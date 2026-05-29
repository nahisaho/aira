import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runRoutes } from './runs.js';
import { initializeDatabase, getDatabase, closeDatabase } from '../db/index.js';
import { setBaseDir, getBaseDir } from '../config/paths.js';

describe('Runs API', () => {
  let tmpDir: string;
  let originalBaseDir: string;
  let app: Hono;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-runs-test-'));
    originalBaseDir = getBaseDir();
    setBaseDir(tmpDir);
    closeDatabase();
    await initializeDatabase();

    app = new Hono();
    app.route('/', runRoutes);

    const db = getDatabase();
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run('p1', 'Project A');
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run('p2', 'Project B');
    db.prepare(
      "INSERT INTO agent_runs (id, project_id, prompt, status) VALUES (?, ?, ?, 'completed')",
    ).run('r1', 'p1', 'prompt for p1');
    db.prepare(
      "INSERT INTO agent_runs (id, project_id, prompt, status) VALUES (?, ?, ?, 'completed')",
    ).run('r2', 'p2', 'prompt for p2');
  });

  afterEach(() => {
    closeDatabase();
    setBaseDir(originalBaseDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/projects/:id/runs/:runId/prompt', () => {
    it('returns prompt when project_id and run_id match', async () => {
      const res = await app.request('/api/projects/p1/runs/r1/prompt');
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe('prompt for p1');
    });

    it('returns 404 when runId belongs to a different project (tenant scope)', async () => {
      // r2 belongs to p2 — fetching via /projects/p1/runs/r2/prompt must fail.
      const res = await app.request('/api/projects/p1/runs/r2/prompt');
      expect(res.status).toBe(404);
    });

    it('returns 404 for unknown runId', async () => {
      const res = await app.request('/api/projects/p1/runs/does-not-exist/prompt');
      expect(res.status).toBe(404);
    });
  });
});
