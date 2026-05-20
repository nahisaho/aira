import { Hono } from 'hono';
import { z } from 'zod';
import { MessageService, ClearHistoryDuringRunError } from '../services/message.service.js';
import { clearSession } from '../services/container-runner.js';

const messageRoutes = new Hono();
const messageService = new MessageService();

const createMessageSchema = z.object({
  content: z.string().min(1).max(500_000),
});

// GET /api/projects/:id/messages
messageRoutes.get('/api/projects/:id/messages', (c) => {
  const projectId = c.req.param('id');
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '100', 10) || 100, 1), 1000);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);
  const since = c.req.query('since');

  if (since) {
    // Validate ISO datetime format
    if (isNaN(Date.parse(since))) {
      return c.json({ error: 'Invalid "since" parameter: expected ISO 8601 datetime' }, 400);
    }
    const messages = messageService.getMessagesSince(projectId, since);
    return c.json(messages);
  }

  const messages = messageService.getHistory(projectId, limit, offset);
  return c.json(messages);
});

// POST /api/projects/:id/messages
messageRoutes.post('/api/projects/:id/messages', async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = createMessageSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  const message = messageService.create(projectId, 'user', parsed.data.content);
  return c.json(message, 201);
});

// DELETE /api/projects/:id/messages
messageRoutes.delete('/api/projects/:id/messages', (c) => {
  const projectId = c.req.param('id');

  try {
    messageService.clearHistory(projectId);
    // Reset CLI session so next message starts fresh (avoids stale session history).
    clearSession(projectId);
    return c.body(null, 204);
  } catch (err) {
    if (err instanceof ClearHistoryDuringRunError) {
      return c.json({ error: err.message }, 409);
    }
    throw err;
  }
});

export { messageRoutes };
