import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getDatabase } from '../db/index.js';
import {
  resolveFilePath,
  isOpenAllowed,
  scanWorkspace,
  FilePathError,
} from '../services/file.service.js';

const fileRoutes = new Hono();

function getWorkspaceDir(projectId: string): string {
  return path.resolve('projects', projectId, 'workspace');
}

// GET /api/projects/:id/files — list files
fileRoutes.get('/api/projects/:id/files', (c) => {
  const projectId = c.req.param('id');
  const db = getDatabase();

  const files = db.prepare(
    'SELECT * FROM project_files WHERE project_id = ? ORDER BY file_path ASC',
  ).all(projectId);

  return c.json(files);
});

// GET /api/projects/:id/files/:fileId/view — view file content
fileRoutes.get('/api/projects/:id/files/:fileId/view', (c) => {
  const projectId = c.req.param('id');
  const fileId = c.req.param('fileId');
  const db = getDatabase();

  const file = db.prepare(
    'SELECT * FROM project_files WHERE id = ? AND project_id = ?',
  ).get(fileId, projectId) as { file_path: string } | undefined;

  if (!file) {
    return c.json({ error: 'File not found' }, 404);
  }

  const workspaceDir = getWorkspaceDir(projectId);

  try {
    const resolved = resolveFilePath(workspaceDir, file.file_path);
    const content = fs.readFileSync(resolved, 'utf8');
    return c.json({ content, path: file.file_path });
  } catch (err) {
    if (err instanceof FilePathError) {
      return c.json({ error: err.code }, 403);
    }
    return c.json({ error: 'File not found' }, 404);
  }
});

// GET /api/projects/:id/files/:fileId/download — download file
fileRoutes.get('/api/projects/:id/files/:fileId/download', (c) => {
  const projectId = c.req.param('id');
  const fileId = c.req.param('fileId');
  const db = getDatabase();

  const file = db.prepare(
    'SELECT * FROM project_files WHERE id = ? AND project_id = ?',
  ).get(fileId, projectId) as { file_path: string } | undefined;

  if (!file) {
    return c.json({ error: 'File not found' }, 404);
  }

  const workspaceDir = getWorkspaceDir(projectId);

  try {
    const resolved = resolveFilePath(workspaceDir, file.file_path);
    const content = fs.readFileSync(resolved);
    const filename = path.basename(file.file_path);

    return new Response(content, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof FilePathError) {
      return c.json({ error: err.code }, 403);
    }
    return c.json({ error: 'File not found' }, 404);
  }
});

// POST /api/projects/:id/files/:fileId/open — open with OS default app
fileRoutes.post('/api/projects/:id/files/:fileId/open', (c) => {
  const projectId = c.req.param('id');
  const fileId = c.req.param('fileId');
  const db = getDatabase();

  const file = db.prepare(
    'SELECT * FROM project_files WHERE id = ? AND project_id = ?',
  ).get(fileId, projectId) as { file_path: string } | undefined;

  if (!file) {
    return c.json({ error: 'File not found' }, 404);
  }

  // Check allowlist
  if (!isOpenAllowed(file.file_path)) {
    return c.json({ error: 'blocked_file_type' }, 403);
  }

  const workspaceDir = getWorkspaceDir(projectId);

  try {
    const resolved = resolveFilePath(workspaceDir, file.file_path);

    // Verify file exists
    if (!fs.existsSync(resolved)) {
      return c.json({ error: 'File not found' }, 404);
    }

    openFileWithOs(resolved);
    return c.json({ status: 'opened' });
  } catch (err) {
    if (err instanceof FilePathError) {
      return c.json({ error: err.code }, 403);
    }

    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EBUSY') {
      return c.json({ error: 'resource_busy' }, 423);
    }
    if (code === 'EPERM' && process.platform === 'win32') {
      return c.json({ error: 'resource_busy' }, 423);
    }
    if (code === 'EACCES') {
      return c.json({ error: 'permission_denied' }, 403);
    }

    return c.json({ error: 'Internal server error' }, 500);
  }
});

// DELETE /api/projects/:id/files/:fileId — delete file
fileRoutes.delete('/api/projects/:id/files/:fileId', (c) => {
  const projectId = c.req.param('id');
  const fileId = c.req.param('fileId');
  const db = getDatabase();

  const file = db.prepare(
    'SELECT * FROM project_files WHERE id = ? AND project_id = ?',
  ).get(fileId, projectId) as { file_path: string } | undefined;

  if (!file) {
    return c.json({ error: 'File not found' }, 404);
  }

  const workspaceDir = getWorkspaceDir(projectId);

  try {
    const resolved = resolveFilePath(workspaceDir, file.file_path);
    fs.unlinkSync(resolved);
    db.prepare('DELETE FROM project_files WHERE id = ?').run(fileId);
    return c.body(null, 204);
  } catch (err) {
    if (err instanceof FilePathError) {
      return c.json({ error: err.code }, 403);
    }

    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EBUSY' || (code === 'EPERM' && process.platform === 'win32')) {
      return c.json({ error: 'resource_busy' }, 423);
    }
    if (code === 'EACCES') {
      return c.json({ error: 'permission_denied' }, 403);
    }
    if (code === 'ENOENT') {
      // File already gone from FS, clean up DB
      db.prepare('DELETE FROM project_files WHERE id = ?').run(fileId);
      return c.body(null, 204);
    }

    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/projects/:id/files/reconcile — manual scan trigger
fileRoutes.post('/api/projects/:id/files/reconcile', (c) => {
  const projectId = c.req.param('id');
  const workspaceDir = getWorkspaceDir(projectId);

  if (!fs.existsSync(workspaceDir)) {
    return c.json({ error: 'Workspace not found' }, 404);
  }

  const db = getDatabase();
  const scanned = scanWorkspace(workspaceDir);

  const upsertStmt = db.prepare(`
    INSERT INTO project_files (id, project_id, file_path, size_bytes, mtime_ms, content_hash)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, file_path) DO UPDATE SET
      size_bytes = excluded.size_bytes,
      mtime_ms = excluded.mtime_ms,
      content_hash = excluded.content_hash,
      updated_at = CURRENT_TIMESTAMP
  `);

  const reconcile = db.transaction(() => {
    for (const file of scanned) {
      const id = require('node:crypto').randomUUID();
      upsertStmt.run(id, projectId, file.relativePath, file.size, file.mtimeMs, file.hash);
    }

    // Remove files not in scan
    const scannedPaths = new Set(scanned.map(f => f.relativePath));
    const dbFiles = db.prepare(
      'SELECT id, file_path FROM project_files WHERE project_id = ?',
    ).all(projectId) as Array<{ id: string; file_path: string }>;

    for (const dbFile of dbFiles) {
      if (!scannedPaths.has(dbFile.file_path)) {
        db.prepare('DELETE FROM project_files WHERE id = ?').run(dbFile.id);
      }
    }
  });

  reconcile();

  return c.json({ status: 'reconciled', fileCount: scanned.length });
});

function openFileWithOs(filePath: string): void {
  if (process.platform === 'darwin') {
    spawn('open', ['--', filePath], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'win32') {
    const escaped = filePath.replace(/'/g, "''");
    spawn('powershell.exe', ['-NoProfile', '-Command', `Invoke-Item -LiteralPath '${escaped}'`], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  } else {
    spawn('xdg-open', [filePath], { detached: true, stdio: 'ignore' }).unref();
  }
}

export { fileRoutes };
