import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { getDataDir, getBaseDir } from '../config/paths.js';
import { getDatabase } from '../db/index.js';
import { AuthService } from './auth.service.js';

export interface AgentsRepo {
  id: string;
  url: string;
  name: string;
  lastSync: string | null;
  status: 'idle' | 'syncing' | 'error';
  error: string | null;
}

interface AgentsRepoConfig {
  repos: AgentsRepo[];
}

function AGENTS_CONFIG_PATH(): string {
  return path.join(getDataDir(), 'agents-repos.json');
}

function AGENTS_CACHE_DIR(): string {
  return path.join(getBaseDir(), 'agents-cache');
}

function readConfig(): AgentsRepoConfig {
  try {
    const configPath = AGENTS_CONFIG_PATH();
    if (!fs.existsSync(configPath)) return { repos: [] };
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AgentsRepoConfig;
  } catch {
    return { repos: [] };
  }
}

function writeConfig(config: AgentsRepoConfig): void {
  const configPath = AGENTS_CONFIG_PATH();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export class AgentsRepoService {
  listRepos(): AgentsRepo[] {
    return readConfig().repos;
  }

  addRepo(url: string, name?: string): AgentsRepo {
    const config = readConfig();

    // Check for duplicate URL
    if (config.repos.some(r => r.url === url)) {
      throw new DuplicateRepoError(url);
    }

    const repoName = name || this.extractRepoName(url);
    const repo: AgentsRepo = {
      id: crypto.randomUUID(),
      url,
      name: repoName,
      lastSync: null,
      status: 'idle',
      error: null,
    };

    config.repos.push(repo);
    writeConfig(config);
    return repo;
  }

  removeRepo(id: string): void {
    const config = readConfig();
    const idx = config.repos.findIndex(r => r.id === id);
    if (idx === -1) throw new RepoNotFoundError(id);

    const repo = config.repos[idx]!;
    config.repos.splice(idx, 1);
    writeConfig(config);

    // Remove cached clone
    const cacheDir = path.join(AGENTS_CACHE_DIR(), repo.id);
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }

    // Remove skills registered from this repo
    const db = getDatabase();
    db.prepare("DELETE FROM skills WHERE source_type = 'github-agents' AND source_url = ?").run(repo.url);
  }

  /**
   * Clone or pull the repo and register discovered agents as skills.
   */
  syncRepo(id: string): AgentsRepo {
    const config = readConfig();
    const repo = config.repos.find(r => r.id === id);
    if (!repo) throw new RepoNotFoundError(id);

    repo.status = 'syncing';
    repo.error = null;
    writeConfig(config);

    try {
      const cacheDir = path.join(AGENTS_CACHE_DIR(), repo.id);
      this.cloneOrPull(repo.url, cacheDir);
      this.registerAgents(repo, cacheDir);

      repo.lastSync = new Date().toISOString();
      repo.status = 'idle';
      repo.error = null;
      writeConfig(config);
      return repo;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      repo.status = 'error';
      repo.error = msg;
      writeConfig(config);
      throw err;
    }
  }

  /**
   * Sync all configured repos. Called on server start.
   */
  syncAll(): void {
    const config = readConfig();
    for (const repo of config.repos) {
      try {
        this.syncRepo(repo.id);
      } catch {
        // Errors are recorded in repo.error
      }
    }
  }

  private cloneOrPull(url: string, cacheDir: string): void {
    // Inject token for authenticated access to private repos
    const authUrl = this.getAuthenticatedUrl(url);

    if (fs.existsSync(path.join(cacheDir, '.git'))) {
      // Update remote URL with current token and pull
      execFileSync('git', ['-C', cacheDir, 'remote', 'set-url', 'origin', authUrl], {
        timeout: 10_000,
        encoding: 'utf-8',
      });
      execFileSync('git', ['-C', cacheDir, 'pull', '--ff-only'], {
        timeout: 60_000,
        encoding: 'utf-8',
      });
    } else {
      // Fresh clone
      if (!fs.existsSync(AGENTS_CACHE_DIR())) {
        fs.mkdirSync(AGENTS_CACHE_DIR(), { recursive: true });
      }
      execFileSync('git', ['clone', '--depth', '1', authUrl, cacheDir], {
        timeout: 120_000,
        encoding: 'utf-8',
      });
    }
  }

  private getAuthenticatedUrl(url: string): string {
    const authService = new AuthService();
    const token = authService.resolveToken();
    if (!token) return url;

    try {
      const u = new URL(url);
      u.username = 'x-access-token';
      u.password = token;
      return u.toString();
    } catch {
      return url;
    }
  }

  private registerAgents(repo: AgentsRepo, cacheDir: string): void {
    const agentsDir = path.join(cacheDir, 'agents');
    if (!fs.existsSync(agentsDir)) {
      throw new Error(`No 'agents/' directory found in repository: ${repo.url}`);
    }

    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    const agentDirs = entries.filter(e => e.isDirectory());

    const db = getDatabase();

    // Get existing skills from this repo
    const existing = db.prepare(
      "SELECT id, skill_path FROM skills WHERE source_type = 'github-agents' AND source_url = ?"
    ).all(repo.url) as { id: string; skill_path: string }[];
    const existingPaths = new Set(existing.map(e => e.skill_path));

    const discoveredPaths = new Set<string>();

    for (const dir of agentDirs) {
      const agentPath = path.join(agentsDir, dir.name);
      discoveredPaths.add(agentPath);

      if (existingPaths.has(agentPath)) {
        // Already registered — update name/description
        const desc = this.readAgentDescription(agentPath);
        db.prepare(
          "UPDATE skills SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE skill_path = ? AND source_type = 'github-agents'"
        ).run(dir.name, desc, agentPath);
      } else {
        // New agent — insert
        const desc = this.readAgentDescription(agentPath);
        const id = crypto.randomUUID();
        db.prepare(
          `INSERT INTO skills (id, name, description, source_type, source_url, skill_path, status, builtin)
           VALUES (?, ?, ?, 'github-agents', ?, ?, 'available', 0)`
        ).run(id, dir.name, desc, repo.url, agentPath);
      }
    }

    // Remove agents that no longer exist in the repo
    for (const e of existing) {
      if (!discoveredPaths.has(e.skill_path)) {
        db.prepare('DELETE FROM skills WHERE id = ?').run(e.id);
      }
    }
  }

  private readAgentDescription(agentPath: string): string | null {
    // Try reading description from AGENTS.md first line after title
    const agentsMd = path.join(agentPath, 'AGENTS.md');
    if (fs.existsSync(agentsMd)) {
      const content = fs.readFileSync(agentsMd, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      // Skip title line (starts with #), take next non-empty line as description
      const descLine = lines.find(l => !l.startsWith('#'));
      if (descLine) return descLine.trim().slice(0, 500);
    }

    // Try skill.json
    const skillJson = path.join(agentPath, 'skill.json');
    if (fs.existsSync(skillJson)) {
      try {
        const data = JSON.parse(fs.readFileSync(skillJson, 'utf-8'));
        if (data.description) return String(data.description).slice(0, 500);
      } catch { /* ignore */ }
    }

    return null;
  }

  private extractRepoName(url: string): string {
    try {
      const u = new URL(url);
      const segments = u.pathname.split('/').filter(Boolean);
      return segments[segments.length - 1]?.replace(/\.git$/, '') || 'agents';
    } catch {
      return 'agents';
    }
  }
}

export class DuplicateRepoError extends Error {
  constructor(url: string) {
    super(`Repository already registered: ${url}`);
    this.name = 'DuplicateRepoError';
  }
}

export class RepoNotFoundError extends Error {
  constructor(id: string) {
    super(`Repository not found: ${id}`);
    this.name = 'RepoNotFoundError';
  }
}
