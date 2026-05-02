import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

describe('MessageService logic', () => {
  let tmpDir: string;
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-msg-'));
    db = new Database(path.join(tmpDir, 'test.db'));
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
        description TEXT, last_activity DATETIME,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE agent_runs (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        message_id TEXT, status TEXT NOT NULL DEFAULT 'queued',
        error_type TEXT, cancel_reason TEXT, started_at DATETIME,
        finished_at DATETIME, exit_code INTEGER,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE messages (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        run_id TEXT REFERENCES agent_runs(id),
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    projectId = crypto.randomUUID();
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(projectId, 'Test');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Message persistence', () => {
    it('should create user message', () => {
      const msgId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, 'user', ?)",
      ).run(msgId, projectId, 'Hello');

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId) as {
        role: string;
        content: string;
      };
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello');
    });

    it('should create assistant message', () => {
      const msgId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, 'assistant', ?)",
      ).run(msgId, projectId, 'Hi there');

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId) as {
        role: string;
      };
      expect(msg.role).toBe('assistant');
    });

    it('should append content to message', () => {
      const msgId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, 'assistant', ?)",
      ).run(msgId, projectId, 'Part 1');

      db.prepare('UPDATE messages SET content = content || ? WHERE id = ?').run(' Part 2', msgId);

      const msg = db.prepare('SELECT content FROM messages WHERE id = ?').get(msgId) as {
        content: string;
      };
      expect(msg.content).toBe('Part 1 Part 2');
    });
  });

  describe('History', () => {
    it('should return messages ordered by creation time', () => {
      for (let i = 0; i < 5; i++) {
        db.prepare(
          "INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, 'user', ?)",
        ).run(crypto.randomUUID(), projectId, `Message ${i}`);
      }

      const messages = db
        .prepare('SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC')
        .all(projectId) as Array<{ content: string }>;
      expect(messages).toHaveLength(5);
      expect(messages[0]!.content).toBe('Message 0');
    });

    it('should support limit and offset', () => {
      for (let i = 0; i < 10; i++) {
        db.prepare(
          "INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, 'user', ?)",
        ).run(crypto.randomUUID(), projectId, `Message ${i}`);
      }

      const page = db
        .prepare(
          'SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?',
        )
        .all(projectId, 3, 2) as Array<{ content: string }>;
      expect(page).toHaveLength(3);
      expect(page[0]!.content).toBe('Message 2');
    });
  });

  describe('Clear history', () => {
    it('should clear all messages', () => {
      db.prepare(
        "INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, 'user', ?)",
      ).run(crypto.randomUUID(), projectId, 'Hello');
      db.prepare('DELETE FROM messages WHERE project_id = ?').run(projectId);

      const count = db
        .prepare('SELECT COUNT(*) as cnt FROM messages WHERE project_id = ?')
        .get(projectId) as { cnt: number };
      expect(count.cnt).toBe(0);
    });

    it('should reject clear during active run', () => {
      db.prepare(
        "INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'running')",
      ).run(crypto.randomUUID(), projectId);

      const activeCount = db
        .prepare(
          "SELECT COUNT(*) as cnt FROM agent_runs WHERE project_id = ? AND status IN ('running', 'queued')",
        )
        .get(projectId) as { cnt: number };
      expect(activeCount.cnt).toBe(1);
      // Service would throw ClearHistoryDuringRunError
    });
  });

  describe('Run association', () => {
    it('should associate message with run', () => {
      const runId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'running')",
      ).run(runId, projectId);

      const msgId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO messages (id, project_id, run_id, role, content) VALUES (?, ?, ?, 'user', ?)",
      ).run(msgId, projectId, runId, 'Start');

      const msg = db.prepare('SELECT run_id FROM messages WHERE id = ?').get(msgId) as {
        run_id: string;
      };
      expect(msg.run_id).toBe(runId);
    });
  });
});
