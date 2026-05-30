import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { mcpRoutes } from './mcp.js';
import { initializeDatabase, getDatabase, closeDatabase } from '../db/index.js';
import { setBaseDir, getBaseDir } from '../config/paths.js';

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
    const httpEntry = list.find((c: { name: string }) => c.name === 'jupyter');
    expect(httpEntry).toBeDefined();
    expect(httpEntry.type).toBe('http');
    expect((httpEntry.config as Record<string, unknown>).url).toBe('https://example.com/mcp');
  });
});
