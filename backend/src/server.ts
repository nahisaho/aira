/**
 * CLI entrypoint — starts the AIRA backend as a standalone process.
 * For Electron embedding, use lifecycle.ts directly.
 */
import { startServer, stopServer } from './lifecycle.js';

const PORT = parseInt(process.env.AIRA_PORT ?? '3000', 10);

process.on('SIGINT', () => { stopServer(); process.exit(0); });
process.on('SIGTERM', () => { stopServer(); process.exit(0); });

startServer(PORT).catch((err) => {
  console.error('[AIRA] Startup failed:', err);
  process.exit(1);
});

export { PORT };

