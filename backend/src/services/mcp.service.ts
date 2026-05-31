import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../db/index.js';
import * as pathConfig from '../config/paths.js';
import { getJupyterUrl, getJupyterToken } from './jupyter-server.js';

export interface McpConfig {
  id: string;
  project_id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
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

/**
 * Built-in MCP servers seeded into every project.
 *
 * `enabledForExisting` — when seeding into an *already-created* project at
 * startup, this flag decides whether the MCP is enabled by default. New
 * projects (created after startup) always get every built-in enabled. Used to
 * gradually introduce new built-ins without flipping behavior on running
 * workflows (see jupyter below).
 */
const BUILTIN_MCP_CONFIGS = [
  {
    name: 'tooluniverse',
    type: 'stdio' as const,
    config: {
      command: 'tooluniverse-stdio',
      args: ['--compact-mode', '--transport', 'stdio'],
      env: {},
      description: 'ToolUniverse MCP server providing access to 100+ scientific database APIs including PubMed, ChEMBL, Ensembl, UniProt, STRING, Reactome, GDC, DepMap, and more.',
      url: 'https://github.com/mims-harvard/ToolUniverse',
    },
    enabledForExisting: true,
  },
  {
    name: 'microsoft-learn',
    type: 'sse' as const,
    config: {
      url: 'https://learn.microsoft.com/api/mcp',
      description: 'Microsoft Learn MCP Server — search Microsoft docs, fetch articles, and find code samples. No authentication required.',
    },
    enabledForExisting: true,
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
    enabledForExisting: true,
  },
  {
    name: 'jupyter',
    type: 'stdio' as const,
    config: {
      command: 'jupyter-mcp-server',
      // The --notebook-path arg and JUPYTER_SERVER_URL / JUPYTER_SERVER_TOKEN
      // env vars are injected at runtime in generateTempConfig() because they
      // depend on per-project paths and per-restart credentials.
      args: ['--transport', 'stdio'],
      env: {},
      description: 'Stateful Python execution via a JupyterLab kernel. Use this for data analysis, statistics, ML, plotting, and any multi-step computation that benefits from persistent variables. Each project has its own notebook (notebook.ipynb in the workspace) and kernel; state survives between turns.',
      url: 'https://github.com/datalayer/jupyter-mcp-server',
    },
    // Disabled on existing projects so v2.x users do not see behavior change
    // mid-workflow. Enabled by default on projects created from v3.0.0 onwards.
    enabledForExisting: false,
  },
];

// v3.3.0 Pillar C — pre-seeded notebook template.
//
// Round-9 telemetry showed agents almost never ran `pip freeze` on their own,
// so the env_capture gate failed 100% of the time. Seeding the notebook with
// a header + an env-capture cell makes the gate pass by default and gives the
// agent a starter cell layout to extend.
//
// Cells included:
//   1. markdown header (instructions)
//   2. code: `!pip freeze > requirements.txt` — captures env
//   3. code: `import numpy as np; np.random.seed(42); ...` — seeds the
//      common RNG libraries (cheap; agent may add torch / tf later)
//
// Cell ids are stable so [cell:...] citations in templates / examples stay
// valid across project lifetimes.
const NOTEBOOK_TEMPLATE_JSON = JSON.stringify({
  cells: [
    {
      id: 'aira-header',
      cell_type: 'markdown',
      metadata: {},
      source: [
        '# Project Notebook\n',
        '\n',
        'This notebook is the stateful Python surface for this AIRA project.\n',
        '\n',
        '- Cell `[cell:aira-env]` captures the Python environment (passes the `env_capture` provenance gate).\n',
        '- Cell `[cell:aira-seed]` seeds the common RNG libraries (passes the `seed_presence` gate).\n',
        '- Cite numbers in `report.md` / `paper.md` with `[cell:<id>]` referring to the cell that produced them.\n',
      ],
    },
    {
      id: 'aira-env',
      cell_type: 'code',
      metadata: {},
      execution_count: null,
      outputs: [],
      source: ['# Capture the Python environment for reproducibility.\n', '!pip freeze > requirements.txt\n'],
    },
    {
      id: 'aira-seed',
      cell_type: 'code',
      metadata: {},
      execution_count: null,
      outputs: [],
      source: [
        '# Seed RNG libraries that are present in the environment.\n',
        'import random\n',
        'random.seed(42)\n',
        'try:\n',
        '    import numpy as np\n',
        '    np.random.seed(42)\n',
        'except ImportError:\n',
        '    pass\n',
        'try:\n',
        '    import torch\n',
        '    torch.manual_seed(42)\n',
        'except ImportError:\n',
        '    pass\n',
      ],
    },
  ],
  metadata: {
    kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
    language_info: { name: 'python' },
  },
  nbformat: 4,
  nbformat_minor: 5,
}, null, 2);

// Back-compat alias; existing code paths reference EMPTY_NOTEBOOK_JSON.
const EMPTY_NOTEBOOK_JSON = NOTEBOOK_TEMPLATE_JSON;

/**
 * Seed built-in MCP configs for a specific project.
 * Idempotent — skips if already present.
 *
 * @param opts.isNewProject — true when called from project creation; every
 * built-in is enabled. When false (startup seeding into existing projects),
 * each built-in's `enabledForExisting` decides the default state.
 */
export function seedBuiltinMcpForProject(
  projectId: string,
  opts: { isNewProject?: boolean } = {},
): void {
  const db = getDatabase();
  const isNewProject = opts.isNewProject ?? false;

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

    const enabledByDefault = isNewProject ? true : (mcp.enabledForExisting ?? true);
    const enabled = enabledByDefault ? 1 : 0;

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO project_mcp_configs (id, project_id, name, type, config_json, enabled, builtin)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
    ).run(id, projectId, mcp.name, mcp.type, JSON.stringify(mcp.config), enabled);
  }
}

