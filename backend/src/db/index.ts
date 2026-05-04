import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import type { BindParams } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDataDir } from '../config/paths.js';

function DATA_DIR(): string { return getDataDir(); }
function DB_PATH(): string { return path.join(DATA_DIR(), 'aira.db'); }

// ─── Compatibility wrapper ───────────────────────────────────────────

interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

interface PreparedStatement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown | undefined;
  run(...params: unknown[]): RunResult;
}

export interface CompatDatabase {
  prepare(sql: string): PreparedStatement;
  exec(sql: string): void;
  pragma(statement: string): unknown;
  transaction<T extends (...args: unknown[]) => unknown>(fn: T): T;
  close(): void;
}

let dbInstance: CompatDatabase | null = null;
let rawDb: SqlJsDatabase | null = null;
let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const SAVE_DEBOUNCE_MS = 100;

function scheduleSave(): void {
  if (!dirty) { dirty = true; }
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushToDisk();
  }, SAVE_DEBOUNCE_MS);
}

function flushToDisk(): void {
  if (!rawDb || !dirty) return;
  const data = rawDb.export();
  const buffer = Buffer.from(data);
  const dbPath = DB_PATH();
  const tmpPath = dbPath + '.tmp';
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, dbPath);
  dirty = false;
}

function normalizeParams(params: unknown[]): BindParams | undefined {
  if (params.length === 0) return undefined;
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0] as BindParams;
  }
  return params as BindParams;
}

function createWrapper(db: SqlJsDatabase): CompatDatabase {
  const wrapper: CompatDatabase = {
    prepare(sql: string): PreparedStatement {
      return {
        all(...params: unknown[]): unknown[] {
          const stmt = db.prepare(sql);
          const bound = normalizeParams(params);
          if (bound) stmt.bind(bound);
          const results: unknown[] = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        },
        get(...params: unknown[]): unknown | undefined {
          const stmt = db.prepare(sql);
          const bound = normalizeParams(params);
          if (bound) stmt.bind(bound);
          let result: unknown | undefined;
          if (stmt.step()) {
            result = stmt.getAsObject();
          }
          stmt.free();
          return result;
        },
        run(...params: unknown[]): RunResult {
          const bound = normalizeParams(params);
          if (bound) {
            db.run(sql, bound);
          } else {
            db.run(sql);
          }
          const changes = db.getRowsModified();
          let lastInsertRowid = 0;
          try {
            const r = db.exec("SELECT last_insert_rowid() as id");
            if (r.length > 0 && r[0].values.length > 0) {
              lastInsertRowid = r[0].values[0][0] as number;
            }
          } catch { /* ignore */ }
          scheduleSave();
          return { changes, lastInsertRowid };
        }
      };
    },

    exec(sql: string): void {
      db.exec(sql);
      scheduleSave();
    },

    pragma(statement: string): unknown {
      const setMatch = statement.match(/^(\w+)\s*=\s*(.+)$/);
      if (setMatch) {
        try { db.run(`PRAGMA ${statement}`); } catch { /* ignore unsupported */ }
        return undefined;
      }
      try {
        const result = db.exec(`PRAGMA ${statement}`);
        if (result.length === 0) return [];
        const cols = result[0].columns;
        return result[0].values.map(row => {
          const obj: Record<string, unknown> = {};
          cols.forEach((col, i) => { obj[col] = row[i]; });
          return obj;
        });
      } catch {
        return [];
      }
    },

    transaction<T extends (...args: unknown[]) => unknown>(fn: T): T {
      const wrapped = ((...args: unknown[]) => {
        db.run("BEGIN TRANSACTION");
        try {
          const result = fn(...args);
          db.run("COMMIT");
          flushToDisk();
          return result;
        } catch (err) {
          db.run("ROLLBACK");
          throw err;
        }
      }) as T;
      return wrapped;
    },

    close(): void {
      flushToDisk();
      db.close();
    }
  };
  return wrapper;
}

// ─── Public API ──────────────────────────────────────────────────────

export async function initializeDatabase(): Promise<void> {
  if (dbInstance) return;

  ensureDataDirectory();

  // Locate WASM binary
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(thisDir, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.resolve(thisDir, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ];
  let wasmBinary: ArrayBuffer | undefined;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const buf = fs.readFileSync(c);
      wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      break;
    }
  }

  const SQL = await initSqlJs(
    wasmBinary ? { wasmBinary } : undefined
  );

  let db: SqlJsDatabase;
  const dbPath = DB_PATH();
  if (fs.existsSync(dbPath)) {
    const fileBuf = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuf);
  } else {
    db = new SQL.Database();
  }

  rawDb = db;
  db.run("PRAGMA foreign_keys = ON");

  const wrapper = createWrapper(db);
  createSchema(wrapper);
  dbInstance = wrapper;

  // Flush initial schema creation
  flushToDisk();

  if (process.platform !== 'win32' && fs.existsSync(dbPath)) {
    fs.chmodSync(dbPath, 0o600);
  }
}

export function getDatabase(): CompatDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    rawDb = null;
    dirty = false;
  }
}

// ─── Internal ────────────────────────────────────────────────────────

function ensureDataDirectory(): void {
  const dataDir = DATA_DIR();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { mode: 0o700, recursive: true });
  }
  if (process.platform !== 'win32') {
    const stat = fs.statSync(dataDir);
    const mode = stat.mode & 0o777;
    if (mode !== 0o700) {
      fs.chmodSync(dataDir, 0o700);
    }
  }
}

function createSchema(db: CompatDatabase): void {
  const statements = [
    `CREATE TABLE IF NOT EXISTS projects (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL UNIQUE,
      description   TEXT,
      last_activity DATETIME,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS agent_runs (
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
      prompt        TEXT,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_agent_runs_project_status
      ON agent_runs(project_id, status)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_runs_one_running
      ON agent_runs(project_id) WHERE status = 'running'`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_runs_one_queued
      ON agent_runs(project_id) WHERE status = 'queued'`,
    `CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      run_id      TEXT REFERENCES agent_runs(id),
      role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content     TEXT NOT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS skills (
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
    )`,
    `CREATE TABLE IF NOT EXISTS project_skills (
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      skill_id    TEXT NOT NULL,
      PRIMARY KEY (project_id, skill_id)
    )`,
    `CREATE TABLE IF NOT EXISTS project_mcp_configs (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL CHECK(type IN ('stdio', 'sse', 'preset')),
      config_json TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS project_files (
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
    )`
  ];

  for (const stmt of statements) {
    try { db.exec(stmt); } catch { /* table may already exist */ }
  }

  // Migrations
  const cols = db.pragma('table_info(project_files)') as Array<{ name: string }>;
  if (Array.isArray(cols) && !cols.some(c => c.name === 'source')) {
    db.exec("ALTER TABLE project_files ADD COLUMN source TEXT NOT NULL DEFAULT 'agent'");
  }
  const runCols = db.pragma('table_info(agent_runs)') as Array<{ name: string }>;
  if (Array.isArray(runCols) && !runCols.some(c => c.name === 'prompt')) {
    db.exec("ALTER TABLE agent_runs ADD COLUMN prompt TEXT");
  }
}

export { DATA_DIR, DB_PATH };
export { getDataDir } from '../config/paths.js';
