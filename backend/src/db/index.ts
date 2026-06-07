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
    try {
      db = new SQL.Database(fileBuf);
      // Verify integrity with a simple query
      db.exec("SELECT 1");
    } catch (err) {
      const corruptPath = `${dbPath}.corrupt.${Date.now()}`;
      console.error(`[db] Corrupted database detected, backing up to ${corruptPath}:`, (err as Error).message);
      fs.renameSync(dbPath, corruptPath);
      db = new SQL.Database();
    }
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
      source_type TEXT NOT NULL CHECK(source_type IN ('local', 'github', 'marketplace', 'github-agents')),
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
      type        TEXT NOT NULL CHECK(type IN ('stdio', 'sse', 'http', 'preset')),
      config_json TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      preset_id   TEXT,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    )`,

    // ── Structured RAG tables ──
    `CREATE TABLE IF NOT EXISTS rag_knowledge (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      message_id  TEXT REFERENCES messages(id) ON DELETE CASCADE,
      file_path   TEXT,
      source_hash TEXT,
      type        TEXT NOT NULL CHECK(type IN ('entity','action','topic')),
      data_json   TEXT NOT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_rag_knowledge_project ON rag_knowledge(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_rag_knowledge_message ON rag_knowledge(message_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_knowledge_msg_uniq
      ON rag_knowledge(project_id, message_id, type, data_json) WHERE message_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_knowledge_file_uniq
      ON rag_knowledge(project_id, file_path, type, data_json) WHERE file_path IS NOT NULL`,

    `CREATE TABLE IF NOT EXISTS rag_index (
      term          TEXT NOT NULL COLLATE NOCASE,
      project_id    TEXT NOT NULL,
      knowledge_id  INTEGER NOT NULL REFERENCES rag_knowledge(id) ON DELETE CASCADE,
      score         REAL NOT NULL DEFAULT 1.0,
      PRIMARY KEY (term, project_id, knowledge_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_rag_index_lookup ON rag_index(project_id, term)`,

    `CREATE TABLE IF NOT EXISTS rag_settings (
      project_id        TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      enabled           INTEGER NOT NULL DEFAULT 0,
      max_context_chars INTEGER NOT NULL DEFAULT 4000,
      auto_index_files  INTEGER NOT NULL DEFAULT 1,
      created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── Skill routing log (v3.6.0) ──
    // Records, per run, which skills AIRA synced into the workspace and which
    // skills the Copilot CLI reported loading. Lets the operator investigate why
    // the same skill set produced different agent behaviour (e.g. citation
    // density) across runs. event_type:
    //   'synced'        — AIRA-side: skill dirs + sub-skills written to .github/
    //   'skills_loaded' — CLI event: skills the CLI selected/loaded for the turn
    //   'tool_invoked'  — CLI event: a skill-related tool the agent actually ran
    `CREATE TABLE IF NOT EXISTS skill_routing_logs (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      run_id      TEXT,
      event_type  TEXT NOT NULL CHECK(event_type IN ('synced','skills_loaded','tool_invoked')),
      payload     TEXT NOT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_skill_routing_project
      ON skill_routing_logs(project_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_skill_routing_run
      ON skill_routing_logs(run_id)`
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

  // Migrate project_mcp_configs: add preset_id column
  const mcpCols = db.pragma('table_info(project_mcp_configs)') as Array<{ name: string }>;
  if (Array.isArray(mcpCols) && !mcpCols.some(c => c.name === 'preset_id')) {
    db.exec("ALTER TABLE project_mcp_configs ADD COLUMN preset_id TEXT");
  }

  // Migrate project_mcp_configs: add updated_at column. PATCH writes to it,
  // so DBs created before this column existed (≤ v2.7.1 fresh DBs) crashed
  // every edit with "no such column: updated_at".
  const mcpColsForUpdatedAt = db.pragma('table_info(project_mcp_configs)') as Array<{ name: string }>;
  if (Array.isArray(mcpColsForUpdatedAt) && !mcpColsForUpdatedAt.some(c => c.name === 'updated_at')) {
    // SQLite requires non-constant DEFAULTs (CURRENT_TIMESTAMP) to be added
    // without DEFAULT first; backfill afterwards.
    db.exec("ALTER TABLE project_mcp_configs ADD COLUMN updated_at DATETIME");
    db.exec("UPDATE project_mcp_configs SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL");
  }

  // Migrate project_mcp_configs: add 'http' to the type CHECK constraint.
  // SQLite cannot ALTER a CHECK constraint, so we read the table's stored DDL
  // from sqlite_master and recreate the table when 'http' is missing. This is
  // safer than a probe-INSERT, which conflates FK errors with CHECK errors.
  const mcpTableDef = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'project_mcp_configs'",
  ).get() as { sql: string } | undefined;

  if (mcpTableDef && !mcpTableDef.sql.includes("'http'")) {
    // Detect whether the existing table already has the builtin column so the
    // migration works on both pre- and post-seed databases.
    const existingCols = (db.pragma('table_info(project_mcp_configs)') as Array<{ name: string }>)
      .map(c => c.name);
    const hasBuiltin = existingCols.includes('builtin');

    db.exec(`
      CREATE TABLE project_mcp_configs_new (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        type        TEXT NOT NULL CHECK(type IN ('stdio', 'sse', 'http', 'preset')),
        config_json TEXT NOT NULL,
        enabled     INTEGER NOT NULL DEFAULT 1,
        builtin     INTEGER NOT NULL DEFAULT 0,
        preset_id   TEXT,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const builtinSelect = hasBuiltin ? 'COALESCE(builtin, 0)' : '0';
    db.exec(`
      INSERT INTO project_mcp_configs_new
        (id, project_id, name, type, config_json, enabled, builtin, preset_id, created_at, updated_at)
      SELECT
        id, project_id, name, type, config_json, enabled,
        ${builtinSelect},
        preset_id,
        COALESCE(created_at, CURRENT_TIMESTAMP),
        COALESCE(created_at, CURRENT_TIMESTAMP)
      FROM project_mcp_configs
    `);
    db.exec('DROP TABLE project_mcp_configs');
    db.exec('ALTER TABLE project_mcp_configs_new RENAME TO project_mcp_configs');
  }

  // Migrate skills table: add 'github-agents' to source_type constraint
  try {
    db.exec("INSERT INTO skills (id, name, source_type, skill_path) VALUES ('__constraint_test__', '__test__', 'github-agents', '__test__')");
    db.exec("DELETE FROM skills WHERE id = '__constraint_test__'");
  } catch {
    // Constraint doesn't allow 'github-agents' — recreate table
    db.exec(`
      CREATE TABLE skills_new (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        source_type TEXT NOT NULL CHECK(source_type IN ('local', 'github', 'marketplace', 'github-agents')),
        source_url  TEXT,
        skill_path  TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'available'
                    CHECK(status IN ('available', 'importing', 'error')),
        last_error  TEXT,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        builtin     INTEGER NOT NULL DEFAULT 0
      )
    `);
    db.exec(`INSERT INTO skills_new SELECT id, name, description, source_type, source_url, skill_path, status, last_error, created_at, updated_at, COALESCE(builtin, 0) FROM skills`);
    db.exec('DROP TABLE skills');
    db.exec('ALTER TABLE skills_new RENAME TO skills');
  }
}

export { DATA_DIR, DB_PATH };
export { getDataDir } from '../config/paths.js';
