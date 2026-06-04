/**
 * Provenance validator — v3.2.0 Pillars 2 + 3.
 *
 * Reads report.md / paper.md / notebook trace, and reports:
 *   - Pillar 2: numeric claims without [cell:<id>] citations (or with citations
 *     that don't match any cell in the latest trace snapshot).
 *   - Pillar 3: reproducibility gates:
 *       seed_presence    — RNG-using cells without an explicit seed
 *       env_capture      — no `requirements.txt` / `pip freeze` artifact
 *       no_error_in_cited — cells referenced from reports must have empty stderr
 *       citation_coverage — ≥80% of numeric claims are cited
 *
 * Soft mode by default: returns a structured report. Callers decide whether
 * a failed gate blocks a workflow.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getWorkspaceDir, getTraceDir } from '../config/paths.js';
import { readLatestSnapshot, readAllSnapshots, type TraceCell, type TraceSnapshot } from './notebook-trace.js';

// ── Numeric-claim extraction ──────────────────────────────────────────
//
// Detects numbers that look like reportable scientific quantities. Heuristic
// — false positives are OK, the linter only nudges the agent.
//
//  - "= 0.83"             metric assignment
//  - "AUROC of 0.92"      named metric
//  - "(p < 0.001)"        p-value
//  - "(p = 0.034)"
//  - "F1: 0.87"           colon-separated
//  - "mean = 12.3 ± 0.4"  mean with std
//  - "n = 1000"            sample size — included
//
// Excluded by post-filter (see EXCLUSION_PATTERNS below):
//  - DOIs (10.1038/nature12873)
//  - 4-digit years (1900–2100) in citation contexts
//  - section / figure / equation labels (3.1, Fig. 2.5, Eq. (4))
//  - reference-list citation brackets ([Smith et al., 2024])
//
const CLAIM_PATTERNS: Array<{ name: string; re: RegExp }> = [
  // metric = value (with possible ± std)
  { name: 'metric-assignment', re: /\b([A-Z][A-Za-z0-9_-]*)\s*[=:]\s*(-?\d+\.\d+)(\s*±\s*\d+\.\d+)?/g },
  // "X of 0.92" style
  { name: 'metric-of',          re: /\b(AUROC|AUPRC|F1|MAE|RMSE|MSE|R\^?2|accuracy|precision|recall|sensitivity|specificity|loss)\s+(?:of|=)\s+(-?\d+\.\d+)/gi },
  // p-values
  { name: 'p-value',            re: /\bp\s*[<=>]\s*(0?\.\d+)/g },
  // n = 1234 (sample sizes; bare integer with the variable)
  { name: 'sample-size',        re: /\bn\s*=\s*(\d{2,})/g },
];

// v3.3.0 — increased from 200 to 400 chars. Round-9 analysis showed real
// citations are often placed in the same paragraph but separated by table
// rows / inline equations, putting them >200 chars from the claim.
const CITE_NEAR = 400;

const CITE_RE = /\[cell:([A-Za-z0-9_-]{1,64})\]/g;

/**
 * v3.3.0 — exclusion windows (substrings near a candidate claim that mean
 * "this is not a metric"). Each rule returns true if the match should be
 * suppressed.
 */
const EXCLUSION_RULES: Array<{ name: string; test: (full: string, matchIdx: number, matchText: string) => boolean }> = [
  {
    name: 'doi',
    test: (full, idx) => {
      // 50 char lookback for "DOI:" / "doi.org/" / "10.<digits>/"
      const win = full.slice(Math.max(0, idx - 50), idx + 32);
      return /(\bdoi\s*[:=]\s*\d|doi\.org\/|10\.\d{4,9}\/)/i.test(win);
    },
  },
  {
    name: 'reference-citation',
    test: (full, idx) => {
      // Inside a bracketed citation like "(Smith et al., 2024)" or "[1, 2]"
      // Look back for an unclosed parenthesis / bracket with 'et al' / year
      const back = full.slice(Math.max(0, idx - 80), idx);
      const fwd = full.slice(idx, idx + 80);
      // Pattern: "(X et al., 20YY)" enclosing our match
      if (/\(\s*[A-Z][a-zA-ZÀ-ɏ'-]+(?:\s+(?:et\s+al\.|and\s+[A-Z][a-zA-Z]+))?,\s*[^)]*$/.test(back)
          && /^[^()]*\)/.test(fwd)) {
        return true;
      }
      return false;
    },
  },
  {
    name: 'section-or-figure-label',
    test: (full, idx) => {
      // Look back 40 chars for "Section", "Fig.", "Figure", "Table", "Eq."
      const back = full.slice(Math.max(0, idx - 40), idx);
      return /(\b(?:Section|Sec\.|Figure|Fig\.|Table|Tab\.|Equation|Eq\.|Appendix|App\.|Chapter|Ch\.)\s*\(?\s*)$/i.test(back);
    },
  },
  {
    name: 'four-digit-year',
    test: (_full, _idx, matchText) => {
      // Whole match is just a 4-digit number in year range
      const n = parseInt(matchText, 10);
      return !Number.isNaN(n) && /^\d{4}$/.test(matchText) && n >= 1900 && n <= 2100;
    },
  },
];

function shouldExclude(full: string, idx: number, matchText: string): string | null {
  for (const r of EXCLUSION_RULES) {
    if (r.test(full, idx, matchText)) return r.name;
  }
  return null;
}

export interface NumericClaim {
  pattern: string;
  match: string;
  /** byte index in source markdown */
  index: number;
  /** cell ids found within CITE_NEAR chars after the match (may be empty). */
  cited: string[];
  /** filename relative to workspace ('report.md', 'paper.md'). */
  source_file: string;
}

export function extractNumericClaims(markdown: string, sourceFile: string): NumericClaim[] {
  const collected: NumericClaim[] = [];
  for (const { name, re } of CLAIM_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown)) !== null) {
      // v3.3.0 — drop false positives (DOI, references, section labels, years)
      if (shouldExclude(markdown, m.index, m[0])) continue;
      const window = markdown.slice(m.index, m.index + m[0].length + CITE_NEAR);
      const cited: string[] = [];
      let cm: RegExpExecArray | null;
      CITE_RE.lastIndex = 0;
      while ((cm = CITE_RE.exec(window)) !== null) cited.push(cm[1]!);
      collected.push({
        pattern: name,
        match: m[0],
        index: m.index,
        cited,
        source_file: sourceFile,
      });
    }
  }
  // Deduplicate: when multiple patterns match overlapping spans (e.g.
  // metric-assignment and metric-of both fire on "AUROC = 0.83"), keep the
  // earliest-registered pattern's hit and drop later ones whose span overlaps.
  collected.sort((a, b) => a.index - b.index || a.match.length - b.match.length);
  const out: NumericClaim[] = [];
  let lastEnd = -1;
  for (const claim of collected) {
    const end = claim.index + claim.match.length;
    if (claim.index < lastEnd) continue; // overlaps with a prior claim
    out.push(claim);
    lastEnd = end;
  }
  return out;
}

