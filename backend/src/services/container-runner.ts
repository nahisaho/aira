/**
 * Container Runner  (CoreClaw-inspired)
 *
 * Executes GitHub Copilot CLI inside a Docker container (one per run).
 * When Docker is unavailable, falls back to a host child process.
 *
 * Design decisions (from studying CoreClaw + NanoClaw + Hermes):
 *
 *  • **Isolation first** — each run gets a fresh container; workspace is
 *    bind-mounted read-write so Copilot's file edits land on the host.
 *
 *  • **Credential proxy** — the container connects to the credential proxy
 *    (running on the host's docker-bridge gateway) instead of GitHub directly,
 *    so the raw GITHUB_TOKEN never enters the container environment.
 *
 *  • **Structured streaming** — the agent-runner inside the container outputs
 *    newline-delimited JSON events.  We parse `assistant.message_delta` →
 *    `onChunk` and `tool.execution_start` → `onProgress`, mirroring CoreClaw's
 *    streaming output model.
 *
 *  • **Host fallback** — if Docker is not running or the image is missing,
 *    a local child-process runner is used instead (same JSON protocol).
 *    This preserves the developer experience on machines without Docker.
 *
 *  • **Cancellation** — the caller receives a `stop()` function that kills
 *    the container (or child process) and terminates the run cleanly.
 */

import { spawn, execSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PROXY_PORT } from './credential-proxy.js';

// ── Constants ──────────────────────────────────────────────────────────────

/** Container image built by container/build.sh */
const CONTAINER_IMAGE = process.env.AIRA_CONTAINER_IMAGE ?? 'aira-agent:latest';

/** Max time (ms) a single Copilot CLI run is allowed to take. */
const RUN_TIMEOUT_MS = parseInt(process.env.CONTAINER_TIMEOUT ?? String(3 * 60 * 60 * 1000), 10);

// ── Types ──────────────────────────────────────────────────────────────────

export interface RunnerCallbacks {
  onChunk:    (content: string) => void;
  onProgress: (message: string) => void;
  onDone:     (exitCode: number | null) => void;
  onError:    (message: string) => void;
}

export interface RunnerOptions {
  projectId:    string;
  workspaceDir: string;
  prompt:       string;
  token:        string;
  model?:       string;
  mcpConfigFile?: string | null;
}

export interface ActiveRun {
  /** Call to request cancellation of the in-flight run. */
  stop: () => void;
}

// ── Docker availability check ──────────────────────────────────────────────

let _dockerAvailable: boolean | null = null;
let _imageExists: boolean | null = null;

function isDockerAvailable(): boolean {
  if (_dockerAvailable !== null) return _dockerAvailable;
  try {
    execSync('docker info', { stdio: 'pipe', timeout: 8_000 });
    _dockerAvailable = true;
  } catch {
    _dockerAvailable = false;
  }
  return _dockerAvailable;
}

function containerImageExists(): boolean {
  if (_imageExists !== null) return _imageExists;
  try {
    const out = execSync(
      `docker image inspect ${CONTAINER_IMAGE} --format "{{.Id}}"`,
      { stdio: 'pipe', timeout: 8_000, encoding: 'utf8' },
    ).trim();
    _imageExists = out.length > 0;
  } catch {
    _imageExists = false;
  }
  return _imageExists;
}

/** Reset cache (used after docker build completes). */
export function invalidateDockerCache(): void {
  _dockerAvailable = null;
  _imageExists = null;
}

// ── Host-gateway resolution (for container → proxy communication) ──────────

/**
 * Returns the IP address containers can use to reach the host.
 * On Linux: usually 172.17.0.1 (docker0 bridge).
 * Docker Desktop (macOS/Windows): host.docker.internal.
 */
function hostGateway(): string {
  if (process.platform === 'linux') {
    // Try to read the docker0 bridge address
    try {
      const output = execSync(
        "ip route show | grep docker0 | awk '{print $NF}'",
        { stdio: 'pipe', encoding: 'utf8', timeout: 3_000 },
      ).trim().split('\n')[0] ?? '';
      if (output) return output;
    } catch { /* fall through */ }
    return '172.17.0.1'; // docker0 default
  }
  return 'host.docker.internal';
}

