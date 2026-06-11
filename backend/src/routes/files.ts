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

  // Always reconcile so subdirectory files are included
  reconcileProjectFiles(projectId, db);

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
    const stat = fs.statSync(resolved);
    const MAX_VIEW_SIZE = 5 * 1024 * 1024; // 5MB
    if (stat.size > MAX_VIEW_SIZE) {
      return c.json({ error: 'File too large for inline view', size: stat.size, limit: MAX_VIEW_SIZE }, 413);
    }
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

    // Serve PDFs and images inline so the browser's built-in viewer can render them
    const inlineTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
    };
    const contentType = inlineTypes[ext];
    const safeAsciiName = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    if (contentType) {
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'X-Content-Type-Options': 'nosniff',
      };
      // SVG can contain scripts; restrict with CSP so scripts won't run
      // even if the URL is opened directly in the browser
      if (ext === '.svg') {
        headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'";
      }
      return new Response(content, { headers });
    }

    return new Response(content, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    if (err instanceof FilePathError) {
      return c.json({ error: err.code }, 403);
    }
    return c.json({ error: 'File not found' }, 404);
  }
});

// GET /api/projects/:id/files/raw?path=<relpath> — serve a workspace file inline
// by its relative path (v3.11.1). Used to embed images (e.g. figures/roc.png)
// referenced from markdown in the file viewer. Image/PDF types only.
fileRoutes.get('/api/projects/:id/files/raw', (c) => {
  const projectId = c.req.param('id');
  const relPath = c.req.query('path');
  if (!relPath) return c.json({ error: 'path query required' }, 400);

  const workspaceDir = getWorkspaceDir(projectId);
  try {
    const resolved = resolveFilePath(workspaceDir, relPath);
    const content = fs.readFileSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const inlineTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
    };
    const contentType = inlineTypes[ext];
    if (!contentType) return c.json({ error: 'Unsupported media type' }, 415);

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=60',
    };
    // SVG can carry scripts; lock it down even if opened directly.
    if (ext === '.svg') headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'";
    return new Response(content, { headers });
  } catch (err) {
    if (err instanceof FilePathError) return c.json({ error: err.code }, 403);
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

// Memory-safety caps so a single upload request cannot exhaust the backend.
// Read at request time so tests can lower the limits without re-importing.
function getUploadLimits(): { perFile: number; total: number } {
  return {
    perFile: parseInt(process.env.AIRA_MAX_UPLOAD_FILE_BYTES ?? String(100 * 1024 * 1024), 10),
    total: parseInt(process.env.AIRA_MAX_UPLOAD_TOTAL_BYTES ?? String(500 * 1024 * 1024), 10),
  };
}

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

  // v3.2.0 — optional `dest` allows uploading directly into a subdirectory
  // such as `data/raw/`. Only allowlisted destinations are accepted to keep
  // the workspace layout predictable.
  const destRaw = body['dest'];
  const destStr = typeof destRaw === 'string' ? destRaw : '';
  const ALLOWED_DESTS = new Set(['', 'data/raw']);
  if (!ALLOWED_DESTS.has(destStr)) {
    return c.json({
      error: 'invalid_dest',
      allowed: Array.from(ALLOWED_DESTS).filter(Boolean),
    }, 400);
  }
  const targetDir = destStr ? path.join(workspaceDir, destStr) : workspaceDir;
  fs.mkdirSync(targetDir, { recursive: true });

  const fileList = Array.isArray(rawFiles) ? rawFiles : [rawFiles];
  const uploaded: string[] = [];
  const db = getDatabase();

  // Size-limit gate (reject before any disk write). Counted from File.size,
  // which is set by the parseBody multipart parser, so we don't have to read
  // the body into memory just to measure it.
  const limits = getUploadLimits();
  let totalBytes = 0;
  for (const file of fileList) {
    if (!(file instanceof File)) continue;
    if (file.size > limits.perFile) {
      return c.json({
        error: 'file_too_large',
        filename: file.name,
        size: file.size,
        limit: limits.perFile,
      }, 413);
    }
    totalBytes += file.size;
    if (totalBytes > limits.total) {
      return c.json({
        error: 'upload_total_too_large',
        size: totalBytes,
        limit: limits.total,
      }, 413);
    }
  }

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
    // eslint-disable-next-line no-control-regex -- intentionally strip ASCII control chars from uploaded filenames
    const filename = file.name.replace(/[/\\:<>"|?*\x00-\x1f]/g, '_');
    if (!filename || filename === '.' || filename === '..') continue;
    // Truncate to 200 chars to stay within FS limits, preserving extension
    const MAX_NAME = 200;
    let safeName = filename;
    if (Buffer.byteLength(safeName) > MAX_NAME) {
      const ext = path.extname(safeName);
      const base = safeName.slice(0, MAX_NAME - ext.length);
      safeName = base + ext;
    }
    const dest = path.join(targetDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    // The file_path stored in DB is the workspace-relative path so listings
    // / downloads work regardless of where the file lives under workspace.
    const relPath = destStr ? `${destStr}/${safeName}` : safeName;
    uploaded.push(relPath);

    const stat = fs.statSync(dest);
    const id = crypto.randomUUID();
    upsertStmt.run(id, projectId, safeName, relPath, stat.size, Math.round(stat.mtimeMs));
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

  // Every writer promise needs a rejection handler: when the client aborts the
  // download mid-stream the writable side errors, and an unhandled rejection
  // here would crash the whole process.
  archive.on('data', (chunk: Buffer) => {
    writer.write(chunk).catch(() => archive.destroy());
  });
  archive.on('end', () => {
    writer.close().catch(() => { /* client already gone */ });
  });
  archive.on('error', (err) => {
    console.error('[files] archive error:', (err as Error).message);
    writer.abort(err).catch(() => { /* already errored */ });
  });

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
