import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../db/index.js';
import { getBaseDir } from '../config/paths.js';

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  source_url: string | null;
  skill_path: string;
  status: 'available' | 'importing' | 'error';
  builtin: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/** Built-in skills bundled with AIRA */
const BUILTIN_SKILLS = [
  {
    slug: 'co-scientist',
    name: 'co-scientist',
    description: 'Harness-optimized collaborative research partner suite covering literature review, experimental design, data analysis, academic writing, peer review, reproducibility, and presentation with full Orchestrator routing and verification loops.',
    repo_url: 'https://github.com/nahisaho/coreclaw-marketplace/tree/main/coreclaw-skills-hub/skills/co-scientist',
  },
  {
    slug: 'spread1000-assistant',
    name: 'spread1000-builder',
    description: '文部科学省 AI for Science 萌芽的挑戦研究創出事業（SPReAD）公募支援スイート。研究プラン策定から Azure 構築・申請書作成・応募手続きまで 12 の専門サブスキルで支援。',
    repo_url: 'https://github.com/nahisaho/spread1000-builder/tree/main/src',
  },
];

/**
 * Seed built-in skills into the DB on startup.
 * Idempotent — skips if already present.
 */
export function seedBuiltinSkills(): void {
  const db = getDatabase();
  // skills/ lives at the monorepo root.
  // In local dev, cwd is backend/ so root = ../
  // In Docker, cwd is /app and skills/ is /app/skills/
  const baseDir = getBaseDir();
  const projectRoot = fs.existsSync(path.join(baseDir, 'skills')) ? baseDir
    : path.resolve(baseDir, '..');

  // Ensure builtin column exists
  try {
    db.exec('ALTER TABLE skills ADD COLUMN builtin INTEGER NOT NULL DEFAULT 0');
  } catch {
    // Column already exists
  }

  for (const skill of BUILTIN_SKILLS) {
    const skillPath = path.join(projectRoot, 'skills', skill.slug);

    // Check by display name (not slug) to handle slug renames
    const existing = db.prepare('SELECT id FROM skills WHERE name = ? AND builtin = 1').get(skill.name) as { id: string } | undefined;
    if (existing) {
      // Update path in case the slug (directory name) was renamed
      db.prepare('UPDATE skills SET skill_path = ? WHERE id = ?').run(skillPath, existing.id);
      continue;
    }

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO skills (id, name, description, source_type, source_url, skill_path, status, builtin)
       VALUES (?, ?, ?, 'local', ?, ?, 'available', 1)`,
    ).run(id, skill.name, skill.description, skill.repo_url, skillPath);
  }
}

/**
 * Validate and parse a GitHub URL.
 * Accepts: https://github.com/{owner}/{repo}[/tree/...]
 */
export function parseGitHubUrl(urlStr: string): { owner: string; repo: string; subpath?: string } {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new InvalidGitHubUrlError(urlStr);
  }

  if (url.hostname !== 'github.com') {
    throw new InvalidGitHubUrlError(urlStr);
  }

  if (url.protocol !== 'https:') {
    throw new InvalidGitHubUrlError(urlStr);
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new InvalidGitHubUrlError(urlStr);
  }

  const owner = segments[0]!;
  const repo = segments[1]!.replace(/\.git$/, '');
  const subpath = segments.length > 3 && segments[2] === 'tree'
    ? segments.slice(3).join('/')
    : undefined;

  return { owner, repo, subpath };
}

export class SkillsService {
  listAll(): Skill[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM skills ORDER BY name ASC').all() as Skill[];
  }

  getById(id: string): Skill | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as Skill | undefined;
  }

  /**
   * Start import of a skill from GitHub URL.
   * Creates DB record with status=importing.
   * Actual download handled separately.
   */
  createImport(name: string, repoUrl: string): Skill {
    const db = getDatabase();
    parseGitHubUrl(repoUrl);
    const id = crypto.randomUUID();
    const skillPath = `skills/${id}`;

    db.prepare(
      `INSERT INTO skills (id, name, description, source_type, source_url, skill_path, status)
       VALUES (?, ?, NULL, 'github', ?, ?, 'importing')`,
    ).run(id, name, repoUrl, skillPath);

    return db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as Skill;
  }

  markAvailable(id: string): void {
    const db = getDatabase();
    db.prepare(
      "UPDATE skills SET status = 'available', last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(id);
  }

  markError(id: string, error: string): void {
    const db = getDatabase();
    db.prepare(
      "UPDATE skills SET status = 'error', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(error, id);
  }

  deleteSkill(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM skills WHERE id = ?').run(id);
  }

  /**
   * Get skills assigned to a project.
   */
  getProjectSkills(projectId: string): Skill[] {
    const db = getDatabase();
    return db.prepare(
      `SELECT s.* FROM skills s
       JOIN project_skills ps ON ps.skill_id = s.id
       WHERE ps.project_id = ?
       ORDER BY s.name ASC`,
    ).all(projectId) as Skill[];
  }

  assignToProject(projectId: string, skillId: string): void {
    const db = getDatabase();
    db.prepare(
      'INSERT OR IGNORE INTO project_skills (project_id, skill_id) VALUES (?, ?)',
    ).run(projectId, skillId);
  }

  unassignFromProject(projectId: string, skillId: string): void {
    const db = getDatabase();
    db.prepare(
      'DELETE FROM project_skills WHERE project_id = ? AND skill_id = ?',
    ).run(projectId, skillId);
  }
}

export class InvalidGitHubUrlError extends Error {
  constructor(url: string) {
    super(`Invalid GitHub URL: ${url}`);
    this.name = 'InvalidGitHubUrlError';
  }
}
