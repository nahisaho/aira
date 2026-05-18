/**
 * Container Runner — Session-based CLI orchestrator
 *
 * Executes GitHub Copilot CLI as a one-process-per-message host process.
 * Uses stdin mode (no --prompt flag) so the CLI runs in interactive mode
 * where ask_user is available, enabling multi-turn skills like
 * context-collector. The prompt is written to stdin and stdin is closed
 * (EOF) so the CLI processes it and exits.
 *
 * Uses --name/--resume to maintain session continuity across invocations
 * so the CLI preserves its own conversation history, skill state, and
 * context between turns.
 *
 * Design:
 *  • **Interactive mode via stdin** — prompt is piped through stdin+EOF
 *    instead of --prompt flag. This keeps ask_user available so skills
 *    can ask the user questions one at a time.
 *
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
  onFileCreated?: (filePath: string) => void;
}

export interface RunnerOptions {
  projectId:    string;
  workspaceDir: string;
  prompt:       string;
  /** Full history prompt used only when creating a new session (--name fallback). */
  coldStartPrompt?: string;
  token:        string;
  model?:       string;
  mcpConfigFile?: string | null;
  /** If true, skip --resume and directly create a new session. */
  forceNewSession?: boolean;
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
  cbs: Pick<RunnerCallbacks, 'onChunk' | 'onProgress' | 'onFileCreated'>,
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
    case 'session.info': {
      if (data.infoType === 'file_created' && typeof data.message === 'string') {
        cbs.onFileCreated?.(data.message);
      }
      break;
    }
    default:
      if (type) {
        // Log unknown events with their data for debugging
        const preview = JSON.stringify(data).substring(0, 200);
        console.log(`[copilot-cli] event: ${type} ${preview}`);
      }
      break;
  }
}

// ── Stdout / event stream reader ───────────────────────────────────────────

function attachStreamReader(
  proc: ChildProcess,
  state: ParseState,
  cbs: Pick<RunnerCallbacks, 'onChunk' | 'onProgress' | 'onFileCreated'>,
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
  // Flush any remaining unterminated line when stdout closes
  proc.stdout?.on('end', () => {
    const remaining = buf.trim();
    if (remaining) parseLine(remaining, state, cbs);
    buf = '';
  });
}

// ── Host process runner ────────────────────────────────────────────────────

function runOnHost(opts: RunnerOptions, cbs: RunnerCallbacks): ActiveRun {
  const cli = resolveHostCli();

  // Always try --resume first (session may exist from a previous container lifecycle).
  // If --resume fails (no such session), retry with --name using a unique suffix.
  const baseSessionName = getSessionName(opts.projectId);
  const knownSession = projectSessions.get(opts.projectId);

  // Mutable stop handle — updated on retry so callers always cancel the active child.
  let currentStop: (() => void) | null = null;

  function spawnCli(sessionArg: '--resume' | '--name', sessionName: string): void {
    const args = [
      ...cli.argsPrefix,
      '--allow-all',
      // stdin mode: prompt is written to stdin then closed (EOF).
      // Note: EOF closes interactive mode, so ask_user tool is NOT available.
      // Skills that need Q&A output questions as regular text instead.
      '--output-format', 'json',
      '--stream', 'on',
      '--add-github-mcp-tool', 'web_search',
      sessionArg, sessionName,
    ];

    if (opts.model)        args.push('--model', opts.model);
    if (opts.mcpConfigFile) args.push('--additional-mcp-config', `@${opts.mcpConfigFile}`);

    // For --resume, send only the raw user message (CLI already has history).
    // For --name (new session / cold-start fallback), send the full history prompt.
    const inputPrompt = sessionArg === '--resume'
      ? opts.prompt
      : (opts.coldStartPrompt ?? opts.prompt);

    const mode = sessionArg === '--resume' ? 'resume' : 'new';
    console.log(`[copilot-cli] ${mode} session="${sessionName}" prompt=${inputPrompt.length}chars`);

    const state: ParseState = { deltasSeen: false, finalMessage: '' };

    const child = spawn(cli.command, args, {
      cwd: opts.workspaceDir,
      env: { ...process.env, GITHUB_TOKEN: opts.token },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    attachStreamReader(child, state, cbs);

    // Write prompt to stdin and close (EOF signals end of input).
    // Use .end(data) for atomicity — avoids EPIPE on fast child exit.
    const payload = inputPrompt.endsWith('\n') ? inputPrompt : inputPrompt + '\n';
    child.stdin?.end(payload);
    child.stdin?.on('error', (err: NodeJS.ErrnoException) => {
      // Ignore broken pipe — child may have exited before we finished writing.
      if (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED') return;
      console.warn(`[copilot-cli] stdin error: ${err.message}`);
    });

    let stderrBuf = '';
    child.stderr?.on('data', (d: Buffer) => {
      const chunk = d.toString('utf8');
      stderrBuf += chunk;
      console.warn(`[copilot-cli] ${chunk.trimEnd()}`);
    });

    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    function settle(exitCode: number | null, error?: string): void {
      if (settled) return;
      settled = true;
      if (timeoutHandle) { clearTimeout(timeoutHandle); timeoutHandle = null; }
      console.log(`[copilot-cli] settle: exitCode=${exitCode} deltasSeen=${state.deltasSeen} finalMsg=${state.finalMessage.length}chars stderr=${stderrBuf.length}chars`);

      // If CLI exited with error and produced no output, report stderr as error
      if (!error && exitCode !== 0 && !state.deltasSeen && !state.finalMessage) {
        const stderrMsg = stderrBuf.trim();
        error = stderrMsg || `CLI exited with code ${exitCode}`;
      }

      // If --resume failed (e.g., no such session or multiple matches), retry with --name.
      // Only retry if no user-visible output was emitted to avoid duplicating content.
      if (error && sessionArg === '--resume' && !state.deltasSeen && !state.finalMessage) {
        console.warn(`[copilot-cli] resume failed: ${error.split('\n')[0]}, retrying with --name`);
        projectSessions.delete(opts.projectId);
        const uniqueName = `${baseSessionName}-${Date.now().toString(36)}`;
        spawnCli('--name', uniqueName);
        return;
      }

      if (error) {
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

    // Update the mutable stop handle so outer callers cancel the right child.
    currentStop = stopFn;
  }

  // If forceNewSession is set (first message or cleared history), skip --resume entirely.
  // Otherwise try to resume an existing session, falling back to --name on failure.
  if (opts.forceNewSession) {
    const uniqueName = `${baseSessionName}-${Date.now().toString(36)}`;
    spawnCli('--name', uniqueName);
  } else if (knownSession) {
    spawnCli('--resume', knownSession);
  } else {
    spawnCli('--resume', baseSessionName);
  }

  return { stop: () => currentStop?.() };
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Active run registry (projectId → ActiveRun). Only one run per project. */
const activeRuns = new Map<string, ActiveRun>();

/**
 * Start a new agent run.
 * Uses the host Copilot CLI with session continuity (--name/--resume).
 */
export function startRun(opts: RunnerOptions, cbs: RunnerCallbacks): ActiveRun {
  // Stop any existing active run for this project to prevent parallel execution.
  const existing = activeRuns.get(opts.projectId);
  if (existing) {
    console.warn(`[copilot-cli] Stopping existing run for project=${opts.projectId.slice(0, 8)}`);
    existing.stop();
    activeRuns.delete(opts.projectId);
  }

  const wrapped: RunnerCallbacks = {
    onChunk:    (c) => cbs.onChunk(c),
    onProgress: (m) => cbs.onProgress(m),
    onFileCreated: (p) => cbs.onFileCreated?.(p),
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
