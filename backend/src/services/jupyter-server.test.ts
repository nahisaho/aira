import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getJupyterUrl,
  getJupyterToken,
  getJupyterPublicUrl,
  isJupyterRunning,
  isJupyterPubliclyReachable,
  resetJupyterStateForTesting,
  setJupyterStateForTesting,
  frameAncestorOrigins,
  kernelCullArgs,
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

  describe('frameAncestorOrigins (v3.1.3) — iframe parent allowlist for JupyterLab', () => {
    afterEach(() => {
      delete process.env.AIRA_PUBLIC_URL;
      delete process.env.AIRA_ALLOWED_ORIGINS;
    });

    it("includes 'self' and common publish ports by default (3000-3003)", () => {
      const ancestors = frameAncestorOrigins();
      expect(ancestors).toContain("'self'");
      for (const p of [3000, 3001, 3002, 3003]) {
        expect(ancestors).toContain(`http://localhost:${p}`);
        expect(ancestors).toContain(`http://127.0.0.1:${p}`);
      }
    });

    it('includes Vite dev ports (5173-5175)', () => {
      const ancestors = frameAncestorOrigins();
      for (const p of [5173, 5174, 5175]) {
        expect(ancestors).toContain(`http://localhost:${p}`);
      }
    });

    it('honours AIRA_PUBLIC_URL (single URL for LAN / hostname / reverse proxy)', () => {
      process.env.AIRA_PUBLIC_URL = 'http://192.168.1.100:3001';
      const ancestors = frameAncestorOrigins();
      expect(ancestors).toContain('http://192.168.1.100:3001');
    });

    it('normalises AIRA_PUBLIC_URL by stripping path / query', () => {
      process.env.AIRA_PUBLIC_URL = 'https://aira.example.com:8443/some/path?x=1';
      const ancestors = frameAncestorOrigins();
      expect(ancestors).toContain('https://aira.example.com:8443');
      expect(ancestors).not.toContain('/some/path');
    });

    it('honours AIRA_ALLOWED_ORIGINS (comma-separated)', () => {
      process.env.AIRA_ALLOWED_ORIGINS = 'http://lan-a:3001,http://lan-b:3001';
      const ancestors = frameAncestorOrigins();
      expect(ancestors).toContain('http://lan-a:3001');
      expect(ancestors).toContain('http://lan-b:3001');
    });

    it('silently skips a malformed AIRA_PUBLIC_URL', () => {
      process.env.AIRA_PUBLIC_URL = 'not a url';
      const ancestors = frameAncestorOrigins();
      expect(ancestors).toContain("'self'");
      expect(ancestors).toContain('http://localhost:3001');
    });
  });

  describe('kernelCullArgs (v3.6.0) — reap lingering idle kernels', () => {
    afterEach(() => {
      delete process.env.AIRA_JUPYTER_CULL_IDLE_TIMEOUT;
      delete process.env.AIRA_JUPYTER_CULL_INTERVAL;
      delete process.env.AIRA_JUPYTER_CULL_CONNECTED;
    });

    it('enables culling with sane defaults', () => {
      const args = kernelCullArgs();
      expect(args).toContain('--MappingKernelManager.cull_idle_timeout=1800');
      expect(args).toContain('--MappingKernelManager.cull_interval=120');
      // Connected kernels MUST be culled — the MCP child / iframe hold the
      // connection that otherwise keeps an idle kernel alive forever.
      expect(args).toContain('--MappingKernelManager.cull_connected=True');
      // Busy (executing) kernels are never culled.
      expect(args).toContain('--MappingKernelManager.cull_busy=False');
    });

    it('honours AIRA_JUPYTER_CULL_IDLE_TIMEOUT / INTERVAL overrides', () => {
      process.env.AIRA_JUPYTER_CULL_IDLE_TIMEOUT = '600';
      process.env.AIRA_JUPYTER_CULL_INTERVAL = '60';
      const args = kernelCullArgs();
      expect(args).toContain('--MappingKernelManager.cull_idle_timeout=600');
      expect(args).toContain('--MappingKernelManager.cull_interval=60');
    });

    it('disables culling when idle timeout is 0', () => {
      process.env.AIRA_JUPYTER_CULL_IDLE_TIMEOUT = '0';
      expect(kernelCullArgs()).toEqual([]);
    });

    it('disables culling on a non-numeric idle timeout', () => {
      process.env.AIRA_JUPYTER_CULL_IDLE_TIMEOUT = 'off';
      expect(kernelCullArgs()).toEqual([]);
    });

    it('spares connected kernels when AIRA_JUPYTER_CULL_CONNECTED=false', () => {
      process.env.AIRA_JUPYTER_CULL_CONNECTED = 'false';
      expect(kernelCullArgs()).toContain('--MappingKernelManager.cull_connected=False');
    });

    it('falls back to default interval when override is invalid', () => {
      process.env.AIRA_JUPYTER_CULL_INTERVAL = '-5';
      expect(kernelCullArgs()).toContain('--MappingKernelManager.cull_interval=120');
    });
  });
});
