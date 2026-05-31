/**
 * Notebook execution-trace capture (v3.2.0 — Pillar 1, Computational Provenance).
 *
 * After each agent run, snapshot the project's notebook.ipynb into an
 * append-only JSONL log under workspace/.trace/execution-trace.jsonl. Each
 * snapshot records cell-by-cell source, execution count, outputs, stdout /
 * stderr, error presence, and a hash of the Python environment.
 *
 * Why: agent-generated reports cite numbers that "look computed" but the
 * computational provenance is opaque. With per-run snapshots we can:
 *   - Verify [cell:<id>] citations in report.md point to cells that actually
 *     ran and produced the cited value.
 *   - Detect cells with stderr / error outputs that the agent might have
 *     ignored.
 *   - Audit env_hash to confirm the same Python environment was used across
 *     turns.
 *
 * The trace is *not* the source of truth (the notebook is); it is an audit
 * log. Linters and the validator route consume the *latest* snapshot.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { getNotebookPath, getTraceDir, getTracePath } from '../config/paths.js';

// ── Env hash caching ──────────────────────────────────────────────────
// `pip freeze` is slow (~300-600ms). Cache for the lifetime of the AIRA
// process; reset only on container restart, which is when env actually
// changes for our setup.
let _envHashCache: string | null = null;

export function computeEnvHash(): string {
  if (_envHashCache) return _envHashCache;
  try {
    const r = spawnSync('python3', ['-m', 'pip', 'freeze'], {
      encoding: 'utf-8',
      timeout: 10_000,
    });
    if (r.status === 0 && r.stdout) {
      const hash = crypto.createHash('sha256').update(r.stdout).digest('hex');
      _envHashCache = `sha256:${hash}`;
      return _envHashCache;
    }
  } catch { /* fall through */ }
  _envHashCache = 'sha256:unknown';
  return _envHashCache;
}

/** Reset cached env hash — only for tests. */
export function resetEnvHashCacheForTesting(): void {
  _envHashCache = null;
}

// ── Cell extraction ───────────────────────────────────────────────────

export interface TraceCell {
  /** Stable id (from nbformat 4.5+ `cell.id`) or synthesized sha256-prefix. */
  id: string;
  type: 'code' | 'markdown' | 'raw';
  exec_count: number | null;
  source: string;
  /** Concatenated stdout from stream outputs (truncated). */
  stdout: string;
  /** Concatenated stderr from stream outputs (truncated). */
  stderr: string;
  /** True if any output of type "error" is present. */
  has_error: boolean;
  /** True if any image output is present (png / jpeg / svg). */
  has_image: boolean;
  /** Best-effort text representation of execute_result / display_data text. */
  text_output: string;
}

export interface TraceSnapshot {
  /** ISO timestamp. */
  timestamp: string;
  /** Run id if provided by the caller. */
  run_id?: string;
  /** Hash of `pip freeze` at capture time. */
  env_hash: string;
  /** Cell snapshots in notebook order. */
  cells: TraceCell[];
}

const MAX_TEXT = 4_000; // bytes per output stream; keeps trace lines bounded

function truncate(s: string): string {
  return s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) + '\n…[truncated]' : s;
}

function sourceToString(source: unknown): string {
  if (typeof source === 'string') return source;
  if (Array.isArray(source)) return source.join('');
  return '';
}

function synthesizeCellId(source: string, index: number): string {
  const sha = crypto.createHash('sha256').update(`${index}:${source}`).digest('hex');
  return sha.slice(0, 12);
}

interface NbCell {
  id?: string;
  cell_type: 'code' | 'markdown' | 'raw';
  source?: string | string[];
  execution_count?: number | null;
  outputs?: Array<{
    output_type: string;
    name?: string;
    text?: string | string[];
    data?: Record<string, unknown>;
    ename?: string;
    evalue?: string;
    traceback?: string[];
  }>;
}

