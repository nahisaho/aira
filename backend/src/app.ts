import { Hono } from 'hono';
import {
  originMiddleware,
  csrfMiddleware,
  corsMiddleware,
  cspMiddleware,
  generateCsrfToken,
} from './middleware/security.js';

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

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok' });
});

export { app };
