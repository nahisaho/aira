import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../db/index.js';
import * as pathConfig from '../config/paths.js';

export interface McpConfig {
  id: string;
  project_id: string;
  name: string;
  type: 'stdio' | 'sse';
  config_json: string;
  enabled: number;
  builtin: number;
  preset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface McpConfigParsed extends Omit<McpConfig, 'config_json'> {
  config: Record<string, unknown>;
}

const SECRET_MASK = '***';

/** Built-in MCP servers seeded into every project */
const BUILTIN_MCP_CONFIGS = [
  {
    name: 'tooluniverse',
    type: 'stdio' as const,
    config: {
      command: 'python',
      args: ['-m', 'tooluniverse.mcp_server'],
      env: {},
      description: 'ToolUniverse MCP server providing access to 100+ scientific database APIs including PubMed, ChEMBL, Ensembl, UniProt, STRING, Reactome, GDC, DepMap, and more.',
      url: 'https://github.com/mims-harvard/ToolUniverse',
    },
  },
  {
    name: 'microsoft-learn',
    type: 'sse' as const,
    config: {
      url: 'https://learn.microsoft.com/api/mcp',
      description: 'Microsoft Learn MCP Server — search Microsoft docs, fetch articles, and find code samples. No authentication required.',
    },
  },
  {
    name: 'azure-mcp',
    type: 'stdio' as const,
    config: {
      command: 'npx',
      args: ['-y', '@azure/mcp@latest'],
      env: {},
      description: 'Azure MCP Server — interact with Azure resources using natural language. Supports Azure CLI, azd, storage, databases, KQL, and more. Requires Azure login (az login).',
      url: 'https://github.com/microsoft/mcp',
    },
  },
];

/**
 * Seed built-in MCP configs for a specific project.
 * Idempotent — skips if already present.
 */
export function seedBuiltinMcpForProject(projectId: string): void {
  const db = getDatabase();

  // Ensure builtin column exists
  try {
    db.exec('ALTER TABLE project_mcp_configs ADD COLUMN builtin INTEGER NOT NULL DEFAULT 0');
  } catch {
    // Column already exists
  }

  for (const mcp of BUILTIN_MCP_CONFIGS) {
    const existing = db.prepare(
      'SELECT id FROM project_mcp_configs WHERE project_id = ? AND name = ? AND builtin = 1',
    ).get(projectId, mcp.name);
    if (existing) continue;

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO project_mcp_configs (id, project_id, name, type, config_json, enabled, builtin)
       VALUES (?, ?, ?, ?, ?, 1, 1)`,
    ).run(id, projectId, mcp.name, mcp.type, JSON.stringify(mcp.config));
  }
}

/**
 * Seed built-in MCP configs for ALL existing projects.
 */
export function seedBuiltinMcpAll(): void {
  const db = getDatabase();

  // Ensure builtin column exists
  try {
    db.exec('ALTER TABLE project_mcp_configs ADD COLUMN builtin INTEGER NOT NULL DEFAULT 0');
  } catch {
    // Column already exists
  }

  const projects = db.prepare('SELECT id FROM projects').all() as Array<{ id: string }>;
  for (const project of projects) {
    seedBuiltinMcpForProject(project.id);
  }
}

export class McpService {
  list(projectId: string): McpConfigParsed[] {
    const db = getDatabase();
    const rows = db.prepare(
      'SELECT * FROM project_mcp_configs WHERE project_id = ? ORDER BY name ASC',
    ).all(projectId) as McpConfig[];

    return rows.map(r => this.maskSecrets(r));
  }

  getById(id: string): McpConfigParsed | undefined {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM project_mcp_configs WHERE id = ?').get(id) as McpConfig | undefined;
    return row ? this.maskSecrets(row) : undefined;
  }

  create(projectId: string, name: string, type: 'stdio' | 'sse', config: Record<string, unknown>, presetId?: string): McpConfigParsed {
    const db = getDatabase();
    const id = crypto.randomUUID();

    db.prepare(
      `INSERT INTO project_mcp_configs (id, project_id, name, type, config_json, enabled, preset_id)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    ).run(id, projectId, name, type, JSON.stringify(config), presetId ?? null);

    return this.getById(id)!;
  }

