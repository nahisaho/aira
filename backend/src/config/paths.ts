/**
 * Centralized runtime paths configuration.
 * All storage paths flow through this module so they can be
 * overridden for Electron (app.getPath('userData')) or testing.
 */
import path from 'node:path';

let _baseDir = process.cwd();

/** Set the base directory for all data storage. Call before backend startup. */
export function setBaseDir(dir: string): void {
  _baseDir = dir;
}

/** Get the base directory for all data storage. */
export function getBaseDir(): string {
  return _baseDir;
}

/** Directory for database and temp files. */
export function getDataDir(): string {
  return path.join(_baseDir, 'data');
}

/** Directory for project workspaces. */
export function getProjectsDir(): string {
  return path.join(_baseDir, 'projects');
}

/** Workspace directory for a specific project. */
export function getWorkspaceDir(projectId: string): string {
  return path.join(_baseDir, 'projects', projectId, 'workspace');
}

/** Temp directory inside data. */
export function getTmpDir(): string {
  return path.join(_baseDir, 'data', '.tmp');
}