// ── MCP config file handling ───────────────────────────────────────────────

/**
 * If there is an MCP config file on the host, write a copy to a temp location
 * accessible from inside the container (within the workspace dir so it is
 * covered by the existing workspace mount).
 */
function prepareContainerMcpConfig(
  workspaceDir: string,
  hostMcpConfigFile: string | null | undefined,
): { hostPath: string; containerPath: string } | null {
  if (!hostMcpConfigFile) return null;
  try {
    const content = fs.readFileSync(hostMcpConfigFile, 'utf8');
    const tmpDir = path.join(workspaceDir, '.aira-tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `mcp-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, content, 'utf8');
    // Inside the container, the workspace is mounted at /workspace
    const containerPath = `/workspace/.aira-tmp/${path.basename(tmpFile)}`;
    return { hostPath: tmpFile, containerPath };
  } catch {
    return null;
  }
}

// ── JSON event parsing (shared by Docker and host modes) ───────────────────

function formatToolStart(toolName: string, args: Record<string, unknown>): string {
  const cmd  = typeof args.command  === 'string' ? args.command.trim()  : '';
  const file = typeof args.filePath === 'string' ? args.filePath.trim() : '';
  const dir  = typeof args.dirPath  === 'string' ? args.dirPath.trim()  : '';
  const q    = typeof args.query    === 'string' ? args.query.trim()    : '';
  const hint = cmd || file || dir || q;
  const short = hint.length > 80 ? hint.slice(0, 77) + '...' : hint;
  return short ? `${toolName}: ${short}` : toolName;
}

interface ParseState {
  deltasSeen: boolean;
  finalMessage: string;
}

function parseLine(
  line: string,
  state: ParseState,
  cbs: Pick<RunnerCallbacks, 'onChunk' | 'onProgress'>,
): void {
  let event: { type?: string; data?: Record<string, unknown> };
  try { event = JSON.parse(line) as typeof event; } catch { return; }

  const type = event?.type ?? '';
  const data = (event?.data ?? {}) as Record<string, unknown>;

  switch (type) {
    case 'assistant.message_delta':
      if (typeof data.deltaContent === 'string' && data.deltaContent) {
        state.deltasSeen = true;
        cbs.onChunk(data.deltaContent);
      }
      break;
    case 'assistant.message':
      if (typeof data.content === 'string') state.finalMessage = data.content.trim();
      break;
    case 'assistant.turn_start':
      cbs.onProgress('Analyzing…');
      break;
    case 'tool.execution_start': {
      const n = typeof data.toolName === 'string' ? data.toolName : 'tool';
      const a = (data.arguments && typeof data.arguments === 'object')
        ? data.arguments as Record<string, unknown> : {};
      cbs.onProgress(formatToolStart(n, a));
      break;
    }
    case 'session.tools_loaded': {
      const names = Array.isArray(data.tools)
        ? (data.tools as Array<{ name?: string }>).map(t => t.name).filter(Boolean).join(', ')
        : '';
      if (names) cbs.onProgress(`Tools loaded: ${names}`);
      break;
    }
    default:
      break;
  }
}

// ── Stdout / event stream reader ───────────────────────────────────────────

function attachStreamReader(
  proc: ChildProcess,
  state: ParseState,
  cbs: Pick<RunnerCallbacks, 'onChunk' | 'onProgress'>,
): void {
  let buf = '';
  proc.stdout?.on('data', (data: Buffer) => {
    buf += data.toString('utf8');
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) parseLine(line, state, cbs);
    }
  });
}

// ── Docker runner ──────────────────────────────────────────────────────────

