import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initializeDatabase, getDatabase, closeDatabase } from './index.js';
import { setBaseDir, getBaseDir, getDataDir } from '../config/paths.js';

describe('project_mcp_configs.type CHECK migration (adds "http")', () => {
  let tmpDir: string;
  let originalBaseDir: string;

  afterEach(() => {
    closeDatabase();
    setBaseDir(originalBaseDir);
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rewrites an old-schema table to accept type=http and preserves existing rows', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-mcp-migrate-'));
    originalBaseDir = getBaseDir();
    setBaseDir(tmpDir);
    closeDatabase();

    // Phase 1: bring up a DB, then forcibly downgrade project_mcp_configs to
    // the pre-v2.6 schema (no 'http' in the CHECK constraint) and seed a row.
    await initializeDatabase();
    let db = getDatabase();
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run('p-old', 'Old Project');

    db.exec('DROP TABLE project_mcp_configs');
    db.exec(`
      CREATE TABLE project_mcp_configs (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        type        TEXT NOT NULL CHECK(type IN ('stdio', 'sse', 'preset')),
        config_json TEXT NOT NULL,
        enabled     INTEGER NOT NULL DEFAULT 1,
        preset_id   TEXT,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.prepare(
      "INSERT INTO project_mcp_configs (id, project_id, name, type, config_json) VALUES ('mc-old', 'p-old', 'legacy', 'stdio', '{}')",
    ).run();

    // The downgraded table should reject 'http' now.
    expect(() => {
      db.prepare(
        "INSERT INTO project_mcp_configs (id, project_id, name, type, config_json) VALUES ('mc-x', 'p-old', 'x', 'http', '{}')",
      ).run();
    }).toThrow();

    // Persist (debounced; close forces flush) and close.
    closeDatabase();

    // Confirm the file on disk has the old constraint.
    const dbFile = path.join(getDataDir(), 'aira.db');
    expect(fs.existsSync(dbFile)).toBe(true);

    // Phase 2: re-open. The schema creation block in initializeDatabase must
    // detect the missing 'http' literal and rebuild the table.
    await initializeDatabase();
    db = getDatabase();

    // The legacy row should survive the rebuild.
    const legacy = db.prepare('SELECT id, type FROM project_mcp_configs WHERE id = ?').get('mc-old') as
      | { id: string; type: string }
      | undefined;
    expect(legacy).toBeDefined();
    expect(legacy?.type).toBe('stdio');

    // And the new constraint should now accept type=http.
    expect(() => {
      db.prepare(
        "INSERT INTO project_mcp_configs (id, project_id, name, type, config_json) VALUES ('mc-new', 'p-old', 'jupyter', 'http', '{}')",
      ).run();
    }).not.toThrow();
  });
});
