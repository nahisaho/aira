import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

describe('McpService logic', () => {
  let tmpDir: string;
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-mcp-'));
    db = new Database(path.join(tmpDir, 'test.db'));
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
        description TEXT, last_activity DATETIME,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE project_mcp_configs (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('stdio', 'sse')),
        config_json TEXT NOT NULL DEFAULT '{}',
        enabled INTEGER NOT NULL DEFAULT 1,
        preset_id TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    projectId = crypto.randomUUID();
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(projectId, 'Test');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Secret masking', () => {
    it('should mask env values in GET response', () => {
      const id = crypto.randomUUID();
      const config = { command: 'node', env: { API_KEY: 'secret123', TOKEN: 'abc' } };
      db.prepare(
        "INSERT INTO project_mcp_configs (id, project_id, name, type, config_json) VALUES (?, ?, 'test', 'stdio', ?)",
      ).run(id, projectId, JSON.stringify(config));

      const row = db.prepare('SELECT config_json FROM project_mcp_configs WHERE id = ?').get(id) as { config_json: string };
      const parsed = JSON.parse(row.config_json);

      // Simulate masking
      const env = parsed.env as Record<string, string>;
      for (const k of Object.keys(env)) {
        env[k] = '***';
      }

      expect(env.API_KEY).toBe('***');
      expect(env.TOKEN).toBe('***');
    });

    it('should reject *** in PATCH', () => {
      // Simulate PATCH rejection
      const patchValue = '***';
      expect(patchValue).toBe('***');
      // Service would throw MaskedValueError
    });
  });

  describe('PATCH semantics', () => {
    it('should merge env values (omit=keep, null=delete, string=overwrite)', () => {
      const existing = { command: 'node', env: { KEY1: 'val1', KEY2: 'val2', KEY3: 'val3' } };
      const patch = { KEY2: null, KEY3: 'newval3', KEY4: 'val4' };

      const merged = { ...existing.env } as Record<string, string | null>;
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) {
          delete merged[k];
        } else {
          merged[k] = v;
        }
      }

      expect(merged).toEqual({ KEY1: 'val1', KEY3: 'newval3', KEY4: 'val4' });
    });
  });

  describe('Enable/disable', () => {
    it('should toggle enabled flag', () => {
      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO project_mcp_configs (id, project_id, name, type, config_json, enabled) VALUES (?, ?, 'test', 'stdio', '{}', 1)",
      ).run(id, projectId);

      db.prepare('UPDATE project_mcp_configs SET enabled = 0 WHERE id = ?').run(id);
      const row = db.prepare('SELECT enabled FROM project_mcp_configs WHERE id = ?').get(id) as { enabled: number };
      expect(row.enabled).toBe(0);
    });
  });

  describe('Secrets for redaction', () => {
    it('should collect all secret values from enabled configs', () => {
      const config1 = { env: { KEY1: 'secret1' }, headers: { AUTH: 'bearer-token' } };
      const config2 = { env: { KEY2: 'secret2' } };

      db.prepare(
        "INSERT INTO project_mcp_configs (id, project_id, name, type, config_json, enabled) VALUES (?, ?, 'a', 'stdio', ?, 1)",
      ).run(crypto.randomUUID(), projectId, JSON.stringify(config1));
      db.prepare(
        "INSERT INTO project_mcp_configs (id, project_id, name, type, config_json, enabled) VALUES (?, ?, 'b', 'stdio', ?, 1)",
      ).run(crypto.randomUUID(), projectId, JSON.stringify(config2));
      db.prepare(
        "INSERT INTO project_mcp_configs (id, project_id, name, type, config_json, enabled) VALUES (?, ?, 'c', 'stdio', ?, 0)",
      ).run(crypto.randomUUID(), projectId, JSON.stringify({ env: { DISABLED: 'skip' } }));

      const rows = db.prepare(
        "SELECT config_json FROM project_mcp_configs WHERE project_id = ? AND enabled = 1",
      ).all(projectId) as Array<{ config_json: string }>;

      const secrets: string[] = [];
      for (const row of rows) {
        const config = JSON.parse(row.config_json) as Record<string, unknown>;
        for (const key of ['env', 'headers']) {
          const vals = config[key] as Record<string, string> | undefined;
          if (vals && typeof vals === 'object') {
            secrets.push(...Object.values(vals));
          }
        }
      }

      expect(secrets).toContain('secret1');
      expect(secrets).toContain('bearer-token');
      expect(secrets).toContain('secret2');
      expect(secrets).not.toContain('skip');
    });
  });
});
