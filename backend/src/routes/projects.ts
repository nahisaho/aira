import { Hono } from 'hono';
import { z } from 'zod';
import {
  ProjectService,
  ProjectNotFoundError,
  ProjectLockedError,
  ProjectActiveRunError,
} from '../services/project.service.js';
import { seedBuiltinMcpForProject } from '../services/mcp.service.js';
import { SkillsService } from '../services/skills.service.js';
import { syncSkillFiles } from '../services/exec-context.js';
import {
  readLatestSnapshot,
  readAllSnapshots,
} from '../services/notebook-trace.js';
import { validateProject, buildRepairPayload, buildPostmortemReport } from '../services/provenance-validator.js';

const projectRoutes = new Hono();
const projectService = new ProjectService();
const skillsService = new SkillsService();

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  skillSetId: z.string().optional(),
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
    seedBuiltinMcpForProject(project.id, { isNewProject: true });

    // Auto-assign skill set to new project only when explicitly specified.
    if (parsed.data.skillSetId) {
      const allSkills = skillsService.listAll();
      const skill = allSkills.find((s: { id: string; name: string }) => s.id === parsed.data.skillSetId || s.name === parsed.data.skillSetId);
      if (skill) {
        skillsService.assignToProject(project.id, skill.id);
      }
    }
    syncSkillFiles(project.id);

    return c.json(project, 201);
  } catch (err) {
    const msg = (err as Error).message ?? '';
    if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' || msg.includes('UNIQUE constraint failed')) {
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
    const msg = (err as Error).message ?? '';
    if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' || msg.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Project name already exists' }, 409);
    }
    throw err;
  }
});

// ── v3.2.0 — Computational Provenance ────────────────────────────────

// GET /api/projects/:id/notebook/trace — read snapshots
projectRoutes.get('/api/projects/:id/notebook/trace', (c) => {
  const projectId = c.req.param('id');
  const latestOnly = c.req.query('latest') === '1';
  if (latestOnly) {
    return c.json({ snapshot: readLatestSnapshot(projectId) });
  }
  return c.json({ snapshots: readAllSnapshots(projectId) });
});

// POST /api/projects/:id/validate — run provenance gates
projectRoutes.post('/api/projects/:id/validate', (c) => {
  const projectId = c.req.param('id');
  return c.json(validateProject(projectId));
});

// POST /api/projects/:id/validate/repair — second-pass repair payload (v3.3.0)
// Returns a machine-readable violation list plus a markdown prompt the agent
// can act on directly. Used by Co-Scientist's "before completing" loop:
//   validate → if fail: read repair_prompt → fix → re-validate → until pass.
projectRoutes.post('/api/projects/:id/validate/repair', (c) => {
  const projectId = c.req.param('id');
  return c.json(buildRepairPayload(projectId));
});

// POST /api/projects/:id/validate/postmortem — auto-postmortem (v3.4.2 Pillar 4)
// Called by Co-Scientist when 3 repair iterations did not converge. Writes a
// JSON dump under workspace/.trace/postmortem-<ISO>.json and returns a
// markdown summary suitable for pasting into report.md Limitations.
projectRoutes.post('/api/projects/:id/validate/postmortem', (c) => {
  const projectId = c.req.param('id');
  return c.json(buildPostmortemReport(projectId));
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
