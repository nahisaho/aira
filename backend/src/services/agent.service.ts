import { spawn, ChildProcess, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { getDatabase } from '../db/index.js';

// Cached CLI resolution result
export interface CliResolution {
  command: string;
  argsPrefix: string[];
  version: string;
}

let cachedResolution: CliResolution | null = null;

/**
 * Resolve the Copilot CLI command for the current platform.
 * macOS/Linux: spawn('copilot', args) via PATH
 * Windows: parse .cmd wrapper to find node.exe + script path
 */
export function resolveCli(): CliResolution {
  if (cachedResolution) return cachedResolution;

  const isWindows = process.platform === 'win32';

  if (isWindows) {
    cachedResolution = resolveCliWindows();
  } else {
    cachedResolution = resolveCliPosix();
  }

  return cachedResolution;
}

function resolveCliPosix(): CliResolution {
  try {
    const version = execSync('copilot --version', {
      encoding: 'utf8',
      timeout: 10_000,
    }).trim();

    return { command: 'copilot', argsPrefix: [], version };
  } catch {
    // Fallback: try via process.execPath + require.resolve
    try {
      const scriptPath = require.resolve('@github/copilot/cli');
      const version = execSync(`${process.execPath} ${scriptPath} --version`, {
        encoding: 'utf8',
        timeout: 10_000,
      }).trim();
      return { command: process.execPath, argsPrefix: [scriptPath], version };
    } catch {
      throw new CliNotFoundError();
    }
  }
}

function resolveCliWindows(): CliResolution {
  // Try to find copilot.cmd in PATH
  try {
    const cmdPath = execSync('where copilot.cmd', {
      encoding: 'utf8',
      timeout: 10_000,
    }).trim().split('\n')[0]!.trim();

    // Parse .cmd to extract node.exe and script path
    const parsed = parseCmdWrapper(cmdPath);
    if (parsed) {
      const version = execSync(`"${parsed.nodeExe}" "${parsed.scriptPath}" --version`, {
        encoding: 'utf8',
        timeout: 10_000,
      }).trim();
      return { command: parsed.nodeExe, argsPrefix: [parsed.scriptPath], version };
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback
  try {
    const scriptPath = require.resolve('@github/copilot/cli');
    const version = execSync(`"${process.execPath}" "${scriptPath}" --version`, {
      encoding: 'utf8',
      timeout: 10_000,
    }).trim();
    return { command: process.execPath, argsPrefix: [scriptPath], version };
  } catch {
    throw new CliNotFoundError();
  }
}

/**
 * Parse a Windows .cmd wrapper to extract the node.exe and script paths.
 * Typical format: "%~dp0\node_modules\.bin\node.exe" "%~dp0\node_modules\@github\copilot\cli.js" %*
 */
function parseCmdWrapper(cmdPath: string): { nodeExe: string; scriptPath: string } | null {
  try {
    const content = fs.readFileSync(cmdPath, 'utf8');
    // Look for patterns like "node.exe" "script.js"
    const match = content.match(/"([^"]*node(?:\.exe)?)"[^"]*"([^"]*\.js)"/i);
    if (match) {
      const dir = path.dirname(cmdPath);
      const nodeExe = match[1]!.replace(/%~dp0/gi, dir + path.sep);
      const scriptPath = match[2]!.replace(/%~dp0/gi, dir + path.sep);
      return { nodeExe: path.resolve(nodeExe), scriptPath: path.resolve(scriptPath) };
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/** Clear cached resolution (for testing) */
export function clearCliCache(): void {
  cachedResolution = null;
}

export class CliNotFoundError extends Error {
  constructor() {
    super('GitHub Copilot CLI not found. Please install @github/copilot globally.');
    this.name = 'CliNotFoundError';
  }
}

// ─── Secret Redaction ───

/**
 * Build a streaming redactor using matchAll to correctly handle secrets
 * that span the safe/carry boundary.
 */
function buildRedactor(secrets: string[]) {
  const sorted = secrets.filter(s => s.length > 0).sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return null;

  const maxLen = sorted[0]!.length;
  const escaped = sorted.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(escaped.join('|'), 'g');

  let buffer = '';

  function push(chunk: string): string {
    buffer += chunk;

    if (buffer.length < maxLen) return '';

    // Find all matches in the full buffer
    pattern.lastIndex = 0;
    const matches: Array<{ start: number; end: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(buffer)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length });
    }

    // Safe boundary: secrets starting at or after this point may be incomplete
    const safeBoundary = buffer.length - maxLen + 1;

    let output = '';
    let pos = 0;

    for (const match of matches) {
      if (match.start >= safeBoundary) break;
      output += buffer.slice(pos, match.start);
      output += '[REDACTED]';
      pos = match.end;
    }

    // Emit remaining text up to safeBoundary
    if (pos < safeBoundary) {
      output += buffer.slice(pos, safeBoundary);
    }

    // Carry: everything from max(safeBoundary, last match end)
    buffer = buffer.slice(Math.max(safeBoundary, pos));

    return output;
  }

  function flush(): string {
    pattern.lastIndex = 0;
    const result = buffer.replace(pattern, '[REDACTED]');
    buffer = '';
    return result;
  }

  return { push, flush };
}

