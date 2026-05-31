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
// Excluded by design (too noisy):
//  - integer years (2024)
//  - section numbers (1.1)
//  - URLs, equation indices like (1), (2)
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

const CITE_NEAR = 200; // chars after a claim to scan for a citation
const CITE_RE = /\[cell:([A-Za-z0-9_-]{1,64})\]/g;

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
