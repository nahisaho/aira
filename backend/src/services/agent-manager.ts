/**
 * Agent Manager
 *
 * Manages persistent agent-runner child processes, one per project.
 * Each project gets a long-lived process that runs copilot CLI in a loop,
 * enabling true multi-turn dialogue between user messages.
 *
 * Process lifecycle:
 *  - First message for a project → spawn agent-runner-process
 *  - Subsequent messages → send to existing runner via stdin
 *  - No message for IDLE_TIMEOUT ms → kill the runner (saves resources)
 *  - Stop requested → kill runner immediately
 */

import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

// ── Constants ──

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ── Types ──

type RunnerEvent =
  | { type: 'chunk'; content: string }
  | { type: 'progress'; message: string }
  | { type: 'done'; exitCode: number | null }
  | { type: 'ready' }
  | { type: 'error'; message: string };

export interface RunCallbacks {
  onChunk: (content: string) => void;
  onProgress?: (message: string) => void;
  onDone: (exitCode: number | null) => void;
}

interface PendingRun {
  runId: string;
  prompt: string;
  token: string;
  model?: string;
  mcpConfigFile?: string | null;
  callbacks: RunCallbacks;
}

interface ManagedRunner {
  projectId: string;
  workspaceDir: string;
  process: ChildProcess;
  /** true while a copilot CLI call is running */
  busy: boolean;
  /** queued run if a message arrived while busy */
  pending: PendingRun | null;
  /** current run callbacks */
  currentCallbacks: RunCallbacks | null;
  /** current run id (for stop signal) */
  currentRunId: string | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  lineBuffer: string;
}

// ── Singleton registry ──

const runners = new Map<string, ManagedRunner>();

// ── Runner file resolution ──

function resolveRunnerScript(): string {
  // In production (compiled JS): sibling .js file
  // In development (tsx): source .ts file
  const __dir = path.dirname(fileURLToPath(import.meta.url));
  const jsPath = path.join(__dir, 'agent-runner-process.js');
  const tsPath = path.join(__dir, 'agent-runner-process.ts');
  if (fs.existsSync(jsPath)) return jsPath;
  return tsPath; // tsx will handle it
}

function resolveRunnerCommand(scriptPath: string): { command: string; args: string[] } {
  if (scriptPath.endsWith('.ts')) {
    // Development: use tsx
    return { command: 'tsx', args: [scriptPath] };
  }
  return { command: process.execPath, args: [scriptPath] };
}

// ── Core ──

function resetIdleTimer(runner: ManagedRunner): void {
  if (runner.idleTimer) clearTimeout(runner.idleTimer);
  runner.idleTimer = setTimeout(() => {
    if (!runner.busy) {
      closeRunner(runner.projectId, 'idle_timeout');
    }
  }, IDLE_TIMEOUT_MS);
}

function sendToRunner(runner: ManagedRunner, msg: Record<string, unknown>): void {
  runner.process.stdin?.write(JSON.stringify(msg) + '\n');
}

function handleRunnerEvent(runner: ManagedRunner, event: RunnerEvent): void {
  switch (event.type) {
    case 'ready':
      runner.busy = false;
      if (runner.pending) {
        const next = runner.pending;
        runner.pending = null;
        dispatchRun(runner, next);
      } else {
        resetIdleTimer(runner);
      }
      break;

    case 'chunk':
      runner.currentCallbacks?.onChunk(event.content);
      break;

    case 'progress':
      runner.currentCallbacks?.onProgress?.(event.message);
      break;

    case 'done':
      runner.currentCallbacks?.onDone(event.exitCode ?? null);
      runner.currentCallbacks = null;
      runner.currentRunId = null;
      break;

    case 'error':
      runner.currentCallbacks?.onDone(null);
      runner.currentCallbacks = null;
      runner.currentRunId = null;
      closeRunner(runner.projectId, 'runner_error');
      break;
  }
}

function dispatchRun(runner: ManagedRunner, run: PendingRun): void {
  runner.busy = true;
  runner.currentCallbacks = run.callbacks;
  runner.currentRunId = run.runId;
  if (runner.idleTimer) {
    clearTimeout(runner.idleTimer);
    runner.idleTimer = null;
  }
  sendToRunner(runner, {
    type: 'run',
    prompt: run.prompt,
    token: run.token,
    model: run.model,
    mcpConfigFile: run.mcpConfigFile ?? null,
  });
}

