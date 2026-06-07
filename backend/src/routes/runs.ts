import { Hono } from 'hono';
import { getDatabase } from '../db/index.js';
import { stopChat } from '../services/exec-context.js';
import { broadcastToProject } from '../services/ws.service.js';
import { getSkillRoutingForProject, type SkillRoutingLog } from '../services/skill-routing.service.js';

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
  const rawLimit = parseInt(c.req.query('limit') ?? '20', 10);
  const rawOffset = parseInt(c.req.query('offset') ?? '0', 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 100);
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

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
  const projectId = c.req.param('id');
  const runId = c.req.param('runId');
  const db = getDatabase();

  // Tenant scope: require both the run id and project id to match so that a
  // known runId from another project cannot be exfiltrated via this URL.
  const run = db.prepare(
    'SELECT prompt FROM agent_runs WHERE id = ? AND project_id = ?',
  ).get(runId, projectId) as { prompt: string | null } | undefined;

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

// GET /api/projects/:id/skill-routing — skill routing log, grouped by run
// (v3.6.0). Returns newest run first; events within a run are chronological.
// Used by the right panel to investigate why the same skill set produced
// different agent behaviour across runs.
runRoutes.get('/api/projects/:id/skill-routing', (c) => {
  const projectId = c.req.param('id');
  const rawLimit = parseInt(c.req.query('limit') ?? '500', 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 500, 1), 2000);

  const logs = getSkillRoutingForProject(projectId, limit);

  // Group by run, preserving newest-run-first order (getSkillRoutingForProject
  // returns rows newest-first, so first-seen run id is the most recent).
  const byRun = new Map<string, SkillRoutingLog[]>();
  for (const log of logs) {
    const key = log.run_id ?? 'unknown';
    let bucket = byRun.get(key);
    if (!bucket) { bucket = []; byRun.set(key, bucket); }
    bucket.push(log);
  }

  const db = getDatabase();
  const runs = Array.from(byRun.entries()).map(([runId, events]) => {
    const run = runId !== 'unknown'
      ? db.prepare(
          'SELECT id, status, prompt, created_at FROM agent_runs WHERE id = ? AND project_id = ?',
        ).get(runId, projectId) as { id: string; status: string; prompt: string | null; created_at: string } | undefined
      : undefined;
    return {
      runId,
      status: run?.status ?? null,
      prompt: run?.prompt ?? null,
      createdAt: run?.created_at ?? events[events.length - 1]?.created_at ?? null,
      // events arrive newest-first; reverse to chronological for the timeline.
      events: events.slice().reverse(),
    };
  });

  return c.json({ runs });
});

export { runRoutes };