function runInDocker(opts: RunnerOptions, cbs: RunnerCallbacks): ActiveRun {
  const gateway = hostGateway();
  const proxyUrl = `http://${gateway}:${PROXY_PORT}`;
  const mcpConf = prepareContainerMcpConfig(opts.workspaceDir, opts.mcpConfigFile);

  const containerName = `aira-run-${opts.projectId.slice(0, 8)}-${Date.now()}`;
  const state: ParseState = { deltasSeen: false, finalMessage: '' };

  const env: string[] = [
    `COPILOT_PROMPT=${opts.prompt}`,
    `GITHUB_API_URL=${proxyUrl}`,
    `GITHUB_TOKEN=proxy`, // placeholder — real token injected by proxy
    ...(opts.model ? [`COPILOT_MODEL=${opts.model}`] : []),
    ...(mcpConf    ? [`MCP_CONFIG_FILE=${mcpConf.containerPath}`] : []),
  ];

  const dockerArgs = [
    'run', '--rm',
    '--name', containerName,
    // Workspace mount (read-write so Copilot can edit files)
    '-v', `${opts.workspaceDir}:/workspace`,
    // Extra host: makes host.docker.internal resolve on Linux
    ...(process.platform === 'linux' ? ['--add-host', 'host.docker.internal:host-gateway'] : []),
    // Environment
    ...env.flatMap(e => ['-e', e]),
    CONTAINER_IMAGE,
  ];

  console.log(`[container-runner] docker run ${containerName}`);

  const child = spawn('docker', dockerArgs, {
    cwd: opts.workspaceDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  attachStreamReader(child, state, cbs);

  child.stderr?.on('data', (d: Buffer) => {
    console.debug(`[${containerName}] ${d.toString('utf8').trimEnd()}`);
  });

  let settled = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  function settle(exitCode: number | null, error?: string): void {
    if (settled) return;
    settled = true;
    if (timeoutHandle) { clearTimeout(timeoutHandle); timeoutHandle = null; }
    // Cleanup MCP temp file
    if (mcpConf?.hostPath) {
      try { fs.unlinkSync(mcpConf.hostPath); } catch { /* ignore */ }
    }
    if (error) {
      cbs.onError(error);
    } else {
      if (!state.deltasSeen && state.finalMessage) {
        cbs.onChunk(state.finalMessage);
      }
      cbs.onDone(exitCode);
    }
  }

  child.on('close', (code) => settle(code));
  child.on('error', (err) => settle(null, `Docker spawn error: ${err.message}`));

  timeoutHandle = setTimeout(() => {
    console.warn(`[container-runner] Run timeout for ${containerName}`);
    stopFn();
    settle(null, 'Run timed out');
  }, RUN_TIMEOUT_MS);

  function stopFn(): void {
    try {
      execSync(`docker stop ${containerName}`, { stdio: 'pipe', timeout: 15_000 });
    } catch {
      child.kill('SIGKILL');
    }
  }

  return { stop: stopFn };
}

// ── Host process fallback runner ───────────────────────────────────────────

/**
 * Resolve the Copilot CLI on the host (same logic as the old agent.service.ts).
 */
function resolveHostCli(): { command: string; argsPrefix: string[] } {
  if (process.platform === 'win32') {
    try {
      const cmdPath = execSync('where copilot.cmd', { encoding: 'utf8', timeout: 10_000 })
        .trim().split('\n')[0]!.trim();
      const content = fs.readFileSync(cmdPath, 'utf8');
      const m = content.match(/"([^"]*node(?:\.exe)?)"[^"]*"([^"]*\.js)"/i);
      if (m) {
        const dir = path.dirname(cmdPath);
        const nodeExe = path.resolve((m[1]!).replace(/%~dp0/gi, dir + path.sep));
        const scriptPath = path.resolve((m[2]!).replace(/%~dp0/gi, dir + path.sep));
        return { command: nodeExe, argsPrefix: [scriptPath] };
      }
    } catch { /* fall through */ }
  }
  try {
    execSync('copilot --version', { encoding: 'utf8', timeout: 10_000, stdio: 'pipe' });
    return { command: 'copilot', argsPrefix: [] };
  } catch { /* fall through */ }
  // Node.js require fallback (monorepo: copilot installed via workspace)
  try {
    const scriptPath = require.resolve('@github/copilot/dist/cli.js');
    return { command: process.execPath, argsPrefix: [scriptPath] };
  } catch { /* fall through */ }
  throw new Error(
    'GitHub Copilot CLI not found. Install it with: npm install -g @github/copilot',
  );
}

