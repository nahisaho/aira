import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  extractNumericClaims,
  validateProject,
} from './provenance-validator.js';
import {
  captureSnapshot,
  resetEnvHashCacheForTesting,
} from './notebook-trace.js';
import { setBaseDir, getBaseDir, getWorkspaceDir } from '../config/paths.js';

const PROJECT_ID = '00000000-0000-0000-0000-000000000bbb';

describe('extractNumericClaims', () => {
  it('captures metric = value', () => {
    const claims = extractNumericClaims('We achieved AUROC = 0.83 on the test set.', 'report.md');
    expect(claims.length).toBeGreaterThan(0);
    expect(claims[0]!.match).toContain('AUROC');
    expect(claims[0]!.match).toContain('0.83');
  });

  it('captures p-values in parentheses', () => {
    const claims = extractNumericClaims('significant (p < 0.001) effect', 'report.md');
    expect(claims.some(c => c.pattern === 'p-value')).toBe(true);
  });

  it('captures "X of 0.92" style', () => {
    const claims = extractNumericClaims('an F1 of 0.92 and AUROC of 0.81', 'report.md');
    expect(claims.filter(c => c.pattern === 'metric-of').length).toBeGreaterThanOrEqual(2);
  });

  it('captures sample size n = 1234', () => {
    const claims = extractNumericClaims('Cohort of n = 1024 patients was analyzed.', 'report.md');
    expect(claims.some(c => c.pattern === 'sample-size')).toBe(true);
  });

  it('captures [cell:id] within window after claim', () => {
    const md = 'AUROC = 0.83 [cell:eda-corr-1] on the held-out split.';
    const claims = extractNumericClaims(md, 'report.md');
    expect(claims[0]!.cited).toContain('eda-corr-1');
  });

  it('leaves claims uncited when no [cell:...] near', () => {
    const md = 'AUROC = 0.83 on the held-out split.';
    const claims = extractNumericClaims(md, 'report.md');
    expect(claims[0]!.cited).toEqual([]);
  });
});

describe('validateProject', () => {
  let tmpDir: string;
  let originalBaseDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-validate-'));
    originalBaseDir = getBaseDir();
    setBaseDir(tmpDir);
    resetEnvHashCacheForTesting();
  });

  afterEach(() => {
    setBaseDir(originalBaseDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function setupProject(notebook: Record<string, unknown>, files: Record<string, string> = {}) {
    const wsDir = getWorkspaceDir(PROJECT_ID);
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'notebook.ipynb'), JSON.stringify(notebook));
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(wsDir, name), content);
    }
    captureSnapshot(PROJECT_ID);
  }

  it('returns available=false when no trace exists', () => {
    const report = validateProject(PROJECT_ID);
    expect(report.available).toBe(false);
    expect(report.reason).toContain('No trace snapshot');
  });

  it('passes all gates on a well-formed project', () => {
    setupProject(
      {
        cells: [
          { id: 'seed', cell_type: 'code', source: 'import numpy as np\nnp.random.seed(42)', outputs: [] },
          { id: 'eda', cell_type: 'code', source: 'import numpy as np\nvals = np.random.randn(100)\nvals.mean()',
            outputs: [{ output_type: 'execute_result', data: { 'text/plain': '0.83' } }] },
        ],
        metadata: {}, nbformat: 4, nbformat_minor: 5,
      },
      {
        'requirements.txt': 'numpy==1.26.0\n',
        'report.md': 'The sample mean was 0.83 [cell:eda].',
      },
    );

    const report = validateProject(PROJECT_ID);
    expect(report.available).toBe(true);
    expect(report.pass).toBe(true);
    expect(report.gates.every(g => g.passed)).toBe(true);
  });

  it('fails seed_presence when RNG used without a seed in scope', () => {
    setupProject(
      {
        cells: [
          { id: 'no-seed', cell_type: 'code', source: 'import numpy as np\nvals = np.random.randn(10)', outputs: [] },
        ],
        metadata: {}, nbformat: 4, nbformat_minor: 5,
      },
      { 'requirements.txt': 'numpy\n' },
    );
    const report = validateProject(PROJECT_ID);
    const seedGate = report.gates.find(g => g.name === 'seed_presence');
    expect(seedGate?.passed).toBe(false);
    expect(seedGate?.offenders).toContain('no-seed');
  });

  it('fails env_capture when no requirements.txt and no pip freeze cell', () => {
    setupProject({
      cells: [{ id: 'c', cell_type: 'code', source: '1+1', outputs: [] }],
      metadata: {}, nbformat: 4, nbformat_minor: 5,
    });
    const report = validateProject(PROJECT_ID);
    const envGate = report.gates.find(g => g.name === 'env_capture');
    expect(envGate?.passed).toBe(false);
  });

  it('passes env_capture when a cell ran pip freeze', () => {
    setupProject({
      cells: [{ id: 'env', cell_type: 'code', source: '!pip freeze > requirements.txt', outputs: [] }],
      metadata: {}, nbformat: 4, nbformat_minor: 5,
    });
    const report = validateProject(PROJECT_ID);
    expect(report.gates.find(g => g.name === 'env_capture')?.passed).toBe(true);
  });

  it('fails no_error_in_cited when cited cell has stderr', () => {
    setupProject(
      {
        cells: [
          { id: 'seed', cell_type: 'code', source: 'import random\nrandom.seed(1)', outputs: [] },
          { id: 'broken', cell_type: 'code', source: 'raise RuntimeError("oops")',
            outputs: [{ output_type: 'error', ename: 'RuntimeError', evalue: 'oops', traceback: [] }] },
        ],
        metadata: {}, nbformat: 4, nbformat_minor: 5,
      },
      {
        'requirements.txt': '',
        'report.md': 'AUROC = 0.42 [cell:broken]',
      },
    );
    const report = validateProject(PROJECT_ID);
    expect(report.gates.find(g => g.name === 'no_error_in_cited')?.passed).toBe(false);
  });

  it('fails citation_coverage when <80% claims are cited', () => {
    setupProject(
      {
        cells: [{ id: 'cell-a', cell_type: 'code', source: 'x = 1', outputs: [] }],
        metadata: {}, nbformat: 4, nbformat_minor: 5,
      },
      {
        'requirements.txt': '',
        'report.md': [
          'AUROC = 0.83 [cell:cell-a]',
          'F1 = 0.74',
          'precision = 0.81',
          'recall = 0.77',
          'p < 0.001',
        ].join('\n'),
      },
    );
    const report = validateProject(PROJECT_ID);
    const cov = report.gates.find(g => g.name === 'citation_coverage');
    expect(cov?.passed).toBe(false);
    expect(cov?.detail).toContain('20%'); // 1/5 cited
  });

  it('flags unknown_citations when [cell:id] does not match any cell', () => {
    setupProject(
      {
        cells: [{ id: 'real', cell_type: 'code', source: 'x = 1', outputs: [] }],
        metadata: {}, nbformat: 4, nbformat_minor: 5,
      },
      {
        'requirements.txt': '',
        'report.md': 'AUROC = 0.83 [cell:fake-id-that-does-not-exist]',
      },
    );
    const report = validateProject(PROJECT_ID);
    expect(report.unknown_citations.length).toBe(1);
    expect(report.unknown_citations[0]!.bad_cell_id).toBe('fake-id-that-does-not-exist');
    expect(report.pass).toBe(false);
  });
});
