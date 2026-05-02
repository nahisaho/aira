/**
 * Workspace file watcher using chokidar.
 * Monitors project workspace for file changes and dispatches events via WebSocket.
 */

import chokidar, { type FSWatcher } from 'chokidar';
import path from 'node:path';
import { hashFile, scanWorkspace } from './file.service.js';

export type FileEvent = {
  type: 'file_added' | 'file_modified' | 'file_deleted';
  projectId: string;
  relativePath: string;
  size?: number;
  hash?: string;
};

type EventHandler = (event: FileEvent) => void;

interface WatcherEntry {
  watcher: FSWatcher;
  projectId: string;
  workspaceDir: string;
}

const watchers = new Map<string, WatcherEntry>();
let eventHandler: EventHandler | null = null;

const DEBOUNCE_MS = 500;
const debounceTimers = new Map<string, NodeJS.Timeout>();

/**
 * Set the handler that receives file change events.
 */
export function setFileEventHandler(handler: EventHandler): void {
  eventHandler = handler;
}

/**
 * Start watching a project workspace.
 */
export function startWatching(projectId: string, workspaceDir: string): void {
  if (watchers.has(projectId)) return;

  const watcher = chokidar.watch(workspaceDir, {
    persistent: true,
    ignoreInitial: true,
    depth: 10,
    followSymlinks: false,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/target/**',
      '**/__pycache__/**',
    ],
  });

  watcher
    .on('add', (filePath) => debounceEvent(projectId, workspaceDir, filePath, 'file_added'))
    .on('change', (filePath) => debounceEvent(projectId, workspaceDir, filePath, 'file_modified'))
    .on('unlink', (filePath) => debounceEvent(projectId, workspaceDir, filePath, 'file_deleted'))
    .on('error', (err) => {
      console.error(`[watcher] Error for project ${projectId}:`, (err as Error).message);
    });

  watchers.set(projectId, { watcher, projectId, workspaceDir });
}

/**
 * Stop watching a project workspace.
 */
export async function stopWatching(projectId: string): Promise<void> {
  const entry = watchers.get(projectId);
  if (!entry) return;
  await entry.watcher.close();
  watchers.delete(projectId);

  // Clear any pending debounce timers for this project
  for (const [key, timer] of debounceTimers.entries()) {
    if (key.startsWith(`${projectId}:`)) {
      clearTimeout(timer);
      debounceTimers.delete(key);
    }
  }
}

/**
 * Stop all watchers (for graceful shutdown).
 */
export async function stopAll(): Promise<void> {
  const promises = [...watchers.keys()].map((id) => stopWatching(id));
  await Promise.all(promises);
}

/**
 * Run a reconciliation scan after a run completes.
 * Returns added/modified/deleted file events.
 */
export function reconcile(
  projectId: string,
  workspaceDir: string,
  knownFiles: Map<string, string>,
): FileEvent[] {
  const events: FileEvent[] = [];
  const currentFiles = scanWorkspace(workspaceDir);
  const currentPaths = new Set<string>();

  for (const file of currentFiles) {
    currentPaths.add(file.relativePath);
    const knownHash = knownFiles.get(file.relativePath);
    if (!knownHash) {
      events.push({
        type: 'file_added',
        projectId,
        relativePath: file.relativePath,
        size: file.size,
        hash: file.hash,
      });
    } else if (knownHash !== file.hash) {
      events.push({
        type: 'file_modified',
        projectId,
        relativePath: file.relativePath,
        size: file.size,
        hash: file.hash,
      });
    }
  }

  // Detect deletions
  for (const [relPath] of knownFiles) {
    if (!currentPaths.has(relPath)) {
      events.push({ type: 'file_deleted', projectId, relativePath: relPath });
    }
  }

  return events;
}

function debounceEvent(
  projectId: string,
  workspaceDir: string,
  filePath: string,
  type: FileEvent['type'],
): void {
  const relativePath = path.relative(workspaceDir, filePath);
  const key = `${projectId}:${relativePath}:${type}`;

  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);

  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      if (!eventHandler) return;

      const event: FileEvent = { type, projectId, relativePath };

      if (type !== 'file_deleted') {
        try {
          const hash = hashFile(filePath);
          event.hash = hash;
        } catch {
          // File may have been deleted between event and handler
        }
      }

      eventHandler(event);
    }, DEBOUNCE_MS),
  );
}
