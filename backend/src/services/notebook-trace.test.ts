import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  extractCells,
  captureSnapshot,
  readLatestSnapshot,
  readAllSnapshots,
  resetEnvHashCacheForTesting,
} from './notebook-trace.js';
import { setBaseDir, getBaseDir, getWorkspaceDir, getTracePath } from '../config/paths.js';

const PROJECT_ID = '00000000-0000-0000-0000-000000000aaa';

describe('notebook-trace extractCells', () => {
  it('returns [] for missing cells', () => {
    expect(extractCells({})).toEqual([]);
    expect(extractCells({ cells: [] })).toEqual([]);
  });

  it('synthesizes id when nbformat 4.4 cell has no id field', () => {
    const cells = extractCells({
      cells: [{ cell_type: 'code', source: "print('hi')" }],
    });
    expect(cells).toHaveLength(1);
    expect(cells[0]!.id).toMatch(/^[0-9a-f]{12}$/); // synthesized
  });

  it('preserves nbformat 4.5+ cell id', () => {
    const cells = extractCells({
      cells: [{ id: 'abc12345-stable', cell_type: 'code', source: '1+1' }],
    });
    expect(cells[0]!.id).toBe('abc12345-stable');
  });

  it('joins array-of-string source into a single string', () => {
    const cells = extractCells({
      cells: [{ cell_type: 'code', source: ['import numpy\n', 'x = 1'] }],
    });
    expect(cells[0]!.source).toBe('import numpy\nx = 1');
  });

  it('captures stdout / stderr from stream outputs', () => {
    const cells = extractCells({
      cells: [{
        cell_type: 'code',
        source: 'print(1); import sys; print("E", file=sys.stderr)',
        outputs: [
          { output_type: 'stream', name: 'stdout', text: '1\n' },
          { output_type: 'stream', name: 'stderr', text: 'E\n' },
        ],
      }],
    });
    expect(cells[0]!.stdout).toBe('1\n');
    expect(cells[0]!.stderr).toBe('E\n');
    expect(cells[0]!.has_error).toBe(false);
  });

  it('flags has_error when output_type is error', () => {
    const cells = extractCells({
      cells: [{
        cell_type: 'code',
        source: 'raise ValueError("boom")',
        outputs: [{
          output_type: 'error',
          ename: 'ValueError',
          evalue: 'boom',
          traceback: ['  File "<ipython>", line 1', 'ValueError: boom'],
        }],
      }],
    });
    expect(cells[0]!.has_error).toBe(true);
    expect(cells[0]!.stderr).toContain('[ValueError]');
    expect(cells[0]!.stderr).toContain('boom');
  });

  it('flags has_image when display_data has image/png', () => {
    const cells = extractCells({
      cells: [{
        cell_type: 'code',
        source: 'plt.plot(...)',
        outputs: [{
          output_type: 'display_data',
          data: { 'image/png': 'base64data', 'text/plain': '<Figure>' },
        }],
      }],
    });
    expect(cells[0]!.has_image).toBe(true);
    expect(cells[0]!.text_output).toContain('<Figure>');
  });

  it('truncates very long output', () => {
    const huge = 'x'.repeat(10_000);
    const cells = extractCells({
      cells: [{
        cell_type: 'code',
        source: 'noop',
        outputs: [{ output_type: 'stream', name: 'stdout', text: huge }],
      }],
    });
    expect(cells[0]!.stdout.length).toBeLessThanOrEqual(4_100);
    expect(cells[0]!.stdout).toContain('[truncated]');
  });
});

describe('notebook-trace capture / read snapshots', () => {
  let tmpDir: string;
  let originalBaseDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-trace-'));
    originalBaseDir = getBaseDir();
    setBaseDir(tmpDir);
    resetEnvHashCacheForTesting();

    // Set up a notebook for the project
    const wsDir = getWorkspaceDir(PROJECT_ID);
    fs.mkdirSync(wsDir, { recursive: true });
    const nb = {
      cells: [
        { id: 'cell-1', cell_type: 'code', source: 'x = 42',
          execution_count: 1, outputs: [] },
        { id: 'cell-2', cell_type: 'code', source: 'print(x)',
          execution_count: 2, outputs: [
            { output_type: 'stream', name: 'stdout', text: '42\n' },
          ]},
      ],
      metadata: {}, nbformat: 4, nbformat_minor: 5,
    };
    fs.writeFileSync(path.join(wsDir, 'notebook.ipynb'), JSON.stringify(nb));
  });

  afterEach(() => {
    setBaseDir(originalBaseDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when notebook does not exist', () => {
    const wsDir = getWorkspaceDir(PROJECT_ID);
    fs.unlinkSync(path.join(wsDir, 'notebook.ipynb'));
    expect(captureSnapshot(PROJECT_ID)).toBeNull();
  });

  it('captures cells and writes JSONL', () => {
    const snap = captureSnapshot(PROJECT_ID, 'run-xyz');
    expect(snap).not.toBeNull();
    expect(snap!.cells).toHaveLength(2);
    expect(snap!.cells[0]!.id).toBe('cell-1');
    expect(snap!.cells[1]!.stdout).toBe('42\n');
    expect(snap!.run_id).toBe('run-xyz');
    expect(snap!.env_hash).toMatch(/^sha256:/);

    const tracePath = getTracePath(PROJECT_ID);
    expect(fs.existsSync(tracePath)).toBe(true);
    const content = fs.readFileSync(tracePath, 'utf-8');
    expect(content.trim().split('\n')).toHaveLength(1);
  });

  it('appends additional snapshots without overwriting', () => {
    captureSnapshot(PROJECT_ID, 'run-1');
    captureSnapshot(PROJECT_ID, 'run-2');
    captureSnapshot(PROJECT_ID, 'run-3');

    const all = readAllSnapshots(PROJECT_ID);
    expect(all).toHaveLength(3);
    expect(all.map(s => s.run_id)).toEqual(['run-1', 'run-2', 'run-3']);
  });

  it('readLatestSnapshot returns the most recent', () => {
    captureSnapshot(PROJECT_ID, 'old');
    captureSnapshot(PROJECT_ID, 'newest');

    const latest = readLatestSnapshot(PROJECT_ID);
    expect(latest?.run_id).toBe('newest');
  });

  it('gracefully handles malformed notebook JSON', () => {
    const nbPath = path.join(getWorkspaceDir(PROJECT_ID), 'notebook.ipynb');
    fs.writeFileSync(nbPath, '{ this is not json');
    expect(captureSnapshot(PROJECT_ID)).toBeNull();
  });
});
