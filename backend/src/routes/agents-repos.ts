import { Hono } from 'hono';
import { z } from 'zod';
import { AgentsRepoService, DuplicateRepoError, RepoNotFoundError, AgentsRepoError } from '../services/agents-repo.service.js';

const agentsRepoRoutes = new Hono();
const service = new AgentsRepoService();

const addRepoSchema = z.object({
  url: z.string().url('Valid URL is required'),
  name: z.string().optional(),
});

// GET /api/settings/agents-repos — list all configured repos
agentsRepoRoutes.get('/api/settings/agents-repos', (c) => {
  return c.json(service.listRepos());
});

// POST /api/settings/agents-repos — add a new repo
agentsRepoRoutes.post('/api/settings/agents-repos', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = addRepoSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  try {
    const repo = service.addRepo(parsed.data.url, parsed.data.name);
    try {
      const synced = service.syncRepo(repo.id);
      return c.json(synced, 201);
    } catch (syncErr) {
      // Sync failed — remove the repo and return error
      service.removeRepo(repo.id);
      if (syncErr instanceof AgentsRepoError) {
        return c.json({ error_code: syncErr.code, detail: syncErr.detail }, 400);
      }
      return c.json({ error: syncErr instanceof Error ? syncErr.message : 'Sync failed' }, 400);
    }
  } catch (err) {
    if (err instanceof DuplicateRepoError) {
      return c.json({ error: err.message }, 409);
    }
    throw err;
  }
});

// DELETE /api/settings/agents-repos/:id — remove a repo
agentsRepoRoutes.delete('/api/settings/agents-repos/:id', (c) => {
  const { id } = c.req.param();
  try {
    service.removeRepo(id);
    return c.body(null, 204);
  } catch (err) {
    if (err instanceof RepoNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    throw err;
  }
});

// POST /api/settings/agents-repos/:id/sync — sync a specific repo
agentsRepoRoutes.post('/api/settings/agents-repos/:id/sync', (c) => {
  const { id } = c.req.param();
  try {
    const repo = service.syncRepo(id);
    return c.json(repo);
  } catch (err) {
    if (err instanceof RepoNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    if (err instanceof AgentsRepoError) {
      return c.json({ error_code: err.code, detail: err.detail }, 400);
    }
    return c.json({ error: err instanceof Error ? err.message : 'Sync failed' }, 500);
  }
});

// POST /api/settings/agents-repos/sync-all — sync all repos
agentsRepoRoutes.post('/api/settings/agents-repos/sync-all', (c) => {
  service.syncAll();
  return c.json({ status: 'ok', repos: service.listRepos() });
});

export { agentsRepoRoutes };
