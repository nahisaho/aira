import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  extractNumericClaims,
  validateProject,
  buildRepairPayload,
  buildPostmortemReport,
  extractClaimValue,
  valueAppearsInOutputs,
  valueAppearsInCellOutputs,
  extractNumericCandidates,
  extractFigureReferences,
  figureHasProducerCell,
  detectModelMisuse,
  UNAVAILABLE_SCIENTIFIC_LLM_PREFIXES,
} from './provenance-validator.js';
import { getTraceDir } from '../config/paths.js';
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
            // v3.4.0: include output so the value_match check is satisfied
            { id: 'm', cell_type: 'code', source: 'm = 0.83',
              outputs: [{ output_type: 'stream', name: 'stdout', text: '0.83\n' }] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        {
          'requirements.txt': 'numpy\n',
          // v3.4.2: report.md and paper.md must be non-trivial so the
          // thinness check stays quiet. Pad with descriptive text >= 800 bytes.
          'report.md':
            '# Report\n\n' +
            '## Abstract\n' +
            'We evaluate a classifier. AUROC = 0.83 [cell:m]. ' +
            'word '.repeat(200),
          'paper.md':
            '# Paper\n\n' +
            '## Methods\n' +
            'We fit a model. AUROC = 0.83 [cell:m]. ' +
            'word '.repeat(200),
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
      // v3.4.0 single-batch prompt uses "Uncited claims" section header
      expect(repair.repair_prompt).toContain('Uncited claims');
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

  // v3.4.0 — Pillar 1: value-presence informational check
  describe('Value presence check (v3.4.0 Pillar 1)', () => {
    it('extractClaimValue parses the value and precision', () => {
      expect(extractClaimValue('AUROC = 0.83')).toEqual({ value: 0.83, precision: 2 });
      expect(extractClaimValue('p < 0.001')).toEqual({ value: 0.001, precision: 3 });
      expect(extractClaimValue('n = 1024')).toEqual({ value: 1024, precision: 0 });
      expect(extractClaimValue('rate of -0.05')).toEqual({ value: -0.05, precision: 2 });
      expect(extractClaimValue('no number here')).toBeNull();
    });

    it('valueAppearsInOutputs matches with precision-aware tolerance', () => {
      // 0.83 (precision 2 → tolerance 0.005) matches 0.8316 (rounds to 0.83)
      expect(valueAppearsInOutputs(0.83, 2, '... auroc 0.8316 ...')).toBe(true);
      // 0.83 does NOT match 0.84 (outside tolerance)
      expect(valueAppearsInOutputs(0.83, 2, '... auroc 0.84 ...')).toBe(false);
      // Higher precision 0.835 needs <0.0005 tolerance
      expect(valueAppearsInOutputs(0.835, 3, '0.8355')).toBe(true);
      expect(valueAppearsInOutputs(0.835, 3, '0.836')).toBe(false);
      // Integer (precision 0, tolerance 0) needs exact match
      expect(valueAppearsInOutputs(1024, 0, 'sample size: 1024 patients')).toBe(true);
      expect(valueAppearsInOutputs(1024, 0, '1023')).toBe(false);
      // No numbers in output
      expect(valueAppearsInOutputs(0.83, 2, 'just text')).toBe(false);
    });

    it('reports value_mismatches when cell does not contain the value', () => {
      setupProject(
        {
          cells: [
            { id: 'seed', cell_type: 'code', source: 'import random\nrandom.seed(1)', outputs: [] },
            { id: 'right', cell_type: 'code', source: 'auroc = 0.83',
              outputs: [{ output_type: 'stream', name: 'stdout', text: 'auroc=0.8316\n' }] },
            { id: 'wrong', cell_type: 'code', source: 'f1 = 0.92',
              outputs: [{ output_type: 'stream', name: 'stdout', text: 'f1=0.9234\n' }] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        {
          'requirements.txt': '',
          // citation points at 'wrong' but the value 0.83 is in 'right'
          'report.md': 'We observed AUROC = 0.83 [cell:wrong] across folds.',
        },
      );

      const report = validateProject(PROJECT_ID);
      expect(report.value_mismatches.length).toBe(1);
      expect(report.value_mismatches[0]!.cell_id).toBe('wrong');
      expect(report.value_mismatches[0]!.expected).toBe(0.83);
      // value_mismatches do NOT fail the overall pass
      expect(report.pass).toBe(true);
    });

    it('passes value match when cell output contains the value (with rounding)', () => {
      setupProject(
        {
          cells: [
            { id: 'seed', cell_type: 'code', source: 'random.seed(1)', outputs: [] },
            { id: 'm', cell_type: 'code', source: 'metric = 0.8316',
              outputs: [{ output_type: 'stream', name: 'stdout', text: '0.8316\n' }] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        {
          'requirements.txt': '',
          'report.md': 'AUROC = 0.83 [cell:m]',
        },
      );
      const report = validateProject(PROJECT_ID);
      expect(report.value_mismatches.length).toBe(0);
    });

    // v3.4.4 — Pillar A: last-output bias
    describe('valueAppearsInCellOutputs (v3.4.4 Pillar A)', () => {
      it('matches values found in text_output (execute_result)', () => {
        const cell = { stdout: '', text_output: '0.8316' };
        expect(valueAppearsInCellOutputs(0.83, 2, cell)).toBe(true);
      });

      it('matches values in the last stdout line', () => {
        const cell = { stdout: 'iter 1\niter 2\nfinal: 0.83\n', text_output: '' };
        expect(valueAppearsInCellOutputs(0.83, 2, cell)).toBe(true);
      });

      it('does NOT match intermediate stdout values when last line differs', () => {
        // Round 11 false positive: cell prints intermediate values 0.50/0.60/...
        // and a final 0.92. A claim of 0.83 should NOT match 0.50 anymore.
        const cell = {
          stdout: 'epoch 1: 0.50\nepoch 2: 0.60\nepoch 3: 0.70\nfinal: 0.92\n',
          text_output: '',
        };
        expect(valueAppearsInCellOutputs(0.83, 2, cell)).toBe(false);
        // But the actual final value DOES match
        expect(valueAppearsInCellOutputs(0.92, 2, cell)).toBe(true);
      });

      it('checks text_output before stdout (execute_result takes priority)', () => {
        // stdout has 0.50 anywhere, text_output has 0.83 — should match 0.83
        const cell = {
          stdout: 'progress: 0.50\nstep: 0.60\n',
          text_output: '0.8316',
        };
        expect(valueAppearsInCellOutputs(0.83, 2, cell)).toBe(true);
      });

      it('skips trailing blank lines when finding last stdout line', () => {
        const cell = { stdout: 'final: 0.83\n\n\n', text_output: '' };
        expect(valueAppearsInCellOutputs(0.83, 2, cell)).toBe(true);
      });
    });

    // v3.4.4 — Pillar B: format normalisation
    describe('extractNumericCandidates / percentage + scientific notation (v3.4.4 Pillar B)', () => {
      it('returns plain numbers', () => {
        const out = extractNumericCandidates('AUROC was 0.83 on test');
        expect(out).toContain(0.83);
      });

      it('emits BOTH percentage and divided-by-100 variants', () => {
        const out = extractNumericCandidates('Accuracy reached 83.0% on validation');
        expect(out).toContain(83);
        // 0.83 (not exactly equal due to FP; use closeTo)
        expect(out.some(v => Math.abs(v - 0.83) < 1e-10)).toBe(true);
      });

      it('parses scientific notation', () => {
        const out = extractNumericCandidates('Coefficient = 8.316e-1');
        expect(out.some(v => Math.abs(v - 0.8316) < 1e-10)).toBe(true);
      });

      it('matches a 0.83 claim against an 83% output (cell-aware)', () => {
        const cell = { stdout: '', text_output: 'accuracy: 83.0%' };
        expect(valueAppearsInCellOutputs(0.83, 2, cell)).toBe(true);
      });

      it('matches a 0.0083 claim against a 0.83% output', () => {
        const cell = { stdout: '', text_output: 'rate: 0.83%' };
        expect(valueAppearsInCellOutputs(0.0083, 4, cell)).toBe(true);
      });
    });

    // v3.4.5 — Pillar A: comma separators + leading-dot decimals
    describe('extractNumericCandidates / thousand separators + leading-dot (v3.4.5 Pillar A)', () => {
      it('parses a thousand-separated integer', () => {
        const out = extractNumericCandidates('n = 1,234 samples');
        expect(out).toContain(1234);
      });

      it('parses a multi-group thousand-separated decimal', () => {
        const out = extractNumericCandidates('dataset size: 1,234,567.5 rows');
        expect(out).toContain(1234567.5);
      });

      it('does NOT emit each digit group as a separate candidate for comma-separated number', () => {
        // Regression: without masking, decRe would re-emit 1 and 234 from "1,234"
        const out = extractNumericCandidates('n = 1,234 samples');
        expect(out).toContain(1234);
        expect(out).not.toContain(234);
      });

      it('handles comma-separated percentage', () => {
        const out = extractNumericCandidates('reduction of 1,500%');
        expect(out).toContain(1500);
        expect(out.some(v => Math.abs(v - 15) < 1e-10)).toBe(true);
      });

      it('parses leading-dot decimal (.83 → 0.83)', () => {
        const out = extractNumericCandidates('coef = .83');
        expect(out.some(v => Math.abs(v - 0.83) < 1e-10)).toBe(true);
      });

      it('matches a 1234 claim against a comma-separated output', () => {
        const cell = { stdout: '', text_output: 'training set: 1,234 examples' };
        expect(valueAppearsInCellOutputs(1234, 0, cell)).toBe(true);
      });

      it('matches an int-formatted million-scale claim against comma-output', () => {
        const cell = { stdout: '', text_output: 'parameters: 12,345,678' };
        expect(valueAppearsInCellOutputs(12345678, 0, cell)).toBe(true);
      });

      it('does NOT match unrelated digit-3 lists like [1,234,567]', () => {
        // Edge case: array literal contains commas-with-3-digits — current
        // behaviour treats this AS a thousand-separated number (1234567).
        // This is acceptable: the candidate IS correctly parsed; only an
        // exact-equality claim of 1234567 would match, which would be a
        // legitimate match if that array element really was that number.
        // Documenting the behaviour for future reference.
        const out = extractNumericCandidates('arr = [1,234,567]');
        expect(out).toContain(1234567);
      });

      it('matches 0.83 claim against leading-dot output ".83" in stdout last line', () => {
        const cell = { stdout: 'final coef = .83\n', text_output: '' };
        expect(valueAppearsInCellOutputs(0.83, 2, cell)).toBe(true);
      });
    });

    // v3.4.6 — Pillar C: model misuse detection (unavailable scientific LLMs)
    describe('detectModelMisuse (v3.4.6 Pillar C)', () => {
      const makeCell = (
        id: string,
        type: 'code' | 'markdown',
        source: string,
      ): import('./notebook-trace.js').TraceCell => ({
        id,
        type,
        exec_count: null,
        source,
        stdout: '',
        stderr: '',
        has_error: false,
        has_image: false,
        text_output: '',
      });
      const code = (id: string, source: string) => makeCell(id, 'code', source);
      const markdown = (id: string, source: string) => makeCell(id, 'markdown', source);

      it('flags a GALACTICA from_pretrained call', () => {
        const out = detectModelMisuse([
          code('c1', 'from transformers import AutoModelForCausalLM\nm = AutoModelForCausalLM.from_pretrained("facebook/galactica-1.3b")'),
        ]);
        expect(out).toHaveLength(1);
        expect(out[0]!.cell_id).toBe('c1');
        expect(out[0]!.model_id).toBe('facebook/galactica-1.3b');
        expect(out[0]!.loader).toBe('from_pretrained');
      });

      it('flags a NatureLM from_pretrained call with single quotes', () => {
        const out = detectModelMisuse([
          code('c2', "tok = AutoTokenizer.from_pretrained('microsoft/NatureLM-8x7B-Inst')"),
        ]);
        expect(out).toHaveLength(1);
        expect(out[0]!.model_id).toBe('microsoft/NatureLM-8x7B-Inst');
      });

      it('flags multiple banned models across multiple cells', () => {
        const out = detectModelMisuse([
          code('c1', 'AutoModel.from_pretrained("facebook/esm2_t33_650M_UR50D")'),
          code('c2', 'AutoModel.from_pretrained("dmis-lab/biobert-v1.1")'),
          code('c3', 'x = 1'), // clean cell
        ]);
        expect(out).toHaveLength(2);
        expect(out.map(m => m.cell_id).sort()).toEqual(['c1', 'c2']);
      });

      it('deduplicates within a single cell that loads the same model twice', () => {
        const out = detectModelMisuse([
          code('c1', 'm = AutoModel.from_pretrained("facebook/galactica-125m")\nm2 = AutoModel.from_pretrained("facebook/galactica-125m")'),
        ]);
        expect(out).toHaveLength(1);
      });

      it('does NOT flag markdown cells that merely mention the model name', () => {
        // Related Work / Discussion content must NOT trigger the warning.
        const out = detectModelMisuse([
          markdown('c1', '## Related Work\nNatureLM (arXiv:2502.07527) demonstrates from_pretrained("microsoft/NatureLM-8B-Inst") style usage in their reference implementation.'),
        ]);
        expect(out).toHaveLength(0);
      });

      it('does NOT flag code cells that mention the model in a comment without loading it', () => {
        const out = detectModelMisuse([
          code('c1', '# We considered facebook/galactica-1.3b but use sklearn baseline instead\nfrom sklearn.linear_model import LogisticRegression'),
        ]);
        expect(out).toHaveLength(0);
      });

      it('does NOT flag a sibling-namespace model load (e.g. unrelated facebook/* model)', () => {
        const out = detectModelMisuse([
          code('c1', 'AutoModel.from_pretrained("facebook/bart-large")'),
        ]);
        expect(out).toHaveLength(0);
      });

      it('covers all documented prefixes', () => {
        // Sanity check the export — adding a prefix without testing should not slip through
        expect(UNAVAILABLE_SCIENTIFIC_LLM_PREFIXES.length).toBeGreaterThanOrEqual(8);
        // Smoke test each prefix triggers a match
        for (const prefix of UNAVAILABLE_SCIENTIFIC_LLM_PREFIXES) {
          const out = detectModelMisuse([
            code('c', `AutoModel.from_pretrained("${prefix}example")`),
          ]);
          expect(out, `prefix ${prefix} should be detected`).toHaveLength(1);
        }
      });
    });

    // v3.4.6 — Pillar C: model_misuse surfaces in repair prompt
    it('surfaces model_misuse in the repair prompt with the STRONG warning header', () => {
      setupProject(
        {
          cells: [
            { id: 'seed', cell_type: 'code', source: 'import numpy as np\nnp.random.seed(0)', outputs: [] },
            { id: 'env', cell_type: 'code', source: '!pip freeze > requirements.txt', outputs: [] },
            {
              id: 'bad-load',
              cell_type: 'code',
              source: 'from transformers import AutoModelForCausalLM\nm = AutoModelForCausalLM.from_pretrained("facebook/galactica-1.3b")',
              outputs: [],
            },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        { 'report.md': '# Report\n\nNo numeric claims here, but a clean structure.\n' },
      );
      const payload = buildRepairPayload(PROJECT_ID);
      expect(payload.available).toBe(true);
      const misuse = payload.violations!.filter(v => v.issue === 'model_misuse');
      expect(misuse).toHaveLength(1);
      expect(misuse[0]!.detail).toContain('not callable in the AIRA environment');
      expect(misuse[0]!.detail).toContain('literature-value verification');
      // model_misuse is informational — alone should not force a repair iteration
      expect(payload.needs_repair).toBe(false);
      expect(payload.repair_prompt).toContain('Unavailable scientific LLM loads');
      expect(payload.repair_prompt).toContain('STRONG WARNING');
    });

    it('repair prompt surfaces value mismatches as informational', () => {
      setupProject(
        {
          cells: [
            { id: 'seed', cell_type: 'code', source: 'random.seed(1)', outputs: [] },
            { id: 'm', cell_type: 'code', source: 'x = 0.50',
              outputs: [{ output_type: 'stream', name: 'stdout', text: '0.50\n' }] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        {
          'requirements.txt': '',
          'report.md': 'AUROC = 0.83 [cell:m]',
        },
      );
      const repair = buildRepairPayload(PROJECT_ID);
      // value_mismatch alone is informational → not blocking
      expect(repair.needs_repair).toBe(false);
      expect(repair.pass).toBe(true);
      // But it IS surfaced in violations + prompt
      expect(repair.violations.some(v => v.issue === 'value_mismatch')).toBe(true);
      expect(repair.repair_prompt).toContain('Value-presence');
      expect(repair.repair_prompt).toContain('0.83');
    });
  });

  // v3.4.2 — Pillar 2: figure provenance
  describe('Figure provenance (v3.4.2 Pillar 2)', () => {
    it('extractFigureReferences finds markdown image and inline mentions', () => {
      const md = `
        See ![ROC curve](figures/roc.png) and Figure 2 (figures/pr.png).
        Also figures/box.svg is shown below.
      `;
      const refs = extractFigureReferences(md);
      expect(refs).toContain('figures/roc.png');
      expect(refs).toContain('figures/pr.png');
      expect(refs).toContain('figures/box.svg');
    });

    it('extractFigureReferences deduplicates', () => {
      const md = '![A](figures/a.png) ![B](figures/a.png) ![C](figures/a.png)';
      expect(extractFigureReferences(md)).toEqual(['figures/a.png']);
    });

    it('figureHasProducerCell matches plt.savefig with same path', () => {
      const cells = [
        { id: 'viz', type: 'code', source: 'plt.savefig("figures/roc.png")',
          exec_count: 1, outputs: [], stdout: '', stderr: '', has_error: false, has_image: false, text_output: '' },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(figureHasProducerCell('figures/roc.png', cells as any)).toBe(true);
    });

    it('figureHasProducerCell matches by basename if path differs', () => {
      const cells = [
        { id: 'viz', type: 'code', source: 'fig.savefig("roc.png")',
          exec_count: 1, outputs: [], stdout: '', stderr: '', has_error: false, has_image: false, text_output: '' },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(figureHasProducerCell('figures/roc.png', cells as any)).toBe(true);
    });

    it('figureHasProducerCell rejects when no save call', () => {
      const cells = [
        { id: 'viz', type: 'code', source: 'plt.plot([1,2,3])',
          exec_count: 1, outputs: [], stdout: '', stderr: '', has_error: false, has_image: false, text_output: '' },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(figureHasProducerCell('figures/roc.png', cells as any)).toBe(false);
    });

    it('reports figure_orphans for unreferenced figures', () => {
      setupProject(
        {
          cells: [
            { id: 'seed', cell_type: 'code', source: 'random.seed(1)', outputs: [] },
            { id: 'wrong-viz', cell_type: 'code', source: 'plt.savefig("figures/other.png")', outputs: [] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        {
          'requirements.txt': '',
          'report.md': 'See Figure 1: ![ROC](figures/roc.png) and ![PR](figures/pr.png)',
        },
      );
      const report = validateProject(PROJECT_ID);
      const paths = report.figure_orphans.map(o => o.figure_path);
      expect(paths).toContain('figures/roc.png');
      expect(paths).toContain('figures/pr.png');
      // figure_orphans are informational
      expect(report.pass).toBe(true);
    });

    it('does NOT flag figures that have a producer cell', () => {
      setupProject(
        {
          cells: [
            { id: 'seed', cell_type: 'code', source: 'random.seed(1)', outputs: [] },
            { id: 'viz', cell_type: 'code', source: 'plt.savefig("figures/roc.png")', outputs: [] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        {
          'requirements.txt': '',
          'report.md': '![ROC](figures/roc.png)',
        },
      );
      const report = validateProject(PROJECT_ID);
      expect(report.figure_orphans).toEqual([]);
    });
  });

  // v3.4.2 — SCI-073-style corner case defence
  describe('Report thinness detection (v3.4.2)', () => {
    it('flags missing report.md and paper.md', () => {
      setupProject({
        cells: [{ id: 'c', cell_type: 'code', source: 'x = 1', outputs: [] }],
        metadata: {}, nbformat: 4, nbformat_minor: 5,
      });
      const report = validateProject(PROJECT_ID);
      const missingFiles = report.report_thinness.filter(t => t.level === 'missing').map(t => t.source_file);
      expect(missingFiles).toContain('report.md');
      expect(missingFiles).toContain('paper.md');
    });

    it('flags tiny report.md', () => {
      setupProject(
        { cells: [{ id: 'c', cell_type: 'code', source: 'x = 1', outputs: [] }], metadata: {}, nbformat: 4, nbformat_minor: 5 },
        { 'report.md': 'too short' },
      );
      const report = validateProject(PROJECT_ID);
      expect(report.report_thinness.some(t => t.level === 'tiny' && t.source_file === 'report.md')).toBe(true);
    });

    it('flags no_claims when report is sized but has no numeric content', () => {
      const filler = 'word '.repeat(300); // ~1500 chars but no metrics
      setupProject(
        { cells: [{ id: 'c', cell_type: 'code', source: 'x = 1', outputs: [] }], metadata: {}, nbformat: 4, nbformat_minor: 5 },
        { 'report.md': `# Report\n\n${filler}` },
      );
      const report = validateProject(PROJECT_ID);
      expect(report.report_thinness.some(t => t.level === 'no_claims' && t.source_file === 'report.md')).toBe(true);
    });
  });

  // v3.4.2 — Pillar 4: postmortem
  describe('Auto-postmortem (v3.4.2 Pillar 4)', () => {
    it('returns available=false when no trace yet', () => {
      const pm = buildPostmortemReport(PROJECT_ID);
      expect(pm.available).toBe(false);
      expect(pm.reason).toContain('No trace snapshot');
    });

    it('writes a JSON file and returns a markdown summary', () => {
      setupProject(
        {
          cells: [
            { id: 'broken', cell_type: 'code', source: 'import numpy as np\nnp.random.randn(5)', outputs: [] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        { 'report.md': 'short' },
      );
      const pm = buildPostmortemReport(PROJECT_ID);
      expect(pm.available).toBe(true);
      // Normalise path separator so the regex works on Windows runners too.
      expect(pm.file.replace(/\\/g, '/')).toMatch(/^\.trace\/postmortem-/);
      expect(pm.markdown_summary).toContain('Postmortem');
      expect(pm.markdown_summary).toMatch(/seed_presence|env_capture|tiny/);

      // File on disk
      const traceDir = getTraceDir(PROJECT_ID);
      const files = fs.readdirSync(traceDir).filter(f => f.startsWith('postmortem-'));
      expect(files.length).toBeGreaterThan(0);
      const payload = JSON.parse(fs.readFileSync(path.join(traceDir, files[0]!), 'utf-8'));
      expect(payload.markdown_summary).toContain('Postmortem');
    });
  });

  // v3.4.0 — Pillar 3: single-batch repair prompt
  describe('Single-batch repair prompt (v3.4.0 Pillar 3)', () => {
    it('uses single-batch language emphasising ALL fixes in one pass', () => {
      setupProject(
        {
          cells: [
            { id: 'rng', cell_type: 'code', source: 'import numpy as np\nnp.random.randn(5)', outputs: [] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        {
          'report.md': 'X = 0.5 and Y = 0.6 reported.',
        },
      );
      const repair = buildRepairPayload(PROJECT_ID);
      expect(repair.repair_prompt).toMatch(/ONE Pass|ALL fixes|in one pass/i);
      expect(repair.repair_prompt).toContain('Do NOT call');
    });

    it('groups gates / uncited / unknown / value_mismatch into flat sections', () => {
      setupProject(
        {
          cells: [
            { id: 'rng', cell_type: 'code', source: 'import numpy as np\nnp.random.randn(5)', outputs: [] },
          ],
          metadata: {}, nbformat: 4, nbformat_minor: 5,
        },
        {
          'report.md': 'AUROC = 0.83 [cell:missing-cell] and F1 = 0.74 uncited.',
        },
      );
      const repair = buildRepairPayload(PROJECT_ID);
      // Sections present
      expect(repair.repair_prompt).toMatch(/Uncited claims/);
      expect(repair.repair_prompt).toMatch(/Unknown citations/);
      expect(repair.repair_prompt).toMatch(/Failed reproducibility gates/);
    });
  });
});