// ── Reproducibility gates ─────────────────────────────────────────────

export type GateName =
  | 'seed_presence'
  | 'env_capture'
  | 'no_error_in_cited'
  | 'citation_coverage';

export interface GateResult {
  name: GateName;
  passed: boolean;
  detail: string;
  /** Affected cell ids / file paths if applicable. */
  offenders?: string[];
}

const RNG_CALL_RE = /\b(np\.random\.|numpy\.random\.|random\.(?!seed)|torch\.(rand|randn|randint|randperm)|tf\.random\.)/;
const SEED_SET_RE = /\b(np\.random\.seed|numpy\.random\.seed|random\.seed|torch\.manual_seed|torch\.cuda\.manual_seed|tf\.random\.set_seed|set_random_seed|np\.random\.default_rng)\s*\(/;

function checkSeedPresence(snapshot: TraceSnapshot): GateResult {
  const offenders: string[] = [];
  for (const cell of snapshot.cells) {
    if (cell.type !== 'code') continue;
    if (RNG_CALL_RE.test(cell.source) && !SEED_SET_RE.test(cell.source)) {
      // also accept seed set in any earlier cell — global RNG state persists
      const earlierHasSeed = snapshot.cells
        .slice(0, snapshot.cells.indexOf(cell))
        .some((c) => c.type === 'code' && SEED_SET_RE.test(c.source));
      if (!earlierHasSeed) offenders.push(cell.id);
    }
  }
  return {
    name: 'seed_presence',
    passed: offenders.length === 0,
    detail: offenders.length === 0
      ? 'All RNG-using cells have a seed set (in-cell or earlier).'
      : `${offenders.length} cell(s) use RNG without a seed being set in scope.`,
    offenders: offenders.length ? offenders : undefined,
  };
}

function checkEnvCapture(workspaceDir: string, snapshot: TraceSnapshot): GateResult {
  // Pass if workspace has requirements.txt OR any cell ran `pip freeze` / `pip list` and stored output
  const hasReqFile = fs.existsSync(path.join(workspaceDir, 'requirements.txt'));
  const hasFreezeCell = snapshot.cells.some((c) =>
    c.type === 'code' && /pip\s+(freeze|list)/i.test(c.source),
  );
  const ok = hasReqFile || hasFreezeCell;
  return {
    name: 'env_capture',
    passed: ok,
    detail: ok
      ? `Environment captured (${hasReqFile ? 'requirements.txt' : 'pip freeze cell'}).`
      : 'No requirements.txt and no `pip freeze`/`pip list` cell found.',
  };
}

function checkNoErrorInCited(
  cells: TraceCell[],
  claims: NumericClaim[],
): GateResult {
  const cellById = new Map(cells.map((c) => [c.id, c]));
  const failingCellIds: Set<string> = new Set();
  for (const claim of claims) {
    for (const cid of claim.cited) {
      const cell = cellById.get(cid);
      if (cell && (cell.has_error || cell.stderr.trim().length > 0)) {
        failingCellIds.add(cid);
      }
    }
  }
  const offenders = Array.from(failingCellIds);
  return {
    name: 'no_error_in_cited',
    passed: offenders.length === 0,
    detail: offenders.length === 0
      ? 'No cited cell shows errors or stderr.'
      : `${offenders.length} cited cell(s) have errors or non-empty stderr.`,
    offenders: offenders.length ? offenders : undefined,
  };
}

function checkCitationCoverage(claims: NumericClaim[], threshold = 0.8): GateResult {
  if (claims.length === 0) {
    return {
      name: 'citation_coverage',
      passed: true,
      detail: 'No numeric claims found in report/paper.',
    };
  }
  const cited = claims.filter((c) => c.cited.length > 0).length;
  const ratio = cited / claims.length;
  return {
    name: 'citation_coverage',
    passed: ratio >= threshold,
    detail: `${cited}/${claims.length} numeric claims cite a cell (${(ratio * 100).toFixed(0)}% ≥ ${threshold * 100}% required).`,
  };
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * v3.4.0 — informational value-mismatch warning.
 * For each cited claim, we extract the numeric value and look for it
 * (precision-aware tolerance) in the cited cell's outputs. Mismatches
 * indicate the citation may point to the wrong cell or have a typo,
 * but they're SOFT signals — there are real cases (multi-step
 * computation, formatting differences) where this fails for legitimate
 * reasons. We surface them in the repair prompt but do NOT fail the
 * overall pass on them.
 */
export interface ValueMismatch {
  claim: NumericClaim;
  /** Cell id the claim cited (the one we checked against). */
  cell_id: string;
  /** Numeric value parsed from the claim text. */
  expected: number;
  /** Decimal precision (number of digits after the dot) of the claimed value. */
  precision: number;
  /** Tolerance used (= 0.5 * 10^-precision). */
  tolerance: number;
}

/**
 * v3.4.2 — figure orphan: a figure file referenced from a report has no
 * cell that produced it (i.e. no cell source mentions writing that file).
 * Informational only — false positives possible (figure produced by an
 * external tool, copied from data/raw/, etc.).
 */
export interface FigureOrphan {
  source_file: string;
  /** The figure path as referenced from report.md / paper.md. */
  figure_path: string;
  /** A short reason — usually "no cell source calls savefig/...('X.png')". */
  reason: string;
}

/**
 * v3.4.2 — informational notice that the report is suspiciously thin
 * (catches cases like Round 10 SCI-073 where the agent could not produce
 * any reportable claim).
 */
export interface ReportThinness {
  source_file: string;
  /** byte length of the file's content */
  size_bytes: number;
  /** number of numeric claims detected */
  claim_count: number;
  /** classification — 'missing' / 'tiny' / 'no_claims' */
  level: 'missing' | 'tiny' | 'no_claims';
}

/**
 * v3.4.9 — paper-size-normalised VM grade. Round 14 telemetry showed a
 * 0.728 correlation between `claims` and `value_mismatches`, meaning longer
 * papers naturally accrue more VMs without lower per-claim accuracy. The
 * ratio and grade let external analysis compare versions fairly.
 *
 * **API-only field — NOT surfaced in the repair prompt.** v3.4.7
 * deliberately hides VM counts from the agent to avoid the perverse loop
 * where the agent optimises for the number. The grade is for the
 * experiment runner / telemetry, not for the agent's decision-making.
 */
export type VmGrade = 'A' | 'B' | 'C' | 'D';

export interface ValidationReport {
  available: boolean;
  /** Reason when available=false. */
  reason?: string;
  claims: NumericClaim[];
  uncited_claims: NumericClaim[];
  unknown_citations: Array<{ claim: NumericClaim; bad_cell_id: string }>;
  /** v3.4.0 — values cited from cells whose outputs do not contain the value. */
  value_mismatches: ValueMismatch[];
  /**
   * v3.4.9 — VM normalised by claim count (= `value_mismatches.length /
   * claims.length`). `0` when `claims.length === 0`. Telemetry only —
   * never shown to the agent.
   */
  vm_ratio: number;
  /**
   * v3.4.9 — letter grade derived from `vm_ratio`:
   * `A` ≤ 0.5, `B` ≤ 1.0, `C` ≤ 2.0, `D` > 2.0. Telemetry only.
   */
  vm_grade: VmGrade;
  /** v3.4.2 — figures referenced from reports but produced by no cell. */
  figure_orphans: FigureOrphan[];
  /** v3.4.2 — informational notice that report.md / paper.md is thin or missing. */
  report_thinness: ReportThinness[];
  gates: GateResult[];
  /** Overall pass = every gate passes AND no unknown citations. */
  pass: boolean;
}

/**
 * v3.4.9 — derive `vm_grade` from `vm_ratio`. Exported so analysis scripts
 * and tests can reuse the exact boundaries. Inputs: `vmCount`, `claimCount`.
 */
export function computeVmRatioAndGrade(vmCount: number, claimCount: number): { vm_ratio: number; vm_grade: VmGrade } {
  if (claimCount <= 0) return { vm_ratio: 0, vm_grade: 'A' };
  const ratio = vmCount / claimCount;
  let grade: VmGrade;
  if (ratio <= 0.5) grade = 'A';
  else if (ratio <= 1.0) grade = 'B';
  else if (ratio <= 2.0) grade = 'C';
  else grade = 'D';
  return { vm_ratio: ratio, vm_grade: grade };
}

// ── v3.4.2 — figure references (Pillar 2) ─────────────────────────────

/**
 * Extract paths under `figures/` referenced from a markdown body. Captures
 * both image syntax (`![alt](figures/x.png)`) and inline text mentions like
 * `Figure 1 (figures/roc.png)` or `[cell:viz-roc] figures/x.png`.
 *
 * Returns deduplicated paths preserving first-occurrence order.
 */
export function extractFigureReferences(markdown: string): string[] {
  const found = new Set<string>();
  const ordered: string[] = [];
  // Match figures/<basename>.<ext> where ext is a known image type.
  const re = /\bfigures\/[A-Za-z0-9_\-./]+\.(?:png|jpg|jpeg|svg|pdf|webp|gif)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const p = m[0];
    if (!found.has(p)) {
      found.add(p);
      ordered.push(p);
    }
  }
  return ordered;
}

