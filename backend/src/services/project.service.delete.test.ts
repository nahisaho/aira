/**
 * Integration test for ProjectService.delete() — exercises the real fs cleanup.
 *
 * Regression target: v2.7.0 and earlier removed only `projects/<id>/workspace/`
 * and left the parent `projects/<id>/` directory behind as an empty husk,
 * accumulating orphan directories over time.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProjectService } from './project.service.js';
import { initializeDatabase, closeDatabase } from '../db/index.js';
import { setBaseDir, getBaseDir, getProjectsDir, getWorkspaceDir } from '../config/paths.js';

describe('ProjectService.delete() — filesystem cleanup', () => {
  let tmpDir: string;
  let originalBaseDir: string;
  let service: ProjectService;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-project-delete-'));
    originalBaseDir = getBaseDir();
    setBaseDir(tmpDir);
    closeDatabase();
    await initializeDatabase();
    service = new ProjectService();
  });

  afterEach(() => {
    closeDatabase();
    setBaseDir(originalBaseDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes the project parent directory, not just workspace/', () => {
    const project = service.create('cleanup-target');
    const projectDir = path.join(getProjectsDir(), project.id);
    const workspaceDir = getWorkspaceDir(project.id);

    // Sanity: create() should have produced both the parent and workspace dirs
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.existsSync(workspaceDir)).toBe(true);

    // Drop some files inside the workspace to simulate a real project
    fs.writeFileSync(path.join(workspaceDir, 'report.md'), '# hello');
    fs.mkdirSync(path.join(workspaceDir, 'subdir'));
    fs.writeFileSync(path.join(workspaceDir, 'subdir', 'data.csv'), 'a,b\n1,2\n');

    service.delete(project.id);

    // Both the workspace and the parent project directory must be gone.
    expect(fs.existsSync(workspaceDir)).toBe(false);
    expect(fs.existsSync(projectDir)).toBe(false);

    // And the projects root itself should not have an orphan entry for this id.
    const remaining = fs.readdirSync(getProjectsDir());
    expect(remaining).not.toContain(project.id);
  });

  it('is idempotent when the project directory is already missing', () => {
    const project = service.create('missing-dir');
    const projectDir = path.join(getProjectsDir(), project.id);

    // Remove the directory out-of-band before calling delete()
    fs.rmSync(projectDir, { recursive: true, force: true });
    expect(fs.existsSync(projectDir)).toBe(false);

    // Should not throw and should still remove the DB row
    expect(() => service.delete(project.id)).not.toThrow();
    expect(service.getById(project.id)).toBeUndefined();
  });

  it('does not affect sibling project directories', () => {
    const keep = service.create('keep-me');
    const drop = service.create('drop-me');

    service.delete(drop.id);

    expect(fs.existsSync(path.join(getProjectsDir(), drop.id))).toBe(false);
    expect(fs.existsSync(path.join(getProjectsDir(), keep.id))).toBe(true);
    expect(fs.existsSync(getWorkspaceDir(keep.id))).toBe(true);
  });
});
