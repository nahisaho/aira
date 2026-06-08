import { describe, it, expect } from 'vitest';
import { buildReviewerPrompt } from './paper-review.service.js';

describe('buildReviewerPrompt (v3.12.0)', () => {
  const prompt = buildReviewerPrompt();

  it('targets scientific VALUE, not just form', () => {
    // The six value dimensions must all be present.
    expect(prompt).toContain('データの実在性');
    expect(prompt).toContain('新規性');
    expect(prompt).toContain('主張の支持');
    expect(prompt).toContain('ベースライン');
    expect(prompt).toContain('統計の妥当性');
    expect(prompt).toContain('文献の統合');
  });

  it('instructs an actual one-pass revision of paper.md', () => {
    expect(prompt).toContain('paper.md');
    expect(prompt).toContain('改稿');
    expect(prompt).toContain('review.md');
  });

  it('forbids fabricated support and preserves provenance', () => {
    expect(prompt).toContain('虚偽の補強');     // no fake "we did X"
    expect(prompt).toContain('[cell:]');         // keep citations
    expect(prompt).toContain('/validate');       // re-validate after revising
  });
});
