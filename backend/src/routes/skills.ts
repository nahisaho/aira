import { Hono } from 'hono';
import { z } from 'zod';
import { SkillsService, InvalidGitHubUrlError } from '../services/skills.service.js';

const skillsRoutes = new Hono();
const skillsService = new SkillsService();

const importSchema = z.object({
  name: z.string().min(1),
  repo_url: z.string().url(),
});

// GET /api/skills — list all skills
skillsRoutes.get('/api/skills', (c) => {
  return c.json(skillsService.listAll());
});

// POST /api/skills/import — import a skill from GitHub
skillsRoutes.post('/api/skills/import', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = importSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  try {
    const skill = skillsService.createImport(parsed.data.name, parsed.data.repo_url);
    return c.json(skill, 201);
  } catch (err) {
    if (err instanceof InvalidGitHubUrlError) {
      return c.json({ error: err.message }, 400);
    }
    throw err;
  }
});

// DELETE /api/skills/:id — delete a skill
skillsRoutes.delete('/api/skills/:id', (c) => {
  const id = c.req.param('id');
  skillsService.deleteSkill(id);
  return c.body(null, 204);
});

// GET /api/projects/:id/skills — get project skills
skillsRoutes.get('/api/projects/:id/skills', (c) => {
  const projectId = c.req.param('id');
  return c.json(skillsService.getProjectSkills(projectId));
});

// POST /api/projects/:id/skills/:skillId — assign skill to project
skillsRoutes.post('/api/projects/:id/skills/:skillId', (c) => {
  const { id: projectId, skillId } = c.req.param() as { id: string; skillId: string };
  skillsService.assignToProject(projectId, skillId);
  return c.json({ status: 'assigned' });
});

// DELETE /api/projects/:id/skills/:skillId — unassign skill from project
skillsRoutes.delete('/api/projects/:id/skills/:skillId', (c) => {
  const { id: projectId, skillId } = c.req.param() as { id: string; skillId: string };
  skillsService.unassignFromProject(projectId, skillId);
  return c.body(null, 204);
});

export { skillsRoutes };
