import { Hono } from 'hono';
import { z } from 'zod';
import { execFile, execFileSync } from 'node:child_process';
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

// GET /api/settings/cli-version — get current CLI version
settingsRoutes.get('/api/settings/cli-version', (c) => {
  try {
    const version = execFileSync('copilot', ['--version'], {
      encoding: 'utf-8',
      timeout: 10_000,
    }).trim();
    return c.json({ version });
  } catch {
    return c.json({ version: null, error: 'CLI not found' }, 200);
  }
});

// POST /api/settings/cli-update — run copilot update
settingsRoutes.post('/api/settings/cli-update', async (c) => {
  const result = await new Promise<{ ok: boolean; stdout: string; stderr: string }>((resolve) => {
    execFile('copilot', ['update'], { timeout: 120_000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '' });
    });
  });

  const output = result.stdout + result.stderr;

  if (!result.ok) {
    return c.json({ success: false, output: output || 'Update failed' });
  }

  try {
    const version = execFileSync('copilot', ['--version'], {
      encoding: 'utf-8',
      timeout: 10_000,
    }).trim();
    return c.json({ success: true, output, version });
  } catch {
    return c.json({ success: true, output, version: null });
  }
});

export { settingsRoutes };
