import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  originMiddleware,
  csrfMiddleware,
  corsMiddleware,
  cspMiddleware,
  generateCsrfToken,
  csrfTokens,
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
});
