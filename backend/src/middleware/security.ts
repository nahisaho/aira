import { createMiddleware } from 'hono/factory';
import crypto from 'node:crypto';

const PORT = parseInt(process.env.AIRA_PORT ?? '3000', 10);
const VITE_DEV_PORT = 5173;

function getAllowedOrigins(): string[] {
  const origins = [
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    `http://[::1]:${PORT}`,
    // Vite dev server (always allowed in dev)
    `http://localhost:${VITE_DEV_PORT}`,
    `http://127.0.0.1:${VITE_DEV_PORT}`,
    `http://[::1]:${VITE_DEV_PORT}`,
  ];
  return origins;
}

// In-memory CSRF token store (regenerated on restart)
const csrfTokens = new Set<string>();

/**
 * Origin validation middleware for state-changing requests.
 */
export const originMiddleware = createMiddleware(async (c, next) => {
  const method = c.req.method;

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const origin = c.req.header('origin');
  if (!origin) {
    return c.json({ error: 'Missing Origin header' }, 403);
  }

  const allowed = getAllowedOrigins();
  if (!allowed.includes(origin)) {
    return c.json({ error: 'Origin not allowed' }, 403);
  }

  return next();
});

/**
 * CSRF token validation middleware.
 */
export const csrfMiddleware = createMiddleware(async (c, next) => {
  const method = c.req.method;

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  if (c.req.path === '/api/csrf-token') {
    return next();
  }

  const token = c.req.header('x-aira-token');
  if (!token || !csrfTokens.has(token)) {
    return c.json({ error: 'Invalid or missing CSRF token' }, 403);
  }

  return next();
});

/**
 * CORS middleware with allowlist echo (no wildcard).
 */
export const corsMiddleware = createMiddleware(async (c, next) => {
  const origin = c.req.header('origin');
  const allowed = getAllowedOrigins();

  if (origin && allowed.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, X-AIRA-Token');
    c.header('Access-Control-Max-Age', '86400');
  }

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  return next();
});

/**
 * CSP headers middleware with port-pinned connect-src.
 */
export const cspMiddleware = createMiddleware(async (c, next) => {
  const connectSrc = [
    `http://localhost:${PORT}`, `ws://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`, `ws://127.0.0.1:${PORT}`,
    `http://localhost:${VITE_DEV_PORT}`, `ws://localhost:${VITE_DEV_PORT}`,
    `http://127.0.0.1:${VITE_DEV_PORT}`, `ws://127.0.0.1:${VITE_DEV_PORT}`,
  ].join(' ');

  c.header(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'wasm-unsafe-eval'`,
      "style-src 'self' 'unsafe-inline'",
      `connect-src 'self' ${connectSrc}`,
      "img-src 'self' data:",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );

  return next();
});

export function generateCsrfToken(): string {
  const token = crypto.randomUUID();
  csrfTokens.add(token);
  return token;
}

export { getAllowedOrigins, csrfTokens };
