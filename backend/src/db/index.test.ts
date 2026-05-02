import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTestDb(dir: string): Database.Database {
  const dbPath = path.join(dir, 'test.db');
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

function applySchema(db: Database.Database): void {
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
      error_type    TEXT CHECK(error_type IN ('cli_missing', 'auth_failure', 'timeout', 'spawn_failure', 'server_crash', 'unknown')),
      cancel_reason TEXT CHECK(cancel_reason IN ('user', 'system')),
      started_at    DATETIME,
      finished_at   DATETIME,
      exit_code     INTEGER,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_agent_runs_project_status ON agent_runs(project_id, status);
    CREATE UNIQUE INDEX idx_agent_runs_one_running ON agent_runs(project_id) WHERE status = 'running';
    CREATE UNIQUE INDEX idx_agent_runs_one_queued ON agent_runs(project_id) WHERE status = 'queued';

    CREATE TABLE messages (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      run_id      TEXT REFERENCES agent_runs(id),
      role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content     TEXT NOT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE skills (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      source_type TEXT NOT NULL CHECK(source_type IN ('local', 'github', 'marketplace')),
      source_url  TEXT,
      skill_path  TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'available'
                  CHECK(status IN ('available', 'importing', 'error')),
      last_error  TEXT,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE project_skills (
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      skill_id    TEXT NOT NULL,
      PRIMARY KEY (project_id, skill_id)
    );

    CREATE TABLE project_mcp_configs (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL CHECK(type IN ('stdio', 'sse', 'preset')),
      config_json TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE project_files (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      filename     TEXT NOT NULL,
      file_path    TEXT NOT NULL,
      mime_type    TEXT,
      size_bytes   INTEGER,
      mtime_ms     INTEGER,
      content_hash TEXT,
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, file_path)
    );
  `);
}

describe('SQLite Schema', () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-test-'));
    db = createTestDb(tmpDir);
    applySchema(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('PRAGMA foreign_keys', () => {
    it('should be enabled', () => {
      const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
      expect(result[0]?.foreign_keys).toBe(1);
    });

    it('should reject orphan agent_runs', () => {
      expect(() => {
        db.prepare(
          "INSERT INTO agent_runs (id, project_id, status) VALUES ('r1', 'nonexistent', 'queued')",
        ).run();
      }).toThrow(/FOREIGN KEY/);
    });

    it('should cascade delete agent_runs on project delete', () => {
      db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Test')").run();
      db.prepare(
        "INSERT INTO agent_runs (id, project_id, status) VALUES ('r1', 'p1', 'completed')",
      ).run();
      db.prepare("DELETE FROM projects WHERE id = 'p1'").run();

      const runs = db.prepare('SELECT COUNT(*) as cnt FROM agent_runs').get() as { cnt: number };
      expect(runs.cnt).toBe(0);
    });

    it('should cascade delete messages on project delete', () => {
      db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Test')").run();
      db.prepare(
        "INSERT INTO messages (id, project_id, role, content) VALUES ('m1', 'p1', 'user', 'hello')",
      ).run();
      db.prepare("DELETE FROM projects WHERE id = 'p1'").run();

      const msgs = db.prepare('SELECT COUNT(*) as cnt FROM messages').get() as { cnt: number };
      expect(msgs.cnt).toBe(0);
    });
  });

  describe('Partial unique indexes', () => {
    it('should allow only one running run per project', () => {
      db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Test')").run();
      db.prepare(
        "INSERT INTO agent_runs (id, project_id, status) VALUES ('r1', 'p1', 'running')",
      ).run();

      expect(() => {
        db.prepare(
          "INSERT INTO agent_runs (id, project_id, status) VALUES ('r2', 'p1', 'running')",
        ).run();
      }).toThrow(/UNIQUE/);
    });

    it('should allow only one queued run per project', () => {
      db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Test')").run();
      db.prepare(
        "INSERT INTO agent_runs (id, project_id, status) VALUES ('r1', 'p1', 'queued')",
      ).run();

      expect(() => {
        db.prepare(
          "INSERT INTO agent_runs (id, project_id, status) VALUES ('r2', 'p1', 'queued')",
        ).run();
      }).toThrow(/UNIQUE/);
    });

    it('should allow one running + one queued in same project', () => {
      db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Test')").run();
      db.prepare(
        "INSERT INTO agent_runs (id, project_id, status) VALUES ('r1', 'p1', 'running')",
      ).run();
      db.prepare(
        "INSERT INTO agent_runs (id, project_id, status) VALUES ('r2', 'p1', 'queued')",
      ).run();

      const count = db.prepare("SELECT COUNT(*) as cnt FROM agent_runs WHERE project_id = 'p1'")
        .get() as { cnt: number };
      expect(count.cnt).toBe(2);
    });

    it('should allow multiple completed runs per project', () => {
      db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Test')").run();
      db.prepare(
        "INSERT INTO agent_runs (id, project_id, status) VALUES ('r1', 'p1', 'completed')",
      ).run();
      db.prepare(
        "INSERT INTO agent_runs (id, project_id, status) VALUES ('r2', 'p1', 'completed')",
      ).run();
      db.prepare(
        "INSERT INTO agent_runs (id, project_id, status) VALUES ('r3', 'p1', 'failed')",
      ).run();

      const count = db.prepare('SELECT COUNT(*) as cnt FROM agent_runs').get() as { cnt: number };
      expect(count.cnt).toBe(3);
    });
  });

  describe('CHECK constraints', () => {
    it('should reject invalid run status', () => {
      db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Test')").run();
      expect(() => {
        db.prepare(
          "INSERT INTO agent_runs (id, project_id, status) VALUES ('r1', 'p1', 'invalid')",
        ).run();
      }).toThrow(/CHECK/);
    });

    it('should reject invalid message role', () => {
      db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Test')").run();
      expect(() => {
        db.prepare(
          "INSERT INTO messages (id, project_id, role, content) VALUES ('m1', 'p1', 'admin', 'hi')",
        ).run();
      }).toThrow(/CHECK/);
    });

    it('should reject invalid MCP type', () => {
      db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Test')").run();
      expect(() => {
        db.prepare(
          "INSERT INTO project_mcp_configs (id, project_id, name, type, config_json) VALUES ('c1', 'p1', 'test', 'invalid', '{}')",
        ).run();
      }).toThrow(/CHECK/);
    });
  });

  describe('project_files unique constraint', () => {
    it('should prevent duplicate file_path in same project', () => {
      db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Test')").run();
      db.prepare(
        "INSERT INTO project_files (id, project_id, filename, file_path) VALUES ('f1', 'p1', 'main.rs', 'src/main.rs')",
      ).run();

      expect(() => {
        db.prepare(
          "INSERT INTO project_files (id, project_id, filename, file_path) VALUES ('f2', 'p1', 'main.rs', 'src/main.rs')",
        ).run();
      }).toThrow(/UNIQUE/);
    });

    it('should allow same file_path in different projects', () => {
      db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Test1')").run();
      db.prepare("INSERT INTO projects (id, name) VALUES ('p2', 'Test2')").run();
      db.prepare(
        "INSERT INTO project_files (id, project_id, filename, file_path) VALUES ('f1', 'p1', 'main.rs', 'src/main.rs')",
      ).run();
      db.prepare(
        "INSERT INTO project_files (id, project_id, filename, file_path) VALUES ('f2', 'p2', 'main.rs', 'src/main.rs')",
      ).run();

      const count = db.prepare('SELECT COUNT(*) as cnt FROM project_files').get() as {
        cnt: number;
      };
      expect(count.cnt).toBe(2);
    });
  });

  describe('UPSERT for project_files', () => {
    it('should update on conflict', () => {
      db.prepare("INSERT INTO projects (id, name) VALUES ('p1', 'Test')").run();
      db.prepare(
        "INSERT INTO project_files (id, project_id, filename, file_path, size_bytes) VALUES ('f1', 'p1', 'main.rs', 'src/main.rs', 100)",
      ).run();

      db.prepare(`
        INSERT INTO project_files (id, project_id, filename, file_path, size_bytes)
        VALUES ('f1-new', 'p1', 'main.rs', 'src/main.rs', 200)
        ON CONFLICT(project_id, file_path) DO UPDATE SET
          size_bytes = excluded.size_bytes,
          updated_at = CURRENT_TIMESTAMP
      `).run();

      const file = db.prepare("SELECT size_bytes FROM project_files WHERE project_id = 'p1' AND file_path = 'src/main.rs'")
        .get() as { size_bytes: number };
      expect(file.size_bytes).toBe(200);
    });
  });
});
