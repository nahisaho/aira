import { Hono } from 'hono';
import {
  originMiddleware,
  csrfMiddleware,
  corsMiddleware,
  cspMiddleware,
  generateCsrfToken,
} from './middleware/security.js';
import { healthRoutes } from './routes/health.js';
import { settingsRoutes } from './routes/settings.js';
import { projectRoutes } from './routes/projects.js';
import { messageRoutes } from './routes/messages.js';
import { runRoutes } from './routes/runs.js';
import { fileRoutes } from './routes/files.js';
import { skillsRoutes } from './routes/skills.js';
import { mcpRoutes } from './routes/mcp.js';
import { agentsRepoRoutes } from './routes/agents-repos.js';
import { ragRoutes } from './routes/rag.js';

const app = new Hono();

// Global middleware
app.use('*', corsMiddleware);
app.use('*', cspMiddleware);
app.use('/api/*', originMiddleware);
app.use('/api/*', csrfMiddleware);

// CSRF token endpoint
app.get('/api/csrf-token', (c) => {
  const token = generateCsrfToken();
  return c.json({ token });
});

// Validate project ID as UUID for all /api/projects/:id routes
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
app.use('/api/projects/:id/*', async (c, next) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) {
    return c.json({ error: 'Invalid project ID' }, 400);
  }
  await next();
});
app.use('/api/projects/:id', async (c, next) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) {
    return c.json({ error: 'Invalid project ID' }, 400);
  }
  await next();
});

// Routes
app.route('/', healthRoutes);
app.route('/', settingsRoutes);
app.route('/', projectRoutes);
app.route('/', messageRoutes);
app.route('/', runRoutes);
app.route('/', fileRoutes);
app.route('/', skillsRoutes);
app.route('/', mcpRoutes);
app.route('/', agentsRepoRoutes);
app.route('/', ragRoutes);

// Global error handler — ensures all errors return JSON (not empty bodies)
app.onError((err, c) => {
  console.error('[AIRA] Unhandled error:', err.message);
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

export { app };
