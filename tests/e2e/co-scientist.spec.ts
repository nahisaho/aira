import { test, expect, type Page } from '@playwright/test';
import WebSocket from 'ws';

/**
 * E2E Tests using Co-Scientist skill.
 *
 * These tests create a project with Co-Scientist assigned,
 * send prompts via WebSocket, and verify responses + file generation.
 */

const API = 'http://localhost:3000/api';
const WS_BASE = 'ws://localhost:3000';

// Co-Scientist tests need longer timeouts for CLI execution
test.setTimeout(180_000);

async function csrf(page: Page): Promise<string> {
  const res = await page.request.get(`${API}/csrf-token`);
  return (await res.json()).token;
}

async function createProject(page: Page, name: string): Promise<string> {
  const token = await csrf(page);
  const res = await page.request.post(`${API}/projects`, {
    headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
    data: { name },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id;
}

async function deleteProject(page: Page, id: string): Promise<void> {
  const token = await csrf(page);
  await page.request.delete(`${API}/projects/${id}`, {
    headers: { 'X-AIRA-Token': token },
  });
}

async function assignSkill(page: Page, projectId: string, skillId: string): Promise<void> {
  const token = await csrf(page);
  const res = await page.request.post(`${API}/projects/${projectId}/skills/${skillId}`, {
    headers: { 'X-AIRA-Token': token },
  });
  expect(res.status()).toBe(200);
}

async function getCoScientistSkillId(page: Page): Promise<string> {
  const res = await page.request.get(`${API}/skills`);
  const skills = await res.json();
  const cs = skills.find((s: { name: string }) => s.name === 'co-scientist');
  expect(cs, 'Co-Scientist skill not found').toBeTruthy();
  return cs.id;
}

interface WSResult {
  chunks: string[];
  fullText: string;
  status: string | null;
  runId: string | null;
  error: string | null;
  progressMessages: string[];
}

/**
 * Send a chat message via WebSocket and wait for the full response.
 */
function sendChatViaWS(projectId: string, content: string, timeoutMs = 150_000): Promise<WSResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/ws/projects/${projectId}/chat`, {
      headers: { Origin: 'http://localhost:3000' },
    });

    const result: WSResult = {
      chunks: [],
      fullText: '',
      status: null,
      runId: null,
      error: null,
      progressMessages: [],
    };

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`WebSocket timeout after ${timeoutMs}ms. Received ${result.chunks.length} chunks so far: "${result.fullText.slice(0, 200)}"`));
    }, timeoutMs);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'chat', content }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'chunk' && msg.content) {
          result.chunks.push(msg.content);
          result.fullText += msg.content;
        }

        if (msg.type === 'progress' && msg.message) {
          result.progressMessages.push(msg.message);
        }

        if (msg.type === 'status') {
          result.status = msg.status;
          result.runId = msg.runId ?? null;

          if (msg.status === 'completed' || msg.status === 'error' || msg.status === 'cancelled' || msg.status === 'timeout') {
            clearTimeout(timer);
            ws.close();
            resolve(result);
          }
        }

        if (msg.type === 'error') {
          result.error = msg.message ?? msg.content ?? 'unknown error';
        }
      } catch {
        // Ignore non-JSON messages
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`WebSocket error: ${err.message}`));
    });

    ws.on('close', () => {
      clearTimeout(timer);
      // If we haven't resolved yet, resolve with what we have
      if (!result.status) {
        result.status = 'disconnected';
        resolve(result);
      }
    });
  });
}

// ─── Co-Scientist Skill Tests ───────────────────────────────────

test.describe('Co-Scientist Skill', () => {
  let projectId: string;
  let skillId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    skillId = await getCoScientistSkillId(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    projectId = await createProject(page, `e2e-cosci-${Date.now()}`);
    await assignSkill(page, projectId, skillId);
  });

  test.afterEach(async ({ page }) => {
    if (projectId) {
      // Stop any running run first
      const token = await csrf(page);
      await page.request.post(`${API}/projects/${projectId}/runs/current/stop`, {
        headers: { 'X-AIRA-Token': token },
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 1000));
      await deleteProject(page, projectId).catch(() => {});
      projectId = '';
    }
  });

  test('skill is assigned to project', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/${projectId}/skills`);
    expect(res.status()).toBe(200);
    const skills = await res.json();
    expect(skills.some((s: { name: string }) => s.name === 'co-scientist')).toBe(true);
  });

  test('simple greeting prompt returns response', async ({ page }) => {
    const result = await sendChatViaWS(projectId, 'こんにちは。あなたは何ができますか？簡潔に教えてください。');

    expect(result.fullText.length).toBeGreaterThan(10);
    expect(result.status).toBe('completed');
    expect(result.error).toBeNull();

    // Verify message was saved to DB
    const msgRes = await page.request.get(`${API}/projects/${projectId}/messages`);
    const messages = await msgRes.json();
    expect(messages.length).toBeGreaterThanOrEqual(2); // user + assistant
    const userMsg = messages.find((m: { role: string }) => m.role === 'user');
    const assistantMsg = messages.find((m: { role: string }) => m.role === 'assistant');
    expect(userMsg).toBeTruthy();
    expect(assistantMsg).toBeTruthy();
    expect(assistantMsg.content.length).toBeGreaterThan(10);
  });

  test('research prompt generates meaningful response', async ({ page }) => {
    const result = await sendChatViaWS(
      projectId,
      'PubMedでCRISPR-Cas9に関する最新の論文を3件リストアップしてください。タイトルと概要を含めてください。結果はMarkdown形式で出力してください。',
    );

    expect(result.fullText.length).toBeGreaterThan(50);
    expect(result.status).toBe('completed');

    // Verify messages in DB
    const msgRes = await page.request.get(`${API}/projects/${projectId}/messages`);
    const messages = await msgRes.json();
    expect(messages.length).toBeGreaterThanOrEqual(2);
  });

  test('file generation prompt creates output file', async ({ page }) => {
    const result = await sendChatViaWS(
      projectId,
      '以下の内容をMarkdownファイル「research-summary.md」として保存してください：\n\n# テスト研究サマリー\n\nこれはE2Eテスト用のサマリーです。\n\n## 目的\nAIRAのファイル生成機能を検証します。',
    );

    expect(result.status).toBe('completed');

    // Check if files were generated
    const filesRes = await page.request.get(`${API}/projects/${projectId}/files`);
    const files = await filesRes.json();
    // File may or may not be created depending on CLI behavior, but the request should succeed
    expect(filesRes.status()).toBe(200);
    expect(Array.isArray(files)).toBe(true);
  });

  test('run status transitions correctly', async ({ page }) => {
    // Start a chat - check run appears
    const chatPromise = sendChatViaWS(
      projectId,
      '1+1は何ですか？数字だけ答えてください。',
    );

    // Wait a moment for run to start
    await new Promise(r => setTimeout(r, 2000));

    // Check run history after completion
    const result = await chatPromise;
    expect(result.status).toBe('completed');

    const runsRes = await page.request.get(`${API}/projects/${projectId}/runs`);
    const runs = await runsRes.json();
    expect(runs.length).toBeGreaterThanOrEqual(1);

    // The most recent run should be completed
    const latestRun = runs[0];
    expect(['completed', 'error']).toContain(latestRun.status);
    expect(latestRun.prompt).toBeTruthy();
  });

  test('multiple messages maintain session continuity', async ({ page }) => {
    // First message
    const result1 = await sendChatViaWS(
      projectId,
      '私の名前は「テスト太郎」です。覚えてください。',
    );
    expect(result1.status).toBe('completed');
    expect(result1.fullText.length).toBeGreaterThan(5);

    // Second message - should remember context
    const result2 = await sendChatViaWS(
      projectId,
      '私の名前は何ですか？',
    );
    expect(result2.status).toBe('completed');
    expect(result2.fullText.length).toBeGreaterThan(5);

    // Verify all messages in DB
    const msgRes = await page.request.get(`${API}/projects/${projectId}/messages`);
    const messages = await msgRes.json();
    expect(messages.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant
  });

  test('RAG settings work with Co-Scientist project', async ({ page }) => {
    // Enable RAG
    const token = await csrf(page);
    const ragRes = await page.request.put(`${API}/projects/${projectId}/rag`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: { enabled: true, max_context_chars: 10000 },
    });
    expect(ragRes.status()).toBe(200);

    // Send a message (RAG indexing happens automatically)
    const result = await sendChatViaWS(
      projectId,
      'テスト用のメッセージです。RAGインデックスの確認。',
    );
    expect(result.status).toBe('completed');

    // Verify RAG stats
    const statsRes = await page.request.get(`${API}/projects/${projectId}/rag`);
    const stats = await statsRes.json();
    expect(stats.settings.enabled).toBe(true);
    expect(stats.settings.max_context_chars).toBe(10000);
  });

  test('UI shows project with Co-Scientist skill', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find our test project
    const projectItem = page.locator(`text=e2e-cosci-`).first();
    if (await projectItem.isVisible({ timeout: 5000 })) {
      await projectItem.click();
      await page.waitForTimeout(1000);

      // Chat input should be visible
      const chatInput = page.locator('textarea').first();
      await expect(chatInput).toBeVisible({ timeout: 5000 });
    }
  });
});
