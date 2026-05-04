/**
 * Agent Runner Process
 *
 * Spawned as a persistent child process by AgentManager (one per project).
 * Runs GitHub Copilot CLI for each incoming message, then waits for the next one.
 * This loop enables true multi-turn dialogue (e.g. 1問1答 context collection)
 * because the LLM session context – accumulated output, tool calls, workspace
 * state – persists between turns in-process.
 *
 * ── Stdin protocol (parent → runner, newline-delimited JSON) ──
 *   { type: 'run'; prompt: string; token: string; model?: string; mcpConfigFile?: string | null }
 *   { type: 'close' }
 *
 * ── Stdout protocol (runner → parent, newline-delimited JSON) ──
 *   { type: 'chunk';    content: string }          streaming assistant content
 *   { type: 'progress'; message: string }          tool execution status
 *   { type: 'done';     exitCode: number | null }  CLI process finished
 *   { type: 'ready' }                              waiting for next 'run' message
 *   { type: 'error';    message: string }          unrecoverable error
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

// ── Environment injected by AgentManager ──
const workspaceDir = process.env.AIRA_WORKSPACE_DIR!;

// ── Helpers ──

function send(event: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(event) + '\n');
}

function log(msg: string): void {
  process.stderr.write(`[runner] ${msg}\n`);
}

// ── Copilot CLI resolution (mirrors agent.service.ts logic) ──

interface CliInfo {
  command: string;
  argsPrefix: string[];
}

function resolveCli(): CliInfo {
  if (process.platform === 'win32') {
    try {
      const cmdPath = execSync('where copilot.cmd', { encoding: 'utf8', timeout: 10_000 })
        .trim().split('\n')[0]!.trim();
      const content = fs.readFileSync(cmdPath, 'utf8');
      const m = content.match(/"([^"]*node(?:\.exe)?)"[^"]*"([^"]*\.js)"/i);
      if (m) {
        const dir = path.dirname(cmdPath);
        const nodeExe = path.resolve(m[1]!.replace(/%~dp0/gi, dir + path.sep));
        const scriptPath = path.resolve(m[2]!.replace(/%~dp0/gi, dir + path.sep));
        return { command: nodeExe, argsPrefix: [scriptPath] };
      }
    } catch { /* fall through */ }
  }
  // POSIX / fallback
  try {
    execSync('copilot --version', { encoding: 'utf8', timeout: 10_000 });
    return { command: 'copilot', argsPrefix: [] };
  } catch { /* fall through */ }
  // Node.js require fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const scriptPath = require.resolve('@github/copilot/cli');
  return { command: process.execPath, argsPrefix: [scriptPath] };
}

// ── IPC stdin reader ──

type RunnerInput =
  | { type: 'run'; prompt: string; token: string; model?: string; mcpConfigFile?: string | null }
  | { type: 'close' };

function createStdinReader(): {
  next: () => Promise<RunnerInput | null>;
} {
  let buf = '';
  const pending: Array<(msg: RunnerInput | null) => void> = [];
  const queue: RunnerInput[] = [];
  let closed = false;

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as RunnerInput;
        if (pending.length > 0) {
          pending.shift()!(msg);
        } else {
          queue.push(msg);
        }
      } catch {
        log(`Invalid JSON from parent: ${line}`);
      }
    }
  });

  process.stdin.on('end', () => {
    closed = true;
    while (pending.length > 0) pending.shift()!(null);
  });

  process.stdin.on('error', () => {
    closed = true;
    while (pending.length > 0) pending.shift()!(null);
  });

  return {
    next(): Promise<RunnerInput | null> {
      if (queue.length > 0) return Promise.resolve(queue.shift()!);
      if (closed) return Promise.resolve(null);
      return new Promise(resolve => pending.push(resolve));
    },
  };
}

// ── Copilot CLI JSON event parsing ──

/**
 * Generate a short human-readable progress description from a tool call.
 * Mirrors CoreClaw's summarizeToolStart but keeps it minimal.
 */
function formatToolStart(toolName: string, args: Record<string, unknown>): string {
  const cmd  = typeof args.command  === 'string' ? args.command.trim()  : '';
  const file = typeof args.filePath === 'string' ? args.filePath.trim() : '';
  const dir  = typeof args.dirPath  === 'string' ? args.dirPath.trim()  : '';
  const q    = typeof args.query    === 'string' ? args.query.trim()    : '';
  const hint = cmd || file || dir || q;
  const short = hint.length > 80 ? hint.slice(0, 77) + '...' : hint;
  return short ? `${toolName}: ${short}` : toolName;
}

