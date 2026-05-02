import { Hono } from 'hono';
import { z } from 'zod';
import { AuthService, TokenConflictError } from '../services/auth.service.js';

const settingsRoutes = new Hono();
const authService = new AuthService();

const tokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// GET /api/settings — token presence only (never return value)
settingsRoutes.get('/api/settings', (c) => {
  return c.json({
    token: {
      configured: authService.hasToken(),
      source: authService.isEnvToken() ? 'environment' : 'settings',
    },
  });
});

// PUT /api/settings/token — register/update token
settingsRoutes.put('/api/settings/token', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = tokenSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  try {
    authService.storeToken(parsed.data.token);
    return c.body(null, 204);
  } catch (err) {
    if (err instanceof TokenConflictError) {
      return c.json({ error: err.message }, 409);
    }
    throw err;
  }
});

// DELETE /api/settings/token — remove stored token
settingsRoutes.delete('/api/settings/token', (c) => {
  if (authService.isEnvToken()) {
    return c.json({ error: 'Cannot delete: token is set via environment variable' }, 409);
  }
  authService.deleteToken();
  return c.body(null, 204);
});

// POST /api/settings/validate-token — validate server-stored token against GitHub
settingsRoutes.post('/api/settings/validate-token', async (c) => {
  const result = await authService.validateToken();
  if (result.valid) {
    return c.json({ valid: true, login: result.login, scopes: result.scopes });
  }
  return c.json({ valid: false }, 200);
});

export { settingsRoutes };