/**
 * Check whether any cell source mentions writing the given figure path.
 * Looks for common save calls (`savefig`, `to_image`, `write_image`,
 * `Image.save`, `cv2.imwrite`, `imsave`, `plt.imsave`) referencing the
 * figure path or its basename.
 *
 * v3.4.10 — Round 15 telemetry showed FigOrp avg jumped to 7.2 (worst in 5
 * rounds). Root cause: agents construct paths dynamically
 * (`f"figures/{var}.png"`, `os.path.join("figures", x)`, looped names) so
 * the literal `figures/roc.png` string never appears in any cell's source.
 * The original `pathRe` then missed real producers and flagged false
 * positive orphans. We now run three matchers per cell, all gated on a
 * save call to keep noise down:
 *   1. Literal: cell source contains the full path or basename verbatim.
 *   2. Dynamic template + stem: source contains an `f"figures/…"` or
 *      `os.path.join("figures", …)` template AND the basename stem
 *      (filename without extension) appears somewhere in the source —
 *      catching `name="roc"; plt.savefig(f"figures/{name}.png")`.
 *   3. Runtime echo: the cell's stdout contains the basename, indicating
 *      the path was printed at execution time (a common "Saved: X" pattern).
 * Heuristic — fully variable names (`f"figures/plot_{i}.png"` in a loop
 * with no stem hint) are still missed.
 */
