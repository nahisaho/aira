import { Hono } from 'hono';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, execFileSync } from 'node:child_process';
import { AuthService } from '../services/auth.service.js';
import { getProjectsDir } from '../config/paths.js';
import { getDatabase } from '../db/index.js';
import {
  getJupyterPublicUrl,
  getJupyterToken,
  isJupyterRunning,
  isJupyterPubliclyReachable,
  stopAllKernels,
  getKernelCount,
} from '../services/jupyter-server.js';

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

/**
 * GET /api/settings/jupyter — info the frontend needs to embed JupyterLab.
 *
 * `available` distinguishes three states:
 *   - "ready":     Jupyter is running AND publicly reachable from the browser
 *                  (bind=0.0.0.0 typically) → iframe should work.
 *   - "loopback":  Jupyter is running but bound to 127.0.0.1 → browser cannot
 *                  reach it; UI should explain how to enable iframe access.
 *   - "down":      Jupyter Server is not running at all.
 *
 * Token is exposed so the iframe URL (which the browser navigates to) can
 * include it; this matches how JupyterLab is normally accessed and the same
 * token already flows through subprocess env to jupyter-mcp-server.
 */
settingsRoutes.get('/api/settings/jupyter', (c) => {
  if (!isJupyterRunning()) {
    return c.json({ available: 'down' });
  }
  const publicUrl = getJupyterPublicUrl();
  const token = getJupyterToken();
  const reachable = isJupyterPubliclyReachable();
  return c.json({
    available: reachable ? 'ready' : 'loopback',
    publicUrl,
    token,
  });
});

// POST /api/settings/jupyter/kernels/stop — stop all running Jupyter kernels
// (v3.13.0). Frees resources without taking the server down. No-op if Jupyter
// is not running.
settingsRoutes.post('/api/settings/jupyter/kernels/stop', async (c) => {
  if (!isJupyterRunning()) {
    return c.json({ stopped: 0, running: false });
  }
  const { stopped } = await stopAllKernels();
  return c.json({ stopped, running: true });
});

// GET /api/settings/jupyter/kernels/count — number of active Jupyter kernels.
settingsRoutes.get('/api/settings/jupyter/kernels/count', async (c) => {
  if (!isJupyterRunning()) {
    return c.json({ count: 0, running: false });
  }
  const count = await getKernelCount();
  return c.json({ count, running: true });
});

// PUT /api/settings/token — register/update token
settingsRoutes.put('/api/settings/token', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = tokenSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  authService.storeToken(parsed.data.token);
  return c.body(null, 204);
});

// DELETE /api/settings/token — remove stored token
settingsRoutes.delete('/api/settings/token', (c) => {
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

/**
 * GET /api/settings/version — AIRA + Copilot CLI version info.
 *
 * AIRA version is read once at module load from the root package.json. In
 * production the file is at /app/package.json (per Dockerfile); in dev it is
 * resolved relative to this source file. Falls back to "unknown" if either
 * lookup fails so the endpoint stays usable.
 */
const AIRA_VERSION = (() => {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // backend/src/routes/settings.ts → ../../../package.json
    // backend/dist/routes/settings.js → ../../../package.json
    const candidates = [
      path.resolve(here, '..', '..', '..', 'package.json'),
      path.resolve(here, '..', '..', 'package.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as { name?: string; version?: string };
        if (parsed.name === 'aira' && parsed.version) return parsed.version;
      }
    }
  } catch { /* fall through */ }
  return 'unknown';
})();

settingsRoutes.get('/api/settings/version', (c) => {
  let cliVersion: string | null = null;
  try {
    cliVersion = execFileSync('copilot', ['--version'], {
      encoding: 'utf-8',
      timeout: 5_000,
    }).trim().split('\n')[0] ?? null;
  } catch {
    // Copilot CLI not installed; surface as null instead of failing the request
  }
  return c.json({
    aira: AIRA_VERSION,
    copilotCli: cliVersion,
  });
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

// POST /api/settings/clean-projects — remove orphaned project directories
settingsRoutes.post('/api/settings/clean-projects', (c) => {
  const projectsDir = getProjectsDir();
  if (!fs.existsSync(projectsDir)) {
    return c.json({ deleted: [], count: 0 });
  }

  const db = getDatabase();
  const knownIds = (
    db.prepare('SELECT id FROM projects').all() as Array<{ id: string }>
  ).map((r) => r.id);
  const knownSet = new Set(knownIds);

  const deleted: string[] = [];
  for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (knownSet.has(entry.name)) continue;
    // Orphan directory — not in DB
    const dirPath = `${projectsDir}/${entry.name}`;
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      deleted.push(entry.name);
    } catch {
      // skip locked dirs
    }
  }

  return c.json({ deleted, count: deleted.length });
});

// POST /api/settings/restart — graceful backend restart
// Exit code 42 signals the entrypoint wrapper to restart the process.
settingsRoutes.post('/api/settings/restart', (c) => {
  // Respond before restarting
  setTimeout(async () => {
    console.log('[AIRA] Restart requested via API');
    // Graceful shutdown first: flush the DB and stop child processes (CLI
    // runs, Jupyter, credential proxy) instead of orphaning them.
    try {
      const { stopServer } = await import('../lifecycle.js');
      await stopServer();
    } catch (err) {
      console.error('[AIRA] Shutdown before restart failed:', err);
    }
    process.exit(42);
  }, 500);
  return c.json({ status: 'restarting' });
});

export { settingsRoutes };
