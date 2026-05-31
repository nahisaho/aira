import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  extractNumericClaims,
  validateProject,
  buildRepairPayload,
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

  // v3.3.0 — Pillar A false-positive filters
  describe('exclusion rules (v3.3.0)', () => {
    it('excludes DOI strings (DOI: 10.1038/nature12873)', () => {
      const md = 'See DOI: 10.1038/nature12873 for the reference.';
      const claims = extractNumericClaims(md, 'paper.md');
      // No metric should be detected from the DOI body
      expect(claims.filter(c => c.match.includes('10.1038')).length).toBe(0);
    });

    it('excludes doi.org URL DOIs', () => {
      const md = 'Available at https://doi.org/10.1093/bioinformatics/btaa123';
      const claims = extractNumericClaims(md, 'paper.md');
      expect(claims.filter(c => c.match.includes('10.1093')).length).toBe(0);
    });

    it('excludes 4-digit years in citation parens like (Smith et al., 2024)', () => {
      const md = 'Recent work (Smith et al., 2024) reports n = 2020 patients.';
      const claims = extractNumericClaims(md, 'paper.md');
      // The "n = 2020" sample-size match: 2020 is suspicious (year), but
      // sample-size pattern only catches it because of "n =". This is real
      // intent; we keep it. The "(Smith et al., 2024)" itself should not
      // produce any numeric claim.
      // The year 2024 alone is not caught by any pattern, so this mainly
      // exercises reference-citation rule (no claim from the citation).
      expect(claims.find(c => c.match === '2024' || c.match.includes('2024'))).toBeUndefined();
    });

    it('excludes section / figure / equation labels (Section 3.1, Fig. 2.5, Eq. 1.2)', () => {
      const md = `
        See Section 3.1 for context, Figure 2.5 below, and Eq. 1.2 above.
      `;
      const claims = extractNumericClaims(md, 'report.md');
      // None of "3.1", "2.5", "1.2" should appear as a numeric claim
      const stripped = claims.map(c => c.match);
      expect(stripped.filter(s => /3\.1|2\.5|1\.2/.test(s)).length).toBe(0);
    });

    it('keeps a real metric assignment that happens to neighbour a section label', () => {
      const md = 'See Section 3.1. AUROC = 0.83 [cell:abc] was achieved.';
      const claims = extractNumericClaims(md, 'report.md');
      expect(claims.some(c => c.match.includes('AUROC') && c.match.includes('0.83'))).toBe(true);
    });

    it('CITE_NEAR is now 400 chars — citation farther than 200 but within 400 is captured', () => {
      const filler = 'word '.repeat(50); // ~250 chars of filler
      const md = `AUROC = 0.83 ${filler} [cell:far-cite].`;
      const claims = extractNumericClaims(md, 'report.md');
      expect(claims[0]!.cited).toContain('far-cite');
    });
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

  // v3.3.0 Pillar B — second-pass repair payload
  describe('buildRepairPayload (v3.3.0)', () => {
    it('returns pass=true with no violations when everything is good', () => {
      setupProject(
        {
          cells: [
            { id: 'seed', cell_type: 'code', source: 'import numpy as np\nnp.random.seed(0)', outputs: [] },
            { id: 'm', cell_type: 'code', source: 'm = 0.83', outputs: [] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        {
          'requirements.txt': 'numpy\n',
          'report.md': 'AUROC = 0.83 [cell:m].',
        },
      );

      const repair = buildRepairPayload(PROJECT_ID);
      expect(repair.available).toBe(true);
      expect(repair.needs_repair).toBe(false);
      expect(repair.pass).toBe(true);
      expect(repair.violations).toHaveLength(0);
      expect(repair.repair_prompt).toBe('');
    });

    it('lists uncited claims and includes them in the markdown prompt', () => {
      setupProject(
        {
          cells: [
            { id: 'seed', cell_type: 'code', source: 'import numpy as np\nnp.random.seed(0)', outputs: [] },
            { id: 'eval', cell_type: 'code', source: 'auroc = 0.7', outputs: [] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        {
          'requirements.txt': '',
          'report.md': 'AUROC = 0.83 and F1 = 0.72 on the test set.',
        },
      );

      const repair = buildRepairPayload(PROJECT_ID);
      expect(repair.needs_repair).toBe(true);
      expect(repair.violations.some(v => v.issue === 'uncited')).toBe(true);
      expect(repair.repair_prompt).toContain('uncited numeric claim');
      // Available cell ids should be surfaced
      expect(repair.repair_prompt).toContain('eval');
    });

    it('lists unknown citations with the bad cell id', () => {
      setupProject(
        {
          cells: [
            { id: 'seed', cell_type: 'code', source: 'import random\nrandom.seed(1)', outputs: [] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        {
          'requirements.txt': '',
          'report.md': 'AUROC = 0.83 [cell:does-not-exist]',
        },
      );

      const repair = buildRepairPayload(PROJECT_ID);
      expect(repair.violations.some(v => v.issue === 'unknown_citation')).toBe(true);
      expect(repair.repair_prompt).toContain('does-not-exist');
    });

    it('includes failed gate names with remediation hints', () => {
      setupProject(
        {
          cells: [
            { id: 'rng', cell_type: 'code', source: 'import numpy as np\nnp.random.randn(5)', outputs: [] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        {},  // no requirements.txt → env_capture fails
      );
      const repair = buildRepairPayload(PROJECT_ID);
      const gateViolations = repair.violations.filter(v => v.issue === 'gate_failed');
      expect(gateViolations.length).toBeGreaterThan(0);
      // Remediation hints surfaced in the prompt
      expect(repair.repair_prompt).toMatch(/pip\s+freeze/);
      expect(repair.repair_prompt).toMatch(/seed/);
    });

    it('returns available=false when no trace exists', () => {
      const repair = buildRepairPayload(PROJECT_ID);
      expect(repair.available).toBe(false);
      expect(repair.reason).toContain('No trace snapshot');
    });
  });
});
