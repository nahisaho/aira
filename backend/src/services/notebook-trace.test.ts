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

  // v3.4.8 — readLatestSnapshot resiliency (Direction 2: API 0/4 fix)
  describe('readLatestSnapshot resiliency (v3.4.8)', () => {
    const writeRaw = (lines: string[]) => {
      const tracePath = getTracePath(PROJECT_ID);
      fs.mkdirSync(path.dirname(tracePath), { recursive: true });
      fs.writeFileSync(tracePath, lines.join('\n'));
    };
    const makeSnap = (runId: string, ts = '2026-06-04T00:00:00.000Z') =>
      JSON.stringify({
        timestamp: ts,
        run_id: runId,
        env_hash: 'sha256:test',
        cells: [{ id: 'c1', type: 'code', exec_count: 1, source: 'x=1', stdout: '', stderr: '', has_error: false, has_image: false, text_output: '' }],
      });

    it('returns null for missing trace file', () => {
      expect(readLatestSnapshot(PROJECT_ID)).toBeNull();
    });

    it('returns null for empty trace file', () => {
      writeRaw([]);
      expect(readLatestSnapshot(PROJECT_ID)).toBeNull();
    });

    it('returns the last valid snapshot when last line is empty (stray newline)', () => {
      writeRaw([makeSnap('good'), '', '']); // trailing empty lines
      const got = readLatestSnapshot(PROJECT_ID);
      expect(got?.run_id).toBe('good');
    });

    it('falls back to previous line when last line is unrecoverably corrupt', () => {
      writeRaw([makeSnap('older'), '{{ garbage }}']);
      const got = readLatestSnapshot(PROJECT_ID);
      expect(got?.run_id).toBe('older');
    });

    it('recovers the most recent snapshot from an interleaved last line (Round 13 bug pattern)', () => {
      // Simulate the actual Round 13 corruption: two snapshots written by
      // different processes with O_APPEND, concatenated without a newline.
      // Part 1 = Python-style spacing, Part 2 = Node-style spacing.
      const pythonStyleSnap = '{"timestamp": "2026-06-04T00:00:00.123456Z", "run_id": "python-writer", "env_hash": "sha256:py", "cells": [{"id": "c1", "type": "code", "exec_count": 1, "source": "y=2", "stdout": "", "stderr": "", "has_error": false, "has_image": false, "text_output": ""}]}';
      const nodeStyleSnap = makeSnap('node-writer-recent');
      const interleaved = pythonStyleSnap + nodeStyleSnap; // No \n between
      writeRaw([makeSnap('earliest'), interleaved]);

      const got = readLatestSnapshot(PROJECT_ID);
      // Should recover the LAST (Node-style) snapshot from the interleaved line
      expect(got?.run_id).toBe('node-writer-recent');
    });

    it('returns null only when ALL lines are unrecoverable', () => {
      writeRaw(['{{ junk1', '!! junk2', 'no-json-here-at-all']);
      expect(readLatestSnapshot(PROJECT_ID)).toBeNull();
    });

    it('skips empty middle lines without affecting recovery', () => {
      writeRaw([makeSnap('a'), '', '', makeSnap('b'), '']);
      const got = readLatestSnapshot(PROJECT_ID);
      expect(got?.run_id).toBe('b');
    });

    it('handles the exact SCI-005 R13 file pattern (1 valid, 1 empty, 1 interleaved-corrupt)', () => {
      // Regression test built directly from the Round 13 SCI-005 evidence.
      const earlySnap = makeSnap('early', '2026-06-04T00:27:34.419Z');
      const pythonPart = '{"timestamp": "2026-06-04T00:43:16.599898Z", "run_id": "py-writer", "env_hash": "sha256:x", "cells": [{"id": "c", "type": "code", "exec_count": 1, "source": "a=1", "stdout": "", "stderr": "", "has_error": false, "has_image": false, "text_output": ""}]}';
      const nodePart = makeSnap('node-latest', '2026-06-04T00:44:19.617Z');
      writeRaw([earlySnap, '', pythonPart + nodePart]);

      const got = readLatestSnapshot(PROJECT_ID);
      // Should NOT fall back all the way to `early` — must recover `node-latest`
      // from the interleaved last line.
      expect(got?.run_id).toBe('node-latest');
      expect(got?.timestamp).toBe('2026-06-04T00:44:19.617Z');
    });
  });
});
