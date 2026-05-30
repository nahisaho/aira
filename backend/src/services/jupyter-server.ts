/**
 * Jupyter Server lifecycle — v3.0.0 (AIRA-γ)
 *
 * Spawns a single long-lived Jupyter Server bound to 127.0.0.1 so AIRA-managed
 * subprocesses (specifically jupyter-mcp-server) can connect and operate on
 * per-project notebooks while preserving kernel state across agent runs.
 *
 * Security model:
 *  - 127.0.0.1 bind only — no LAN exposure.
 *  - Random 256-bit auth token generated at startup; never persisted.
 *  - Subprocesses receive the token via env (JUPYTER_SERVER_TOKEN), not via
 *    URL query strings (avoids leaking through process listings).
 *
 * Lifecycle:
 *  - startJupyterServer(): spawn, wait for /api/status to respond OK.
 *  - stopJupyterServer(): SIGTERM, then SIGKILL after a short grace period.
 *  - Crash handling: log + clear refs. Restart is the operator's job for now
 *    (AIRA itself stays up; only Jupyter MCP becomes unavailable).
 */

import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { getDataDir } from '../config/paths.js';

const HOST = '127.0.0.1';
const DEFAULT_PORT = parseInt(process.env.AIRA_JUPYTER_PORT ?? '8888', 10);
const STARTUP_TIMEOUT_MS = 30_000;
const STOP_GRACE_MS = 3_000;

let _process: ChildProcess | null = null;
let _port: number | null = null;
let _token: string | null = null;

export function getJupyterUrl(): string | null {
  return _port ? `http://${HOST}:${_port}` : null;
}

export function getJupyterToken(): string | null {
  return _token;
}

export function isJupyterRunning(): boolean {
  return _process !== null && _process.exitCode === null;
}

/** Reset module state — only for tests. */
export function resetJupyterStateForTesting(): void {
  _process = null;
  _port = null;
  _token = null;
}

/**
 * Force getJupyterUrl/Token to return given values without spawning a real
 * Jupyter Server. ONLY for tests — production callers must use
 * startJupyterServer().
 */
export function setJupyterStateForTesting(port: number, token: string): void {
  _port = port;
  _token = token;
}

function probePortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, HOST);
  });
}

async function findFreePort(start: number): Promise<number> {
  for (let port = start; port < start + 50; port++) {
    if (await probePortFree(port)) return port;
  }
  throw new Error(`No free port found near ${start}`);
}

async function waitForReady(url: string, token: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: Error | null = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/status`, {
        headers: { Authorization: `token ${token}` },
        signal: AbortSignal.timeout(2_000),
      });
      if (res.ok) return;
    } catch (err) {
      lastErr = err as Error;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Jupyter Server did not become ready within ${timeoutMs}ms: ${lastErr?.message ?? 'no response'}`,
  );
}

/**
 * Start the Jupyter Server. Idempotent — returns existing url/token if already
 * running. Throws if `jupyter` is not installed or the server fails to become
 * ready within STARTUP_TIMEOUT_MS.
 */
export async function startJupyterServer(): Promise<{ url: string; token: string }> {
  if (isJupyterRunning()) {
    return { url: getJupyterUrl()!, token: _token! };
  }

  // Sanity check: `jupyter` must be installed.
  try {
    execFileSync('jupyter', ['--version'], { timeout: 5_000, stdio: 'pipe' });
  } catch (err) {
    throw new Error(
      `jupyter command not found in PATH: ${(err as Error).message}. ` +
        `Install jupyter-server in the AIRA Python environment.`,
    );
  }

  _token = crypto.randomBytes(32).toString('hex');
  _port = await findFreePort(DEFAULT_PORT);

  // Pin the Jupyter state directory under AIRA's data/ so it does not write to
  // the user's home directory inside the container.
  const jupyterDataDir = path.join(getDataDir(), 'jupyter');
  fs.mkdirSync(jupyterDataDir, { recursive: true, mode: 0o700 });

  const args = [
    'server',
    '--no-browser',
    `--port=${_port}`,
    `--ServerApp.ip=${HOST}`,
    `--IdentityProvider.token=${_token}`,
    '--ServerApp.open_browser=False',
    '--ServerApp.log_level=WARN',
  ];

  _process = spawn('jupyter', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      JUPYTER_DATA_DIR: jupyterDataDir,
      JUPYTER_RUNTIME_DIR: path.join(jupyterDataDir, 'runtime'),
    },
  });

  _process.stdout?.on('data', (d: Buffer) => {
    const line = d.toString().trim();
    if (line) console.log('[jupyter-server]', line);
  });
  _process.stderr?.on('data', (d: Buffer) => {
    const line = d.toString().trim();
    if (line) console.warn('[jupyter-server]', line);
  });
  _process.on('exit', (code) => {
    console.warn(`[jupyter-server] exited with code ${code}`);
    _process = null;
    _port = null;
    _token = null;
  });

  try {
    await waitForReady(getJupyterUrl()!, _token, STARTUP_TIMEOUT_MS);
  } catch (err) {
    // Failed to come up — kill it and re-throw so the caller can decide.
    try { _process.kill('SIGKILL'); } catch { /* ignore */ }
    _process = null;
    _port = null;
    _token = null;
    throw err;
  }

  console.log(`[jupyter-server] Listening on ${getJupyterUrl()} (auth required)`);
  return { url: getJupyterUrl()!, token: _token };
}

/** Graceful shutdown: SIGTERM, then SIGKILL after STOP_GRACE_MS. */
export async function stopJupyterServer(): Promise<void> {
  const proc = _process;
  if (!proc) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const settleOnce = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };
    proc.once('exit', settleOnce);
    try { proc.kill('SIGTERM'); } catch { settleOnce(); return; }
    setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* already dead */ }
      settleOnce();
    }, STOP_GRACE_MS);
  });

  _process = null;
  _port = null;
  _token = null;
}