export function extractCells(nbJson: { cells?: NbCell[] }): TraceCell[] {
  const cells = Array.isArray(nbJson.cells) ? nbJson.cells : [];
  return cells.map((cell, idx) => {
    const source = sourceToString(cell.source);
    const out: TraceCell = {
      id: cell.id ?? synthesizeCellId(source, idx),
      type: cell.cell_type,
      exec_count: cell.execution_count ?? null,
      source,
      stdout: '',
      stderr: '',
      has_error: false,
      has_image: false,
      text_output: '',
    };
    if (cell.cell_type !== 'code' || !Array.isArray(cell.outputs)) return out;

    const stdoutParts: string[] = [];
    const stderrParts: string[] = [];
    const textParts: string[] = [];

    for (const o of cell.outputs) {
      switch (o.output_type) {
        case 'stream':
          if (o.name === 'stderr') stderrParts.push(sourceToString(o.text));
          else stdoutParts.push(sourceToString(o.text));
          break;
        case 'error':
          out.has_error = true;
          stderrParts.push(
            `[${o.ename ?? 'Error'}] ${o.evalue ?? ''}\n${(o.traceback ?? []).join('\n')}`,
          );
          break;
        case 'display_data':
        case 'execute_result': {
          const data = o.data ?? {};
          if ('image/png' in data || 'image/jpeg' in data || 'image/svg+xml' in data) {
            out.has_image = true;
          }
          const txt = (data['text/plain'] as string | string[] | undefined);
          if (txt) textParts.push(sourceToString(txt));
          break;
        }
      }
    }

    out.stdout = truncate(stdoutParts.join(''));
    out.stderr = truncate(stderrParts.join(''));
    out.text_output = truncate(textParts.join('\n'));
    return out;
  });
}

// ── Snapshot capture ──────────────────────────────────────────────────

/**
 * Read the project's notebook and append a snapshot to its trace log.
 * No-op (returns null) when the notebook does not exist yet.
 */
export function captureSnapshot(projectId: string, runId?: string): TraceSnapshot | null {
  const nbPath = getNotebookPath(projectId);
  if (!fs.existsSync(nbPath)) return null;

  let raw: string;
  try { raw = fs.readFileSync(nbPath, 'utf-8'); }
  catch { return null; }

  let nb: { cells?: NbCell[] };
  try { nb = JSON.parse(raw) as { cells?: NbCell[] }; }
  catch {
    console.warn(`[notebook-trace] malformed notebook for project ${projectId.slice(0, 8)}`);
    return null;
  }

  const snapshot: TraceSnapshot = {
    timestamp: new Date().toISOString(),
    run_id: runId,
    env_hash: computeEnvHash(),
    cells: extractCells(nb),
  };

  const dir = getTraceDir(projectId);
  fs.mkdirSync(dir, { recursive: true });
  const tracePath = getTracePath(projectId);
  fs.appendFileSync(tracePath, JSON.stringify(snapshot) + '\n');
  return snapshot;
}

/**
 * Return the most recent snapshot (last JSONL line). Used by the citation
 * linter and frontend trace viewer.
 */
export function readLatestSnapshot(projectId: string): TraceSnapshot | null {
  const tracePath = getTracePath(projectId);
  if (!fs.existsSync(tracePath)) return null;

  // The file is append-only and usually small (<100 snapshots). Read fully.
  const content = fs.readFileSync(tracePath, 'utf-8');
  const lines = content.trimEnd().split('\n').filter(Boolean);
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1]!) as TraceSnapshot;
  } catch { return null; }
}

/** Read all snapshots (for the audit log viewer). */
export function readAllSnapshots(projectId: string): TraceSnapshot[] {
  const tracePath = getTracePath(projectId);
  if (!fs.existsSync(tracePath)) return [];
  const content = fs.readFileSync(tracePath, 'utf-8');
  return content
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) as TraceSnapshot; }
      catch { return null; }
    })
    .filter((s): s is TraceSnapshot => s !== null);
}