export function figureHasProducerCell(
  figurePath: string,
  cells: TraceCell[],
): boolean {
  const basename = figurePath.split('/').pop() ?? figurePath;
  const basenameNoExt = basename.replace(/\.[^.]+$/, '');
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const saveCallRe = /\b(savefig|to_image|write_image|imsave|imwrite|Image\.save|fig\.write_image|joblib\.dump)\b/;
  const literalPathRe = new RegExp(escape(figurePath) + '|' + escape(basename));
  const dynamicTemplateRe = /f["']figures\/|os\.path\.join\(["']figures["']/;
  // Stem requires at least one char so that pathological basenames like ".png"
  // (basenameNoExt = "") don't degenerate into a regex that matches everything.
  const stemRe = basenameNoExt.length > 0
    ? new RegExp(escape(basenameNoExt), 'i')
    : null;

  for (const c of cells) {
    if (c.type !== 'code') continue;
    if (!saveCallRe.test(c.source)) continue;
    // (1) Literal path or basename in source.
    if (literalPathRe.test(c.source)) return true;
    // (2) Dynamic-path template plus the basename stem somewhere in the source.
    if (stemRe && dynamicTemplateRe.test(c.source) && stemRe.test(c.source)) return true;
    // (3) Runtime echo: the cell printed the basename at execution time.
    if (c.stdout && c.stdout.includes(basename)) return true;
  }
  return false;
}

/**
 * v3.4.0 — extract the principal numeric value from a claim's match text.
 * Returns the first number found (which is the only number for our patterns).
 */
export function extractClaimValue(matchText: string): { value: number; precision: number } | null {
  const m = matchText.match(/-?\d+\.\d+|-?\d+/);
  if (!m) return null;
  const valueStr = m[0];
  const value = parseFloat(valueStr);
  if (Number.isNaN(value)) return null;
  const precision = valueStr.includes('.') ? valueStr.split('.')[1]!.length : 0;
  return { value, precision };
}

/**
 * v3.4.0 — check whether the claimed value appears in the cell's outputs
 * with precision-aware tolerance (0.5 * 10^-precision). E.g. claim "0.83"
 * matches any number in [0.825, 0.835), so a cell that prints "0.8316"
 * counts as a match (it would round to 0.83).
 *
 * For integer claims (no decimal), tolerance is 0 (exact match required).
 */
export function valueAppearsInOutputs(
  claimedValue: number,
  precision: number,
  outputText: string,
): boolean {
  // Tolerance = half a unit at the claim's last decimal place, with a small
  // floating-point epsilon so boundary values (e.g. 0.8355 vs 0.835 at p=3)
  // round in our favour rather than failing due to IEEE-754 representation.
  const tolerance = precision > 0
    ? 0.5 * Math.pow(10, -precision) + 1e-10
    : 0;
  for (const v of extractNumericCandidates(outputText)) {
    if (Math.abs(v - claimedValue) <= tolerance) return true;
  }
  return false;
}

/**
 * v3.4.4 Pillar B — extract numeric candidates from a text fragment, with
 * format normalisation that catches common variants the agent might use:
 *   - "0.8316"   → 0.8316
 *   - "83.16%"   → 83.16 AND 0.8316   (also try the /100 interpretation)
 *   - "8.316e-1" → 0.8316             (scientific notation)
 *   - "8316e-4"  → 0.8316
 *
 * Round 11 telemetry showed agents would frequently write `0.83` in their
 * reports while cells printed `83.0%` or `8.3e-1`; these are semantically
 * the same value but the v3.4.0 numeric regex missed the equivalence.
 */
