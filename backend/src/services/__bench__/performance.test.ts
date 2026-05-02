/**
 * Performance validation tests.
 * Tests system behavior under load conditions.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

function createTestDb(dir: string): InstanceType<typeof Database> {
  const dbPath = path.join(dir, 'test.db');
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      last_activity DATETIME,
      workspace_dir TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

describe('Performance validation', () => {
  let tmpDir: string;
  let db: InstanceType<typeof Database>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-perf-'));
    db = createTestDb(tmpDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Large message handling', () => {
    it('persists a 100KB message within 200ms', () => {
      const projectId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO projects (id, name, workspace_dir) VALUES (?, ?, ?)`,
      ).run(projectId, 'perf-test', path.join(tmpDir, 'ws'));

      const largeContent = 'x'.repeat(100_000);
      const start = performance.now();

      db.prepare(
        `INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, ?, ?)`,
      ).run(crypto.randomUUID(), projectId, 'assistant', largeContent);

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(200);
    });

    it('retrieves 1000 messages within 500ms', () => {
      const projectId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO projects (id, name, workspace_dir) VALUES (?, ?, ?)`,
      ).run(projectId, 'perf-test', path.join(tmpDir, 'ws'));

      const insert = db.prepare(
        `INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, ?, ?)`,
      );
      const tx = db.transaction(() => {
        for (let i = 0; i < 1000; i++) {
          insert.run(crypto.randomUUID(), projectId, i % 2 === 0 ? 'user' : 'assistant', `Message ${i} content`);
        }
      });
      tx();

      const start = performance.now();
      const rows = db.prepare(
        `SELECT * FROM messages WHERE project_id = ? ORDER BY created_at`,
      ).all(projectId);
      const elapsed = performance.now() - start;

      expect(rows.length).toBe(1000);
      expect(elapsed).toBeLessThan(500);
    });

    it('handles 10KB messages in bulk (100 messages) within 1s', () => {
      const projectId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO projects (id, name, workspace_dir) VALUES (?, ?, ?)`,
      ).run(projectId, 'perf-test', path.join(tmpDir, 'ws'));

      const content = 'y'.repeat(10_000);
      const insert = db.prepare(
        `INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, ?, ?)`,
      );

      const start = performance.now();
      const tx = db.transaction(() => {
        for (let i = 0; i < 100; i++) {
          insert.run(crypto.randomUUID(), projectId, 'assistant', content);
        }
      });
      tx();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('File operations performance', () => {
    it('scans 500 files within 2s', async () => {
      const wsDir = path.join(tmpDir, 'workspace');
      fs.mkdirSync(wsDir, { recursive: true });

      for (let i = 0; i < 500; i++) {
        const subdir = path.join(wsDir, `dir${Math.floor(i / 50)}`);
        fs.mkdirSync(subdir, { recursive: true });
        fs.writeFileSync(
          path.join(subdir, `file${i}.txt`),
          `Content for file ${i}\n`.repeat(10),
        );
      }

      const { scanWorkspace } = await import('../file.service.js');

      const start = performance.now();
      const files = scanWorkspace(wsDir);
      const elapsed = performance.now() - start;

      expect(files.length).toBe(500);
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('Project CRUD performance', () => {
    it('creates 50 projects within 500ms', () => {
      const insert = db.prepare(
        `INSERT INTO projects (id, name, workspace_dir) VALUES (?, ?, ?)`,
      );

      const start = performance.now();
      const tx = db.transaction(() => {
        for (let i = 0; i < 50; i++) {
          insert.run(crypto.randomUUID(), `Project ${i}`, path.join(tmpDir, `ws${i}`));
        }
      });
      tx();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
    });

    it('lists 50 projects within 100ms', () => {
      const insert = db.prepare(
        `INSERT INTO projects (id, name, workspace_dir) VALUES (?, ?, ?)`,
      );
      const tx = db.transaction(() => {
        for (let i = 0; i < 50; i++) {
          insert.run(crypto.randomUUID(), `Project ${i}`, path.join(tmpDir, `ws${i}`));
        }
      });
      tx();

      const start = performance.now();
      const rows = db.prepare(`SELECT * FROM projects ORDER BY created_at DESC`).all();
      const elapsed = performance.now() - start;

      expect(rows.length).toBe(50);
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Secret redaction performance', () => {
    it('redacts secrets in 1MB stream within 500ms', async () => {
      const { createRedactorWithFlush } = await import('../agent.service.js');

      const secrets = ['ghp_supersecrettoken123456789', 'sk-proj-anothersecret987654'];
      const redactor = createRedactorWithFlush(secrets);

      const chunkSize = 4096;
      const totalSize = 1_000_000;
      let totalOutput = '';

      const start = performance.now();
      for (let offset = 0; offset < totalSize; offset += chunkSize) {
        let chunk = 'a'.repeat(chunkSize);
        if (offset % 50_000 === 0) {
          chunk = chunk.slice(0, 2000) + secrets[0] + chunk.slice(2000 + secrets[0].length);
        }
        totalOutput += redactor.push(chunk);
      }
      totalOutput += redactor.flush();
      const elapsed = performance.now() - start;

      expect(totalOutput.length).toBeGreaterThan(0);
      expect(totalOutput).not.toContain(secrets[0]);
      expect(elapsed).toBeLessThan(500);
    });
  });
});
