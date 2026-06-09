import { describe, it, expect, vi } from 'vitest';
import { parseLine, type ParseState, type SkillRoutingEvent } from './container-runner.js';

function freshState(): ParseState {
  return { deltasSeen: false, finalMessage: '' };
}

describe('parseLine — skill routing capture (v3.9.1)', () => {
  it('records a real skill invocation from the CLI skill.invoked event', () => {
    const routing: SkillRoutingEvent[] = [];
    const cbs = {
      onChunk: () => {},
      onProgress: () => {},
      onFileCreated: () => {},
      onSkillRouting: (e: SkillRoutingEvent) => routing.push(e),
    };
    parseLine(
      JSON.stringify({
        type: 'skill.invoked',
        data: { name: 'co-scientist-data-analysis', path: '.github/skills/co-scientist-data-analysis/SKILL.md', content: 'x'.repeat(5000) },
      }),
      freshState(),
      cbs,
    );
    expect(routing).toHaveLength(1);
    expect(routing[0]!.type).toBe('tool_invoked');
    expect(routing[0]!.payload.skill).toBe('co-scientist-data-analysis');
    // content (large, possibly sensitive) is NOT recorded.
    expect(routing[0]!.payload.content).toBeUndefined();
  });

  it('still records the available-skills registry from session.skills_loaded', () => {
    const routing: SkillRoutingEvent[] = [];
    parseLine(
      JSON.stringify({ type: 'session.skills_loaded', data: { skills: [{ name: 'a' }, { name: 'b' }] } }),
      freshState(),
      { onChunk: () => {}, onProgress: () => {}, onFileCreated: () => {}, onSkillRouting: (e) => routing.push(e) },
    );
    expect(routing).toHaveLength(1);
    expect(routing[0]!.type).toBe('skills_loaded');
    expect(routing[0]!.payload.skills).toEqual(['a', 'b']);
  });

  it('records a skill invocation from tool.execution_start with toolName "skill" (v1.0.55+ CLI path)', () => {
    const routing: SkillRoutingEvent[] = [];
    const onProgress = vi.fn();
    parseLine(
      JSON.stringify({
        type: 'tool.execution_start',
        data: { toolName: 'skill', arguments: { skill: 'co-scientist-literature-review' } },
      }),
      freshState(),
      { onChunk: () => {}, onProgress, onFileCreated: () => {}, onSkillRouting: (e) => routing.push(e) },
    );
    expect(routing).toHaveLength(1);
    expect(routing[0]!.type).toBe('tool_invoked');
    expect(routing[0]!.payload.skill).toBe('co-scientist-literature-review');
    expect(onProgress).toHaveBeenCalled(); // still surfaces progress
  });

  it('does NOT fire a skill invocation for an ordinary tool that merely reads a SKILL.md path (the old false-positive heuristic is gone)', () => {
    const routing: SkillRoutingEvent[] = [];
    const onProgress = vi.fn();
    parseLine(
      JSON.stringify({
        type: 'tool.execution_start',
        data: { toolName: 'read', arguments: { filePath: '.github/skills/co-scientist-bioinformatics/SKILL.md' } },
      }),
      freshState(),
      { onChunk: () => {}, onProgress, onFileCreated: () => {}, onSkillRouting: (e) => routing.push(e) },
    );
    expect(routing).toHaveLength(0);     // no phantom skill-invoked
    expect(onProgress).toHaveBeenCalled(); // still surfaces progress
  });
});
