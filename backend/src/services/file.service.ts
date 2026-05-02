import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip symlinks (use lstat via Dirent)
      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = fs.lstatSync(fullPath);
          results.push({
            relativePath: path.relative(workspaceDir, fullPath),
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
