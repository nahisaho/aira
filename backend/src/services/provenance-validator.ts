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

export interface ValidationReport {
  available: boolean;
  /** Reason when available=false. */
  reason?: string;
  claims: NumericClaim[];
  uncited_claims: NumericClaim[];
  unknown_citations: Array<{ claim: NumericClaim; bad_cell_id: string }>;
  gates: GateResult[];
  /** Overall pass = every gate passes AND no unknown citations. */
  pass: boolean;
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
    issue: 'uncited' | 'unknown_citation' | 'gate_failed';
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

  // Collect available cell ids — agent uses these to choose correct citations.
  const snapshot = readLatestSnapshot(projectId);
  const availableCellIds = snapshot
    ? snapshot.cells.filter((c) => c.type === 'code').map((c) => c.id)
    : [];

  const needsRepair = violations.length > 0;
  const repair_prompt = needsRepair
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

function formatRepairPrompt(
  violations: RepairPayload['violations'],
  availableCellIds: string[],
): string {
  const uncited = violations.filter((v) => v.issue === 'uncited');
  const unknown = violations.filter((v) => v.issue === 'unknown_citation');
  const gates = violations.filter((v) => v.issue === 'gate_failed');

  const sections: string[] = [];
  sections.push('# Provenance Validator — Second-Pass Repair');
  sections.push('');
  sections.push('Your report failed at least one provenance check. Apply the fixes below, then call `POST /api/projects/:id/validate` again. Loop until all gates pass.');

  if (uncited.length > 0) {
    sections.push('');
    sections.push(`## ${uncited.length} uncited numeric claim(s) — add a [cell:<id>] reference`);
    sections.push('');
    for (const v of uncited.slice(0, 30)) {
      sections.push(`- ${v.file}: \`${v.claim}\`  → append the cell id that produced this value, e.g. \`${v.claim} [cell:<id>]\``);
    }
    if (uncited.length > 30) sections.push(`- … +${uncited.length - 30} more`);
  }

  if (unknown.length > 0) {
    sections.push('');
    sections.push(`## ${unknown.length} unknown citation(s) — fix the cell id`);
    sections.push('');
    for (const v of unknown.slice(0, 30)) {
      sections.push(`- ${v.file}: \`${v.claim}\` — ${v.detail}`);
    }
  }

  if (gates.length > 0) {
    sections.push('');
    sections.push(`## ${gates.length} failed reproducibility gate(s)`);
    sections.push('');
    for (const v of gates) {
      sections.push(`- **${v.claim}**: ${v.detail}`);
      switch (v.claim) {
        case 'seed_presence':
          sections.push('  - Add an early cell with `np.random.seed(42)` / `random.seed(42)` / `torch.manual_seed(42)` (match the libraries you use).');
          break;
        case 'env_capture':
          sections.push('  - Add a cell that runs `!pip freeze > requirements.txt` and execute it.');
          break;
        case 'no_error_in_cited':
          sections.push('  - Either fix the broken cell so it produces clean output, or repoint the citation to a different cell that actually produced the value.');
          break;
        case 'citation_coverage':
          sections.push('  - Walk through each uncited claim above and attach a `[cell:<id>]` reference.');
          break;
      }
    }
  }

  if (availableCellIds.length > 0) {
    sections.push('');
    sections.push('## Available cell ids (from the latest notebook snapshot)');
    sections.push('');
    sections.push('```');
    sections.push(availableCellIds.slice(0, 50).join('\n'));
    if (availableCellIds.length > 50) sections.push(`… +${availableCellIds.length - 50} more`);
    sections.push('```');
  }

  return sections.join('\n');
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
  const uncited = claims.filter((c) => c.cited.length === 0);
  const unknown: ValidationReport['unknown_citations'] = [];
  for (const c of claims) {
    for (const cid of c.cited) {
      if (!cellIds.has(cid)) unknown.push({ claim: c, bad_cell_id: cid });
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
    gates,
    pass: gates.every((g) => g.passed) && unknown.length === 0,
  };
}
