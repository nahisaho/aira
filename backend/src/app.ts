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

// Routes
app.route('/', healthRoutes);
app.route('/', settingsRoutes);
app.route('/', projectRoutes);
app.route('/', messageRoutes);
app.route('/', runRoutes);
app.route('/', fileRoutes);
app.route('/', skillsRoutes);
app.route('/', mcpRoutes);

// Global error handler — ensures all errors return JSON (not empty bodies)
app.onError((err, c) => {
  console.error('[AIRA] Unhandled error:', err.message);
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

export { app };
