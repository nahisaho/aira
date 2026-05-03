import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../db/index.js';
import { getProjectsDir } from '../config/paths.js';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  last_activity: string | null;
  created_at: string;
  updated_at: string;
}

export class ProjectService {
  list(): Project[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Project[];
  }

  getById(id: string): Project | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
  }

  create(name: string, description?: string): Project {
    const db = getDatabase();
    const id = crypto.randomUUID();

    db.prepare(
      'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
    ).run(id, name, description ?? null);

    // Create workspace directory
    const workspaceDir = this.getWorkspacePath(id);
    fs.mkdirSync(workspaceDir, { recursive: true });

    return this.getById(id)!;
  }

  update(id: string, updates: { name?: string; description?: string }): Project {
    const db = getDatabase();
    const project = this.getById(id);
    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    // Check for active runs before rename
    if (updates.name && updates.name !== project.name) {
      this.assertNoActiveRuns(id);
    }

    const fields: string[] = [];
    const values: (string | null)[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.getById(id)!;
  }

  /**
   * Delete project: FS-first, DB-after, 423 on lock/permission failure.
   */
  delete(id: string): void {
    const db = getDatabase();
    const project = this.getById(id);
    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    this.assertNoActiveRuns(id);

    // FS-first: try to delete workspace
    const workspaceDir = this.getWorkspacePath(id);
    if (fs.existsSync(workspaceDir)) {
      try {
        fs.rmSync(workspaceDir, { recursive: true, force: true });
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
          throw new ProjectLockedError(id);
        }
        throw err;
      }
    }

    // DB-after: delete from database
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  updateActivity(id: string): void {
    const db = getDatabase();
    db.prepare('UPDATE projects SET last_activity = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  }

  getWorkspacePath(projectId: string): string {
    return path.join(getProjectsDir(), projectId, 'workspace');
  }

  hasActiveRuns(projectId: string): boolean {
    const db = getDatabase();
    const count = db.prepare(
      "SELECT COUNT(*) as cnt FROM agent_runs WHERE project_id = ? AND status IN ('running', 'queued')",
    ).get(projectId) as { cnt: number };
    return count.cnt > 0;
  }

  private assertNoActiveRuns(id: string): void {
    if (this.hasActiveRuns(id)) {
      throw new ProjectActiveRunError(id);
    }
  }
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project not found: ${id}`);
    this.name = 'ProjectNotFoundError';
  }
}

export class ProjectLockedError extends Error {
  constructor(id: string) {
    super(`Project is locked: ${id}`);
    this.name = 'ProjectLockedError';
  }
}

export class ProjectActiveRunError extends Error {
  constructor(id: string) {
    super(`Project has active runs: ${id}`);
    this.name = 'ProjectActiveRunError';
  }
}
