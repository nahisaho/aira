import { serve } from '@hono/node-server';
import { app } from './app.js';

const PORT = parseInt(process.env.AIRA_PORT ?? '3000', 10);

const server4 = serve({
  fetch: app.fetch,
  hostname: '127.0.0.1',
  port: PORT,
});

const server6 = serve({
  fetch: app.fetch,
  hostname: '::1',
  port: PORT,
});

console.log(`AIRA server listening on http://127.0.0.1:${PORT} and http://[::1]:${PORT}`);

export { server4, server6 };