/**
 * Create a streaming redactor that replaces secret strings with [REDACTED].
 * Handles chunk boundaries with a carry-over buffer.
 */
export function createRedactor(secrets: string[]): (chunk: string) => string {
  const r = buildRedactor(secrets);
  if (!r) return (chunk: string) => chunk;
  return r.push;
}

/** Flush remaining content from the redactor carry buffer */
export function createRedactorWithFlush(secrets: string[]): {
  push: (chunk: string) => string;
  flush: () => string;
} {
  const r = buildRedactor(secrets);
  if (!r) return { push: (chunk: string) => chunk, flush: () => '' };
  return r;
}

// ─── Agent Process Management ───

export interface RunningProcess {
  runId: string;
  projectId: string;
  child: ChildProcess;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const KILL_GRACE_MS = 5_000;

const runningProcesses = new Map<string, RunningProcess>();

export function getRunningProcessCount(): number {
  return runningProcesses.size;
}

export function getRunningProcess(runId: string): RunningProcess | undefined {
  return runningProcesses.get(runId);
}

/**
 * Spawn the Copilot CLI agent for a given run.
 */
export function spawnAgent(opts: {
  runId: string;
  projectId: string;
  workspaceDir: string;
  prompt: string;
  token: string;
  extraEnv?: Record<string, string>;
  onData?: (data: string) => void;
  onClose?: (code: number | null) => void;
}): ChildProcess {
  const cli = resolveCli();
  const isWindows = process.platform === 'win32';

  const args = [...cli.argsPrefix, ...buildAgentArgs(opts.prompt)];

  const child = spawn(cli.command, args, {
    cwd: opts.workspaceDir,
    env: {
      ...process.env,
      GITHUB_TOKEN: opts.token,
      ...opts.extraEnv,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: !isWindows, // POSIX: process group for clean kill
  });

  // Set up timeout
  const timeoutHandle = setTimeout(() => {
    killProcess(opts.runId, 'timeout');
  }, TIMEOUT_MS);

  const entry: RunningProcess = {
    runId: opts.runId,
    projectId: opts.projectId,
    child,
    timeoutHandle,
  };
  runningProcesses.set(opts.runId, entry);

  // Wire stdout/stderr
  child.stdout?.on('data', (data: Buffer) => {
    opts.onData?.(data.toString('utf8'));
  });
  child.stderr?.on('data', (data: Buffer) => {
    opts.onData?.(data.toString('utf8'));
  });

  child.on('close', (code) => {
    clearTimeout(timeoutHandle);
    runningProcesses.delete(opts.runId);
    opts.onClose?.(code);
  });

  child.on('error', (err) => {
    clearTimeout(timeoutHandle);
    runningProcesses.delete(opts.runId);
    console.error(`Agent process error for run ${opts.runId}:`, err.message);
    opts.onClose?.(null);
  });

  return child;
}

function buildAgentArgs(prompt: string): string[] {
  // Base args for copilot CLI chat mode
  return ['--prompt', prompt];
}

/**
 * Kill a running agent process.
 */
export function killProcess(runId: string, _reason: 'timeout' | 'user_cancel'): boolean {
  const entry = runningProcesses.get(runId);
  if (!entry) return false;

  const { child } = entry;
  const pid = child.pid;
  if (!pid) return false;

  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Windows: taskkill /T /F /PID to kill process tree
    try {
      execSync(`taskkill /T /F /PID ${pid}`, { timeout: 10_000 });
    } catch {
      // Process may have already exited
    }
  } else {
    // POSIX: SIGTERM to process group, then SIGKILL after grace period
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      // Process may have already exited
    }

    setTimeout(() => {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        // Already dead
      }
    }, KILL_GRACE_MS);
  }

  return true;
}

/**
 * Mark orphan runs as failed on startup.
 */
export function recoverOrphanRuns(): number {
  const db = getDatabase();
  const result = db.prepare(
    "UPDATE agent_runs SET status = 'failed', error_type = 'server_crash', finished_at = CURRENT_TIMESTAMP WHERE status IN ('running', 'queued')",
  ).run();
  return result.changes;
}