function parseCliEvent(line: string): void {
  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(line) as typeof event;
  } catch {
    // Non-JSON line (e.g. diagnostic text) — ignore silently
    return;
  }

  const type = event?.type ?? '';
  const data = (event?.data ?? {}) as Record<string, unknown>;

  switch (type) {
    case 'assistant.message_delta':
      // Streaming content — forward as chunk
      if (typeof data.deltaContent === 'string' && data.deltaContent) {
        send({ type: 'chunk', content: data.deltaContent });
      }
      break;

    case 'assistant.message':
      // Non-streaming fallback: emit if no deltas were produced
      // Handled at close time via finalAssistantMessage
      break;

    case 'assistant.turn_start':
      send({ type: 'progress', message: 'Analyzing…' });
      break;

    case 'tool.execution_start': {
      const toolName = typeof data.toolName === 'string' ? data.toolName : 'tool';
      const toolArgs = (data.arguments && typeof data.arguments === 'object')
        ? data.arguments as Record<string, unknown>
        : {};
      send({ type: 'progress', message: formatToolStart(toolName, toolArgs) });
      break;
    }

    case 'session.tools_loaded': {
      const names = Array.isArray(data.tools)
        ? (data.tools as Array<{ name?: string }>).map(t => t.name).filter(Boolean).join(', ')
        : '';
      if (names) send({ type: 'progress', message: `Tools loaded: ${names}` });
      break;
    }

    case 'result':
      // Usage / finish — nothing to show
      break;

    default:
      break;
  }
}

// ── Copilot CLI invocation ──

interface RunResult {
  exitCode: number | null;
}

function runCopilot(
  prompt: string,
  token: string,
  model: string | undefined,
  mcpConfigFile: string | null | undefined,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const cli = resolveCli();

    // Use JSON streaming output so we can parse structured events:
    //   assistant.message_delta → chunk (streamed content)
    //   tool.execution_start   → progress (tool call indicator)
    // This makes AIRA a proper frontend for the Copilot CLI API.
    const args = [
      ...cli.argsPrefix,
      '--allow-all',
      '--prompt', prompt,
      '--output-format', 'json',
      '--stream', 'on',
    ];
    if (model) args.push('--model', model);
    if (mcpConfigFile) args.push('--additional-mcp-config', `@${mcpConfigFile}`);

    log(`Starting copilot (${prompt.length} chars, cwd=${workspaceDir})`);

    const child = spawn(cli.command, args, {
      cwd: workspaceDir,
      env: { ...process.env, GITHUB_TOKEN: token },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stdin?.end();

    // Parse JSONL from stdout — each line is a structured CLI event
    let jsonBuf = '';
    let deltasSeen = false;
    let finalAssistantMessage = '';

    child.stdout?.on('data', (data: Buffer) => {
      jsonBuf += data.toString('utf8');
      let nl: number;
      while ((nl = jsonBuf.indexOf('\n')) !== -1) {
        const line = jsonBuf.slice(0, nl).trim();
        jsonBuf = jsonBuf.slice(nl + 1);
        if (!line) continue;

        // Track whether we saw streaming deltas
        try {
          const ev = JSON.parse(line) as { type?: string; data?: Record<string, unknown> };
          if (ev.type === 'assistant.message_delta') deltasSeen = true;
          if (ev.type === 'assistant.message') {
            const content = (ev.data as Record<string, unknown> | undefined)?.content;
            if (typeof content === 'string') finalAssistantMessage = content.trim();
          }
        } catch { /* ignore */ }

        parseCliEvent(line);
      }
    });

    // Stderr contains CLI diagnostic messages — log internally, do not stream to UI
    child.stderr?.on('data', (data: Buffer) => {
      log(data.toString('utf8').trimEnd());
    });

    child.on('close', (code) => {
      log(`Copilot exited with code ${code}`);

      // If the model doesn't stream deltas but sends a final message, emit it now
      if (!deltasSeen && finalAssistantMessage) {
        send({ type: 'chunk', content: finalAssistantMessage });
      }

      resolve({ exitCode: code });
    });

    child.on('error', (err) => {
      log(`Copilot spawn error: ${err.message}`);
      resolve({ exitCode: null });
    });
  });
}

// ── Main loop ──

async function main(): Promise<void> {
  if (!workspaceDir) {
    send({ type: 'error', message: 'AIRA_WORKSPACE_DIR not set' });
    process.exit(1);
  }

  fs.mkdirSync(workspaceDir, { recursive: true });

  const reader = createStdinReader();

  log(`Agent runner started, workspace=${workspaceDir}`);
  send({ type: 'ready' });

  while (true) {
    const msg = await reader.next();
    if (msg === null || msg.type === 'close') {
      log('Closing agent runner');
      break;
    }
    if (msg.type !== 'run') continue;

    const { exitCode } = await runCopilot(
      msg.prompt,
      msg.token,
      msg.model,
      msg.mcpConfigFile,
    );

    send({ type: 'done', exitCode });
    send({ type: 'ready' });
  }
}

main().catch((err) => {
  send({ type: 'error', message: String(err) });
  process.exit(1);
});
