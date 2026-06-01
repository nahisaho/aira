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
import { getWorkspaceDir } from '../config/paths.js';
import { readLatestSnapshot, type TraceCell, type TraceSnapshot } from './notebook-trace.js';

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

export interface ValidationReport {
  available: boolean;
  /** Reason when available=false. */
  reason?: string;
  claims: NumericClaim[];
  uncited_claims: NumericClaim[];
  unknown_citations: Array<{ claim: NumericClaim; bad_cell_id: string }>;
  /** v3.4.0 — values cited from cells whose outputs do not contain the value. */
  value_mismatches: ValueMismatch[];
  gates: GateResult[];
  /** Overall pass = every gate passes AND no unknown citations. */
  pass: boolean;
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
  const numRe = /-?\d+(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(outputText)) !== null) {
    const v = parseFloat(m[0]);
    if (Number.isNaN(v)) continue;
    if (Math.abs(v - claimedValue) <= tolerance) return true;
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
    /** v3.4.0 — added 'value_mismatch' (informational signal, not gate). */
    issue: 'uncited' | 'unknown_citation' | 'gate_failed' | 'value_mismatch';
    detail: string;
  }>;
  /** Markdown prompt the agent reads to drive the second pass. */
  repair_prompt: string;
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

  // Collect available cell ids — agent uses these to choose correct citations.
  const snapshot = readLatestSnapshot(projectId);
  const availableCellIds = snapshot
    ? snapshot.cells.filter((c) => c.type === 'code').map((c) => c.id)
    : [];

  // Repair is "needed" when there are blocking issues (uncited / unknown /
  // gate_failed). value_mismatch alone is informational — the agent should
  // still be told but the loop can declare pass=true if those are the only
  // remaining items.
  const blockingViolations = violations.filter(v => v.issue !== 'value_mismatch');
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

  if (valueMismatches.length > 0) {
    lines.push('');
    lines.push(`## Value-presence warnings (${valueMismatches.length}) — informational, not blocking`);
    lines.push('The cited cell\'s outputs do not contain the value you wrote in the report. Either you cited the wrong cell or the value in the report is wrong. Fix if you can, otherwise document the mismatch in Limitations.');
    for (const v of valueMismatches.slice(0, 20)) {
      lines.push(`- ${v.file}: \`${v.claim}\` — ${v.detail}`);
    }
    if (valueMismatches.length > 20) lines.push(`- … +${valueMismatches.length - 20} more`);
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
      gates: [],
      pass: false,
    };
  }

  // Collect claims from report.md + paper.md if present
  const claims: NumericClaim[] = [];
  for (const name of ['report.md', 'paper.md']) {
    const p = path.join(wsDir, name);
    if (fs.existsSync(p)) {
      try { claims.push(...extractNumericClaims(fs.readFileSync(p, 'utf-8'), name)); }
      catch { /* skip read errors */ }
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

  // v3.4.0 — value-presence check (informational). Only meaningful for
  // claim patterns that name a numeric value (metric-assignment / metric-of /
  // p-value / sample-size). For each cited claim, see if the value appears
  // in the cited cell's outputs.
  const value_mismatches: ValueMismatch[] = [];
  for (const c of claims) {
    if (c.cited.length === 0) continue; // no citation → already in uncited
    const parsed = extractClaimValue(c.match);
    if (!parsed) continue;
    for (const cid of c.cited) {
      const cell = cellById.get(cid);
      if (!cell) continue; // already in unknown_citations
      const haystack = `${cell.stdout}\n${cell.text_output}`;
      if (valueAppearsInOutputs(parsed.value, parsed.precision, haystack)) continue;
      value_mismatches.push({
        claim: c,
        cell_id: cid,
        expected: parsed.value,
        precision: parsed.precision,
        tolerance: parsed.precision > 0 ? 0.5 * Math.pow(10, -parsed.precision) : 0,
      });
    }
  }

  const gates: GateResult[] = [
    checkSeedPresence(snapshot),
    checkEnvCapture(wsDir, snapshot),
    checkNoErrorInCited(snapshot.cells, claims),
    checkCitationCoverage(claims),
  ];

  return {
    available: true,
    claims,
    uncited_claims: uncited,
    unknown_citations: unknown,
    value_mismatches,
    gates,
    // value_mismatches are informational; they don't block the overall pass.
    pass: gates.every((g) => g.passed) && unknown.length === 0,
  };
}
