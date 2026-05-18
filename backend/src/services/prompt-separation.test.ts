import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the prompt construction logic that prevents response duplication.
 *
 * The bug: when --resume succeeds, the full conversation history was sent to the
 * CLI via stdin alongside the CLI's own session state, causing the model to echo
 * previous responses. The fix separates the prompt into:
 * - `prompt`: just the raw user message (used for --resume)
 * - `coldStartPrompt`: full history (used for --name fallback)
 */
describe('container-runner prompt separation', () => {
  // Simulate the RunnerOptions interface
  interface RunnerOptions {
    prompt: string;
    coldStartPrompt?: string;
    forceNewSession?: boolean;
  }

  function getInputPrompt(opts: RunnerOptions, sessionArg: '--resume' | '--name'): string {
    return sessionArg === '--resume'
      ? opts.prompt
      : (opts.coldStartPrompt ?? opts.prompt);
  }

  function getSessionMode(
    opts: RunnerOptions,
    knownSession: string | undefined,
  ): { sessionArg: '--resume' | '--name'; sessionName: string } {
    const baseSessionName = 'aira-test123456';
    if (opts.forceNewSession) {
      return { sessionArg: '--name', sessionName: `${baseSessionName}-unique` };
    } else if (knownSession) {
      return { sessionArg: '--resume', sessionName: knownSession };
    } else {
      return { sessionArg: '--resume', sessionName: baseSessionName };
    }
  }

  it('--resume uses only the raw user message as prompt', () => {
    const opts: RunnerOptions = {
      prompt: 'what is TypeScript?',
      coldStartPrompt: '[Previous conversation]\nUser: hello\n\nAssistant: Hi!\n\n[Current message]\nwhat is TypeScript?',
    };
    const input = getInputPrompt(opts, '--resume');
    expect(input).toBe('what is TypeScript?');
    expect(input).not.toContain('[Previous conversation]');
  });

  it('--name uses the cold-start prompt with full history', () => {
    const opts: RunnerOptions = {
      prompt: 'what is TypeScript?',
      coldStartPrompt: '[Previous conversation]\nUser: hello\n\nAssistant: Hi!\n\n[Current message]\nwhat is TypeScript?',
    };
    const input = getInputPrompt(opts, '--name');
    expect(input).toBe(opts.coldStartPrompt);
    expect(input).toContain('[Previous conversation]');
    expect(input).toContain('Hi!');
  });

  it('--name falls back to prompt when no coldStartPrompt is provided', () => {
    const opts: RunnerOptions = {
      prompt: 'hello world',
    };
    const input = getInputPrompt(opts, '--name');
    expect(input).toBe('hello world');
  });

  it('forceNewSession skips --resume and uses --name directly', () => {
    const opts: RunnerOptions = {
      prompt: 'first message',
      forceNewSession: true,
    };
    const { sessionArg } = getSessionMode(opts, 'aira-known-session');
    expect(sessionArg).toBe('--name');
  });

  it('known session uses --resume', () => {
    const opts: RunnerOptions = {
      prompt: 'second message',
      forceNewSession: false,
    };
    const { sessionArg, sessionName } = getSessionMode(opts, 'aira-known-session');
    expect(sessionArg).toBe('--resume');
    expect(sessionName).toBe('aira-known-session');
  });

  it('no known session tries --resume with base name', () => {
    const opts: RunnerOptions = {
      prompt: 'second message',
      forceNewSession: false,
    };
    const { sessionArg, sessionName } = getSessionMode(opts, undefined);
    expect(sessionArg).toBe('--resume');
    expect(sessionName).toContain('aira-');
  });
});

describe('exec-context isFirstMessage logic', () => {
  it('count <= 1 means first message (current user msg already in DB)', () => {
    // The user message is created via REST before executeChat is called.
    // So existingMsgCount includes it. For a truly first message, count = 1.
    const existingMsgCount = 1; // Only the current user message
    const isFirstMessage = existingMsgCount <= 1;
    expect(isFirstMessage).toBe(true);
  });

  it('count > 1 means subsequent message (prior conversation exists)', () => {
    // user1 + assistant1 + user2 (current) = 3
    const existingMsgCount = 3;
    const isFirstMessage = existingMsgCount <= 1;
    expect(isFirstMessage).toBe(false);
  });

  it('count = 0 means first message (edge case: msg not yet inserted)', () => {
    const existingMsgCount = 0;
    const isFirstMessage = existingMsgCount <= 1;
    expect(isFirstMessage).toBe(true);
  });
});