function spawnRunner(projectId: string, workspaceDir: string): ManagedRunner {
  const scriptPath = resolveRunnerScript();
  const { command, args } = resolveRunnerCommand(scriptPath);

  const child = spawn(command, args, {
    env: { ...process.env, AIRA_WORKSPACE_DIR: workspaceDir },
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });

  const runner: ManagedRunner = {
    projectId,
    workspaceDir,
    process: child,
    busy: false,
    pending: null,
    currentCallbacks: null,
    currentRunId: null,
    idleTimer: null,
    lineBuffer: '',
  };

  // Parse JSONL from runner stdout
  child.stdout?.on('data', (data: Buffer) => {
    runner.lineBuffer += data.toString('utf8');
    let nl: number;
    while ((nl = runner.lineBuffer.indexOf('\n')) !== -1) {
      const line = runner.lineBuffer.slice(0, nl).trim();
      runner.lineBuffer = runner.lineBuffer.slice(nl + 1);
      if (!line) continue;
      try {
        const event = JSON.parse(line) as RunnerEvent;
        handleRunnerEvent(runner, event);
      } catch {
        // Non-JSON output from runner — ignore
      }
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    // Runner internal logs; suppress in production
    if (process.env.NODE_ENV !== 'production') {
      process.stderr.write(data);
    }
  });

  child.on('close', () => {
    runners.delete(projectId);
    // If there was an active run, signal done
    runner.currentCallbacks?.onDone(null);
    runner.currentCallbacks = null;
    if (runner.idleTimer) clearTimeout(runner.idleTimer);
  });

  child.on('error', (err) => {
    process.stderr.write(`[agent-manager] Runner spawn error for ${projectId}: ${err.message}\n`);
    runners.delete(projectId);
    runner.currentCallbacks?.onDone(null);
    runner.currentCallbacks = null;
  });

  runners.set(projectId, runner);
  return runner;
}

export function closeRunner(projectId: string, _reason: string): void {
  const runner = runners.get(projectId);
  if (!runner) return;
  if (runner.idleTimer) clearTimeout(runner.idleTimer);
  try {
    sendToRunner(runner, { type: 'close' });
  } catch { /* ignore */ }
  setTimeout(() => {
    const r = runners.get(projectId);
    if (!r) return;
    try {
      if (process.platform === 'win32') {
        r.process.kill('SIGTERM');
      } else if (r.process.pid) {
        process.kill(-r.process.pid, 'SIGTERM');
      }
    } catch { /* ignore */ }
    runners.delete(projectId);
  }, 3000);
}

// ── Public API ──

/**
 * Send a message to the agent runner for a project.
 * Spawns a new runner if none exists.
 * Returns the runId for stop support.
 */
export function sendMessage(opts: {
  projectId: string;
  workspaceDir: string;
  runId: string;
  prompt: string;
  token: string;
  model?: string;
  mcpConfigFile?: string | null;
  callbacks: RunCallbacks;
}): void {
  let runner = runners.get(opts.projectId);
  if (!runner) {
    runner = spawnRunner(opts.projectId, opts.workspaceDir);
  }

  const run: PendingRun = {
    runId: opts.runId,
    prompt: opts.prompt,
    token: opts.token,
    model: opts.model,
    mcpConfigFile: opts.mcpConfigFile,
    callbacks: opts.callbacks,
  };

  if (runner.busy) {
    // Queue — only keep the latest pending message
    runner.pending = run;
  } else {
    dispatchRun(runner, run);
  }
}

/**
 * Stop the current running CLI invocation for a project.
 * Kills the entire runner process (which kills the copilot child too).
 */
export function stopProjectRunner(projectId: string): boolean {
  const runner = runners.get(projectId);
  if (!runner) return false;

  // Signal current callbacks as done before killing
  runner.currentCallbacks?.onDone(null);
  runner.currentCallbacks = null;
  runner.currentRunId = null;

  closeRunner(projectId, 'user_cancel');
  return true;
}

/**
 * Check if a project has an active runner.
 */
export function hasRunner(projectId: string): boolean {
  return runners.has(projectId);
}

/**
 * Shutdown all runners (call on server shutdown).
 */
export function shutdownAll(): void {
  for (const projectId of runners.keys()) {
    closeRunner(projectId, 'shutdown');
  }
}