function runOnHost(opts: RunnerOptions, cbs: RunnerCallbacks): ActiveRun {
  const cli = resolveHostCli();
  const args = [
    ...cli.argsPrefix,
    '--allow-all',
    '--prompt', opts.prompt,
    '--output-format', 'json',
    '--stream', 'on',
    '--add-github-mcp-tool', 'web_search',
  ];
  if (opts.model)        args.push('--model', opts.model);
  if (opts.mcpConfigFile) args.push('--additional-mcp-config', `@${opts.mcpConfigFile}`);

  console.log(`[container-runner] host process (prompt=${opts.prompt.length} chars)`);

  const state: ParseState = { deltasSeen: false, finalMessage: '' };

  const child = spawn(cli.command, args, {
    cwd: opts.workspaceDir,
    env: { ...process.env, GITHUB_TOKEN: opts.token },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  attachStreamReader(child, state, cbs);

  child.stderr?.on('data', (d: Buffer) => {
    console.debug(`[host-runner] ${d.toString('utf8').trimEnd()}`);
  });

  let settled = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  function settle(exitCode: number | null, error?: string): void {
    if (settled) return;
    settled = true;
    if (timeoutHandle) { clearTimeout(timeoutHandle); timeoutHandle = null; }
    if (error) {
      cbs.onError(error);
    } else {
      if (!state.deltasSeen && state.finalMessage) {
        cbs.onChunk(state.finalMessage);
      }
      cbs.onDone(exitCode);
    }
  }

  child.on('close', (code) => settle(code));
  child.on('error', (err) => settle(null, `Spawn error: ${err.message}`));

  timeoutHandle = setTimeout(() => {
    stopFn();
    settle(null, 'Run timed out');
  }, RUN_TIMEOUT_MS);

  function stopFn(): void {
    child.kill('SIGTERM');
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 5_000);
  }

  return { stop: stopFn };
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Active run registry (projectId → ActiveRun). Only one run per project. */
const activeRuns = new Map<string, ActiveRun>();

/**
 * Start a new agent run.
 * Returns an `ActiveRun` that can be used to cancel the run.
 *
 * Mode selection:
 *  1. Docker + image exists → container isolation (CoreClaw style)
 *  2. Otherwise            → host process (developer fallback)
 */
export function startRun(opts: RunnerOptions, cbs: RunnerCallbacks): ActiveRun {
  // Wrap callbacks so we clean up the registry entry when the run ends.
  const wrapped: RunnerCallbacks = {
    onChunk:    (c) => cbs.onChunk(c),
    onProgress: (m) => cbs.onProgress(m),
    onDone: (code) => {
      activeRuns.delete(opts.projectId);
      cbs.onDone(code);
    },
    onError: (msg) => {
      activeRuns.delete(opts.projectId);
      cbs.onError(msg);
    },
  };

  const useDocker = isDockerAvailable() && containerImageExists();
  const run = useDocker
    ? runInDocker(opts, wrapped)
    : runOnHost(opts, wrapped);

  if (useDocker) {
    console.log(`[container-runner] mode=docker project=${opts.projectId.slice(0, 8)}`);
  } else {
    console.log(`[container-runner] mode=host  project=${opts.projectId.slice(0, 8)} (Docker unavailable or image missing)`);
  }

  activeRuns.set(opts.projectId, run);
  return run;
}

/**
 * Stop the active run for a project, if any.
 * Returns true if a run was stopped, false if no run was active.
 */
export function stopRun(projectId: string): boolean {
  const run = activeRuns.get(projectId);
  if (!run) return false;
  run.stop();
  activeRuns.delete(projectId);
  return true;
}

/**
 * Stop all active runs. Called during server shutdown.
 */
export function stopAllRuns(): void {
  for (const [projectId, run] of activeRuns) {
    run.stop();
    activeRuns.delete(projectId);
  }
}

/** Number of currently active runs. */
export function activeRunCount(): number {
  return activeRuns.size;
}
