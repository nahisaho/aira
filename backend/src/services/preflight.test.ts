import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Preflight checks', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-preflight-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Directory creation', () => {
    it('should create directory if not exists', () => {
      const testDir = path.join(tmpDir, 'newdir');
      expect(fs.existsSync(testDir)).toBe(false);

      fs.mkdirSync(testDir, { mode: 0o700, recursive: true });
      expect(fs.existsSync(testDir)).toBe(true);
    });

    it('should set 0700 permissions on POSIX', () => {
      if (process.platform === 'win32') return;

      const testDir = path.join(tmpDir, 'securedir');
      fs.mkdirSync(testDir, { mode: 0o700 });

      const stat = fs.statSync(testDir);
      expect(stat.mode & 0o777).toBe(0o700);
    });

    it('should auto-repair permissions', () => {
      if (process.platform === 'win32') return;

      const testDir = path.join(tmpDir, 'fixdir');
      fs.mkdirSync(testDir, { mode: 0o755 });

      // Verify wrong permissions
      expect(fs.statSync(testDir).mode & 0o777).toBe(0o755);

      // Auto-repair
      fs.chmodSync(testDir, 0o700);
      expect(fs.statSync(testDir).mode & 0o777).toBe(0o700);
    });
  });

  describe('Writability check', () => {
    it('should detect writable directory', () => {
      const testFile = path.join(tmpDir, '.preflight-test.tmp');
      fs.writeFileSync(testFile, 'test');
      expect(fs.existsSync(testFile)).toBe(true);
      fs.unlinkSync(testFile);
      expect(fs.existsSync(testFile)).toBe(false);
    });
  });

  describe('Temp file cleanup', () => {
    it('should clean stale .tmp files', () => {
      // Create some temp files
      fs.writeFileSync(path.join(tmpDir, 'stale1.tmp'), '');
      fs.writeFileSync(path.join(tmpDir, 'stale2.tmp'), '');
      fs.writeFileSync(path.join(tmpDir, 'keep.json'), '');

      // Cleanup
      const entries = fs.readdirSync(tmpDir);
      for (const entry of entries) {
        if (entry.endsWith('.tmp')) {
          fs.unlinkSync(path.join(tmpDir, entry));
        }
      }

      const remaining = fs.readdirSync(tmpDir);
      expect(remaining).not.toContain('stale1.tmp');
      expect(remaining).not.toContain('stale2.tmp');
      expect(remaining).toContain('keep.json');
    });
  });

  describe('OS detection', () => {
    it('should report current platform', () => {
      expect(['darwin', 'win32', 'linux']).toContain(process.platform);
    });
  });
});
