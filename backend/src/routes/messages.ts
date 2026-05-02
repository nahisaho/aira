import { Hono } from 'hono';
import { z } from 'zod';
import { MessageService, ClearHistoryDuringRunError } from '../services/message.service.js';

const messageRoutes = new Hono();
const messageService = new MessageService();

const createMessageSchema = z.object({
  content: z.string().min(1),
});

// GET /api/projects/:id/messages
messageRoutes.get('/api/projects/:id/messages', (c) => {
  const projectId = c.req.param('id');
  const limit = parseInt(c.req.query('limit') ?? '100', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const since = c.req.query('since');

  if (since) {
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
    return c.body(null, 204);
  } catch (err) {
    if (err instanceof ClearHistoryDuringRunError) {
      return c.json({ error: err.message }, 409);
    }
    throw err;
  }
});

export { messageRoutes };
