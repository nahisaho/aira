import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import archiver from 'archiver';
import { getDatabase } from '../db/index.js';
import * as pathConfig from '../config/paths.js';
import {
  resolveFilePath,
  isOpenAllowed,
  reconcileProjectFiles,
  FilePathError,
} from '../services/file.service.js';

const fileRoutes = new Hono();

function getWorkspaceDir(projectId: string): string {
  return pathConfig.getWorkspaceDir(projectId);
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
    const ext = path.extname(filename).toLowerCase();

    // Serve PDFs inline so the browser's built-in viewer can render them
    const inlineTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
    };
    const contentType = inlineTypes[ext];
    if (contentType) {
      return new Response(content, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${filename.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }

    const asciiName = filename.replace(/[^\x20-\x7E]/g, '_');
    return new Response(content, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
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

// POST /api/projects/:id/files/upload — upload files to workspace
fileRoutes.post('/api/projects/:id/files/upload', async (c) => {
  const projectId = c.req.param('id');
  const workspaceDir = getWorkspaceDir(projectId);

  // Ensure workspace exists
  fs.mkdirSync(workspaceDir, { recursive: true });

  const body = await c.req.parseBody({ all: true });
  const rawFiles = body['files'];

  if (!rawFiles) {
    return c.json({ error: 'No files provided' }, 400);
  }

  const fileList = Array.isArray(rawFiles) ? rawFiles : [rawFiles];
  const uploaded: string[] = [];
  const db = getDatabase();

  const upsertStmt = db.prepare(`
    INSERT INTO project_files (id, project_id, filename, file_path, size_bytes, mtime_ms, source)
    VALUES (?, ?, ?, ?, ?, ?, 'upload')
    ON CONFLICT(project_id, file_path) DO UPDATE SET
      size_bytes = excluded.size_bytes,
      mtime_ms = excluded.mtime_ms,
      source = 'upload',
      updated_at = CURRENT_TIMESTAMP
  `);

  for (const file of fileList) {
    if (!(file instanceof File)) continue;
    const filename = file.name.replace(/[\/\\:<>"|?*\x00-\x1f]/g, '_');
    const dest = path.join(workspaceDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    uploaded.push(filename);

    const stat = fs.statSync(dest);
    const id = crypto.randomUUID();
    upsertStmt.run(id, projectId, filename, filename, stat.size, Math.round(stat.mtimeMs));
  }

  return c.json({ uploaded, count: uploaded.length });
});

// GET /api/projects/:id/files/download-all — download all files as zip
fileRoutes.get('/api/projects/:id/files/download-all', (c) => {
  const projectId = c.req.param('id');
  const workspaceDir = getWorkspaceDir(projectId);

  if (!fs.existsSync(workspaceDir)) {
    return c.json({ error: 'Workspace not found' }, 404);
  }

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.glob('**/*', {
    cwd: workspaceDir,
    ignore: ['.git/**', '.github/**', 'AGENTS.md'],
    dot: false,
  });
  archive.finalize();

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  archive.on('data', (chunk: Buffer) => writer.write(chunk));
  archive.on('end', () => writer.close());
  archive.on('error', () => writer.close());

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="project-files.zip"`,
    },
  });
});

// POST /api/projects/:id/files/reconcile — manual scan trigger
fileRoutes.post('/api/projects/:id/files/reconcile', (c) => {
  const projectId = c.req.param('id');
  const workspaceDir = getWorkspaceDir(projectId);

  if (!fs.existsSync(workspaceDir)) {
    return c.json({ error: 'Workspace not found' }, 404);
  }

  const db = getDatabase();
  reconcileProjectFiles(projectId, db);

  const count = db.prepare(
    'SELECT COUNT(*) as cnt FROM project_files WHERE project_id = ?',
  ).get(projectId) as { cnt: number };

  return c.json({ status: 'reconciled', fileCount: count.cnt });
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