/**
 * Seed built-in MCP configs for ALL existing projects (called once at startup).
 * Built-ins flagged enabledForExisting=false are inserted in the disabled state
 * so v2.x workflows don't change behavior under their feet.
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
    seedBuiltinMcpForProject(project.id, { isNewProject: false });
  }
}

export class McpService {
  /**
   * Clean up stale MCP temp config files left by crashed processes.
   * Called at startup.
   */
  scavengeStaleConfigs(): void {
    try {
      const tmpDir = pathConfig.getTmpDir();
      if (!fs.existsSync(tmpDir)) return;
      const files = fs.readdirSync(tmpDir);
      let removed = 0;
      for (const f of files) {
        if (f.startsWith('mcp-') && f.endsWith('.json')) {
          try {
            fs.unlinkSync(path.join(tmpDir, f));
            removed++;
          } catch { /* ignore */ }
        }
      }
      if (removed > 0) {
        console.log(`[mcp] scavenged ${removed} stale config file(s)`);
      }
    } catch { /* best effort */ }
  }

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

  create(projectId: string, name: string, type: 'stdio' | 'sse' | 'http', config: Record<string, unknown>, presetId?: string): McpConfigParsed {
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

    const existingConfig = (() => {
      try { return JSON.parse(existing.config_json) as Record<string, unknown>; }
      catch { return {} as Record<string, unknown>; }
    })();

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
            if (['__proto__', 'constructor', 'prototype'].includes(k)) continue;
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

    // Reject prototype pollution keys
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    for (const key of Object.keys(patch)) {
      if (dangerousKeys.includes(key)) {
        delete patch[key];
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
      let config: Record<string, unknown>;
      try { config = JSON.parse(row.config_json) as Record<string, unknown>; }
      catch { continue; }
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
   *
   * Runtime injection for built-ins that need per-run credentials:
   *  - jupyter: injects JUPYTER_SERVER_URL / JUPYTER_SERVER_TOKEN env vars
   *    (regenerated each AIRA restart) and the per-project --notebook-path
   *    flag. Auto-creates an empty notebook on first use so jupyter-mcp-server
   *    has something to attach to.
   */
  generateTempConfig(projectId: string): string | null {
    const db = getDatabase();
    const rows = db.prepare(
      "SELECT * FROM project_mcp_configs WHERE project_id = ? AND enabled = 1",
    ).all(projectId) as McpConfig[];

    if (rows.length === 0) return null;

    const mcpServers: Record<string, unknown> = {};
    for (const row of rows) {
      let config: Record<string, unknown>;
      try { config = JSON.parse(row.config_json); }
      catch { continue; }

      if (row.name === 'jupyter') {
        const injected = injectJupyterRuntime(config, projectId);
        if (!injected) continue; // Jupyter Server not running — skip this entry
        config = injected;
      }

      mcpServers[row.name] = { type: row.type, ...config };
    }

    // Copilot CLI expects { "mcpServers": { ... } }
    const mcpConfig = { mcpServers };

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

  // (helper declared at module level — see injectJupyterRuntime below)

  private maskSecrets(row: McpConfig): McpConfigParsed {
    let config: Record<string, unknown>;
    try { config = JSON.parse(row.config_json) as Record<string, unknown>; }
    catch { config = {}; }

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

/**
 * Inject runtime-only fields into the jupyter MCP config so jupyter-mcp-server
 * connects to AIRA's bundled Jupyter Server and opens the project's notebook.
 *
 * Env var names match jupyter-mcp-server v1.27.2's CLI envvar bindings:
 *   RUNTIME_URL  / RUNTIME_TOKEN  — Jupyter kernel runtime (read by --runtime-*)
 *   DOCUMENT_URL / DOCUMENT_TOKEN — Jupyter document service (same Jupyter
 *     Server in our embedded setup, so values mirror runtime)
 *   DOCUMENT_ID  — notebook path to auto-activate (avoids requiring
 *     `use_notebook` on the first turn for simple cases, though the agent is
 *     still expected to call use_notebook explicitly per the v4.6.1 skill
 *     instructions for clarity)
 *
 * Auto-creates the per-project notebook file on first use so jupyter-mcp-server
 * has a valid document to attach to.
 *
 * Returns null when the Jupyter Server is unavailable, so the caller can skip
 * the jupyter entry instead of handing jupyter-mcp-server a broken config.
 */
function injectJupyterRuntime(
  config: Record<string, unknown>,
  projectId: string,
): Record<string, unknown> | null {
  const url = getJupyterUrl();
  const token = getJupyterToken();
  if (!url || !token) {
    console.warn('[mcp] Jupyter Server is not running; skipping jupyter MCP for this run');
    return null;
  }

  const notebookPath = pathConfig.getNotebookPath(projectId);
  if (!fs.existsSync(notebookPath)) {
    fs.mkdirSync(path.dirname(notebookPath), { recursive: true });
    fs.writeFileSync(notebookPath, EMPTY_NOTEBOOK_JSON, 'utf8');
  }

  const env = { ...((config.env as Record<string, string>) ?? {}) };
  env.RUNTIME_URL = url;
  env.RUNTIME_TOKEN = token;
  env.DOCUMENT_URL = url;
  env.DOCUMENT_TOKEN = token;
  env.DOCUMENT_ID = notebookPath;

  // args stays as ['--transport', 'stdio'] — connection details flow via env.
  // (Earlier v3.0.0/3.0.1 implementations injected `--notebook-path <path>`
  // here, which jupyter-mcp-server rejects as unknown.)
  const args = Array.isArray(config.args) ? [...(config.args as string[])] : [];

  return { ...config, env, args };
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