  /**
   * PATCH update with secret-aware merge semantics.
   * - Key omitted → keep existing
   * - Key = null → delete
   * - Key = "***" → reject (400)
   * - Key = string → overwrite
   */
  update(id: string, patch: Record<string, unknown>): McpConfigParsed {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM project_mcp_configs WHERE id = ?').get(id) as McpConfig | undefined;
    if (!existing) throw new McpNotFoundError(id);

    const existingConfig = JSON.parse(existing.config_json) as Record<string, unknown>;

    // Merge with secret semantics for env and headers
    for (const secretKey of ['env', 'headers']) {
      if (secretKey in patch) {
        const patchVal = patch[secretKey] as Record<string, string | null> | null | undefined;

        if (patchVal === null) {
          delete existingConfig[secretKey];
          continue;
        }

        if (patchVal && typeof patchVal === 'object') {
          const existing_secrets = (existingConfig[secretKey] ?? {}) as Record<string, string>;

          for (const [k, v] of Object.entries(patchVal)) {
            if (v === SECRET_MASK) {
              throw new MaskedValueError(secretKey, k);
            }
            if (v === null) {
              delete existing_secrets[k];
            } else {
              existing_secrets[k] = v;
            }
          }

          existingConfig[secretKey] = existing_secrets;
        }

        delete patch[secretKey];
      }
    }

    // Merge non-secret fields
    const merged = { ...existingConfig, ...patch };

    db.prepare(
      'UPDATE project_mcp_configs SET config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).run(JSON.stringify(merged), id);

    if ('name' in patch && typeof patch.name === 'string') {
      db.prepare('UPDATE project_mcp_configs SET name = ? WHERE id = ?').run(patch.name, id);
    }
    if ('enabled' in patch && typeof patch.enabled === 'number') {
      db.prepare('UPDATE project_mcp_configs SET enabled = ? WHERE id = ?').run(patch.enabled, id);
    }

    return this.getById(id)!;
  }

  toggle(id: string, enabled: boolean): void {
    const db = getDatabase();
    db.prepare('UPDATE project_mcp_configs SET enabled = ? WHERE id = ?').run(
      enabled ? 1 : 0,
      id,
    );
  }

  delete(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM project_mcp_configs WHERE id = ?').run(id);
  }

  /**
   * Get secrets for redaction (all env/headers values across project configs).
   */
  getSecretsForRedaction(projectId: string): string[] {
    const db = getDatabase();
    const rows = db.prepare(
      "SELECT config_json FROM project_mcp_configs WHERE project_id = ? AND enabled = 1",
    ).all(projectId) as Array<{ config_json: string }>;

    const secrets: string[] = [];
    for (const row of rows) {
      const config = JSON.parse(row.config_json) as Record<string, unknown>;
      for (const key of ['env', 'headers']) {
        const vals = config[key] as Record<string, string> | undefined;
        if (vals && typeof vals === 'object') {
          secrets.push(...Object.values(vals).filter(v => typeof v === 'string' && v.length > 0));
        }
      }
    }
    return secrets;
  }

  /**
   * Generate a temporary MCP config file for agent execution.
   */
  generateTempConfig(projectId: string): string | null {
    const db = getDatabase();
    const rows = db.prepare(
      "SELECT * FROM project_mcp_configs WHERE project_id = ? AND enabled = 1",
    ).all(projectId) as McpConfig[];

    if (rows.length === 0) return null;

    const mcpConfig: Record<string, unknown> = {};
    for (const row of rows) {
      const config = JSON.parse(row.config_json);
      mcpConfig[row.name] = { type: row.type, ...config };
    }

    const tmpDir = pathConfig.getTmpDir();
    fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 });

    const tmpFile = path.join(tmpDir, `mcp-${crypto.randomUUID()}.json`);

    if (process.platform !== 'win32') {
      const fd = fs.openSync(tmpFile, 'w', 0o600);
      fs.writeSync(fd, JSON.stringify(mcpConfig, null, 2));
      fs.closeSync(fd);
    } else {
      fs.writeFileSync(tmpFile, JSON.stringify(mcpConfig, null, 2));
    }

    return tmpFile;
  }

  private maskSecrets(row: McpConfig): McpConfigParsed {
    const config = JSON.parse(row.config_json) as Record<string, unknown>;

    for (const key of ['env', 'headers']) {
      const vals = config[key] as Record<string, string> | undefined;
      if (vals && typeof vals === 'object') {
        for (const k of Object.keys(vals)) {
          vals[k] = SECRET_MASK;
        }
      }
    }

    const { config_json: _, ...rest } = row;
    return { ...rest, config };
  }
}

export class McpNotFoundError extends Error {
  constructor(id: string) {
    super(`MCP config not found: ${id}`);
    this.name = 'McpNotFoundError';
  }
}

export class MaskedValueError extends Error {
  field: string;
  key: string;
  constructor(field: string, key: string) {
    super(`Cannot save masked value "***" for ${field}.${key}. Please provide the actual value or omit the field.`);
    this.name = 'MaskedValueError';
    this.field = field;
    this.key = key;
  }
}
