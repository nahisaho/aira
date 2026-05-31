import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// (afterEach used in jupyter-runtime describe block below)
import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { mcpRoutes } from './mcp.js';
import { initializeDatabase, getDatabase, closeDatabase } from '../db/index.js';
import { setBaseDir, getBaseDir, getNotebookPath } from '../config/paths.js';
import {
  seedBuiltinMcpForProject,
  McpService,
} from '../services/mcp.service.js';
import {
  resetJupyterStateForTesting,
  setJupyterStateForTesting,
} from '../services/jupyter-server.js';
import fs from 'node:fs';

const PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';

describe('MCP routes — transport types (stdio / sse / http)', () => {
  let tmpDir: string;
  let originalBaseDir: string;
  let app: Hono;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-mcp-test-'));
    originalBaseDir = getBaseDir();
    setBaseDir(tmpDir);
    closeDatabase();
    await initializeDatabase();

    app = new Hono();
    app.route('/', mcpRoutes);

    const db = getDatabase();
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(PROJECT_ID, 'MCP Test');
  });

  afterEach(() => {
    closeDatabase();
    setBaseDir(originalBaseDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a stdio MCP server (regression)', async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'local-tool',
        type: 'stdio',
        config: { command: 'node', args: ['server.js'] },
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe('stdio');
  });

  it('creates an sse MCP server (regression)', async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'sse-server',
        type: 'sse',
        config: { url: 'https://example.com/sse' },
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe('sse');
  });

  it('creates an http (streamable-HTTP) MCP server', async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'jupyter',
        type: 'http',
        config: {
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer fake-token' },
        },
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe('http');
    // Secret-mask should hide the header value on GET
    expect((body.config.headers as Record<string, string>).Authorization).toBe('***');
  });

  it('rejects unknown transport types with 400', async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'ws-thing',
        type: 'websocket',
        config: { url: 'wss://example.com' },
      }),
    });
    expect(res.status).toBe(400);
  });

  describe('PATCH — edit existing config (secret-omit semantics)', () => {
    async function seed(): Promise<string> {
      const res = await app.request(`/api/projects/${PROJECT_ID}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'editable',
          type: 'stdio',
          config: {
            command: 'node',
            args: ['server.js'],
            env: { KEEP: 'keep-val', REPLACE: 'old-val', REMOVE: 'doomed' },
            description: 'first description',
          },
        }),
      });
      const body = await res.json();
      return body.id;
    }

    it('updates name via PATCH', async () => {
      const id = await seed();
      const res = await app.request(`/api/projects/${PROJECT_ID}/mcp/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'renamed' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('renamed');
    });

    it('updates description and other non-secret config fields', async () => {
      const id = await seed();
      const res = await app.request(`/api/projects/${PROJECT_ID}/mcp/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'updated description' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.config.description).toBe('updated description');
      // Untouched fields stay
      expect(body.config.command).toBe('node');
    });

    it('env: omitted key keeps existing, null deletes, string overwrites', async () => {
      const id = await seed();
      const res = await app.request(`/api/projects/${PROJECT_ID}/mcp/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          env: {
            REPLACE: 'new-val',   // overwrite
            REMOVE: null,          // delete
            ADDED: 'fresh',        // add new
            // KEEP omitted → preserved
          },
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const env = body.config.env as Record<string, string>;
      // All values masked in the response — verify by keys
      expect(Object.keys(env).sort()).toEqual(['ADDED', 'KEEP', 'REPLACE']);
      // All values shown as ***
      for (const v of Object.values(env)) expect(v).toBe('***');
    });

    it('rejects "***" sentinel as a secret value with 400', async () => {
      const id = await seed();
      const res = await app.request(`/api/projects/${PROJECT_ID}/mcp/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          env: { REPLACE: '***' },
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/masked|\*\*\*/i);
    });

    it('headers: same semantics as env (for http/sse configs)', async () => {
      const createRes = await app.request(`/api/projects/${PROJECT_ID}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'http-with-headers',
          type: 'http',
          config: {
            url: 'https://example.com/mcp',
            headers: { Authorization: 'Bearer old' },
          },
        }),
      });
      const id = (await createRes.json()).id;

      const patchRes = await app.request(`/api/projects/${PROJECT_ID}/mcp/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers: { Authorization: 'Bearer new', 'X-Custom': 'added' },
        }),
      });
      expect(patchRes.status).toBe(200);
      const body = await patchRes.json();
      const headers = body.config.headers as Record<string, string>;
      expect(Object.keys(headers).sort()).toEqual(['Authorization', 'X-Custom']);
    });

    it('toggles enabled via PATCH', async () => {
      const id = await seed();
      const res = await app.request(`/api/projects/${PROJECT_ID}/mcp/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: 0 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.enabled).toBe(0);
    });
  });

  it('persists http configs and returns them in the list', async () => {
    await app.request(`/api/projects/${PROJECT_ID}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'jupyter',
        type: 'http',
        config: { url: 'https://example.com/mcp' },
      }),
    });

    const listRes = await app.request(`/api/projects/${PROJECT_ID}/mcp`);
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    const httpEntry = list.find((c: { name: string }) => c.name === 'jupyter' && c.type === 'http');
    expect(httpEntry).toBeDefined();
    expect(httpEntry.type).toBe('http');
    expect((httpEntry.config as Record<string, unknown>).url).toBe('https://example.com/mcp');
  });
});

describe('Built-in seeding behavior (v3.0.0 jupyter)', () => {
  let tmpDir: string;
  let originalBaseDir: string;
  const P_EXISTING = 'c0000000-0000-0000-0000-000000000001';
  const P_NEW = 'c0000000-0000-0000-0000-000000000002';

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-mcp-seed-'));
    originalBaseDir = getBaseDir();
    setBaseDir(tmpDir);
    closeDatabase();
    await initializeDatabase();
    const db = getDatabase();
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(P_EXISTING, 'Existing');
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(P_NEW, 'New');
  });

  afterEach(() => {
    closeDatabase();
    setBaseDir(originalBaseDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('seeds jupyter as DISABLED on existing projects', () => {
    seedBuiltinMcpForProject(P_EXISTING, { isNewProject: false });
    const db = getDatabase();
    const row = db.prepare(
      "SELECT enabled FROM project_mcp_configs WHERE project_id = ? AND name = 'jupyter' AND builtin = 1",
    ).get(P_EXISTING) as { enabled: number } | undefined;
    expect(row).toBeDefined();
    expect(row?.enabled).toBe(0);
  });

  it('seeds jupyter as ENABLED on new projects', () => {
    seedBuiltinMcpForProject(P_NEW, { isNewProject: true });
    const db = getDatabase();
    const row = db.prepare(
      "SELECT enabled FROM project_mcp_configs WHERE project_id = ? AND name = 'jupyter' AND builtin = 1",
    ).get(P_NEW) as { enabled: number } | undefined;
    expect(row).toBeDefined();
    expect(row?.enabled).toBe(1);
  });

  it('seeds the other built-ins as ENABLED regardless of isNewProject', () => {
    seedBuiltinMcpForProject(P_EXISTING, { isNewProject: false });
    const db = getDatabase();
    const rows = db.prepare(
      "SELECT name, enabled FROM project_mcp_configs WHERE project_id = ? AND builtin = 1 AND name != 'jupyter'",
    ).all(P_EXISTING) as Array<{ name: string; enabled: number }>;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.enabled).toBe(1);
  });
});

describe('generateTempConfig — jupyter runtime injection', () => {
  let tmpDir: string;
  let originalBaseDir: string;
  const PID = 'd0000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-mcp-runtime-'));
    originalBaseDir = getBaseDir();
    setBaseDir(tmpDir);
    closeDatabase();
    await initializeDatabase();
    const db = getDatabase();
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(PID, 'Runtime Test');
    seedBuiltinMcpForProject(PID, { isNewProject: true }); // jupyter enabled
    resetJupyterStateForTesting();
  });

  afterEach(() => {
    resetJupyterStateForTesting();
    closeDatabase();
    setBaseDir(originalBaseDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('omits jupyter from temp config when Jupyter Server is not running', () => {
    const tmpFile = new McpService().generateTempConfig(PID);
    expect(tmpFile).not.toBeNull();
    const json = JSON.parse(fs.readFileSync(tmpFile!, 'utf-8'));
    expect(Object.keys(json.mcpServers)).not.toContain('jupyter');
  });

  it('injects RUNTIME/DOCUMENT env vars when Jupyter is running, and creates an empty notebook', () => {
    setJupyterStateForTesting(8889, 'fake-jupyter-token');
    const notebookPath = getNotebookPath(PID);
    expect(fs.existsSync(notebookPath)).toBe(false);

    const tmpFile = new McpService().generateTempConfig(PID);
    expect(tmpFile).not.toBeNull();
    const json = JSON.parse(fs.readFileSync(tmpFile!, 'utf-8'));
    const jp = json.mcpServers.jupyter;
    expect(jp).toBeDefined();
    // jupyter-mcp-server v1.27.2 env bindings
    expect(jp.env.RUNTIME_URL).toBe('http://127.0.0.1:8889');
    expect(jp.env.RUNTIME_TOKEN).toBe('fake-jupyter-token');
    expect(jp.env.DOCUMENT_URL).toBe('http://127.0.0.1:8889');
    expect(jp.env.DOCUMENT_TOKEN).toBe('fake-jupyter-token');
    expect(jp.env.DOCUMENT_ID).toBe(notebookPath);
    // Connection flows via env now; no --notebook-path (that arg does not exist)
    expect(jp.args).not.toContain('--notebook-path');
    expect(jp.args).toEqual(['--transport', 'stdio']);

    // Notebook file auto-created with valid structure
    expect(fs.existsSync(notebookPath)).toBe(true);
    const nb = JSON.parse(fs.readFileSync(notebookPath, 'utf-8'));
    expect(nb.nbformat).toBe(4);
    // v3.3.0 — pre-seeded template (Pillar C): header + env capture + seed cells
    expect(Array.isArray(nb.cells)).toBe(true);
    expect(nb.cells.length).toBe(3);
    const ids = nb.cells.map((c: { id: string }) => c.id);
    expect(ids).toEqual(['aira-header', 'aira-env', 'aira-seed']);
    // env_capture cell contains pip freeze
    const envCell = nb.cells.find((c: { id: string }) => c.id === 'aira-env');
    expect(envCell.source.join('')).toMatch(/pip\s+freeze/);
    // seed cell sets RNG seeds
    const seedCell = nb.cells.find((c: { id: string }) => c.id === 'aira-seed');
    expect(seedCell.source.join('')).toMatch(/random\.seed/);
    expect(nb.metadata.kernelspec.name).toBe('python3');
  });

  it('does not inject the legacy --notebook-path arg or JUPYTER_SERVER_* env (regression for v3.0.2 fix)', () => {
    setJupyterStateForTesting(8890, 'token-2');
    const tmpFile = new McpService().generateTempConfig(PID);
    const json = JSON.parse(fs.readFileSync(tmpFile!, 'utf-8'));
    const jp = json.mcpServers.jupyter;
    expect(jp.env.JUPYTER_SERVER_URL).toBeUndefined();
    expect(jp.env.JUPYTER_SERVER_TOKEN).toBeUndefined();
    expect(JSON.stringify(jp.args)).not.toContain('--notebook-path');
  });
});
