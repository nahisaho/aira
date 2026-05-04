/**
 * Container Runner — Session-based CLI orchestrator
 *
 * Executes GitHub Copilot CLI as a one-process-per-message host process.
 * Uses --name/--resume to maintain session continuity across invocations
 * so the CLI preserves its own conversation history, skill state, and
 * context between turns.
 *
 * Design:
 *  • **Session continuity** — first message uses `--name`, subsequent
 *    messages use `--resume` so the CLI's built-in session management
 *    handles conversation history (no need to rebuild from DB).
 *
 *  • **Native skill discovery** — the CLI auto-discovers skills from
 *    .github/skills/ and loads them based on description matching.
 *
 *  • **Structured streaming** — JSON events (assistant.message_delta,
 *    tool.execution_start, assistant.turn_end) are parsed and forwarded.
 *
 *  • **Cancellation** — the caller receives a stop() function that kills
 *    the process and terminates the run cleanly.
 */

import { spawn, execSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// ── Constants ──────────────────────────────────────────────────────────────

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
  stop: () => void;
}

// ── Session name registry ──────────────────────────────────────────────────

/**
 * Tracks which projects have an active CLI session (by name).
 * First message creates a session with --name, subsequent messages use --resume.
 */
const projectSessions = new Map<string, string>();

function getSessionName(projectId: string): string {
  return `aira-${projectId.slice(0, 12)}`;
}

/** Clear session for a project (e.g., on project delete or reset). */
export function clearSession(projectId: string): void {
  projectSessions.delete(projectId);
}

// ── CLI resolution ─────────────────────────────────────────────────────────

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
  try {
    const scriptPath = require.resolve('@github/copilot/dist/cli.js');
    return { command: process.execPath, argsPrefix: [scriptPath] };
  } catch { /* fall through */ }
  throw new Error(
    'GitHub Copilot CLI not found. Install it with: npm install -g @github/copilot',
  );
}

// ── JSON event parsing ─────────────────────────────────────────────────────

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
    case 'session.tools_loaded':
    case 'session.tools_updated': {
      const names = Array.isArray(data.tools)
        ? (data.tools as Array<{ name?: string }>).map(t => t.name).filter(Boolean).join(', ')
        : '';
      if (names) cbs.onProgress(`Tools loaded: ${names}`);
      break;
    }
    case 'session.skills_loaded': {
      const skills = Array.isArray(data.skills)
        ? (data.skills as Array<{ name?: string }>).map(s => s.name).filter(Boolean).join(', ')
        : '';
      if (skills) console.log(`[copilot-cli] Skills loaded: ${skills}`);
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

// ── Host process runner ────────────────────────────────────────────────────

function runOnHost(opts: RunnerOptions, cbs: RunnerCallbacks): ActiveRun {
  const cli = resolveHostCli();
  const sessionName = getSessionName(opts.projectId);
  const hasSession = projectSessions.has(opts.projectId);

  const args = [
    ...cli.argsPrefix,
    '--allow-all',
    '--prompt', opts.prompt,
    '--output-format', 'json',
    '--stream', 'on',
    '--add-github-mcp-tool', 'web_search',
  ];

  // Session continuity: --name for new sessions, --resume for existing ones
  if (hasSession) {
    args.push('--resume', sessionName);
  } else {
    args.push('--name', sessionName);
  }

  if (opts.model)        args.push('--model', opts.model);
  if (opts.mcpConfigFile) args.push('--additional-mcp-config', `@${opts.mcpConfigFile}`);

  const mode = hasSession ? 'resume' : 'new';
  console.log(`[copilot-cli] ${mode} session="${sessionName}" prompt=${opts.prompt.length}chars`);

  const state: ParseState = { deltasSeen: false, finalMessage: '' };

  const child = spawn(cli.command, args, {
    cwd: opts.workspaceDir,
    env: { ...process.env, GITHUB_TOKEN: opts.token },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  attachStreamReader(child, state, cbs);

  child.stderr?.on('data', (d: Buffer) => {
    console.debug(`[copilot-cli] ${d.toString('utf8').trimEnd()}`);
  });

  let settled = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  function settle(exitCode: number | null, error?: string): void {
    if (settled) return;
    settled = true;
    if (timeoutHandle) { clearTimeout(timeoutHandle); timeoutHandle = null; }

    if (error) {
      // If resume failed, clear session so next attempt creates a new one
      if (hasSession && exitCode !== 0) {
        console.warn(`[copilot-cli] resume failed for "${sessionName}", clearing session`);
        projectSessions.delete(opts.projectId);
      }
      cbs.onError(error);
    } else {
      // Mark session as active on success
      projectSessions.set(opts.projectId, sessionName);

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
 * Uses the host Copilot CLI with session continuity (--name/--resume).
 */
export function startRun(opts: RunnerOptions, cbs: RunnerCallbacks): ActiveRun {
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

  const run = runOnHost(opts, wrapped);
  console.log(`[copilot-cli] project=${opts.projectId.slice(0, 8)}`);
  activeRuns.set(opts.projectId, run);
  return run;
}

/**
 * Stop the active run for a project, if any.
 */
export function stopRun(projectId: string): boolean {
  const run = activeRuns.get(projectId);
  if (!run) return false;
  run.stop();
  activeRuns.delete(projectId);
  return true;
}

/** Stop all active runs. Called during server shutdown. */
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

/** No-op — kept for API compatibility. */
export function invalidateDockerCache(): void { /* no-op */ }
