import { describe, it, expect, afterEach } from 'vitest';
import { skillUsageRulesPrefix, type SyncedSkillSummary } from './exec-context.js';

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
