/**
 * AIRA Backend Lifecycle — embeddable start/stop API.
 * Used by both CLI (server.ts) and Electron (electron/main.ts).
 */
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import fs from 'node:fs';
import path from 'node:path';
import { app } from './app.js';
import { initializeDatabase, getDatabase, closeDatabase } from './db/index.js';
import { runPreflight } from './services/preflight.js';
import { attachWebSocket } from './services/ws.service.js';
import { seedBuiltinSkills } from './services/skills.service.js';
import { seedBuiltinMcpAll } from './services/mcp.service.js';
import type { Server } from 'node:http';

let server4: ServerType | null = null;
let server6: ServerType | null = null;

export interface StartOptions {
  port: number;
  hostname?: string; // default: '127.0.0.1', use '0.0.0.0' for Docker
}

export interface StartResult {
  port: number;
  servers: { ipv4: boolean; ipv6: boolean };
}

/**
 * Start the AIRA backend on the given port.
 * Throws on fatal errors instead of calling process.exit().
 */
export async function startServer(portOrOpts: number | StartOptions): Promise<StartResult> {
  const opts = typeof portOrOpts === 'number' ? { port: portOrOpts } : portOrOpts;
  const { port, hostname } = opts;
  const bindHost = hostname ?? '127.0.0.1';
  // 1. Preflight
  const preflight = runPreflight();
  console.log('[AIRA] Preflight results:');
  for (const [key, check] of Object.entries(preflight)) {
    if (key === 'allPassed') continue;
    const status = (check as { ok: boolean }).ok ? '✓' : '✗';
    console.log(`  ${status} ${key}: ${(check as { message?: string }).message ?? ''}`);
  }

  if (!preflight.allPassed) {
    throw new Error('Preflight checks failed. Cannot start server.');
  }

  // 2. Database (async init for sql.js WASM)
  await initializeDatabase();
  console.log('[AIRA] Database initialized');

  // 3. Orphan recovery
  recoverOrphanRuns();

  // 4. Seed built-ins
  seedBuiltinSkills();
  seedBuiltinMcpAll();
  console.log('[AIRA] Built-in skills and MCP seeded');

  // 5. Start servers
  let hasIpv4 = false;
  let hasIpv6 = false;

  try {
    server4 = serve({ fetch: app.fetch, hostname: bindHost, port });
    attachWebSocket(server4 as unknown as Server, port);
    hasIpv4 = true;
    console.log(`[AIRA] Listening on http://${bindHost}:${port}`);
  } catch (err) {
    console.warn(`[AIRA] Failed to bind IPv4: ${err instanceof Error ? err.message : err}`);
  }

  if (bindHost === '127.0.0.1') {
    try {
      server6 = serve({ fetch: app.fetch, hostname: '::1', port });
      attachWebSocket(server6 as unknown as Server, port);
      hasIpv6 = true;
      console.log(`[AIRA] Listening on http://[::1]:${port}`);
    } catch (err) {
      console.warn(`[AIRA] Failed to bind IPv6: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!hasIpv4 && !hasIpv6) {
    throw new Error(`Failed to bind to any address on port ${port}`);
  }

  console.log('[AIRA] Server started successfully');
  return { port, servers: { ipv4: hasIpv4, ipv6: hasIpv6 } };
}

/** Stop the AIRA backend gracefully. */
export function stopServer(): void {
  console.log('[AIRA] Shutting down...');
  if (server4) {
    server4.close();
    server4 = null;
  }
  if (server6) {
    server6.close();
    server6 = null;
  }
  closeDatabase();
  console.log('[AIRA] Shutdown complete');
}

function recoverOrphanRuns(): void {
  const db = getDatabase();
  const orphans = db
    .prepare("SELECT id, project_id FROM agent_runs WHERE status IN ('running', 'queued')")
    .all() as Array<{ id: string; project_id: string }>;

  if (orphans.length === 0) return;

  const update = db.prepare(
    "UPDATE agent_runs SET status = 'failed', finished_at = CURRENT_TIMESTAMP, error_type = 'server_crash' WHERE id = ?",
  );

  const tx = db.transaction(() => {
    for (const orphan of orphans) {
      update.run(orphan.id);
      console.log(`[AIRA] Recovered orphan Run ${orphan.id} (project: ${orphan.project_id})`);
    }
  });

  tx();
  console.log(`[AIRA] Recovered ${orphans.length} orphan run(s)`);
}

/**
 * Enable serving frontend static files from the backend.
 * Used by Electron to serve the frontend from the same HTTP origin.
 * Must be called BEFORE startServer().
 */
export function enableStaticServing(frontendDir: string): void {
  // Serve static files for non-API, non-WS routes
  app.get('*', (c) => {
    const urlPath = new URL(c.req.url).pathname;

    // Skip API and health routes
    if (urlPath.startsWith('/api/') || urlPath === '/health') {
      return c.notFound();
    }

    // Try to serve the file
    const filePath = urlPath === '/' ? 'index.html' : urlPath.slice(1);
    const fullPath = path.join(frontendDir, filePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const content = fs.readFileSync(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.wasm': 'application/wasm',
      };
      return c.body(content, 200, {
        'Content-Type': mimeTypes[ext] ?? 'application/octet-stream',
      });
    }

    // SPA fallback: serve index.html for client-side routing
    const indexPath = path.join(frontendDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath);
      return c.body(content, 200, { 'Content-Type': 'text/html' });
    }

    return c.notFound();
  });
}

export { server4, server6 };
