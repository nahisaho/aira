import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileRoutes } from './files.js';
import { initializeDatabase, getDatabase, closeDatabase } from '../db/index.js';
import { setBaseDir, getBaseDir, getWorkspaceDir } from '../config/paths.js';

const PROJECT_ID = 'a0000000-0000-0000-0000-000000000001';

describe('Files API — upload size limits', () => {
  let tmpDir: string;
  let originalBaseDir: string;
  let app: Hono;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-files-test-'));
    originalBaseDir = getBaseDir();
    setBaseDir(tmpDir);
    closeDatabase();
    await initializeDatabase();

    app = new Hono();
    app.route('/', fileRoutes);

    const db = getDatabase();
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(PROJECT_ID, 'Upload Test');

    // Lower the caps so the tests don't have to allocate huge buffers.
    process.env.AIRA_MAX_UPLOAD_FILE_BYTES = '1024';      // 1 KB per file
    process.env.AIRA_MAX_UPLOAD_TOTAL_BYTES = '2048';     // 2 KB total
  });

  afterEach(() => {
    delete process.env.AIRA_MAX_UPLOAD_FILE_BYTES;
    delete process.env.AIRA_MAX_UPLOAD_TOTAL_BYTES;
    closeDatabase();
    setBaseDir(originalBaseDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function buildUpload(files: Array<{ name: string; size: number }>): FormData {
    const form = new FormData();
    for (const f of files) {
      // Fill with zeros — content doesn't matter for size checks.
      const blob = new Blob([new Uint8Array(f.size)], { type: 'application/octet-stream' });
      form.append('files', blob, f.name);
    }
    return form;
  }

  it('accepts a file within the per-file and total limits', async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/files/upload`, {
      method: 'POST',
      body: buildUpload([{ name: 'small.txt', size: 100 }]),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploaded).toEqual(['small.txt']);

    // File actually written
    const written = fs.statSync(path.join(getWorkspaceDir(PROJECT_ID), 'small.txt'));
    expect(written.size).toBe(100);
  });

  it('rejects a file that exceeds the per-file limit with 413', async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/files/upload`, {
      method: 'POST',
      body: buildUpload([{ name: 'big.bin', size: 2048 }]), // > 1024
    });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe('file_too_large');
    expect(body.filename).toBe('big.bin');

    // Nothing should be written
    expect(fs.existsSync(path.join(getWorkspaceDir(PROJECT_ID), 'big.bin'))).toBe(false);
  });

  it('rejects when the cumulative total exceeds the limit (413)', async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/files/upload`, {
      method: 'POST',
      body: buildUpload([
        { name: 'a.bin', size: 1024 },
        { name: 'b.bin', size: 1024 },
        { name: 'c.bin', size: 1 }, // 2049 total, > 2048
      ]),
    });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe('upload_total_too_large');

    // No partial writes
    const ws = getWorkspaceDir(PROJECT_ID);
    expect(fs.existsSync(path.join(ws, 'a.bin'))).toBe(false);
    expect(fs.existsSync(path.join(ws, 'b.bin'))).toBe(false);
    expect(fs.existsSync(path.join(ws, 'c.bin'))).toBe(false);
  });

  it('accepts multiple files when within all limits', async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/files/upload`, {
      method: 'POST',
      body: buildUpload([
        { name: 'a.bin', size: 500 },
        { name: 'b.bin', size: 500 },
      ]),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
  });

  describe('v3.2.0 dest=data/raw', () => {
    it('uploads to data/raw/ when dest is allowlisted', async () => {
      const form = new FormData();
      form.append('files', new Blob([new Uint8Array(200)]), 'measurement.csv');
      form.append('dest', 'data/raw');
      const res = await app.request(`/api/projects/${PROJECT_ID}/files/upload`, {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.uploaded[0]).toBe('data/raw/measurement.csv');

      const filePath = path.join(getWorkspaceDir(PROJECT_ID), 'data', 'raw', 'measurement.csv');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('rejects an arbitrary dest with 400', async () => {
      const form = new FormData();
      form.append('files', new Blob([new Uint8Array(10)]), 'x.txt');
      form.append('dest', '../../etc/passwd');
      const res = await app.request(`/api/projects/${PROJECT_ID}/files/upload`, {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('invalid_dest');
    });
  });
});
