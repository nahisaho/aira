import crypto from 'node:crypto';
import { getDatabase } from '../db/index.js';

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  repo_url: string;
  local_path: string;
  status: 'available' | 'importing' | 'error';
  last_error: string | null;
  created_at: string;
  updated_at: string;
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
    parseGitHubUrl(repoUrl); // Validate URL format
    const id = crypto.randomUUID();
    const localPath = `skills/${id}`;

    db.prepare(
      `INSERT INTO skills (id, name, description, repo_url, local_path, status)
       VALUES (?, ?, NULL, ?, ?, 'importing')`,
    ).run(id, name, repoUrl, localPath);

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
