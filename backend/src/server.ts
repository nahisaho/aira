/**
 * CLI entrypoint — starts the AIRA backend as a standalone process.
 */
import path from 'node:path';
import { startServer, stopServer, enableStaticServing } from './lifecycle.js';

const PORT = parseInt(process.env.AIRA_PORT ?? '3000', 10);
const isDocker = process.env.AIRA_SERVE_FRONTEND === 'true';

// Docker / production: serve frontend from same port
if (isDocker) {
  const frontendDir = path.resolve('frontend', 'dist');
  enableStaticServing(frontendDir);
  console.log(`[AIRA] Serving frontend from ${frontendDir}`);
}

process.on('SIGINT',  () => { stopServer().finally(() => process.exit(0)); });
process.on('SIGTERM', () => { stopServer().finally(() => process.exit(0)); });

// Last-resort crash handlers: flush the DB and kill child processes instead of
// dying with up to 100ms of debounced writes and orphaned CLI/Jupyter children.
process.on('uncaughtException', (err) => {
  console.error('[AIRA] Uncaught exception:', err);
  // Hard exit fallback in case stopServer() itself hangs.
  setTimeout(() => process.exit(1), 5_000).unref();
  stopServer().finally(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  // Log and keep running — a stray rejected promise (e.g. an aborted download
  // stream) must not take down in-flight agent runs.
  console.error('[AIRA] Unhandled rejection:', reason);
});

startServer({
  port: PORT,
  hostname: isDocker ? '0.0.0.0' : '127.0.0.1',
}).catch(async (err) => {
  console.error('[AIRA] Startup failed:', err);
  // Clean up anything startup already spawned (Jupyter Server, credential
  // proxy) — otherwise a persistent bind failure leaks one orphan per retry.
  try { await stopServer(); } catch { /* best-effort */ }
  process.exit(1);
});

export { PORT };

