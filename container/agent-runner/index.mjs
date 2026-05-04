/**
 * AIRA Agent Runner (runs inside Docker container)
 *
 * Inspired by CoreClaw's container/agent-runner pattern.
 * Reads configuration from environment variables, runs GitHub Copilot CLI
 * with JSON streaming output, and writes structured events to stdout for
 * the host container-runner.ts to consume.
 *
 * Environment variables (injected by host):
 *   COPILOT_PROMPT          - the full prompt text
 *   COPILOT_MODEL           - optional model override
 *   MCP_CONFIG_FILE         - path to MCP config JSON file (optional)
 *   GITHUB_API_URL          - credential proxy URL (replaces direct GitHub API)
 *
 * Output protocol (stdout, newline-delimited JSON):
 *   { "type": "ready" }
 *   { "type": "chunk",    "content": "..." }      ← streaming text
 *   { "type": "progress", "message": "..." }      ← tool execution indicator
 *   { "type": "done",     "exitCode": 0 }
 *   { "type": "error",    "message": "..." }
 */

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';

// ── Configuration ──────────────────────────────────────────────────────────

const PROMPT        = process.env.COPILOT_PROMPT        ?? '';
const MODEL         = process.env.COPILOT_MODEL         ?? '';
const MCP_CONFIG    = process.env.MCP_CONFIG_FILE       ?? '';

if (!PROMPT) {
  send({ type: 'error', message: 'COPILOT_PROMPT is required' });
  process.exit(1);
}

// ── IPC helpers ────────────────────────────────────────────────────────────

function send(event) {
  process.stdout.write(JSON.stringify(event) + '\n');
}

function log(msg) {
  process.stderr.write(`[agent-runner] ${msg}\n`);
}

// ── Copilot CLI resolution ─────────────────────────────────────────────────

function resolveCli() {
  // Inside the container, @github/copilot is installed globally via npm -g
  try {
    execSync('copilot --version', { encoding: 'utf8', timeout: 10_000, stdio: 'pipe' });
    return { command: 'copilot', argsPrefix: [] };
  } catch { /* fall through */ }
  // npm global bin fallback
  try {
    const bin = execSync('npm root -g', { encoding: 'utf8', timeout: 5_000 }).trim();
    const script = `${bin}/@github/copilot/dist/cli.js`;
    if (fs.existsSync(script)) {
      return { command: process.execPath, argsPrefix: [script] };
    }
  } catch { /* fall through */ }
  throw new Error('copilot CLI not found. Is @github/copilot installed?');
}

// ── JSON streaming output parsing ─────────────────────────────────────────

function formatToolStart(toolName, args) {
  const cmd  = typeof args?.command  === 'string' ? args.command.trim()  : '';
  const file = typeof args?.filePath === 'string' ? args.filePath.trim() : '';
  const dir  = typeof args?.dirPath  === 'string' ? args.dirPath.trim()  : '';
  const q    = typeof args?.query    === 'string' ? args.query.trim()    : '';
  const hint = cmd || file || dir || q;
  const short = hint.length > 80 ? hint.slice(0, 77) + '...' : hint;
  return short ? `${toolName}: ${short}` : toolName;
}

function parseCliEvent(line, state) {
  let event;
  try { event = JSON.parse(line); } catch { return; }

  const type = event?.type ?? '';
  const data = event?.data ?? {};

  switch (type) {
    case 'assistant.message_delta':
      if (typeof data.deltaContent === 'string' && data.deltaContent) {
        state.deltasSeen = true;
        send({ type: 'chunk', content: data.deltaContent });
      }
      break;

    case 'assistant.message':
      // Non-streaming fallback content
      if (typeof data.content === 'string') {
        state.finalMessage = data.content.trim();
      }
      break;

    case 'assistant.turn_start':
      send({ type: 'progress', message: 'Analyzing…' });
      break;

    case 'tool.execution_start': {
      const toolName = typeof data.toolName === 'string' ? data.toolName : 'tool';
      const toolArgs = (data.arguments && typeof data.arguments === 'object') ? data.arguments : {};
      send({ type: 'progress', message: formatToolStart(toolName, toolArgs) });
      break;
    }

    case 'session.tools_loaded': {
      const names = Array.isArray(data.tools)
        ? data.tools.map(t => t.name).filter(Boolean).join(', ')
        : '';
      if (names) send({ type: 'progress', message: `Tools loaded: ${names}` });
      break;
    }

    default:
      break;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  send({ type: 'ready' });

  const cli = resolveCli();
  const args = [
    ...cli.argsPrefix,
    '--allow-all',
    '--prompt', PROMPT,
    '--output-format', 'json',
    '--stream', 'on',
  ];
  if (MODEL) args.push('--model', MODEL);
  if (MCP_CONFIG) args.push('--additional-mcp-config', `@${MCP_CONFIG}`);

  log(`Starting copilot (prompt length=${PROMPT.length})`);

  const state = { deltasSeen: false, finalMessage: '' };

  const child = spawn(cli.command, args, {
    cwd: '/workspace',
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  child.stdin?.end();

  let jsonBuf = '';
  child.stdout?.on('data', (data) => {
    jsonBuf += data.toString('utf8');
    let nl;
    while ((nl = jsonBuf.indexOf('\n')) !== -1) {
      const line = jsonBuf.slice(0, nl).trim();
      jsonBuf = jsonBuf.slice(nl + 1);
      if (line) parseCliEvent(line, state);
    }
  });

  child.stderr?.on('data', (data) => {
    log(data.toString('utf8').trimEnd());
  });

  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code));
    child.on('error', (err) => { log(`spawn error: ${err.message}`); resolve(null); });
  });

  // Emit non-streaming content if no deltas were seen
  if (!state.deltasSeen && state.finalMessage) {
    send({ type: 'chunk', content: state.finalMessage });
  }

  send({ type: 'done', exitCode });
}

main().catch((err) => {
  send({ type: 'error', message: String(err) });
  process.exit(1);
});
