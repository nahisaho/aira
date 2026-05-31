import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import crypto from 'node:crypto';

const PORT = parseInt(process.env.AIRA_PORT ?? '3000', 10);
const VITE_DEV_PORT = parseInt(process.env.VITE_DEV_PORT ?? '5173', 10);

function getAllowedOrigins(): string[] {
  const vitePort = parseInt(process.env.VITE_DEV_PORT ?? '5173', 10);
  const origins = [
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    `http://[::1]:${PORT}`,
    // Vite dev server (port may vary if default is busy)
    `http://localhost:${vitePort}`,
    `http://127.0.0.1:${vitePort}`,
    `http://[::1]:${vitePort}`,
  ];
  if (vitePort === 5173) {
    origins.push(`http://localhost:5174`, `http://127.0.0.1:5174`, `http://[::1]:5174`);
  }
  // AIRA_PUBLIC_URL (v3.1.3) — single URL the browser uses to reach AIRA, for
  // Docker `-p` mappings and LAN / reverse-proxy access.
  if (process.env.AIRA_PUBLIC_URL) {
    try {
      const u = new URL(process.env.AIRA_PUBLIC_URL);
      origins.push(`${u.protocol}//${u.host}`);
    } catch { /* malformed; skip */ }
  }
  if (process.env.AIRA_ALLOWED_ORIGINS) {
    origins.push(
      ...process.env.AIRA_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean),
    );
  }
  return origins;
}

/**
 * Check whether an Origin is allowed.
 * Accepts if:
 *  - Origin is in the static allowlist (env-configurable via AIRA_ALLOWED_ORIGINS), OR
 *  - Origin's host:port matches the request's Host header (same-origin).
 *
 * Same-origin matching lets users access the server via any LAN IP / hostname
 * without explicit configuration, while still blocking browser-driven
 * cross-origin attacks: evil.com cannot forge the Host header — it is set by
 * the browser to the host the user actually loaded.
 */
export function isOriginAllowed(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;
  if (host) {
    try {
      if (new URL(origin).host === host) return true;
    } catch { /* malformed Origin */ }
  }
  return false;
}

/**
 * Resolve the effective request host. Prefer the URL captured by the adapter
 * (always set, even in test mode); fall back to the Host header.
 */
function effectiveHost(c: Context): string | undefined {
  try {
    return new URL(c.req.url).host;
  } catch {
    return c.req.header('host');
  }
}

// ── CSRF token store ───────────────────────────────────────────────
//
// In-memory token store keyed by token, value = expiresAt (ms epoch).
// Each token expires after TTL_MS; the store is capped at MAX_TOKENS to
// prevent unbounded growth from token-refresh storms / CSRF endpoint abuse.
// Eviction is FIFO: when the cap is reached, the oldest 10% are dropped.
const CSRF_TTL_MS = parseInt(process.env.AIRA_CSRF_TTL_MS ?? String(24 * 60 * 60 * 1000), 10);
const CSRF_MAX_TOKENS = parseInt(process.env.AIRA_CSRF_MAX_TOKENS ?? '10000', 10);
const CSRF_EVICT_BATCH = Math.max(1, Math.floor(CSRF_MAX_TOKENS / 10));

const csrfTokens = new Map<string, number>();

function isValidCsrfToken(token: string): boolean {
  const expiresAt = csrfTokens.get(token);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    csrfTokens.delete(token);
    return false;
  }
  return true;
}

/**
 * Sweep expired tokens. Called opportunistically on issuance — keeps the map
 * trimmed without a background timer (which would prevent process exit in
 * tests).
 */
function sweepExpired(now: number): void {
  for (const [token, expiresAt] of csrfTokens) {
    if (expiresAt <= now) csrfTokens.delete(token);
  }
}

/**
 * Origin validation middleware for state-changing requests.
 * Applies uniformly in dev and serve-frontend (Docker) mode — the previous
 * blanket bypass in serve-frontend mode allowed cross-origin attackers to
 * drive the agent via CSRF token disclosure through `*`-echoing CORS.
 */
export const originMiddleware = createMiddleware(async (c, next) => {
  const method = c.req.method;

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const origin = c.req.header('origin');
  if (!origin) {
    // Non-browser tooling (curl, scripts) without Origin. CSRF token is still
    // required and provides the actual defence. Allow in serve-frontend mode
    // where local tooling is expected; reject in dev mode to keep defaults
    // strict.
    if (process.env.AIRA_SERVE_FRONTEND === 'true') return next();
    return c.json({ error: 'Missing Origin header' }, 403);
  }

  if (!isOriginAllowed(origin, effectiveHost(c))) {
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
  if (!token || !isValidCsrfToken(token)) {
    return c.json({ error: 'Invalid or missing CSRF token' }, 403);
  }

  return next();
});

/**
 * CORS middleware with allowlist + same-origin echo (never wildcard).
 * Cross-origin requests from outside the allowlist receive no CORS headers,
 * which prevents browsers from exposing the response to the attacker page —
 * including the CSRF token endpoint.
 */
export const corsMiddleware = createMiddleware(async (c, next) => {
  const origin = c.req.header('origin');

  if (origin && isOriginAllowed(origin, effectiveHost(c))) {
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
  const ports = [PORT, VITE_DEV_PORT];
  if (VITE_DEV_PORT === 5173) ports.push(5174);
  const connectSrc = ports.flatMap(p => [
    `http://localhost:${p}`, `ws://localhost:${p}`,
    `http://127.0.0.1:${p}`, `ws://127.0.0.1:${p}`,
  ]).join(' ');

  // v3.1.0 — frame-src allows AIRA UI to embed JupyterLab. Same loopback
  // host:port shape as connect-src. AIRA_JUPYTER_PUBLIC_URL is added when set
  // so deployments behind a reverse proxy / non-localhost hostname work.
  const jupyterPort = parseInt(process.env.AIRA_JUPYTER_PORT ?? '8888', 10);
  const frameSrcParts = new Set<string>([
    "'self'",
    `http://localhost:${jupyterPort}`,
    `http://127.0.0.1:${jupyterPort}`,
  ]);
  if (process.env.AIRA_JUPYTER_PUBLIC_URL) {
    try {
      const u = new URL(process.env.AIRA_JUPYTER_PUBLIC_URL);
      frameSrcParts.add(`${u.protocol}//${u.host}`);
    } catch { /* malformed env, skip */ }
  }
  const frameSrc = Array.from(frameSrcParts).join(' ');

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
      `frame-src ${frameSrc}`,
    ].join('; '),
  );

  return next();
});

export function generateCsrfToken(): string {
  const now = Date.now();

  // Lazy GC: sweep expired entries before considering eviction.
  sweepExpired(now);

  // FIFO eviction if still over cap. Map preserves insertion order, so the
  // first N iterated keys are the oldest.
  if (csrfTokens.size >= CSRF_MAX_TOKENS) {
    let dropped = 0;
    for (const key of csrfTokens.keys()) {
      csrfTokens.delete(key);
      if (++dropped >= CSRF_EVICT_BATCH) break;
    }
  }

  const token = crypto.randomUUID();
  csrfTokens.set(token, now + CSRF_TTL_MS);
  return token;
}

export { getAllowedOrigins, csrfTokens, CSRF_TTL_MS, CSRF_MAX_TOKENS, isValidCsrfToken };
