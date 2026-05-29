/**
 * Credential Proxy  (CoreClaw-inspired)
 *
 * Listens on a local port and proxies requests to the GitHub API,
 * injecting the real GITHUB_TOKEN into Authorization headers.
 *
 * Docker containers run with:
 *   -e GITHUB_API_URL=http://host-gateway:<port>
 *   -e AIRA_PROXY_AUTH=<shared secret>
 *
 * This way containers never hold the raw token — they just call this proxy.
 * The proxy reads the current token from AuthService on every request so
 * settings changes take effect immediately without restarting.
 *
 * Authentication: every request must carry `X-AIRA-Proxy-Auth: <secret>`.
 * The secret is generated at proxy start; AIRA-managed subprocesses receive
 * it via env so they can call the proxy, while other local processes on the
 * host cannot piggyback on the stored token.
 *
 * Port defaults to 3001, configurable via CREDENTIAL_PROXY_PORT env var.
 */

import crypto from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import type { RequestOptions } from 'node:http';

// Token supplier function — injected at startup so this module stays testable
// without importing AuthService directly (which pulls in the full DB stack).
let _getToken: () => string | null = () => null;

export function setTokenSupplier(fn: () => string | null): void {
  _getToken = fn;
}

/** Port the credential proxy listens on. Exported so container-runner can read it. */
export const PROXY_PORT = parseInt(process.env.CREDENTIAL_PROXY_PORT ?? '3001', 10);

/** Upstream GitHub API base URL. Read at proxy start so tests can override. */
function getUpstreamUrl(): string {
  return process.env.COPILOT_API_URL ?? 'https://api.github.com';
}

// Shared-secret auth. Generated lazily on first proxy start; persists across
// restart calls within the same process so subprocesses that captured it via
// env stay valid through proxy restarts (rare, but covers the test path).
let _proxyAuth: string | null = null;

/** Reveal the proxy auth secret. Used by subprocess env injection. */
export function getProxyAuth(): string {
  if (!_proxyAuth) {
    _proxyAuth = crypto.randomBytes(32).toString('hex');
  }
  return _proxyAuth;
}

/** For tests: reset the auth secret so each test gets fresh state. */
export function resetProxyAuthForTesting(): void {
  _proxyAuth = null;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function startCredentialProxy(port: number, host = '127.0.0.1'): Promise<Server> {
  const upstreamUrl = getUpstreamUrl();
  const upstream = new URL(upstreamUrl);
  const isHttps = upstream.protocol === 'https:';
  const makeRequest = isHttps ? httpsRequest : httpRequest;
  const expectedAuth = getProxyAuth();

  const server = createServer((req, res) => {
    // ── Authentication ─────────────────────────────────────────────────
    const auth = req.headers['x-aira-proxy-auth'];
    if (typeof auth !== 'string' || !timingSafeEqualStr(auth, expectedAuth)) {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Unauthorized');
      // Drain the body so the socket stays usable.
      req.resume();
      return;
    }

    // Request size limit: 10MB
    const MAX_BODY = 10 * 1024 * 1024;
    let bodySize = 0;

    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      bodySize += c.length;
      if (bodySize > MAX_BODY) {
        req.destroy();
        if (!res.headersSent) { res.writeHead(413); res.end('Payload Too Large'); }
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (bodySize > MAX_BODY) return;
      const body = Buffer.concat(chunks);

      // Whitelist only safe headers to forward upstream
      const ALLOWED_HEADERS = new Set([
        'content-type', 'accept', 'accept-encoding', 'accept-language',
        'user-agent', 'x-request-id', 'x-github-api-version',
      ]);
      const headers: Record<string, string | number | string[]> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        const lower = k.toLowerCase();
        if (ALLOWED_HEADERS.has(lower) && v !== undefined) {
          headers[k] = v as string | string[];
        }
      }
      headers['host'] = upstream.host;
      headers['content-length'] = body.length;

      // Inject current token (from settings or GITHUB_TOKEN env var)
      const token = _getToken();
      if (token) {
        headers['authorization'] = `Bearer ${token}`;
      }

      const opts: RequestOptions = {
        hostname: upstream.hostname,
        port: upstream.port || (isHttps ? 443 : 80),
        path: req.url,
        method: req.method,
        headers,
      };

      const proxyReq = makeRequest(opts, (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers as Record<string, string>);
        proxyRes.pipe(res, { end: true });
      });

      // Timeout upstream requests after 30 seconds
      proxyReq.setTimeout(30_000, () => {
        proxyReq.destroy();
        if (!res.headersSent) {
          res.writeHead(504);
          res.end('Gateway Timeout');
        }
      });

      proxyReq.on('error', (err) => {
        console.error('[credential-proxy] upstream error:', err.message);
        if (!res.headersSent) {
          res.writeHead(502);
          res.end('Bad Gateway');
        }
      });

      proxyReq.end(body);
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      const actualPort = (server.address() as { port: number } | null)?.port ?? port;
      console.log(`[credential-proxy] Listening on http://${host}:${actualPort} → ${upstreamUrl} (auth required)`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

export function stopCredentialProxy(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}
