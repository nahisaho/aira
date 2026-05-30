import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getJupyterUrl,
  getJupyterToken,
  getJupyterPublicUrl,
  isJupyterRunning,
  isJupyterPubliclyReachable,
  resetJupyterStateForTesting,
  setJupyterStateForTesting,
} from './jupyter-server.js';

describe('jupyter-server module', () => {
  beforeEach(() => {
    resetJupyterStateForTesting();
  });

  afterEach(() => {
    delete process.env.AIRA_JUPYTER_PUBLIC_URL;
  });

  it('returns null url and token before startup', () => {
    expect(getJupyterUrl()).toBeNull();
    expect(getJupyterToken()).toBeNull();
    expect(getJupyterPublicUrl()).toBeNull();
    expect(isJupyterRunning()).toBe(false);
    expect(isJupyterPubliclyReachable()).toBe(false);
  });

  it('exposes set state for testing — loopback bind (default)', () => {
    setJupyterStateForTesting(9999, 'fake-token-abc');
    expect(getJupyterUrl()).toBe('http://127.0.0.1:9999');
    expect(getJupyterToken()).toBe('fake-token-abc');
    // The "set" helper does not register a child process, so isJupyterRunning
    // should still report false — only a real spawn flips that flag.
    expect(isJupyterRunning()).toBe(false);
    // Default bind in tests is 127.0.0.1 → not publicly reachable
    expect(isJupyterPubliclyReachable()).toBe(false);
  });

  it('reset clears state', () => {
    setJupyterStateForTesting(9999, 'fake-token-abc');
    resetJupyterStateForTesting();
    expect(getJupyterUrl()).toBeNull();
    expect(getJupyterToken()).toBeNull();
    expect(isJupyterPubliclyReachable()).toBe(false);
  });

  it('reports publicly reachable when bind is 0.0.0.0', () => {
    setJupyterStateForTesting(8888, 't', '0.0.0.0');
    expect(isJupyterPubliclyReachable()).toBe(true);
  });

  it('reports not reachable for any 127.x bind', () => {
    setJupyterStateForTesting(8888, 't', '127.0.0.1');
    expect(isJupyterPubliclyReachable()).toBe(false);
    setJupyterStateForTesting(8888, 't', 'localhost');
    expect(isJupyterPubliclyReachable()).toBe(false);
  });

  it('getJupyterPublicUrl defaults to localhost:<port>', () => {
    setJupyterStateForTesting(8888, 't', '0.0.0.0');
    expect(getJupyterPublicUrl()).toBe('http://localhost:8888');
  });

  it('getJupyterPublicUrl honours AIRA_JUPYTER_PUBLIC_URL env', () => {
    process.env.AIRA_JUPYTER_PUBLIC_URL = 'https://jupyter.example.com';
    setJupyterStateForTesting(8888, 't', '0.0.0.0');
    expect(getJupyterPublicUrl()).toBe('https://jupyter.example.com');
  });

  it('getJupyterUrl always returns loopback (internal subprocess use)', () => {
    // Even when bound to 0.0.0.0, AIRA-internal subprocesses use loopback
    setJupyterStateForTesting(8888, 't', '0.0.0.0');
    expect(getJupyterUrl()).toBe('http://127.0.0.1:8888');
  });
});
