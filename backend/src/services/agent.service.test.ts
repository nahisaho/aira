import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRedactor, createRedactorWithFlush } from './agent.service.js';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

describe('Secret Redaction', () => {
  describe('createRedactor', () => {
    it('should redact a single secret', () => {
      const redact = createRedactor(['my-secret-token']);
      // Send enough data to flush carry buffer
      const result = redact('Before my-secret-token after') + redact(' '.repeat(100));
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('my-secret-token');
    });

    it('should redact multiple secrets', () => {
      const redact = createRedactor(['secret1', 'longer-secret-two']);
      const result = redact('Has secret1 and longer-secret-two here') + redact(' '.repeat(100));
      expect(result).not.toContain('secret1');
      expect(result).not.toContain('longer-secret-two');
    });

    it('should handle empty secrets list', () => {
      const redact = createRedactor([]);
      expect(redact('no secrets here')).toBe('no secrets here');
    });

    it('should handle secret at chunk boundary', () => {
      const secret = 'BOUNDARY_SECRET';
      const redact = createRedactor([secret]);
      // Split secret across chunks
      const part1 = redact('prefix BOUNDARY');
      const part2 = redact('_SECRET suffix');
      const part3 = redact(' '.repeat(100));
      const combined = part1 + part2 + part3;
      expect(combined).not.toContain('BOUNDARY_SECRET');
      expect(combined).toContain('[REDACTED]');
    });

    it('should escape regex special characters in secrets', () => {
      const secret = 'token+with.special$chars';
      const redact = createRedactor([secret]);
      const result = redact(`safe ${secret} safe`) + redact(' '.repeat(100));
      expect(result).not.toContain(secret);
    });
  });

  describe('createRedactorWithFlush', () => {
    it('should flush remaining buffer', () => {
      const { push, flush } = createRedactorWithFlush(['mysecret']);
      push('hello mysecret world');
      const flushed = flush();
      // The flush should contain the remaining content with redaction applied
      expect(flushed).not.toContain('mysecret');
    });

    it('should handle no secrets', () => {
      const { push, flush } = createRedactorWithFlush([]);
      expect(push('test')).toBe('test');
      expect(flush()).toBe('');
    });

    it('should redact secret that spans push/flush boundary', () => {
      const { push, flush } = createRedactorWithFlush(['ABCDEF']);
      const r1 = push('before ABC');
      const r2 = push('DEF after');
      const r3 = flush();
      const combined = r1 + r2 + r3;
      expect(combined).not.toContain('ABCDEF');
      expect(combined).toContain('[REDACTED]');
    });
  });
});

describe('Orphan Run Recovery', () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-agent-'));
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
    `);

    const pid = crypto.randomUUID();
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(pid, 'TestProj');

    // Create runs in various states
    db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'running')").run(crypto.randomUUID(), pid);
    db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'queued')").run(crypto.randomUUID(), pid);
    db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'completed')").run(crypto.randomUUID(), pid);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should mark running and queued runs as failed with server_crash', () => {
    const result = db.prepare(
      "UPDATE agent_runs SET status = 'failed', error_type = 'server_crash', finished_at = CURRENT_TIMESTAMP WHERE status IN ('running', 'queued')",
    ).run();
    expect(result.changes).toBe(2);

    const failed = db.prepare("SELECT COUNT(*) as cnt FROM agent_runs WHERE status = 'failed'").get() as { cnt: number };
    expect(failed.cnt).toBe(2);

    const completed = db.prepare("SELECT COUNT(*) as cnt FROM agent_runs WHERE status = 'completed'").get() as { cnt: number };
    expect(completed.cnt).toBe(1);
  });

  it('should set error_type to server_crash', () => {
    db.prepare(
      "UPDATE agent_runs SET status = 'failed', error_type = 'server_crash', finished_at = CURRENT_TIMESTAMP WHERE status IN ('running', 'queued')",
    ).run();

    const runs = db.prepare("SELECT error_type FROM agent_runs WHERE status = 'failed'").all() as Array<{ error_type: string }>;
    expect(runs.every(r => r.error_type === 'server_crash')).toBe(true);
  });
});

describe('Queue Control', () => {
  let tmpDir: string;
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-queue-'));
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
      CREATE UNIQUE INDEX idx_agent_runs_one_running ON agent_runs(project_id) WHERE status = 'running';
      CREATE UNIQUE INDEX idx_agent_runs_one_queued ON agent_runs(project_id) WHERE status = 'queued';
      CREATE TABLE messages (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        run_id TEXT REFERENCES agent_runs(id),
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    projectId = crypto.randomUUID();
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(projectId, 'Queue Test');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should enforce one running run per project via partial unique index', () => {
    db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'running')").run(crypto.randomUUID(), projectId);

    expect(() => {
      db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'running')").run(crypto.randomUUID(), projectId);
    }).toThrow(/UNIQUE/);
  });

  it('should enforce one queued run per project', () => {
    db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'queued')").run(crypto.randomUUID(), projectId);

    expect(() => {
      db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'queued')").run(crypto.randomUUID(), projectId);
    }).toThrow(/UNIQUE/);
  });

  it('should allow running + queued simultaneously', () => {
    db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'running')").run(crypto.randomUUID(), projectId);
    db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'queued')").run(crypto.randomUUID(), projectId);

    const count = db.prepare("SELECT COUNT(*) as cnt FROM agent_runs WHERE project_id = ? AND status IN ('running', 'queued')").get(projectId) as { cnt: number };
    expect(count.cnt).toBe(2);
  });

  it('should create message and run atomically', () => {
    const createRun = db.transaction((msgContent: string) => {
      const msgId = crypto.randomUUID();
      const runId = crypto.randomUUID();

      db.prepare("INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, 'user', ?)").run(msgId, projectId, msgContent);
      db.prepare("INSERT INTO agent_runs (id, project_id, message_id, status) VALUES (?, ?, ?, 'queued')").run(runId, projectId, msgId);

      return { msgId, runId };
    });

    const result = createRun('Hello agent');

    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.msgId) as { content: string };
    expect(msg.content).toBe('Hello agent');

    const run = db.prepare('SELECT * FROM agent_runs WHERE id = ?').get(result.runId) as { message_id: string; status: string };
    expect(run.message_id).toBe(result.msgId);
    expect(run.status).toBe('queued');
  });

  it('should promote queued to running', () => {
    const runId = crypto.randomUUID();
    db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'queued')").run(runId, projectId);

    db.prepare("UPDATE agent_runs SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?").run(runId);

    const run = db.prepare('SELECT status FROM agent_runs WHERE id = ?').get(runId) as { status: string };
    expect(run.status).toBe('running');
  });
});
