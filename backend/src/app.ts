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

export { app };
