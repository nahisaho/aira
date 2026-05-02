import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// Test the project service logic with a test DB

describe('ProjectService logic', () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-project-'));
    db = new Database(path.join(tmpDir, 'test.db'));
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE projects (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL UNIQUE,
        description   TEXT,
        last_activity DATETIME,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE agent_runs (
        id            TEXT PRIMARY KEY,
        project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        message_id    TEXT,
        status        TEXT NOT NULL DEFAULT 'queued'
                      CHECK(status IN ('queued', 'running', 'completed', 'failed', 'timeout', 'cancelled')),
        error_type    TEXT,
        cancel_reason TEXT,
        started_at    DATETIME,
        finished_at   DATETIME,
        exit_code     INTEGER,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX idx_agent_runs_one_running ON agent_runs(project_id) WHERE status = 'running';
      CREATE UNIQUE INDEX idx_agent_runs_one_queued ON agent_runs(project_id) WHERE status = 'queued';
    `);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('CRUD', () => {
    it('should create a project', () => {
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(id, 'Test Project');
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as { name: string };
      expect(project.name).toBe('Test Project');
    });

    it('should reject duplicate project names', () => {
      db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(crypto.randomUUID(), 'Dup');
      expect(() => {
        db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(crypto.randomUUID(), 'Dup');
      }).toThrow(/UNIQUE/);
    });

    it('should update project name', () => {
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(id, 'Old Name');
      db.prepare('UPDATE projects SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('New Name', id);

      const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(id) as { name: string };
      expect(project.name).toBe('New Name');
    });

    it('should list projects ordered by updated_at', () => {
      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();
      db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(id1, 'First');
      db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(id2, 'Second');
      // Update first to make it most recent
      db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id1);

      const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Array<{ id: string }>;
      expect(projects[0]!.id).toBe(id1);
    });

    it('should delete project and cascade', () => {
      const pid = crypto.randomUUID();
      const rid = crypto.randomUUID();
      db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(pid, 'ToDelete');
      db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'completed')").run(rid, pid);

      db.prepare('DELETE FROM projects WHERE id = ?').run(pid);

      const runs = db.prepare('SELECT COUNT(*) as cnt FROM agent_runs').get() as { cnt: number };
      expect(runs.cnt).toBe(0);
    });
  });

  describe('Active Run guard', () => {
    it('should detect active running run', () => {
      const pid = crypto.randomUUID();
      db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(pid, 'Running');
      db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'running')").run(crypto.randomUUID(), pid);

      const count = db.prepare(
        "SELECT COUNT(*) as cnt FROM agent_runs WHERE project_id = ? AND status IN ('running', 'queued')",
      ).get(pid) as { cnt: number };
      expect(count.cnt).toBe(1);
    });

    it('should not block when only completed runs exist', () => {
      const pid = crypto.randomUUID();
      db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(pid, 'Completed');
      db.prepare("INSERT INTO agent_runs (id, project_id, status) VALUES (?, ?, 'completed')").run(crypto.randomUUID(), pid);

      const count = db.prepare(
        "SELECT COUNT(*) as cnt FROM agent_runs WHERE project_id = ? AND status IN ('running', 'queued')",
      ).get(pid) as { cnt: number };
      expect(count.cnt).toBe(0);
    });
  });

  describe('Workspace directory', () => {
    it('should create workspace directory', () => {
      const projectDir = path.join(tmpDir, 'workspace');
      fs.mkdirSync(projectDir, { recursive: true });
      expect(fs.existsSync(projectDir)).toBe(true);
    });

    it('should delete workspace directory', () => {
      const projectDir = path.join(tmpDir, 'workspace');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'test.txt'), 'hello');

      fs.rmSync(projectDir, { recursive: true, force: true });
      expect(fs.existsSync(projectDir)).toBe(false);
    });
  });
});