export function extractNumericCandidates(text: string): number[] {
  const out: number[] = [];
  // Decimal / integer
  const decRe = /-?\d+(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = decRe.exec(text)) !== null) {
    const v = parseFloat(m[0]);
    if (Number.isFinite(v)) out.push(v);
    // Percentage variant: if the next non-space char is '%', also push /100
    const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 2);
    if (/^\s*%/.test(tail)) out.push(v / 100);
  }
  // Scientific notation — JS parseFloat handles "8.316e-1" natively but the
  // simple regex above wouldn't capture the exponent. Match explicitly.
  const sciRe = /-?\d+(?:\.\d+)?[eE][-+]?\d+/g;
  while ((m = sciRe.exec(text)) !== null) {
    const v = parseFloat(m[0]);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

/**
 * v3.4.4 Pillar A — cell-aware value match with last-output bias.
 *
 * The flat regex scan used in v3.4.0 found ANY number anywhere in a cell's
 * combined output. Round 11 telemetry showed this produced an average of
 * 20.1 value_mismatches per experiment — mostly false positives where an
 * intermediate `print()` value happened to mismatch while the cell's real
 * "return" value was correct.
 *
 * v3.4.4 prioritises:
 *   1. text_output  — the concatenation of execute_result + display_data
 *                     text/plain. This is the cell's "final value" — the
 *                     thing a notebook user sees as the cell's answer.
 *   2. last line of stdout — usually the final printed metric.
 *   3. (NEW) stop here. We do NOT fall through to scanning the full stdout,
 *      so intermediate print noise no longer triggers spurious matches.
 *
 * If both priorities miss, the claim is reported as a mismatch.
 */
export function valueAppearsInCellOutputs(
  claimedValue: number,
  precision: number,
  cell: { stdout: string; text_output: string },
): boolean {
  // Priority 1: execute_result / display_data text (high-confidence)
  if (cell.text_output && valueAppearsInOutputs(claimedValue, precision, cell.text_output)) {
    return true;
  }
  // Priority 2: last non-empty line of stdout
  if (cell.stdout) {
    const lines = cell.stdout.replace(/\s+$/, '').split('\n');
    // Walk backwards to skip trailing blank lines defensively.
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!;
      if (line.trim() === '') continue;
      return valueAppearsInOutputs(claimedValue, precision, line);
    }
  }
  return false;
}

/**
 * v3.3.0 Pillar B — second-pass repair payload. Generated from a validation
 * report so the agent can re-process uncited claims without re-deriving
 * which claims are which.
 *
 * Returns:
 *   - structured violations (machine-readable)
 *   - a markdown prompt the agent can act on directly
 *   - the list of available cell ids for context
 */
export interface RepairPayload {
  available: boolean;
  reason?: string;
  needs_repair: boolean;
  /** True when there is nothing to fix. */
  pass: boolean;
  violations: Array<{
    file: string;
    claim: string;
    /**
     * v3.4.0 — added 'value_mismatch' (informational).
     * v3.4.2 — added 'figure_orphan' and 'report_thin' (informational).
     */
    issue: 'uncited' | 'unknown_citation' | 'gate_failed' | 'value_mismatch' | 'figure_orphan' | 'report_thin';
    detail: string;
  }>;
  /** Markdown prompt the agent reads to drive the second pass. */
  repair_prompt: string;
}

/**
 * v3.4.2 Pillar 4 — Auto-postmortem.
 *
 * When the agent's 3 repair iterations did not converge to pass, this
 * generates a structured failure summary that:
 *   - lists the remaining failed gates and their offending cells,
 *   - lists the unresolved uncited / unknown / value-mismatch / figure /
 *     thinness signals,
 *   - includes a snapshot count and the timestamps of the last few
 *     trace snapshots (so the human reviewer can see what was tried),
 *   - is written to `workspace/.trace/postmortem-<ISO>.json` for audit,
 *   - is returned in the response so the agent can paste the summary
 *     into `report.md` Limitations and `paper.md` Limitations.
 */
export interface PostmortemReport {
  available: boolean;
  reason?: string;
  /** ISO timestamp at which the postmortem was generated. */
  generated_at: string;
  /** Where the file was written (workspace-relative). */
  file: string;
  /** Validation report that fed this postmortem. */
  validation: ValidationReport;
  /** Number of trace snapshots captured so far. */
  trace_snapshot_count: number;
  /** Last 5 snapshot timestamps (most recent last). */
  recent_snapshot_timestamps: string[];
  /** Markdown summary suitable for pasting into Limitations. */
  markdown_summary: string;
}

