/**
 * Jupyter Server lifecycle — v3.0.0 (AIRA-γ), extended in v3.1.0 (AIRA-γ GUI).
 *
 * Spawns a single long-lived Jupyter Server. Two consumers:
 *  - jupyter-mcp-server (stdio child, agent-driven cell ops). Always works.
 *  - JupyterLab UI in an AIRA iframe (browser-driven, requires bind=0.0.0.0 +
 *    port publish so the user's browser can reach it).
 *
 * Security model:
 *  - Default bind 127.0.0.1 — closed unless the operator opens it explicitly.
 *  - Random 256-bit auth token by default. Can be pinned via AIRA_JUPYTER_TOKEN
 *    so the JupyterLab bookmark URL stays stable across restarts.
 *  - Tornado headers loosen frame-ancestors and X-Frame-Options to allow the
 *    AIRA UI origin to embed JupyterLab; other origins still blocked.
 *
 * Env overrides (all optional, defaults preserve v3.0.x behavior):
 *  - AIRA_JUPYTER_BIND       host to bind (default 127.0.0.1; 0.0.0.0 to
 *                            allow browser access from outside the container)
 *  - AIRA_JUPYTER_PORT       port (default 8888, auto-bumped if occupied)
 *  - AIRA_JUPYTER_TOKEN      fixed auth token (default: per-startup random)
 *  - AIRA_JUPYTER_PUBLIC_URL URL the browser uses to reach Jupyter (default:
 *                            http://localhost:<port>). Set this if AIRA is
 *                            running on a non-localhost hostname (e.g. behind
 *                            a reverse proxy or accessed via LAN IP).
 *  - AIRA_ALLOWED_ORIGINS    inherited from AIRA's CSRF/CORS allowlist; also
 *                            granted iframe-parent permission so the AIRA UI
 *                            can embed JupyterLab.
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

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = parseInt(process.env.AIRA_JUPYTER_PORT ?? '8888', 10);
const STARTUP_TIMEOUT_MS = 30_000;
const STOP_GRACE_MS = 3_000;

let _process: ChildProcess | null = null;
let _port: number | null = null;
let _token: string | null = null;
let _bindHost: string | null = null;

function bindHost(): string {
  return process.env.AIRA_JUPYTER_BIND ?? DEFAULT_HOST;
}

/**
 * URL used by AIRA-internal subprocesses (jupyter-mcp-server) to reach the
 * Jupyter Server. Always loopback because the subprocess runs in the same
 * container, so 127.0.0.1 works even when the public bind is 0.0.0.0.
 */
export function getJupyterUrl(): string | null {
  return _port ? `http://${DEFAULT_HOST}:${_port}` : null;
}

/**
 * URL the user's browser uses to reach Jupyter for the iframe. Defaults to
 * http://localhost:<port> which works when the user runs the container with
 * `-p 8888:8888` on the same machine. Override via AIRA_JUPYTER_PUBLIC_URL for
 * remote/LAN/reverse-proxy access.
 */
export function getJupyterPublicUrl(): string | null {
  if (!_port) return null;
  return process.env.AIRA_JUPYTER_PUBLIC_URL ?? `http://localhost:${_port}`;
}

/**
 * Whether the Jupyter Server is reachable from outside the container (i.e.
 * iframe-embeddable). True only when bound to 0.0.0.0 or a non-loopback
 * address, so the UI can show a helpful "open with -p 8888:8888" message
 * instead of a broken iframe.
 */
export function isJupyterPubliclyReachable(): boolean {
  if (!_bindHost) return false;
  return _bindHost === '0.0.0.0' || (!_bindHost.startsWith('127.') && _bindHost !== 'localhost');
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
  _bindHost = null;
}

/**
 * Force getJupyterUrl/Token to return given values without spawning a real
 * Jupyter Server. ONLY for tests — production callers must use
 * startJupyterServer().
 */
export function setJupyterStateForTesting(port: number, token: string, host = DEFAULT_HOST): void {
  _port = port;
  _token = token;
  _bindHost = host;
}

function probePortFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findFreePort(start: number, host: string): Promise<number> {
  for (let port = start; port < start + 50; port++) {
    if (await probePortFree(port, host)) return port;
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
 * Build the space-separated list of origins allowed to embed JupyterLab in
 * an iframe. Mirrors the AIRA CSRF/CORS allowlist so the JupyterLab UI is
 * reachable from the same browser contexts that already trust AIRA.
 *
 * The default set covers the typical Docker pattern `-p <host>:3000`. Since
 * AIRA_PORT inside the container is always 3000 but the user's browser sees
 * whatever host port they published to, we include a small range of common
 * publish ports (3000-3003) so `-p 3001:3000` etc. just work without extra
 * env config.
 *
 * For non-standard hostnames or ports, set AIRA_PUBLIC_URL (single URL) and
 * /or AIRA_ALLOWED_ORIGINS (comma-separated list).
 *
 * Exported for testing.
 */
export function frameAncestorOrigins(): string {
  const origins = new Set<string>(["'self'"]);

  // Common Docker publish ports the user's browser is likely to hit AIRA at.
  // 3000 is the container-internal default; 3001-3003 covers the typical
  // `-p 3001:3000` host-port shifts users do to avoid conflicts.
  for (const p of [3000, 3001, 3002, 3003]) {
    origins.add(`http://localhost:${p}`);
    origins.add(`http://127.0.0.1:${p}`);
  }
  // Vite dev ports
  for (const p of [5173, 5174, 5175]) {
    origins.add(`http://localhost:${p}`);
    origins.add(`http://127.0.0.1:${p}`);
  }
  // Public URL of AIRA as seen by the browser (LAN IP, hostname, reverse
  // proxy, etc.). Single URL for clarity.
  if (process.env.AIRA_PUBLIC_URL) {
    try {
      const u = new URL(process.env.AIRA_PUBLIC_URL);
      origins.add(`${u.protocol}//${u.host}`);
    } catch { /* malformed; skip */ }
  }
  if (process.env.AIRA_ALLOWED_ORIGINS) {
    for (const o of process.env.AIRA_ALLOWED_ORIGINS.split(',')) {
      const t = o.trim();
      if (t) origins.add(t);
    }
  }
  return Array.from(origins).join(' ');
}

/**
 * Idle-kernel culling args (v3.6.0).
 *
 * Bug: kernels started by jupyter-mcp-server (one per project notebook) and by
 * the JupyterLab iframe were never reaped — they "lingered" indefinitely,
 * accumulating across runs and leaking memory/PIDs. The Jupyter Server can do
 * this itself via MappingKernelManager culling, which was simply not enabled.
 *
 * Defaults: shut down a kernel idle for 30 min, checked every 2 min.
 * `cull_connected=True` is the crucial part — the MCP stdio child and the iframe
 * hold persistent connections, so without it an idle-but-connected kernel is
 * never culled (which is exactly the lingering bug). Busy (executing) kernels
 * are never culled so long-running cells aren't interrupted.
 *
 * Overridable via env so an operator can tune or disable culling:
 *   - AIRA_JUPYTER_CULL_IDLE_TIMEOUT  seconds (default 1800; 0 disables culling)
 *   - AIRA_JUPYTER_CULL_INTERVAL      seconds between checks (default 120)
 *   - AIRA_JUPYTER_CULL_CONNECTED     'false' to spare connected kernels
 *
 * Exported for testing.
 */
export function kernelCullArgs(): string[] {
  const idle = parseInt(process.env.AIRA_JUPYTER_CULL_IDLE_TIMEOUT ?? '1800', 10);
  // 0 (or invalid) disables culling entirely — operator opt-out.
  if (!Number.isFinite(idle) || idle <= 0) return [];

  const rawInterval = parseInt(process.env.AIRA_JUPYTER_CULL_INTERVAL ?? '120', 10);
  const interval = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : 120;
  const cullConnected = process.env.AIRA_JUPYTER_CULL_CONNECTED !== 'false';

  return [
    `--MappingKernelManager.cull_idle_timeout=${idle}`,
    `--MappingKernelManager.cull_interval=${interval}`,
    `--MappingKernelManager.cull_connected=${cullConnected ? 'True' : 'False'}`,
    // Never cull a kernel that is actively executing a cell.
    '--MappingKernelManager.cull_busy=False',
  ];
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
      { cause: err },
    );
  }

  _bindHost = bindHost();
  _token = process.env.AIRA_JUPYTER_TOKEN || crypto.randomBytes(32).toString('hex');
  // Probe ports from the loopback side — even when binding 0.0.0.0, a port
  // that's free on 127.0.0.1 is free on all interfaces.
  _port = await findFreePort(DEFAULT_PORT, DEFAULT_HOST);

  // Pin the Jupyter state directory under AIRA's data/ so it does not write to
  // the user's home directory inside the container.
  const jupyterDataDir = path.join(getDataDir(), 'jupyter');
  fs.mkdirSync(jupyterDataDir, { recursive: true, mode: 0o700 });

  // Tornado headers — relax X-Frame-Options + tighten CSP frame-ancestors so
  // exactly the AIRA UI origins are allowed to iframe JupyterLab. Anyone else
  // (including arbitrary cross-origin pages) is still blocked.
  const ancestors = frameAncestorOrigins();
  const tornadoSettings = JSON.stringify({
    headers: {
      'Content-Security-Policy': `frame-ancestors ${ancestors}`,
      // Remove X-Frame-Options by setting empty string (tornado collapses it).
      'X-Frame-Options': '',
    },
  });

  const args = [
    'server',
    '--no-browser',
    `--port=${_port}`,
    `--ServerApp.ip=${_bindHost}`,
    `--IdentityProvider.token=${_token}`,
    '--ServerApp.open_browser=False',
    '--ServerApp.log_level=WARN',
    // v3.1.0 — default landing page is the JupyterLab UI, not the classic tree
    '--ServerApp.default_url=/lab',
    // Allow iframe embedding from AIRA UI origins
    `--ServerApp.tornado_settings=${tornadoSettings}`,
    // Match the AIRA CORS allowlist so AJAX from the iframe works
    `--ServerApp.allow_origin_pat=^https?://(localhost|127\\.0\\.0\\.1|\\[::1\\])(:\\d+)?$`,
    // v3.6.0 — reap idle kernels so they don't linger across runs.
    ...kernelCullArgs(),
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
    _bindHost = null;
  });

  try {
    await waitForReady(getJupyterUrl()!, _token, STARTUP_TIMEOUT_MS);
  } catch (err) {
    // Failed to come up — kill it and re-throw so the caller can decide.
    try { _process.kill('SIGKILL'); } catch { /* ignore */ }
    _process = null;
    _port = null;
    _token = null;
    _bindHost = null;
    throw err;
  }

  const publicUrl = getJupyterPublicUrl();
  const reachableNote = isJupyterPubliclyReachable()
    ? `iframe-reachable at ${publicUrl}`
    : 'loopback only (iframe needs AIRA_JUPYTER_BIND=0.0.0.0 + -p 8888:8888)';
  console.log(`[jupyter-server] Listening on http://${_bindHost}:${_port}/lab — ${reachableNote}`);
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
  _bindHost = null;
}

