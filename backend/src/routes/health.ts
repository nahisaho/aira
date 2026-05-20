import { Hono } from 'hono';
import { runPreflight } from '../services/preflight.js';

const healthRoutes = new Hono();

healthRoutes.get('/api/health', (c) => {
  const result = runPreflight();
  // Only expose pass/fail status, not detailed system info
  return c.json({
    status: result.allPassed ? 'ok' : 'degraded',
    checks: Object.fromEntries(
      Object.entries(result)
        .filter(([k]) => k !== 'allPassed')
        .map(([k, v]) => [k, { ok: (v as { ok: boolean }).ok }]),
    ),
  });
});

export { healthRoutes };
