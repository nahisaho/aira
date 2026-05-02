import { Hono } from 'hono';
import { z } from 'zod';
import { McpService, McpNotFoundError, MaskedValueError } from '../services/mcp.service.js';

const mcpRoutes = new Hono();
const mcpService = new McpService();

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['stdio', 'sse']),
  config: z.record(z.unknown()),
  preset_id: z.string().optional(),
});

// GET /api/projects/:id/mcp — list MCP configs (masked)
mcpRoutes.get('/api/projects/:id/mcp', (c) => {
  const projectId = c.req.param('id');
  return c.json(mcpService.list(projectId));
});

// POST /api/projects/:id/mcp — create MCP config
mcpRoutes.post('/api/projects/:id/mcp', async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  const config = mcpService.create(
    projectId,
    parsed.data.name,
    parsed.data.type,
    parsed.data.config,
    parsed.data.preset_id,
  );

  return c.json(config, 201);
});

// PATCH /api/projects/:id/mcp/:configId — update with secret semantics
mcpRoutes.patch('/api/projects/:id/mcp/:configId', async (c) => {
  const configId = c.req.param('configId');
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  try {
    const updated = mcpService.update(configId, body as Record<string, unknown>);
    return c.json(updated);
  } catch (err) {
    if (err instanceof McpNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    if (err instanceof MaskedValueError) {
      return c.json({ error: err.message }, 400);
    }
    throw err;
  }
});

// PUT /api/projects/:id/mcp/:configId/toggle — enable/disable
mcpRoutes.put('/api/projects/:id/mcp/:configId/toggle', async (c) => {
  const configId = c.req.param('configId');
  const body = await c.req.json().catch(() => null);
  const enabled = body?.enabled === true;

  mcpService.toggle(configId, enabled);
  return c.json({ status: enabled ? 'enabled' : 'disabled' });
});

// DELETE /api/projects/:id/mcp/:configId — delete MCP config
mcpRoutes.delete('/api/projects/:id/mcp/:configId', (c) => {
  const configId = c.req.param('configId');
  mcpService.delete(configId);
  return c.body(null, 204);
});

export { mcpRoutes };