export function buildPostmortemReport(projectId: string): PostmortemReport {
  const report = validateProject(projectId);
  if (!report.available) {
    return {
      available: false,
      reason: report.reason,
      generated_at: new Date().toISOString(),
      file: '',
      validation: report,
      trace_snapshot_count: 0,
      recent_snapshot_timestamps: [],
      markdown_summary: '',
    };
  }

  const snapshots = readAllSnapshots(projectId);
  const recent = snapshots.slice(-5).map((s) => s.timestamp);
  const generated_at = new Date().toISOString();

  // Build the markdown summary
  const md: string[] = [];
  md.push(`## Postmortem (auto-generated ${generated_at})`);
  md.push('');
  md.push('The provenance validator did not reach `pass: true` after the maximum number of repair iterations. The following items remain:');
  md.push('');
  const failedGates = report.gates.filter((g) => !g.passed);
  if (failedGates.length > 0) {
    md.push('**Failed reproducibility gates**');
    for (const g of failedGates) {
      md.push(`- \`${g.name}\` — ${g.detail}${g.offenders ? ` (cells: ${g.offenders.slice(0, 5).join(', ')}${g.offenders.length > 5 ? '…' : ''})` : ''}`);
    }
    md.push('');
  }
  if (report.unknown_citations.length > 0) {
    md.push(`**Unknown citations** (${report.unknown_citations.length})`);
    for (const u of report.unknown_citations.slice(0, 5)) {
      md.push(`- ${u.claim.source_file}: \`${u.claim.match}\` cites \`[cell:${u.bad_cell_id}]\` which does not exist`);
    }
    if (report.unknown_citations.length > 5) md.push(`- … +${report.unknown_citations.length - 5} more`);
    md.push('');
  }
  if (report.uncited_claims.length > 0) {
    md.push(`**Uncited numeric claims** (${report.uncited_claims.length})`);
    for (const c of report.uncited_claims.slice(0, 5)) {
      md.push(`- ${c.source_file}: \`${c.match}\``);
    }
    if (report.uncited_claims.length > 5) md.push(`- … +${report.uncited_claims.length - 5} more`);
    md.push('');
  }
  if (report.value_mismatches.length > 0) {
    md.push(`**Value-presence mismatches** (${report.value_mismatches.length}, informational)`);
    for (const v of report.value_mismatches.slice(0, 5)) {
      md.push(`- ${v.claim.source_file}: \`${v.claim.match}\` — value not found in [cell:${v.cell_id}]`);
    }
    if (report.value_mismatches.length > 5) md.push(`- … +${report.value_mismatches.length - 5} more`);
    md.push('');
  }
  if (report.figure_orphans.length > 0) {
    md.push(`**Figure orphans** (${report.figure_orphans.length}, informational)`);
    for (const f of report.figure_orphans.slice(0, 5)) {
      md.push(`- ${f.source_file}: \`${f.figure_path}\` has no producer cell`);
    }
    if (report.figure_orphans.length > 5) md.push(`- … +${report.figure_orphans.length - 5} more`);
    md.push('');
  }
  if (report.report_thinness.length > 0) {
    md.push('**Report thinness** (urgent)');
    for (const t of report.report_thinness) {
      md.push(`- ${t.source_file}: ${t.level} (${t.size_bytes} bytes, ${t.claim_count} claims)`);
    }
    md.push('');
  }
  md.push(`Trace snapshots captured: **${snapshots.length}**.`);
  if (recent.length > 0) {
    md.push(`Recent snapshots: ${recent.join(', ')}`);
  }
  md.push('');
  md.push('See `workspace/.trace/execution-trace.jsonl` for the full audit log.');
  const markdown_summary = md.join('\n');

  // Write the structured file
  let writtenPath = '';
  try {
    const traceDir = getTraceDir(projectId);
    fs.mkdirSync(traceDir, { recursive: true });
    const safeStamp = generated_at.replace(/[:.]/g, '-');
    const filename = `postmortem-${safeStamp}.json`;
    writtenPath = path.join(traceDir, filename);
    const payload = {
      generated_at,
      validation: report,
      trace_snapshot_count: snapshots.length,
      recent_snapshot_timestamps: recent,
      markdown_summary,
    };
    fs.writeFileSync(writtenPath, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    // Best-effort; return the report even if the write failed.
    console.warn('[postmortem] failed to write file:', (err as Error).message);
  }

  return {
    available: true,
    generated_at,
    file: writtenPath ? path.relative(getWorkspaceDir(projectId), writtenPath) : '',
    validation: report,
    trace_snapshot_count: snapshots.length,
    recent_snapshot_timestamps: recent,
    markdown_summary,
  };
}

export function buildRepairPayload(projectId: string): RepairPayload {
  const report = validateProject(projectId);
  if (!report.available) {
    return {
      available: false,
      reason: report.reason,
      needs_repair: false,
      pass: false,
      violations: [],
      repair_prompt: '',
    };
  }

  const violations: RepairPayload['violations'] = [];

  for (const c of report.uncited_claims) {
    violations.push({
      file: c.source_file,
      claim: c.match,
      issue: 'uncited',
      detail: 'No [cell:<id>] citation found within 400 chars after this claim.',
    });
  }
  for (const u of report.unknown_citations) {
    violations.push({
      file: u.claim.source_file,
      claim: u.claim.match,
      issue: 'unknown_citation',
      detail: `Citation [cell:${u.bad_cell_id}] does not match any cell in the latest notebook trace.`,
    });
  }
  for (const g of report.gates) {
    if (!g.passed) {
      violations.push({
        file: '(notebook)',
        claim: g.name,
        issue: 'gate_failed',
        detail: g.detail,
      });
    }
  }
  // v3.4.0 — value-presence mismatches (informational; do not block pass).
  // Still surfaced in the prompt so the agent can correct typos or re-aim
  // citations at the right cells.
  for (const v of report.value_mismatches) {
    violations.push({
      file: v.claim.source_file,
      claim: v.claim.match,
      issue: 'value_mismatch',
      detail: `Value ${v.expected} is not present in cell [cell:${v.cell_id}] outputs (tolerance ±${v.tolerance}). Either fix the citation to point at the cell that actually produced ${v.expected}, or correct the value in the report.`,
    });
  }
  // v3.4.2 — figure orphans (informational).
  for (const f of report.figure_orphans) {
    violations.push({
      file: f.source_file,
      claim: f.figure_path,
      issue: 'figure_orphan',
      detail: f.reason + ' Add the cell that produces this figure (e.g. `plt.savefig("' + f.figure_path + '")`) or remove the reference if the figure is no longer used.',
    });
  }
  // v3.4.2 — report thinness (informational, catches SCI-073-style cases).
  for (const t of report.report_thinness) {
    const detailMap = {
      missing: `${t.source_file} is missing entirely. Write at least an Abstract / Methods / Results / Discussion skeleton before calling /validate.`,
      tiny: `${t.source_file} is only ${t.size_bytes} bytes (${t.claim_count} claims). It probably lacks an Abstract / Methods / Results / Discussion. Expand the content before delivering.`,
      no_claims: `${t.source_file} has ${t.size_bytes} bytes but 0 numeric claims. A scientific report should contain reportable metrics — verify you actually executed the analysis cells and that the values made it into the report.`,
    } as const;
    violations.push({
      file: t.source_file,
      claim: `(thinness: ${t.level})`,
      issue: 'report_thin',
      detail: detailMap[t.level],
    });
  }

  // Collect available cell ids — agent uses these to choose correct citations.
  const snapshot = readLatestSnapshot(projectId);
  const availableCellIds = snapshot
    ? snapshot.cells.filter((c) => c.type === 'code').map((c) => c.id)
    : [];

  // Repair is "needed" when there are blocking issues (uncited / unknown /
  // gate_failed). v3.4.0/v3.4.2 informational signals (value_mismatch /
  // figure_orphan / report_thin) are surfaced in the prompt but don't
  // by themselves keep the agent in the loop — declaring pass=true is OK
  // when only informational items remain.
  const informationalIssues = new Set(['value_mismatch', 'figure_orphan', 'report_thin']);
  const blockingViolations = violations.filter(v => !informationalIssues.has(v.issue));
  const needsRepair = blockingViolations.length > 0;
  const repair_prompt = (violations.length > 0)
    ? formatRepairPrompt(violations, availableCellIds)
    : '';

  return {
    available: true,
    needs_repair: needsRepair,
    pass: !needsRepair,
    violations,
    repair_prompt,
  };
}

/**
 * v3.4.0 — Single-batch repair prompt.
 *
 * Round 10 telemetry showed agents average 1.10 repair iterations and most
 * failures are concentrated in the first call. The earlier prompt structured
 * fixes as "loop until pass" with per-iteration overhead — agents would
 * sometimes re-read the prompt and re-derive analysis. The new prompt
 * **insists on a single pass**: apply EVERY listed fix before calling
 * /validate again. Sections are flat and dense; remediation hints sit
 * inline with the offending row, not as bulky aside.
 */
function formatRepairPrompt(
  violations: RepairPayload['violations'],
  availableCellIds: string[],
): string {
  const uncited = violations.filter((v) => v.issue === 'uncited');
  const unknown = violations.filter((v) => v.issue === 'unknown_citation');
  const gates = violations.filter((v) => v.issue === 'gate_failed');
  const valueMismatches = violations.filter((v) => v.issue === 'value_mismatch');
  const figureOrphans = violations.filter((v) => v.issue === 'figure_orphan');
  const thinness = violations.filter((v) => v.issue === 'report_thin');

  const lines: string[] = [];
  lines.push('# Provenance Repair — Apply ALL Fixes in ONE Pass');
  lines.push('');
  lines.push('**Do NOT call `/validate` again until you have applied every fix below.** Repair loops are budgeted; iterating on subsets wastes the agent\'s turn count and time. Walk the entire list once, then re-validate.');

  if (gates.length > 0) {
    lines.push('');
    lines.push(`## Failed reproducibility gates (${gates.length}) — fix first`);
    for (const v of gates) {
      const hint = (() => {
        switch (v.claim) {
          case 'seed_presence':   return 'Execute the pre-seeded `[cell:aira-seed]` cell, or add `np.random.seed(42)` to an early cell.';
          case 'env_capture':     return 'Execute the pre-seeded `[cell:aira-env]` cell (runs `!pip freeze > requirements.txt`).';
          case 'no_error_in_cited': return 'Fix the broken cell so its output is clean, OR repoint the citation to a different cell.';
          case 'citation_coverage': return 'Append `[cell:<id>]` to every uncited claim below in this same pass.';
          default: return '';
        }
      })();
      lines.push(`- **${v.claim}**: ${v.detail}${hint ? `  →  ${hint}` : ''}`);
    }
  }

  if (uncited.length > 0) {
    lines.push('');
    lines.push(`## Uncited claims (${uncited.length}) — append \`[cell:<id>]\` to each`);
    for (const v of uncited.slice(0, 40)) {
      lines.push(`- ${v.file}: \`${v.claim}\``);
    }
    if (uncited.length > 40) lines.push(`- … +${uncited.length - 40} more (apply the same pattern)`);
  }

  if (unknown.length > 0) {
    lines.push('');
    lines.push(`## Unknown citations (${unknown.length}) — bad cell id`);
    for (const v of unknown.slice(0, 30)) {
      lines.push(`- ${v.file}: \`${v.claim}\` — ${v.detail}`);
    }
  }

  // v3.4.7 — VM as spot-check examples, NOT a count metric.
  //
  // Round 13 telemetry showed the previous "Value-presence warnings (N)"
  // header triggered a perverse incentive loop: agents tried to minimise N
  // by adding citations / re-running cells, which introduced stochastic
  // drift and inflated VM further. We now show only the top 3 examples,
  // hide the count, and explicitly tell the agent not to chase the array.
  if (valueMismatches.length > 0) {
    lines.push('');
    lines.push('## Value-presence spot-check (sampled examples — do NOT chase a count)');
    lines.push('A few cited values were not found in their cited cell\'s outputs. **Verify only the specific (claim, cell) pairs listed below**; the full count is intentionally not shown because optimising for it leads to spurious re-runs and worse outputs. Fix what looks like a clear typo or wrong cell-id; if a value naturally varies on re-run (bootstrap CI, stochastic models), document it in Limitations and move on. Spending repair iterations to drive this list to empty is wasteful.');
    for (const v of valueMismatches.slice(0, 3)) {
      lines.push(`- ${v.file}: \`${v.claim}\` — ${v.detail}`);
    }
  }

  if (figureOrphans.length > 0) {
    lines.push('');
    lines.push(`## Figure orphans (${figureOrphans.length}) — informational`);
    lines.push('These figure paths are referenced from your report but no cell appears to produce them.');
    lines.push('**Fix**: For each orphan, ensure the cell that generates it contains an explicit `plt.savefig("figures/exact_filename.png")` call with the literal path (not an f-string or variable). Alternatively, remove the figure reference from paper.md if the figure is not needed.');
    for (const f of figureOrphans.slice(0, 20)) {
      lines.push(`- ${f.file}: \`${f.claim}\``);
    }
    if (figureOrphans.length > 20) lines.push(`- … +${figureOrphans.length - 20} more`);
  }

  if (thinness.length > 0) {
    lines.push('');
    lines.push(`## Report thinness (${thinness.length}) — informational, urgent`);
    lines.push('Your report is missing or suspiciously short. **Most repair iterations are wasted on these cases — fix this before anything else.**');
    for (const t of thinness) {
      lines.push(`- ${t.file}: ${t.detail}`);
    }
  }

  if (availableCellIds.length > 0) {
    lines.push('');
    lines.push('## Available cell ids (from the latest snapshot)');
    lines.push('```');
    lines.push(availableCellIds.slice(0, 50).join('\n'));
    if (availableCellIds.length > 50) lines.push(`… +${availableCellIds.length - 50} more`);
    lines.push('```');
  }

  lines.push('');
  lines.push('Once every fix above is applied to your files (`report.md` / `paper.md`) and re-executed cells (if any), call `POST /api/projects/:id/validate`. Aim for `pass: true` on the next attempt.');

  return lines.join('\n');
}

export function validateProject(projectId: string): ValidationReport {
  const wsDir = getWorkspaceDir(projectId);
  const snapshot = readLatestSnapshot(projectId);
  if (!snapshot) {
    return {
      available: false,
      reason: 'No trace snapshot — run at least one agent turn first.',
      claims: [],
      uncited_claims: [],
      unknown_citations: [],
      value_mismatches: [],
      vm_ratio: 0,
      vm_grade: 'A',
      figure_orphans: [],
      report_thinness: [],
      gates: [],
      pass: false,
    };
  }

  // Collect claims from report.md + paper.md if present.
  // Also accumulate the raw text per file for figure-reference extraction and
  // thinness detection below.
  const claims: NumericClaim[] = [];
  const reportTexts: Array<{ file: string; text: string }> = [];
  for (const name of ['report.md', 'paper.md']) {
    const p = path.join(wsDir, name);
    if (fs.existsSync(p)) {
      try {
        const text = fs.readFileSync(p, 'utf-8');
        reportTexts.push({ file: name, text });
        claims.push(...extractNumericClaims(text, name));
      } catch { /* skip read errors */ }
    } else {
      // File missing — recorded as 'missing' in report_thinness below.
      reportTexts.push({ file: name, text: '' });
    }
  }

  const cellIds = new Set(snapshot.cells.map((c) => c.id));
  const cellById = new Map(snapshot.cells.map((c) => [c.id, c]));
  const uncited = claims.filter((c) => c.cited.length === 0);
  const unknown: ValidationReport['unknown_citations'] = [];
  for (const c of claims) {
    for (const cid of c.cited) {
      if (!cellIds.has(cid)) unknown.push({ claim: c, bad_cell_id: cid });
    }
  }

  // v3.4.0/v3.4.4 — value-presence check (informational).
  // v3.4.4 uses cell-aware matching with last-output bias so intermediate
  // print() noise no longer generates false positives.
  const value_mismatches: ValueMismatch[] = [];
  for (const c of claims) {
    if (c.cited.length === 0) continue; // no citation → already in uncited
    const parsed = extractClaimValue(c.match);
    if (!parsed) continue;
    for (const cid of c.cited) {
      const cell = cellById.get(cid);
      if (!cell) continue; // already in unknown_citations
      if (valueAppearsInCellOutputs(parsed.value, parsed.precision, cell)) continue;
      value_mismatches.push({
        claim: c,
        cell_id: cid,
        expected: parsed.value,
        precision: parsed.precision,
        tolerance: parsed.precision > 0 ? 0.5 * Math.pow(10, -parsed.precision) : 0,
      });
    }
  }

  // v3.4.2 Pillar 2 — figure provenance (informational).
  const figure_orphans: FigureOrphan[] = [];
  for (const { file, text } of reportTexts) {
    if (!text) continue;
    for (const figPath of extractFigureReferences(text)) {
      if (!figureHasProducerCell(figPath, snapshot.cells)) {
        figure_orphans.push({
          source_file: file,
          figure_path: figPath,
          reason: 'No cell source calls savefig / to_image / write_image / imsave with this path.',
        });
      }
    }
  }

  // v3.4.2 — thinness detection (catches Round-10 SCI-073-style failures).
  const report_thinness: ReportThinness[] = [];
  for (const { file, text } of reportTexts) {
    if (text.length === 0) {
      report_thinness.push({ source_file: file, size_bytes: 0, claim_count: 0, level: 'missing' });
    } else {
      const claimCount = claims.filter((c) => c.source_file === file).length;
      if (text.length < 800) {
        report_thinness.push({ source_file: file, size_bytes: text.length, claim_count: claimCount, level: 'tiny' });
      } else if (claimCount === 0) {
        report_thinness.push({ source_file: file, size_bytes: text.length, claim_count: 0, level: 'no_claims' });
      }
    }
  }

  const gates: GateResult[] = [
    checkSeedPresence(snapshot),
    checkEnvCapture(wsDir, snapshot),
    checkNoErrorInCited(snapshot.cells, claims),
    checkCitationCoverage(claims),
  ];

  const { vm_ratio, vm_grade } = computeVmRatioAndGrade(value_mismatches.length, claims.length);

  return {
    available: true,
    claims,
    uncited_claims: uncited,
    unknown_citations: unknown,
    value_mismatches,
    vm_ratio,
    vm_grade,
    figure_orphans,
    report_thinness,
    gates,
    // value_mismatches / figure_orphans / report_thinness are informational;
    // they don't block the overall pass.
    pass: gates.every((g) => g.passed) && unknown.length === 0,
  };
}
