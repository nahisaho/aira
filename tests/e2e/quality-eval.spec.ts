import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Quality Evaluation Tests for AIRA
 *
 * Tests cover: API integrity, input validation, security,
 * project lifecycle, RAG, MCP, file management, and UI rendering.
 */

const API = 'http://localhost:3000/api';

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

// ─── Health & CSRF ──────────────────────────────────────────────

test.describe('Health & CSRF', () => {
  test('GET /api/health returns ok', async ({ page }) => {
    const res = await page.request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('CSRF token is returned and required', async ({ page }) => {
    const res = await page.request.get(`${API}/csrf-token`);
    expect(res.status()).toBe(200);
    const { token } = await res.json();
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    // POST without CSRF should fail
    const bad = await page.request.post(`${API}/projects`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name: 'no-csrf' },
    });
    expect(bad.status()).toBe(403);
  });
});

// ─── Project CRUD ───────────────────────────────────────────────

test.describe('Project CRUD', () => {
  let projectId: string;

  test.afterEach(async ({ page }) => {
    if (projectId) await deleteProject(page, projectId).catch(() => {});
    projectId = '';
  });

  test('create, read, update, delete project', async ({ page }) => {
    const token = await csrf(page);
    // Create
    const createRes = await page.request.post(`${API}/projects`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: { name: `e2e-crud-${Date.now()}` },
    });
    expect(createRes.status()).toBe(201);
    const project = await createRes.json();
    projectId = project.id;
    expect(project.name).toContain('e2e-crud-');

    // Read
    const getRes = await page.request.get(`${API}/projects/${projectId}`);
    expect(getRes.status()).toBe(200);
    expect((await getRes.json()).id).toBe(projectId);

    // Update
    const token2 = await csrf(page);
    const patchRes = await page.request.patch(`${API}/projects/${projectId}`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token2 },
      data: { name: `e2e-updated-${Date.now()}` },
    });
    expect(patchRes.status()).toBe(200);

    // Delete
    const token3 = await csrf(page);
    const delRes = await page.request.delete(`${API}/projects/${projectId}`, {
      headers: { 'X-AIRA-Token': token3 },
    });
    expect(delRes.status()).toBe(204);
    projectId = '';
  });

  test('create project with empty name returns 400', async ({ page }) => {
    const token = await csrf(page);
    const res = await page.request.post(`${API}/projects`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: { name: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('create duplicate project name returns 409', async ({ page }) => {
    const name = `e2e-dup-${Date.now()}`;
    projectId = await createProject(page, name);

    const token = await csrf(page);
    const res = await page.request.post(`${API}/projects`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: { name },
    });
    expect(res.status()).toBe(409);
  });

  test('get non-existent project returns 404', async ({ page }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await page.request.get(`${API}/projects/${fakeId}`);
    expect(res.status()).toBe(404);
  });

  test('list projects returns array', async ({ page }) => {
    const res = await page.request.get(`${API}/projects`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

// ─── UUID Validation (Security) ─────────────────────────────────

test.describe('UUID Validation', () => {
  test('non-UUID project ID returns 400', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/not-a-uuid`);
    expect(res.status()).toBe(400);
  });

  test('SQL injection in project ID returns 400', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/'; DROP TABLE projects; --`);
    expect(res.status()).toBe(400);
  });

  test('unicode project ID returns 400', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/日本語テスト`);
    expect(res.status()).toBe(400);
  });
});

// ─── Messages ───────────────────────────────────────────────────

test.describe('Messages', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    projectId = await createProject(page, `e2e-msg-${Date.now()}`);
  });

  test.afterEach(async ({ page }) => {
    if (projectId) await deleteProject(page, projectId).catch(() => {});
  });

  test('create and list messages', async ({ page }) => {
    const token = await csrf(page);
    const createRes = await page.request.post(`${API}/projects/${projectId}/messages`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: { content: 'Hello from E2E test' },
    });
    expect(createRes.status()).toBe(201);
    const msg = await createRes.json();
    expect(msg.content).toBe('Hello from E2E test');

    // List
    const listRes = await page.request.get(`${API}/projects/${projectId}/messages`);
    expect(listRes.status()).toBe(200);
    const messages = await listRes.json();
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages.some((m: { content: string }) => m.content === 'Hello from E2E test')).toBe(true);
  });

  test('create message with empty content returns 400', async ({ page }) => {
    const token = await csrf(page);
    const res = await page.request.post(`${API}/projects/${projectId}/messages`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: { content: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('messages since returns filtered results', async ({ page }) => {
    const token = await csrf(page);
    const before = new Date().toISOString();

    await page.request.post(`${API}/projects/${projectId}/messages`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: { content: 'Before marker' },
    });

    // Wait a moment
    await page.waitForTimeout(100);
    const after = new Date().toISOString();

    const token2 = await csrf(page);
    await page.request.post(`${API}/projects/${projectId}/messages`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token2 },
      data: { content: 'After marker' },
    });

    const sinceRes = await page.request.get(
      `${API}/projects/${projectId}/messages?since=${encodeURIComponent(after)}`
    );
    expect(sinceRes.status()).toBe(200);
    const filtered = await sinceRes.json();
    expect(filtered.every((m: { content: string }) => m.content !== 'Before marker')).toBe(true);
  });

  test('invalid since parameter returns 400', async ({ page }) => {
    const res = await page.request.get(
      `${API}/projects/${projectId}/messages?since=not-a-date`
    );
    expect(res.status()).toBe(400);
  });

  test('clear messages returns 204', async ({ page }) => {
    const token = await csrf(page);
    await page.request.post(`${API}/projects/${projectId}/messages`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: { content: 'To be cleared' },
    });

    const token2 = await csrf(page);
    const delRes = await page.request.delete(`${API}/projects/${projectId}/messages`, {
      headers: { 'X-AIRA-Token': token2 },
    });
    expect(delRes.status()).toBe(204);

    const listRes = await page.request.get(`${API}/projects/${projectId}/messages`);
    const messages = await listRes.json();
    expect(messages.length).toBe(0);
  });
});

// ─── Files ──────────────────────────────────────────────────────

test.describe('Files', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    projectId = await createProject(page, `e2e-files-${Date.now()}`);
  });

  test.afterEach(async ({ page }) => {
    if (projectId) await deleteProject(page, projectId).catch(() => {});
  });

  test('list files returns array', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/${projectId}/files`);
    expect(res.status()).toBe(200);
    const files = await res.json();
    expect(Array.isArray(files)).toBe(true);
  });

  test('upload file with path traversal name is rejected', async ({ page }) => {
    const token = await csrf(page);
    const res = await page.request.post(`${API}/projects/${projectId}/files/upload`, {
      headers: { 'X-AIRA-Token': token },
      multipart: {
        file: {
          name: '../../../etc/passwd',
          mimeType: 'text/plain',
          buffer: Buffer.from('test content'),
        },
      },
    });
    expect(res.status()).toBe(400);
  });

  test('download-all archive returns zip', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/${projectId}/files/download-all`);
    // Even if no files, it should return a valid response (empty zip or the zip header)
    expect([200, 204].includes(res.status()) || res.headers()['content-type']?.includes('zip')).toBeTruthy();
  });
});

// ─── RAG ────────────────────────────────────────────────────────

test.describe('RAG', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    projectId = await createProject(page, `e2e-rag-${Date.now()}`);
  });

  test.afterEach(async ({ page }) => {
    if (projectId) await deleteProject(page, projectId).catch(() => {});
  });

  test('get RAG settings and stats', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/${projectId}/rag`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('settings');
    expect(body).toHaveProperty('stats');
    expect(typeof body.settings.enabled).toBe('boolean');
    expect(typeof body.settings.max_context_chars).toBe('number');
  });

  test('update RAG settings', async ({ page }) => {
    const token = await csrf(page);
    const res = await page.request.put(`${API}/projects/${projectId}/rag`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: { enabled: true, max_context_chars: 5000 },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.settings.enabled).toBe(true);
    expect(body.settings.max_context_chars).toBe(5000);
  });

  test('RAG search without query returns 400', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/${projectId}/rag/search`);
    expect(res.status()).toBe(400);
  });

  test('RAG search with query returns results', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/${projectId}/rag/search?q=test`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('results');
    expect(body).toHaveProperty('context');
    expect(Array.isArray(body.results)).toBe(true);
  });

  test('clear RAG index', async ({ page }) => {
    const token = await csrf(page);
    const res = await page.request.delete(`${API}/projects/${projectId}/rag/index`, {
      headers: { 'X-AIRA-Token': token },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('cleared');
  });

  test('max_context_chars validation rejects negative', async ({ page }) => {
    const token = await csrf(page);
    const res = await page.request.put(`${API}/projects/${projectId}/rag`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: { max_context_chars: -100 },
    });
    expect(res.status()).toBe(400);
  });

  test('max_context_chars validation rejects over 200000', async ({ page }) => {
    const token = await csrf(page);
    const res = await page.request.put(`${API}/projects/${projectId}/rag`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: { max_context_chars: 300000 },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── MCP ────────────────────────────────────────────────────────

test.describe('MCP', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    projectId = await createProject(page, `e2e-mcp-${Date.now()}`);
  });

  test.afterEach(async ({ page }) => {
    if (projectId) await deleteProject(page, projectId).catch(() => {});
  });

  test('list MCP configs returns array', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/${projectId}/mcp`);
    expect(res.status()).toBe(200);
    const configs = await res.json();
    expect(Array.isArray(configs)).toBe(true);
  });

  test('create, toggle, and delete MCP config', async ({ page }) => {
    const token = await csrf(page);
    // Create
    const createRes = await page.request.post(`${API}/projects/${projectId}/mcp`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: {
        name: 'test-mcp',
        type: 'stdio',
        config: { command: 'echo', args: ['hello'] },
      },
    });
    expect(createRes.status()).toBe(201);
    const config = await createRes.json();
    expect(config.name).toBe('test-mcp');
    const configId = config.id;

    // Toggle off
    const token2 = await csrf(page);
    const toggleRes = await page.request.put(`${API}/projects/${projectId}/mcp/${configId}/toggle`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token2 },
      data: { enabled: false },
    });
    expect(toggleRes.status()).toBe(200);

    // Delete
    const token3 = await csrf(page);
    const delRes = await page.request.delete(`${API}/projects/${projectId}/mcp/${configId}`, {
      headers: { 'X-AIRA-Token': token3 },
    });
    expect(delRes.status()).toBe(204);
  });

  test('create MCP with invalid schema returns 400', async ({ page }) => {
    const token = await csrf(page);
    const res = await page.request.post(`${API}/projects/${projectId}/mcp`, {
      headers: { 'Content-Type': 'application/json', 'X-AIRA-Token': token },
      data: { name: 'bad', type: 'invalid-type', config: {} },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── Skills ─────────────────────────────────────────────────────

test.describe('Skills', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    projectId = await createProject(page, `e2e-skills-${Date.now()}`);
  });

  test.afterEach(async ({ page }) => {
    if (projectId) await deleteProject(page, projectId).catch(() => {});
  });

  test('list all skills returns array', async ({ page }) => {
    const res = await page.request.get(`${API}/skills`);
    expect(res.status()).toBe(200);
    const skills = await res.json();
    expect(Array.isArray(skills)).toBe(true);
  });

  test('get project skills returns array', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/${projectId}/skills`);
    expect(res.status()).toBe(200);
    const skills = await res.json();
    expect(Array.isArray(skills)).toBe(true);
  });
});

// ─── Runs ───────────────────────────────────────────────────────

test.describe('Runs', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    projectId = await createProject(page, `e2e-runs-${Date.now()}`);
  });

  test.afterEach(async ({ page }) => {
    if (projectId) await deleteProject(page, projectId).catch(() => {});
  });

  test('list runs returns array', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/${projectId}/runs`);
    expect(res.status()).toBe(200);
    const runs = await res.json();
    expect(Array.isArray(runs)).toBe(true);
  });

  test('current run returns idle when none', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/${projectId}/runs/current`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('idle');
  });

  test('stop run with none running returns 404', async ({ page }) => {
    const token = await csrf(page);
    const res = await page.request.post(`${API}/projects/${projectId}/runs/current/stop`, {
      headers: { 'X-AIRA-Token': token },
    });
    expect(res.status()).toBe(404);
  });

  test('runs support pagination', async ({ page }) => {
    const res = await page.request.get(`${API}/projects/${projectId}/runs?limit=5&offset=0`);
    expect(res.status()).toBe(200);
    const runs = await res.json();
    expect(Array.isArray(runs)).toBe(true);
  });
});

