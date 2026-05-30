/**
 * Centralized runtime paths configuration.
 * All storage paths flow through this module so they can be
 * overridden for testing.
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

/**
 * Path to the Jupyter notebook for a specific project.
 * The notebook is the stateful Python compute surface introduced in v3.0.0.
 * Lives under workspace/ so it's visible in the file pane and bundled in
 * project ZIP downloads.
 */
export function getNotebookPath(projectId: string): string {
  return path.join(getWorkspaceDir(projectId), 'notebook.ipynb');
}

/** Temp directory inside data. */
export function getTmpDir(): string {
  return path.join(_baseDir, 'data', '.tmp');
}
