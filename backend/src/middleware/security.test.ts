import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import {
  originMiddleware,
  csrfMiddleware,
  corsMiddleware,
  cspMiddleware,
  generateCsrfToken,
  csrfTokens,
  isOriginAllowed,
  isValidCsrfToken,
  CSRF_MAX_TOKENS,
} from './security.js';

function createTestApp(): Hono {
  const app = new Hono();
  app.use('*', corsMiddleware);
  app.use('*', cspMiddleware);
  app.use('/api/*', originMiddleware);
  app.use('/api/*', csrfMiddleware);

  app.get('/api/csrf-token', (c) => c.json({ token: generateCsrfToken() }));
  app.get('/api/test', (c) => c.json({ ok: true }));
  app.post('/api/test', (c) => c.json({ ok: true }));
  app.delete('/api/test', (c) => c.json({ ok: true }));

  return app;
}

describe('Security Middleware', () => {
  let app: Hono;

  beforeEach(() => {
    csrfTokens.clear();
    app = createTestApp();
  });

  describe('Origin validation', () => {
    it('should allow GET without Origin', async () => {
      const res = await app.request('/api/test');
      expect(res.status).toBe(200);
    });

    it('should reject POST without Origin', async () => {
      const token = generateCsrfToken();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: { 'X-AIRA-Token': token },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Origin');
    });

    it('should reject POST with wrong Origin', async () => {
      const token = generateCsrfToken();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: {
          Origin: 'http://evil.com',
          'X-AIRA-Token': token,
        },
      });
      expect(res.status).toBe(403);
    });

    it('should allow POST with correct Origin', async () => {
      const token = generateCsrfToken();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          'X-AIRA-Token': token,
        },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('CSRF validation', () => {
    it('should reject POST without CSRF token', async () => {
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('CSRF');
    });

    it('should reject POST with invalid CSRF token', async () => {
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          'X-AIRA-Token': 'invalid-token',
        },
      });
      expect(res.status).toBe(403);
    });

    it('should allow POST with valid CSRF token', async () => {
      const token = generateCsrfToken();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          'X-AIRA-Token': token,
        },
      });
      expect(res.status).toBe(200);
    });

    it('should allow csrf-token endpoint without CSRF header', async () => {
      const res = await app.request('/api/csrf-token');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
    });
  });

  describe('CSP headers', () => {
    it('should include CSP header with port-pinned connect-src', async () => {
      const res = await app.request('/api/test');
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
      expect(csp).toContain('connect-src');
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('should include frame-src allowing the Jupyter port (v3.1.0 GUI)', async () => {
      const res = await app.request('/api/test');
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toContain('frame-src');
      expect(csp).toContain('http://localhost:8888');
      expect(csp).toContain('http://127.0.0.1:8888');
    });

    it('should add AIRA_JUPYTER_PUBLIC_URL to frame-src when set', async () => {
      process.env.AIRA_JUPYTER_PUBLIC_URL = 'https://jupyter.example.com';
      try {
        const res = await app.request('/api/test');
        const csp = res.headers.get('Content-Security-Policy');
        expect(csp).toContain('https://jupyter.example.com');
      } finally {
        delete process.env.AIRA_JUPYTER_PUBLIC_URL;
      }
    });
  });

  describe('CORS', () => {
    it('should echo allowed origin', async () => {
      const res = await app.request('/api/test', {
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });

    it('should not set CORS header for disallowed origin', async () => {
      const res = await app.request('/api/test', {
        headers: { Origin: 'http://evil.com' },
      });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should not use wildcard', async () => {
      const res = await app.request('/api/test', {
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(res.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
    });

    it('should handle OPTIONS preflight', async () => {
      const res = await app.request('/api/test', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(res.status).toBe(204);
    });
  });

  describe('Serve-frontend mode (Docker) — same-origin LAN access', () => {
    beforeEach(() => {
      process.env.AIRA_SERVE_FRONTEND = 'true';
    });
    afterEach(() => {
      delete process.env.AIRA_SERVE_FRONTEND;
    });

    it('should allow POST when Origin matches request Host (same-origin LAN IP)', async () => {
      const token = generateCsrfToken();
      const res = await app.request('http://192.168.1.100:3001/api/test', {
        method: 'POST',
        headers: {
          Origin: 'http://192.168.1.100:3001',
          'X-AIRA-Token': token,
        },
      });
      expect(res.status).toBe(200);
    });

    it('should allow POST without Origin header (non-browser tooling)', async () => {
      const token = generateCsrfToken();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: { 'X-AIRA-Token': token },
      });
      expect(res.status).toBe(200);
    });

    it('should still require CSRF token', async () => {
      const res = await app.request('http://192.168.1.100:3001/api/test', {
        method: 'POST',
        headers: { Origin: 'http://192.168.1.100:3001' },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('CSRF');
    });

    it('should reject cross-origin POST from evil.com (CSWSH defence)', async () => {
      const token = generateCsrfToken();
      const res = await app.request('http://192.168.1.100:3001/api/test', {
        method: 'POST',
        headers: {
          Origin: 'http://evil.com',
          'X-AIRA-Token': token,
        },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Origin');
    });

    it('should not set CORS header for cross-origin attacker (blocks token exfiltration)', async () => {
      const res = await app.request('http://192.168.1.100:3001/api/csrf-token', {
        headers: { Origin: 'http://evil.com' },
      });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should echo CORS header for same-origin LAN IP', async () => {
      const res = await app.request('http://192.168.1.100:3001/api/test', {
        headers: { Origin: 'http://192.168.1.100:3001' },
      });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://192.168.1.100:3001');
    });

    it('should reject when Origin host differs from request Host (Origin spoof)', async () => {
      const token = generateCsrfToken();
      // Attacker page sets Origin pointing to a different host than the one
      // the request actually targets — this is the classic cross-origin shape.
      const res = await app.request('http://192.168.1.100:3001/api/test', {
        method: 'POST',
        headers: {
          Origin: 'http://10.0.0.5:3001',
          'X-AIRA-Token': token,
        },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('isOriginAllowed helper', () => {
    it('should accept origin in static allowlist', () => {
      expect(isOriginAllowed('http://localhost:3000', 'localhost')).toBe(true);
    });

    it('should accept same-origin (Origin host == request Host)', () => {
      expect(isOriginAllowed('http://192.168.1.100:3001', '192.168.1.100:3001')).toBe(true);
    });

    it('should reject when Origin host does not match Host header and not in allowlist', () => {
      expect(isOriginAllowed('http://evil.com', '192.168.1.100:3001')).toBe(false);
    });

    it('should reject malformed Origin', () => {
      expect(isOriginAllowed('not-a-url', '192.168.1.100:3001')).toBe(false);
    });

    it('should reject empty Origin', () => {
      expect(isOriginAllowed(undefined, '192.168.1.100:3001')).toBe(false);
      expect(isOriginAllowed('', '192.168.1.100:3001')).toBe(false);
    });

    it('should accept origin from AIRA_ALLOWED_ORIGINS env', () => {
      process.env.AIRA_ALLOWED_ORIGINS = 'http://aira.example.com';
      try {
        expect(isOriginAllowed('http://aira.example.com', 'aira.example.com')).toBe(true);
      } finally {
        delete process.env.AIRA_ALLOWED_ORIGINS;
      }
    });
  });

  describe('CSRF token lifecycle (TTL + cap)', () => {
    beforeEach(() => {
      csrfTokens.clear();
    });

    it('issues a token that is valid immediately', () => {
      const token = generateCsrfToken();
      expect(isValidCsrfToken(token)).toBe(true);
    });

    it('rejects unknown tokens', () => {
      expect(isValidCsrfToken('not-issued')).toBe(false);
    });

    it('marks a token invalid after its TTL elapses and evicts it', () => {
      const token = generateCsrfToken();
      // Force the token's expiry to the past — simulates TTL elapse without
      // waiting 24h or mocking the clock.
      csrfTokens.set(token, Date.now() - 1);
      expect(isValidCsrfToken(token)).toBe(false);
      expect(csrfTokens.has(token)).toBe(false);
    });

    it('evicts oldest tokens when the cap is reached (FIFO)', () => {
      // Fill to cap, then issue one more.
      const issued: string[] = [];
      for (let i = 0; i < CSRF_MAX_TOKENS; i++) {
        issued.push(generateCsrfToken());
      }
      expect(csrfTokens.size).toBe(CSRF_MAX_TOKENS);

      const overflow = generateCsrfToken();
      // The new token must still be valid; size stays at or below the cap.
      expect(csrfTokens.size).toBeLessThanOrEqual(CSRF_MAX_TOKENS);
      expect(isValidCsrfToken(overflow)).toBe(true);

      // Oldest tokens should have been dropped in FIFO order.
      const droppedSomeOldest = issued.slice(0, 10).some(t => !csrfTokens.has(t));
      expect(droppedSomeOldest).toBe(true);
    });

    it('sweeps already-expired tokens during issuance', () => {
      const stale = generateCsrfToken();
      csrfTokens.set(stale, Date.now() - 1_000);
      const sizeBefore = csrfTokens.size;

      generateCsrfToken(); // triggers sweepExpired internally

      // Stale token should be gone; net size grows by at most 0 (issued 1, evicted 1).
      expect(csrfTokens.has(stale)).toBe(false);
      expect(csrfTokens.size).toBe(sizeBefore);
    });
  });
});
