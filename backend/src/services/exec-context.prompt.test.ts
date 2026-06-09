import { describe, it, expect, afterEach } from 'vitest';
import { skillUsageRulesPrefix, citationRulesSuffix, type SyncedSkillSummary } from './exec-context.js';

function summary(skills: Array<{ name: string; subSkills?: string[] }>): SyncedSkillSummary {
  return {
    skills: skills.map(s => ({ name: s.name, skillPath: `/x/${s.name}`, subSkills: s.subSkills ?? [] })),
    hasCopilotInstructions: true,
    hasAgentsMd: true,
  };
}

describe('skillUsageRulesPrefix (v3.11.0 — prompt-level skill-usage rules)', () => {
  afterEach(() => { delete process.env.AIRA_SKILL_USAGE_PROMPT; });

  it('injects the rules block when the Co-Scientist suite is assigned', () => {
    const out = skillUsageRulesPrefix(summary([{ name: 'co-scientist', subSkills: ['co-scientist-data-analysis'] }]));
    expect(out).toContain('スキル使用ルール（必須）');
    expect(out).toContain('`co-scientist-literature-review` を invoke');
    expect(out.endsWith('\n')).toBe(true); // separated from the user message
  });

  it('also detects via co-scientist-* sub-skills even if the suite name differs', () => {
    const out = skillUsageRulesPrefix(summary([{ name: 'something', subSkills: ['co-scientist-academic-writing'] }]));
    expect(out).toContain('スキル使用ルール（必須）');
  });

  it('is a no-op when no Co-Scientist skill is assigned', () => {
    expect(skillUsageRulesPrefix(summary([{ name: 'spread1000-assistant', subSkills: ['spread1000-foo'] }]))).toBe('');
    expect(skillUsageRulesPrefix(summary([]))).toBe('');
  });

  it('is disabled by AIRA_SKILL_USAGE_PROMPT=off', () => {
    process.env.AIRA_SKILL_USAGE_PROMPT = 'off';
    expect(skillUsageRulesPrefix(summary([{ name: 'co-scientist', subSkills: ['co-scientist-data-analysis'] }]))).toBe('');
  });
});

describe('citationRulesSuffix (v3.15.0 — prompt-tail citation golden rule)', () => {
  afterEach(() => { delete process.env.AIRA_CITATION_SUFFIX; });

  it('appends the citation rule (English) when Co-Scientist is assigned', () => {
    const out = citationRulesSuffix(summary([{ name: 'co-scientist', subSkills: ['co-scientist-data-analysis'] }]));
    expect(out).toContain('CITATION RULE');
    expect(out).toContain('[cell:<id>]');
    expect(out).toContain('Uncited claims = 0');
    expect(out).toContain('Citation Ledger');
    // Leads with blank lines so it is separated from the user message and sits last.
    expect(out.startsWith('\n')).toBe(true);
  });

  it('also detects via co-scientist-* sub-skills', () => {
    expect(citationRulesSuffix(summary([{ name: 'x', subSkills: ['co-scientist-academic-writing'] }]))).toContain('CITATION RULE');
  });

  it('is a no-op when no Co-Scientist skill is assigned', () => {
    expect(citationRulesSuffix(summary([{ name: 'spread1000-assistant', subSkills: ['spread1000-foo'] }]))).toBe('');
    expect(citationRulesSuffix(summary([]))).toBe('');
  });

  it('is disabled by AIRA_CITATION_SUFFIX=off', () => {
    process.env.AIRA_CITATION_SUFFIX = 'off';
    expect(citationRulesSuffix(summary([{ name: 'co-scientist', subSkills: ['co-scientist-data-analysis'] }]))).toBe('');
  });
});
