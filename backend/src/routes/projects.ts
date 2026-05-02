import { Hono } from 'hono';
import { z } from 'zod';
import {
  ProjectService,
  ProjectNotFoundError,
  ProjectLockedError,
  ProjectActiveRunError,
} from '../services/project.service.js';
import { seedBuiltinMcpForProject } from '../services/mcp.service.js';

const projectRoutes = new Hono();
const projectService = new ProjectService();

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

// GET /api/projects
projectRoutes.get('/api/projects', (c) => {
  const projects = projectService.list();
  return c.json(projects);
});

// POST /api/projects
projectRoutes.post('/api/projects', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  try {
    const project = projectService.create(parsed.data.name, parsed.data.description);
    seedBuiltinMcpForProject(project.id);
    return c.json(project, 201);
  } catch (err) {
    if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return c.json({ error: 'Project name already exists' }, 409);
    }
    throw err;
  }
});

// GET /api/projects/:id
projectRoutes.get('/api/projects/:id', (c) => {
  const project = projectService.getById(c.req.param('id'));
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  return c.json(project);
});

// PATCH /api/projects/:id
projectRoutes.patch('/api/projects/:id', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  try {
    const project = projectService.update(c.req.param('id'), parsed.data);
    return c.json(project);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    if (err instanceof ProjectActiveRunError) {
      return c.json({ error: err.message }, 409);
    }
    if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return c.json({ error: 'Project name already exists' }, 409);
    }
    throw err;
  }
});

// DELETE /api/projects/:id
projectRoutes.delete('/api/projects/:id', (c) => {
  try {
    projectService.delete(c.req.param('id'));
    return c.body(null, 204);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    if (err instanceof ProjectActiveRunError) {
      return c.json({ error: err.message }, 409);
    }
    if (err instanceof ProjectLockedError) {
      return c.json({ error: err.message }, 423);
    }
    throw err;
  }
});

export { projectRoutes };
