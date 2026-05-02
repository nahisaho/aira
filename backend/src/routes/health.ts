import { Hono } from 'hono';
import { runPreflight } from '../services/preflight.js';

const healthRoutes = new Hono();

healthRoutes.get('/api/health', (c) => {
  const result = runPreflight();
  return c.json(result);
});

export { healthRoutes };
