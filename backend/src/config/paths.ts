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

/**
 * Execution-trace directory (v3.2.0 Computational Provenance).
 * Hidden under workspace/.trace/ so it does not clutter the File Pane.
 */
export function getTraceDir(projectId: string): string {
  return path.join(getWorkspaceDir(projectId), '.trace');
}

/**
 * JSONL append-only log of notebook snapshots. Each line is one snapshot
 * captured at agent-run completion. Newest at bottom; linter reads the last
 * line for current state but the file is the audit history.
 */
export function getTracePath(projectId: string): string {
  return path.join(getTraceDir(projectId), 'execution-trace.jsonl');
}

/**
 * Per-project raw data directory (v3.2.0 Pillar 4). When this directory has
 * files, the agent is instructed to prefer them over generating mock data.
 */
export function getRawDataDir(projectId: string): string {
  return path.join(getWorkspaceDir(projectId), 'data', 'raw');
}

export function getDataSourcesPath(projectId: string): string {
  return path.join(getWorkspaceDir(projectId), 'data', 'SOURCES.md');
}

/** Temp directory inside data. */
export function getTmpDir(): string {
  return path.join(_baseDir, 'data', '.tmp');
}
