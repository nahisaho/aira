/**
 * Credential Proxy  (CoreClaw-inspired)
 *
 * Listens on a local port and proxies requests to the GitHub API,
 * injecting the real GITHUB_TOKEN into Authorization headers.
 *
 * Docker containers run with:
 *   -e GITHUB_API_URL=http://host-gateway:<port>
 *
 * This way containers never hold the raw token — they just call this proxy.
 * The proxy reads the current token from AuthService on every request so
 * settings changes take effect immediately without restarting.
 *
 * Port defaults to 3001, configurable via CREDENTIAL_PROXY_PORT env var.
 */

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

/** Upstream GitHub API base URL. Can be overridden for testing. */
const UPSTREAM_URL = process.env.COPILOT_API_URL ?? 'https://api.github.com';

// Headers that must not be forwarded to prevent connection reuse issues.
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

export function startCredentialProxy(port: number, host = '127.0.0.1'): Promise<Server> {
  const upstream = new URL(UPSTREAM_URL);
  const isHttps = upstream.protocol === 'https:';
  const makeRequest = isHttps ? httpsRequest : httpRequest;

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);

      // Build upstream request headers
      const headers: Record<string, string | number | string[]> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (!HOP_BY_HOP.has(k.toLowerCase()) && v !== undefined) {
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
      console.log(`[credential-proxy] Listening on http://${host}:${port} → ${UPSTREAM_URL}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

export function stopCredentialProxy(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}
