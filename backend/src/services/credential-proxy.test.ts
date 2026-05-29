import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server, type AddressInfo } from 'node:http';
import {
  startCredentialProxy,
  stopCredentialProxy,
  getProxyAuth,
  resetProxyAuthForTesting,
  setTokenSupplier,
} from './credential-proxy.js';

// ── Mock upstream ─────────────────────────────────────────────────────
let upstream: Server;
let upstreamPort: number;
let lastUpstreamAuth: string | undefined;

beforeAll(async () => {
  upstream = createServer((req, res) => {
    lastUpstreamAuth = req.headers['authorization'] as string | undefined;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, path: req.url }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', () => resolve()));
  upstreamPort = (upstream.address() as AddressInfo).port;
  process.env.COPILOT_API_URL = `http://127.0.0.1:${upstreamPort}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
  delete process.env.COPILOT_API_URL;
});

// ── Proxy under test ──────────────────────────────────────────────────
let proxy: Server;
let proxyPort: number;

beforeAll(async () => {
  resetProxyAuthForTesting();
  setTokenSupplier(() => 'fake-github-token');
  proxy = await startCredentialProxy(0);
  proxyPort = (proxy.address() as AddressInfo).port;
});

afterAll(async () => {
  await stopCredentialProxy(proxy);
});

beforeEach(() => {
  lastUpstreamAuth = undefined;
});

describe('credential proxy auth', () => {
  it('rejects requests without X-AIRA-Proxy-Auth header with 401', async () => {
    const res = await fetch(`http://127.0.0.1:${proxyPort}/user`);
    expect(res.status).toBe(401);
    // Upstream must not have been contacted
    expect(lastUpstreamAuth).toBeUndefined();
  });

  it('rejects requests with an incorrect auth header with 401', async () => {
    const res = await fetch(`http://127.0.0.1:${proxyPort}/user`, {
      headers: { 'X-AIRA-Proxy-Auth': 'wrong-secret' },
    });
    expect(res.status).toBe(401);
    expect(lastUpstreamAuth).toBeUndefined();
  });

  it('accepts requests with the correct auth and injects the GitHub token', async () => {
    const res = await fetch(`http://127.0.0.1:${proxyPort}/user`, {
      headers: { 'X-AIRA-Proxy-Auth': getProxyAuth() },
    });
    expect(res.status).toBe(200);
    expect(lastUpstreamAuth).toBe('Bearer fake-github-token');
  });

  it('rejects POST without auth even when body is provided', async () => {
    const res = await fetch(`http://127.0.0.1:${proxyPort}/anything`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'payload' }),
    });
    expect(res.status).toBe(401);
    expect(lastUpstreamAuth).toBeUndefined();
  });

  it('issues a hex-encoded secret of meaningful length', () => {
    const secret = getProxyAuth();
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
  });
});
