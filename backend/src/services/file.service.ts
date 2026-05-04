import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as pathConfig from '../config/paths.js';

// ─── File Open Allowlist (REQ-FILE-005) ───

const OPEN_ALLOWLIST = [
  // Multi-part extensions first (longest suffix match)
  '.tar.gz',
  '.env.example',
  // Text/Code
  '.txt', '.md', '.json', '.yaml', '.yml', '.toml', '.xml', '.csv', '.log',
  // Programming
  '.ts', '.tsx', '.jsx', '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.rb', '.php', '.swift', '.kt', '.scala', '.sql', '.css', '.scss', '.less',
  '.vue', '.svelte',
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
  // Documents
  '.pdf', '.docx', '.xlsx', '.pptx',
  // Other
  '.zip', '.wasm',
].sort((a, b) => b.length - a.length); // longest first

// Windows reserved names
const WIN_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

/**
 * Check if a file extension is in the open allowlist.
 */
export function isOpenAllowed(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (!lower.includes('.')) return false;
  return OPEN_ALLOWLIST.some(ext => lower.endsWith(ext));
}

/**
 * Resolve and validate a file path within a workspace directory.
 * Returns the resolved absolute path if valid.
 * Throws FilePathError on violations.
 */
export function resolveFilePath(workspaceDir: string, inputPath: string): string {
  // Step 1: Resolve to absolute path
  const candidate = path.resolve(workspaceDir, inputPath);

  // Step 2: Boundary check
  assertWithinBoundary(workspaceDir, candidate);

  // Step 3: Symlink / realpath check (if file exists)
  try {
    const stat = fs.lstatSync(candidate);

    if (stat.isSymbolicLink()) {
      throw new FilePathError('symlink_rejected', 'Symbolic links are not allowed');
    }

    // Verify realpath is also within boundary
    const real = fs.realpathSync(candidate);
    assertWithinBoundary(workspaceDir, real);
  } catch (err) {
    if (err instanceof FilePathError) throw err;
    // File doesn't exist — validate nearest existing ancestor
    validateAncestorPath(workspaceDir, candidate);
  }

  // Step 4: Windows-specific checks
  if (process.platform === 'win32') {
    const basename = path.basename(candidate);
    const nameWithoutExt = basename.replace(/\.[^.]*$/, '');

    if (WIN_RESERVED.test(nameWithoutExt)) {
      throw new FilePathError('reserved_name', `Reserved filename: ${nameWithoutExt}`);
    }

    if (basename.endsWith('.') || basename.endsWith(' ')) {
      throw new FilePathError('invalid_name', 'Filename cannot end with dot or space');
    }
  }

  return candidate;
}

function assertWithinBoundary(baseDir: string, candidate: string): void {
  let rel = path.relative(baseDir, candidate);

  // Windows: case-insensitive comparison
  if (process.platform === 'win32') {
    rel = path.relative(baseDir.toLowerCase(), candidate.toLowerCase());
  }

  if (path.isAbsolute(rel) || rel.startsWith('..')) {
    throw new FilePathError('path_traversal', 'Path escapes workspace boundary');
  }
}

function validateAncestorPath(workspaceDir: string, candidate: string): void {
  let current = path.dirname(candidate);

  while (current !== workspaceDir && current.startsWith(workspaceDir)) {
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        throw new FilePathError('symlink_rejected', 'Ancestor path contains symbolic link');
      }
      // Found existing ancestor — check realpath
      const real = fs.realpathSync(current);
      assertWithinBoundary(workspaceDir, real);
      return;
    } catch (err) {
      if (err instanceof FilePathError) throw err;
      // Ancestor doesn't exist, go up
      current = path.dirname(current);
    }
  }
}

/**
 * Compute SHA-256 hash of a file.
 */
export function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Scan a workspace directory and return file info.
 */
export function scanWorkspace(
  workspaceDir: string,
): Array<{ relativePath: string; size: number; mtimeMs: number; hash: string }> {
  const results: Array<{ relativePath: string; size: number; mtimeMs: number; hash: string }> = [];

  // System instruction directories/files written by AIRA — not user-generated output.
  // These mirror CoreClaw's convention and must not appear in the file panel.
  const SYSTEM_ENTRIES = new Set(['.github', '.git', 'AGENTS.md']);

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      // Skip system instruction files/dirs at any depth when entry name matches
      // (top-level check is sufficient since .github is only at workspace root)
      const relativePath = path.relative(workspaceDir, path.join(dir, entry.name));
      const topSegment = relativePath.split(path.sep)[0];
      if (topSegment && SYSTEM_ENTRIES.has(topSegment)) continue;

      const fullPath = path.join(dir, entry.name);

      // Skip symlinks (use lstat via Dirent)
      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = fs.lstatSync(fullPath);
          results.push({
            relativePath,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            hash: hashFile(fullPath),
          });
        } catch {
          // Skip inaccessible files
        }
      }
    }
  }

  walk(workspaceDir);
  return results;
}

export class FilePathError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'FilePathError';
    this.code = code;
  }
}

/**
 * Reconcile project files: scan workspace and sync with DB.
 * Upserts new/changed files, removes deleted files.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function reconcileProjectFiles(projectId: string, db: any): void {
  const workspaceDir = pathConfig.getWorkspaceDir(projectId);
  if (!fs.existsSync(workspaceDir)) return;

  const scanned = scanWorkspace(workspaceDir);

  const upsertStmt = db.prepare(`
    INSERT INTO project_files (id, project_id, filename, file_path, size_bytes, mtime_ms, content_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, file_path) DO UPDATE SET
      size_bytes = excluded.size_bytes,
      mtime_ms = excluded.mtime_ms,
      content_hash = excluded.content_hash,
      updated_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    for (const file of scanned) {
      const id = crypto.randomUUID();
      const filename = path.basename(file.relativePath);
      upsertStmt.run(id, projectId, filename, file.relativePath, file.size, file.mtimeMs, file.hash);
    }

    const scannedPaths = new Set(scanned.map(f => f.relativePath));
    const dbFiles = db.prepare(
      'SELECT id, file_path FROM project_files WHERE project_id = ?',
    ).all(projectId) as Array<{ id: string; file_path: string }>;

    for (const dbFile of dbFiles) {
      if (!scannedPaths.has(dbFile.file_path)) {
        db.prepare('DELETE FROM project_files WHERE id = ?').run(dbFile.id);
      }
    }
  })();
}
