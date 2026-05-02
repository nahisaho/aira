import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { app } from './app.js';
import { getDatabase, closeDatabase } from './db/index.js';
import { runPreflight } from './services/preflight.js';
import { attachWebSocket } from './services/ws.service.js';
import type { Server } from 'node:http';

const PORT = parseInt(process.env.AIRA_PORT ?? '3000', 10);

let server4: ServerType | null = null;
let server6: ServerType | null = null;

async function startup(): Promise<void> {
  // 1. Run preflight checks
  const preflight = runPreflight();
  console.log('[AIRA] Preflight results:');
  for (const [key, check] of Object.entries(preflight)) {
    if (key === 'allPassed') continue;
    const status = (check as { ok: boolean }).ok ? '✓' : '✗';
    console.log(`  ${status} ${key}: ${(check as { message?: string }).message ?? ''}`);
  }

  if (!preflight.allPassed) {
    console.error('[AIRA] FATAL: Preflight checks failed. Cannot start server.');
    process.exit(1);
  }

  // 2. Initialize database (creates schema if needed)
  getDatabase();
  console.log('[AIRA] Database initialized');

  // 3. Orphan Run recovery
  recoverOrphanRuns();

  // 4. Start dual-socket servers
  try {
    server4 = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: PORT });
    attachWebSocket(server4 as unknown as Server, PORT);
    console.log(`[AIRA] Listening on http://127.0.0.1:${PORT}`);
  } catch (err) {
    console.warn(`[AIRA] Failed to bind IPv4: ${err instanceof Error ? err.message : err}`);
  }

  try {
    server6 = serve({ fetch: app.fetch, hostname: '::1', port: PORT });
    attachWebSocket(server6 as unknown as Server, PORT);
    console.log(`[AIRA] Listening on http://[::1]:${PORT}`);
  } catch (err) {
    console.warn(`[AIRA] Failed to bind IPv6: ${err instanceof Error ? err.message : err}`);
  }

  if (!server4 && !server6) {
    console.error('[AIRA] FATAL: Failed to bind to any address');
    process.exit(1);
  }

  console.log('[AIRA] Server started successfully');
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

function shutdown(): void {
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

process.on('SIGINT', () => { shutdown(); process.exit(0); });
process.on('SIGTERM', () => { shutdown(); process.exit(0); });

startup().catch((err) => {
  console.error('[AIRA] Startup failed:', err);
  process.exit(1);
});

export { server4, server6, PORT };

