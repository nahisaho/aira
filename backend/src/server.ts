/**
 * CLI entrypoint — starts the AIRA backend as a standalone process.
 * For Electron embedding, use lifecycle.ts directly.
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

process.on('SIGINT', () => { stopServer(); process.exit(0); });
process.on('SIGTERM', () => { stopServer(); process.exit(0); });

startServer({
  port: PORT,
  hostname: isDocker ? '0.0.0.0' : '127.0.0.1',
}).catch((err) => {
  console.error('[AIRA] Startup failed:', err);
  process.exit(1);
});

export { PORT };

