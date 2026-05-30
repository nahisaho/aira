import { describe, it, expect, beforeEach } from 'vitest';
import {
  getJupyterUrl,
  getJupyterToken,
  isJupyterRunning,
  resetJupyterStateForTesting,
  setJupyterStateForTesting,
} from './jupyter-server.js';

describe('jupyter-server module', () => {
  beforeEach(() => {
    resetJupyterStateForTesting();
  });

  it('returns null url and token before startup', () => {
    expect(getJupyterUrl()).toBeNull();
    expect(getJupyterToken()).toBeNull();
    expect(isJupyterRunning()).toBe(false);
  });

  it('exposes set state for testing', () => {
    setJupyterStateForTesting(9999, 'fake-token-abc');
    expect(getJupyterUrl()).toBe('http://127.0.0.1:9999');
    expect(getJupyterToken()).toBe('fake-token-abc');
    // The "set" helper does not register a child process, so isJupyterRunning
    // should still report false — only a real spawn flips that flag.
    expect(isJupyterRunning()).toBe(false);
  });

  it('reset clears state', () => {
    setJupyterStateForTesting(9999, 'fake-token-abc');
    resetJupyterStateForTesting();
    expect(getJupyterUrl()).toBeNull();
    expect(getJupyterToken()).toBeNull();
  });
});
