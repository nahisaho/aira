/**
 * AIRA 100 Advanced Scientific Experiments Runner
 *
 * Standalone Playwright-free runner using WebSocket + REST API directly.
 * Creates a project, assigns Co-Scientist + ToolUniverse MCP,
 * sends a prompt, collects results, and returns structured data.
 *
 * Usage: Called by the experiment orchestrator (scientific-100.orchestrator.ts)
 */

import WebSocket from 'ws';

const API = 'http://localhost:3000/api';
const WS_BASE = 'ws://localhost:3000';

// ── Types ───────────────────────────────────────────────────────────

export interface ExperimentPrompt {
  id: string;
  domain: string;
  title: string;
  prompt: string;
  category: string;
}

export interface ExperimentResult {
  id: string;
  title: string;
  domain: string;
  category: string;
  prompt: string;
  status: string;
  responseText: string;
  responseLength: number;
  chunkCount: number;
  fileCount: number;
  files: string[];
  durationSec: number;
  error: string | null;
  timestamp: string;
}

// ── HTTP Helpers ────────────────────────────────────────────────────

const DEFAULT_HEADERS = { Origin: 'http://localhost:3000' };

async function fetchJson(url: string, options?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...options,
    headers: { ...DEFAULT_HEADERS, ...options?.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

async function getCsrfToken(): Promise<string> {
  const data = await fetchJson(`${API}/csrf-token`) as { token: string };
  return data.token;
}

export async function createProject(name: string): Promise<string> {
  const token = await getCsrfToken();
  const data = await fetchJson(`${API}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
    body: JSON.stringify({ name }),
  }) as { id: string };
  return data.id;
}

export async function deleteProject(id: string): Promise<void> {
  const token = await getCsrfToken();
  await fetch(`${API}/projects/${id}`, {
    method: 'DELETE',
    headers: { ...DEFAULT_HEADERS, 'X-AIRA-Token': token },
  });
}

export async function assignCoScientist(projectId: string): Promise<void> {
  const skills = await fetchJson(`${API}/skills`) as Array<{ id: string; name: string }>;
  const cs = skills.find(s => s.name === 'co-scientist');
  if (!cs) throw new Error('Co-Scientist skill not found');
  const token = await getCsrfToken();
  await fetchJson(`${API}/projects/${projectId}/skills/${cs.id}`, {
    method: 'POST',
    headers: { 'X-AIRA-Token': token },
  });
}

export async function listFiles(projectId: string): Promise<string[]> {
  try {
    const data = await fetchJson(`${API}/projects/${projectId}/files`) as
      Array<{ file_path?: string; name?: string; path?: string }>;
    return data.map(f => f.file_path ?? f.path ?? f.name ?? '');
  } catch {
    return [];
  }
}

export async function stopRun(projectId: string): Promise<void> {
  try {
    const token = await getCsrfToken();
    await fetch(`${API}/projects/${projectId}/runs/current/stop`, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, 'X-AIRA-Token': token },
    });
  } catch { /* ignore */ }
}

// ── WebSocket Chat ──────────────────────────────────────────────────

interface WSResult {
  chunks: string[];
  fullText: string;
  status: string | null;
  runId: string | null;
  error: string | null;
  durationMs: number;
}

function sendChat(projectId: string, content: string, timeoutMs = 3_600_000): Promise<WSResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const ws = new WebSocket(`${WS_BASE}/ws/projects/${projectId}/chat`, {
      headers: { Origin: 'http://localhost:3000' },
    });

    const result: WSResult = {
      chunks: [], fullText: '', status: null, runId: null,
      error: null, durationMs: 0,
    };

    let resolved = false;
    const finish = (status: string) => {
      if (resolved) return;
      resolved = true;
      result.durationMs = Date.now() - start;
      if (!result.status) result.status = status;
      clearTimeout(idleTimer);
      clearTimeout(absTimer);
      try { ws.close(); } catch { /* ignore */ }
      resolve(result);
    };

    // Idle timeout: 30 min without any message — resolve with partial results
    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        result.error = `Idle timeout (1800s). chunks=${result.chunks.length}`;
        finish('timeout');
      }, 1_800_000);
    };

    // Absolute timeout — resolve with partial results
    const absTimer = setTimeout(() => {
      result.error = `Absolute timeout (${timeoutMs}ms). chunks=${result.chunks.length}`;
      finish('timeout');
    }, timeoutMs);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'chat', content }));
      resetIdle();
    });

    ws.on('message', (data) => {
      resetIdle();
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'chunk' && msg.content) {
          result.chunks.push(msg.content);
          result.fullText += msg.content;
        }
        if (msg.type === 'status') {
          result.status = msg.status;
          result.runId = msg.runId ?? null;
          if (['completed', 'error', 'cancelled', 'timeout', 'failed'].includes(msg.status)) {
            finish(msg.status);
          }
        }
        if (msg.type === 'error') {
          result.error = msg.message ?? msg.content ?? 'unknown error';
        }
      } catch { /* ignore */ }
    });

    ws.on('error', (err) => {
      result.error = `WS error: ${err.message}`;
      finish('error');
    });

    ws.on('close', () => {
      finish(result.status ?? 'disconnected');
    });
  });
}

// ── Main Experiment Runner ──────────────────────────────────────────

export async function runExperiment(exp: ExperimentPrompt): Promise<ExperimentResult> {
  const projectName = `exp-${exp.id}-${Date.now()}`;
  let projectId = '';

  try {
    // 1. Create project
    projectId = await createProject(projectName);
    console.log(`  [${exp.id}] Project created: ${projectId}`);

    // 2. Assign Co-Scientist
    await assignCoScientist(projectId);
    console.log(`  [${exp.id}] Co-Scientist assigned`);

    // 3. Wait for MCP/skill initialization
    await new Promise(r => setTimeout(r, 2000));

    // 4. Send prompt via WebSocket
    console.log(`  [${exp.id}] Sending prompt (${exp.prompt.length} chars)...`);
    const wsResult = await sendChat(projectId, exp.prompt);

    // 5. Collect files
    const files = await listFiles(projectId);

    const result: ExperimentResult = {
      id: exp.id,
      title: exp.title,
      domain: exp.domain,
      category: exp.category,
      prompt: exp.prompt,
      status: wsResult.status ?? 'unknown',
      responseText: wsResult.fullText,
      responseLength: wsResult.fullText.length,
      chunkCount: wsResult.chunks.length,
      fileCount: files.length,
      files,
      durationSec: Math.round(wsResult.durationMs / 1000 * 10) / 10,
      error: wsResult.error,
      timestamp: new Date().toISOString(),
    };

    console.log(
      `  [${exp.id}] Done: status=${result.status}, ` +
      `${result.responseLength} chars, ${result.fileCount} files, ` +
      `${result.durationSec}s`
    );

    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`  [${exp.id}] ERROR: ${error}`);
    return {
      id: exp.id,
      title: exp.title,
      domain: exp.domain,
      category: exp.category,
      prompt: exp.prompt,
      status: 'error',
      responseText: '',
      responseLength: 0,
      chunkCount: 0,
      fileCount: 0,
      files: [],
      durationSec: 0,
      error,
      timestamp: new Date().toISOString(),
    };
  } finally {
    // Cleanup
    if (projectId) {
      await stopRun(projectId).catch(() => {});
      await new Promise(r => setTimeout(r, 1000));
      await deleteProject(projectId).catch(() => {});
    }
  }
}
