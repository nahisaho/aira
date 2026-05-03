import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve('data');
const DB_PATH = path.join(DATA_DIR, 'aira.db');

let dbInstance: Database.Database | null = null;

function ensureDataDirectory(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { mode: 0o700, recursive: true });
  }

  if (process.platform !== 'win32') {
    const stat = fs.statSync(DATA_DIR);
    const mode = stat.mode & 0o777;
    if (mode !== 0o700) {
      fs.chmodSync(DATA_DIR, 0o700);
    }
  }
}

function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL UNIQUE,
      description   TEXT,
      last_activity DATETIME,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
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

    CREATE INDEX IF NOT EXISTS idx_agent_runs_project_status
      ON agent_runs(project_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_runs_one_running
      ON agent_runs(project_id) WHERE status = 'running';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_runs_one_queued
      ON agent_runs(project_id) WHERE status = 'queued';

    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      run_id      TEXT REFERENCES agent_runs(id),
      role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content     TEXT NOT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS skills (
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

    CREATE TABLE IF NOT EXISTS project_skills (
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      skill_id    TEXT NOT NULL,
      PRIMARY KEY (project_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS project_mcp_configs (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL CHECK(type IN ('stdio', 'sse', 'preset')),
      config_json TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_files (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      filename     TEXT NOT NULL,
      file_path    TEXT NOT NULL,
      mime_type    TEXT,
      size_bytes   INTEGER,
      mtime_ms     INTEGER,
      content_hash TEXT,
      source       TEXT NOT NULL DEFAULT 'agent',
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, file_path)
    );
  `);

  // Migration: add source column if missing
  const cols = db.prepare("PRAGMA table_info(project_files)").all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === 'source')) {
    db.exec("ALTER TABLE project_files ADD COLUMN source TEXT NOT NULL DEFAULT 'agent'");
  }

  // Add foreign key for messages.run_id -> agent_runs.id after both tables exist
  // (SQLite doesn't support ALTER TABLE ADD CONSTRAINT, but FK is declared in CREATE TABLE above)
}

function validateForeignKeys(db: Database.Database): void {
  const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
  if (!result[0] || result[0].foreign_keys !== 1) {
    throw new Error('FATAL: PRAGMA foreign_keys=ON failed. Database integrity cannot be guaranteed.');
  }
}

export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  ensureDataDirectory();

  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  // CRITICAL: Enable foreign keys on every connection (SQLite default is OFF)
  db.pragma('foreign_keys = ON');
  validateForeignKeys(db);

  createSchema(db);

  // Set restrictive permissions on DB file (POSIX only)
  if (process.platform !== 'win32') {
    fs.chmodSync(DB_PATH, 0o600);
  }

  dbInstance = db;
  return db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export { DATA_DIR, DB_PATH };