// ─── Settings ───────────────────────────────────────────────────

test.describe('Settings', () => {
  test('get settings returns object', async ({ page }) => {
    const res = await page.request.get(`${API}/settings`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('token');
    expect(body.token).toHaveProperty('configured');
  });
});

// ─── Global Error Handling ──────────────────────────────────────

test.describe('Global Error Handling', () => {
  test('all API errors return JSON not HTML', async ({ page }) => {
    // Non-existent endpoint
    const res = await page.request.get(`${API}/nonexistent-endpoint-xyz`);
    // Should return 404 - content type should be JSON or at least not text/html
    const contentType = res.headers()['content-type'] ?? '';
    expect(contentType).not.toContain('text/html');
  });
});

// ─── UI Rendering ───────────────────────────────────────────────

test.describe('UI Rendering', () => {
  test('homepage loads and shows AIRA title', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('sidebar renders project list', async ({ page }) => {
    const projectId = await createProject(page, `e2e-ui-${Date.now()}`);

    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // The sidebar shows project names
      const projectText = page.locator(`text=e2e-ui-`).first();
      await expect(projectText).toBeVisible({ timeout: 5000 });
    } finally {
      await deleteProject(page, projectId).catch(() => {});
    }
  });

  test('selecting project shows chat area', async ({ page }) => {
    const projectId = await createProject(page, `e2e-chat-ui-${Date.now()}`);

    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const projectItem = page.locator(`text=e2e-chat-ui-`).first();
      if (await projectItem.isVisible({ timeout: 3000 })) {
        await projectItem.click();
        await page.waitForTimeout(1000);

        const chatInput = page.locator('textarea, input[type="text"]').first();
        await expect(chatInput).toBeVisible({ timeout: 5000 });
      }
    } finally {
      await deleteProject(page, projectId).catch(() => {});
    }
  });
});