// ── Kernel / orphan management (v3.13.0) ────────────────────────────────────

function jupyterRuntimeDir(): string {
  return path.join(getDataDir(), 'jupyter', 'runtime');
}

/** True if a process with this pid exists (EPERM counts as "exists"). */
function isProcessAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Reap a Jupyter Server (and its kernels) left running by a force-killed AIRA.
 *
 * jupyter_server writes a `jpserver-<pid>.json` into our pinned runtime dir and
 * removes it on clean exit, so a leftover file = an orphaned server. We SIGTERM
 * its pid — jupyter shuts its kernels down gracefully on SIGTERM — wait a grace
 * period, then SIGKILL any survivor, and clean the stale connection files. The
 * files live in OUR runtime dir, so the pid is provably a Jupyter Server we
 * started (no PID-reuse ambiguity).
 *
 * Call at startup BEFORE startJupyterServer(). Returns how many were reaped.
 */
export async function reapOrphanedJupyterServer(): Promise<{ killed: number }> {
  const runtimeDir = jupyterRuntimeDir();
  let files: string[];
  try { files = fs.readdirSync(runtimeDir); } catch { return { killed: 0 }; }

  const pids: number[] = [];
  for (const f of files) {
    if (!f.startsWith('jpserver-') || !f.endsWith('.json')) continue;
    const fp = path.join(runtimeDir, f);
    let pid = NaN;
    try {
      const info = JSON.parse(fs.readFileSync(fp, 'utf8')) as { pid?: number };
      if (typeof info.pid === 'number') pid = info.pid;
    } catch { /* unreadable — fall back to filename */ }
    if (!Number.isFinite(pid)) {
      const m = f.match(/^jpserver-(\d+)\.json$/);
      if (m) pid = parseInt(m[1]!, 10);
    }
    if (Number.isFinite(pid) && isProcessAlive(pid)) pids.push(pid);
    try { fs.unlinkSync(fp); } catch { /* ignore */ }
  }

  if (pids.length > 0) {
    for (const pid of pids) {
      console.warn(`[jupyter-server] reaping orphaned Jupyter Server pid=${pid} (force-kill leftover)`);
      try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
    }
    // Grace for graceful kernel shutdown, then SIGKILL any survivor.
    await new Promise((r) => setTimeout(r, 1500));
    for (const pid of pids) {
      if (isProcessAlive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
    }
  }

  // Clean leftover kernel connection files too (the server, if reaped, no longer owns them).
  for (const f of files) {
    if (f.startsWith('kernel-') && f.endsWith('.json')) {
      try { fs.unlinkSync(path.join(runtimeDir, f)); } catch { /* ignore */ }
    }
  }
  return { killed: pids.length };
}

/**
 * Stop all kernels of the currently-running Jupyter Server via its REST API
 * (graceful per-kernel shutdown), leaving the server itself up so the JupyterLab
 * iframe keeps working. Used by the "Stop kernels" action. Returns how many were
 * stopped; no-op (0) if the server isn't running.
 */
export async function stopAllKernels(): Promise<{ stopped: number }> {
  const url = getJupyterUrl();
  if (!url || !_token) return { stopped: 0 };
  const auth = { Authorization: `token ${_token}` };
  try {
    const res = await fetch(`${url}/api/kernels`, { headers: auth, signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return { stopped: 0 };
    const kernels = (await res.json()) as Array<{ id: string }>;
    let stopped = 0;
    for (const k of kernels) {
      try {
        const del = await fetch(`${url}/api/kernels/${encodeURIComponent(k.id)}`, {
          method: 'DELETE',
          headers: auth,
          signal: AbortSignal.timeout(5_000),
        });
        if (del.ok || del.status === 204) stopped++;
      } catch { /* skip this kernel */ }
    }
    console.log(`[jupyter-server] stopped ${stopped}/${kernels.length} kernel(s)`);
    return { stopped };
  } catch (err) {
    console.warn(`[jupyter-server] stopAllKernels failed: ${(err as Error).message}`);
    return { stopped: 0 };
  }
}
