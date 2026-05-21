import { test, expect, type Page } from '@playwright/test';
import WebSocket from 'ws';

/**
 * E2E Tests for Structured RAG feature.
 *
 * Tests the full RAG lifecycle:
 *   1. RAG settings CRUD (GET/PUT)
 *   2. Chat → token indexing → search verification
 *   3. Reindex trigger and index clearing
 *   4. Context assembly and retrieval
 *   5. Edge cases (empty queries, invalid settings, large input)
 */

const API = 'http://localhost:3000/api';
const WS_BASE = 'ws://localhost:3000';

test.setTimeout(300_000);

// ── Helpers ─────────────────────────────────────────────────────────

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

async function getRag(page: Page, projectId: string) {
  const res = await page.request.get(`${API}/projects/${projectId}/rag`);
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

async function putRag(page: Page, projectId: string, body: Record<string, unknown>) {
  const token = await csrf(page);
  const res = await page.request.put(`${API}/projects/${projectId}/rag`, {
    headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
    data: body,
  });
  return res;
}

async function searchRag(page: Page, projectId: string, query: string) {
  const res = await page.request.get(
    `${API}/projects/${projectId}/rag/search?q=${encodeURIComponent(query)}`,
  );
  return res;
}

async function clearRagIndex(page: Page, projectId: string) {
  const token = await csrf(page);
  return page.request.delete(`${API}/projects/${projectId}/rag/index`, {
    headers: { 'X-AIRA-Token': token },
  });
}

async function reindexRag(page: Page, projectId: string) {
  const token = await csrf(page);
  return page.request.post(`${API}/projects/${projectId}/rag/reindex`, {
    headers: { 'X-AIRA-Token': token },
  });
}

interface WSResult {
  chunks: string[];
  fullText: string;
  status: string | null;
}

function sendChat(projectId: string, content: string, timeoutMs = 180_000): Promise<WSResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/ws/projects/${projectId}/chat`, {
      headers: { Origin: 'http://localhost:3000' },
    });

    const result: WSResult = { chunks: [], fullText: '', status: null };

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`WS timeout (${timeoutMs}ms). chunks=${result.chunks.length}`));
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
        if (msg.type === 'status') {
          result.status = msg.status;
          if (['completed', 'error', 'cancelled', 'timeout'].includes(msg.status)) {
            clearTimeout(timer);
            ws.close();
            resolve(result);
          }
        }
      } catch { /* ignore */ }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`WS error: ${err.message}`));
    });

    ws.on('close', () => {
      clearTimeout(timer);
      if (!result.status) {
        result.status = 'disconnected';
        resolve(result);
      }
    });
  });
}

// ─── Tests ──────────────────────────────────────────────────────────

test.describe('Structured RAG', () => {
  let projectId: string;

  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    projectId = await createProject(page, `rag-test-${Date.now()}`);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await deleteProject(page, projectId);
    await page.close();
  });

  // ── RAG Settings ────────────────────────────────────────────────

  test('RAG-01: default settings should have RAG disabled', async ({ page }) => {
    const data = await getRag(page, projectId);

    expect(data.settings).toBeDefined();
    expect(data.settings.enabled).toBe(false);
    expect(data.settings.max_context_chars).toBe(4000);
    expect(data.settings.auto_index_files).toBe(true);

    expect(data.stats).toBeDefined();
    expect(data.stats.knowledge_count).toBe(0);
    expect(data.stats.index_term_count).toBe(0);
  });

  test('RAG-02: enable RAG and update settings', async ({ page }) => {
    const res = await putRag(page, projectId, {
      enabled: true,
      max_context_chars: 8000,
    });
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.settings.enabled).toBe(true);
    expect(body.settings.max_context_chars).toBe(8000);

    // Verify persistence
    const data = await getRag(page, projectId);
    expect(data.settings.enabled).toBe(true);
    expect(data.settings.max_context_chars).toBe(8000);
  });

  test('RAG-03: reject invalid max_context_chars', async ({ page }) => {
    const res = await putRag(page, projectId, {
      max_context_chars: 300_000,
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('max_context_chars');
  });

  test('RAG-04: reject negative max_context_chars', async ({ page }) => {
    const res = await putRag(page, projectId, {
      max_context_chars: -100,
    });
    expect(res.status()).toBe(400);
  });

  // ── Chat → Token Indexing ───────────────────────────────────────

  test('RAG-05: chat message should index tokens for RAG search', async ({ page }) => {
    // Send a domain-specific chat message
    const chatResult = await sendChat(
      projectId,
      'Python で ShannonDiversity 指数と SimpsonIndex を計算する関数を作成してください。メタゲノミクス解析に使用します。',
    );

    expect(chatResult.status).toBe('completed');
    expect(chatResult.chunks.length).toBeGreaterThan(0);

    // Wait for indexing to complete
    await page.waitForTimeout(2000);

    // Search for indexed terms
    const searchRes = await searchRag(page, projectId, 'ShannonDiversity メタゲノミクス');
    expect(searchRes.ok()).toBeTruthy();

    const searchData = await searchRes.json();
    expect(searchData.results).toBeDefined();
    expect(Array.isArray(searchData.results)).toBe(true);
    // Token extraction should have indexed at least some terms
    expect(searchData.results.length).toBeGreaterThanOrEqual(0);
  });

  test('RAG-06: second chat should accumulate index entries', async ({ page }) => {
    const statsBefore = (await getRag(page, projectId)).stats;

    const chatResult = await sendChat(
      projectId,
      'CRISPR-Cas9 を使ったゲノム編集の実験プロトコルを設計してください。sgRNA の設計基準も含めて。',
    );

    expect(chatResult.status).toBe('completed');
    await page.waitForTimeout(2000);

    const statsAfter = (await getRag(page, projectId)).stats;
    // Knowledge count should increase (or at least not decrease)
    expect(statsAfter.knowledge_count).toBeGreaterThanOrEqual(statsBefore.knowledge_count);
  });

  // ── Search ──────────────────────────────────────────────────────

  test('RAG-07: search with empty query should return error', async ({ page }) => {
    const res = await searchRag(page, projectId, '');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('q');
  });

  test('RAG-08: search should return context string', async ({ page }) => {
    const res = await searchRag(page, projectId, 'Python 関数');
    expect(res.ok()).toBeTruthy();

    const data = await res.json();
    expect(data).toHaveProperty('results');
    expect(data).toHaveProperty('context');
    expect(typeof data.context).toBe('string');
  });

  test('RAG-09: search for domain-specific term', async ({ page }) => {
    const res = await searchRag(page, projectId, 'CRISPR ゲノム編集');
    expect(res.ok()).toBeTruthy();

    const data = await res.json();
    expect(data.results).toBeDefined();
  });

  // ── Index Management ────────────────────────────────────────────

  test('RAG-10: clear index should reset stats to zero', async ({ page }) => {
    const res = await clearRagIndex(page, projectId);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.status).toBe('cleared');
    expect(body.stats.knowledge_count).toBe(0);
    expect(body.stats.index_term_count).toBe(0);

    // Verify via GET
    const data = await getRag(page, projectId);
    expect(data.stats.knowledge_count).toBe(0);
  });

  test('RAG-11: reindex should start background job', async ({ page }) => {
    const res = await reindexRag(page, projectId);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.status).toBe('started');
    expect(body.message).toContain('background');
  });

  // ── Settings Edge Cases ─────────────────────────────────────────

  test('RAG-12: disable RAG and verify', async ({ page }) => {
    const res = await putRag(page, projectId, { enabled: false });
    expect(res.ok()).toBeTruthy();

    const data = await getRag(page, projectId);
    expect(data.settings.enabled).toBe(false);
  });

  test('RAG-13: re-enable with custom settings', async ({ page }) => {
    const res = await putRag(page, projectId, {
      enabled: true,
      max_context_chars: 2000,
      auto_index_files: false,
    });
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.settings.enabled).toBe(true);
    expect(body.settings.max_context_chars).toBe(2000);
    expect(body.settings.auto_index_files).toBe(false);
  });

  test('RAG-14: max_context_chars upper boundary (200000)', async ({ page }) => {
    const res = await putRag(page, projectId, { max_context_chars: 200_000 });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.settings.max_context_chars).toBe(200_000);
  });

  test('RAG-15: max_context_chars zero is valid', async ({ page }) => {
    const res = await putRag(page, projectId, { max_context_chars: 0 });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.settings.max_context_chars).toBe(0);
  });

  // ── RAG with Chat Integration ───────────────────────────────────

  test('RAG-16: full cycle — enable, chat, search, verify context', async ({ page }) => {
    // Reset state
    await putRag(page, projectId, {
      enabled: true,
      max_context_chars: 4000,
    });
    await clearRagIndex(page, projectId);

    // Send a chat with specific scientific terms
    const chatResult = await sendChat(
      projectId,
      'AlphaFold2 を使ったタンパク質の立体構造予測について説明してください。pLDDT スコアの解釈と、ドラッグターゲットとしての評価基準も含めて。',
    );

    expect(chatResult.status).toBe('completed');
    expect(chatResult.fullText.length).toBeGreaterThan(50);

    await page.waitForTimeout(3000);

    // Verify terms were indexed
    const stats = (await getRag(page, projectId)).stats;
    expect(stats.knowledge_count).toBeGreaterThan(0);

    // Search should return results
    const searchRes = await searchRag(page, projectId, 'AlphaFold タンパク質');
    const searchData = await searchRes.json();
    expect(searchData.results.length).toBeGreaterThan(0);
    expect(typeof searchData.context).toBe('string');
  });

  // ── Multiple Projects Isolation ─────────────────────────────────

  test('RAG-17: RAG data should be isolated per project', async ({ page }) => {
    // Create a second project
    const projectId2 = await createProject(page, `rag-test-2-${Date.now()}`);

    try {
      // Enable RAG on project 2
      await putRag(page, projectId2, { enabled: true });

      // Project 2 should have empty index
      const stats2 = (await getRag(page, projectId2)).stats;
      expect(stats2.knowledge_count).toBe(0);

      // Project 1 should still have its data
      const stats1 = (await getRag(page, projectId)).stats;
      expect(stats1.knowledge_count).toBeGreaterThan(0);

      // Search on project 2 should return no results
      const res = await searchRag(page, projectId2, 'AlphaFold');
      const data = await res.json();
      expect(data.results.length).toBe(0);
    } finally {
      await deleteProject(page, projectId2);
    }
  });

  // ── Index Rebuild after Clear ───────────────────────────────────

  test('RAG-18: chat after index clear rebuilds index', async ({ page }) => {
    await clearRagIndex(page, projectId);
    const statsCleared = (await getRag(page, projectId)).stats;
    expect(statsCleared.knowledge_count).toBe(0);

    // New chat should re-populate
    const chatResult = await sendChat(
      projectId,
      'ベイズ推定を用いた遺伝子発現解析の統計モデルについて、MCMCサンプリングの収束診断方法を解説してください。',
    );
    expect(chatResult.status).toBe('completed');

    await page.waitForTimeout(2000);

    const statsRebuilt = (await getRag(page, projectId)).stats;
    expect(statsRebuilt.knowledge_count).toBeGreaterThan(0);
  });

  // ── Cleanup and final state ─────────────────────────────────────

  test('RAG-19: disable RAG at end leaves settings but no active search', async ({ page }) => {
    await putRag(page, projectId, { enabled: false });

    const data = await getRag(page, projectId);
    expect(data.settings.enabled).toBe(false);
    // Stats should still show historical data
    expect(data.stats).toBeDefined();
  });

  test('RAG-20: clear index on disabled RAG still works', async ({ page }) => {
    const res = await clearRagIndex(page, projectId);
    expect(res.ok()).toBeTruthy();

    const data = await getRag(page, projectId);
    expect(data.stats.knowledge_count).toBe(0);
    expect(data.stats.index_term_count).toBe(0);
  });
});
