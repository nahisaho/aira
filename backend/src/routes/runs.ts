import { Hono } from 'hono';
import { getDatabase } from '../db/index.js';
import { stopChat } from '../services/exec-context.js';
import { broadcastToProject } from '../services/ws.service.js';

const runRoutes = new Hono();

interface RunRow {
  id: string;
  project_id: string;
  message_id: string | null;
  status: string;
  error_type: string | null;
  cancel_reason: string | null;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  prompt: string | null;
  created_at: string;
}

// GET /api/projects/:id/runs — paginated run history
runRoutes.get('/api/projects/:id/runs', (c) => {
  const projectId = c.req.param('id');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  const db = getDatabase();
  const runs = db.prepare(
    'SELECT * FROM agent_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
  ).all(projectId, limit, offset) as RunRow[];

  return c.json(runs);
});

// GET /api/projects/:id/runs/current — current active run
runRoutes.get('/api/projects/:id/runs/current', (c) => {
  const projectId = c.req.param('id');
  const db = getDatabase();

  const run = db.prepare(
    "SELECT * FROM agent_runs WHERE project_id = ? AND status IN ('running', 'queued') ORDER BY created_at DESC LIMIT 1",
  ).get(projectId) as RunRow | undefined;

  if (!run) {
    return c.json({ status: 'idle' });
  }

  return c.json(run);
});

// POST /api/projects/:id/runs/current/stop — stop current run
runRoutes.post('/api/projects/:id/runs/current/stop', (c) => {
  const projectId = c.req.param('id');
  const db = getDatabase();

  const run = db.prepare(
    "SELECT * FROM agent_runs WHERE project_id = ? AND status = 'running' LIMIT 1",
  ).get(projectId) as RunRow | undefined;

  if (!run) {
    return c.json({ error: 'No running run found' }, 404);
  }

  // Immediately mark as cancelled in DB so fetchCurrentRun returns idle
  db.prepare(
    "UPDATE agent_runs SET status = 'cancelled', cancel_reason = 'user', finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('running', 'queued')",
  ).run(run.id);

  // Notify connected clients immediately
  broadcastToProject(projectId, { type: 'status', runId: run.id, status: 'cancelled' });

  // Stop via container-runner (kills Docker container or host child process)
  stopChat(projectId);

  return c.json({ status: 'cancelled', runId: run.id });
});

// GET /api/projects/:id/runs/:runId/prompt — download run prompt as text
runRoutes.get('/api/projects/:id/runs/:runId/prompt', (c) => {
  const runId = c.req.param('runId');
  const db = getDatabase();

  const run = db.prepare('SELECT prompt FROM agent_runs WHERE id = ?').get(runId) as { prompt: string | null } | undefined;

  if (!run || !run.prompt) {
    return c.json({ error: 'Prompt not found' }, 404);
  }

  return new Response(run.prompt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="prompt-${runId.slice(0, 8)}.txt"`,
    },
  });
});

export { runRoutes };
