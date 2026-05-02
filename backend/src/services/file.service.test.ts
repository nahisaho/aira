import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  isOpenAllowed,
  resolveFilePath,
  scanWorkspace,
  FilePathError,
} from './file.service.js';

describe('FileService', () => {
  let tmpDir: string;
  let workspaceDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-file-'));
    workspaceDir = path.join(tmpDir, 'workspace');
    fs.mkdirSync(workspaceDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('isOpenAllowed', () => {
    it('should allow text/code files', () => {
      expect(isOpenAllowed('readme.md')).toBe(true);
      expect(isOpenAllowed('config.json')).toBe(true);
      expect(isOpenAllowed('style.css')).toBe(true);
      expect(isOpenAllowed('app.ts')).toBe(true);
    });

    it('should allow images', () => {
      expect(isOpenAllowed('photo.png')).toBe(true);
      expect(isOpenAllowed('icon.jpg')).toBe(true);
    });

    it('should allow documents', () => {
      expect(isOpenAllowed('report.pdf')).toBe(true);
      expect(isOpenAllowed('data.xlsx')).toBe(true);
    });

    it('should block .js, .html, .svg (execution risk)', () => {
      expect(isOpenAllowed('script.js')).toBe(false);
      expect(isOpenAllowed('page.html')).toBe(false);
      expect(isOpenAllowed('icon.svg')).toBe(false);
    });

    it('should block files without extension', () => {
      expect(isOpenAllowed('Makefile')).toBe(false);
      expect(isOpenAllowed('Dockerfile')).toBe(false);
    });

    it('should handle multi-part extensions', () => {
      expect(isOpenAllowed('archive.tar.gz')).toBe(true);
      expect(isOpenAllowed('config.env.example')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isOpenAllowed('README.MD')).toBe(true);
      expect(isOpenAllowed('photo.PNG')).toBe(true);
    });
  });

  describe('resolveFilePath', () => {
    it('should resolve valid path within workspace', () => {
      const filePath = path.join(workspaceDir, 'test.txt');
      fs.writeFileSync(filePath, 'hello');
      const resolved = resolveFilePath(workspaceDir, 'test.txt');
      expect(resolved).toBe(filePath);
    });

    it('should reject path traversal with ../', () => {
      expect(() => {
        resolveFilePath(workspaceDir, '../../../etc/passwd');
      }).toThrow(FilePathError);
    });

    it('should reject absolute paths outside workspace', () => {
      expect(() => {
        resolveFilePath(workspaceDir, '/etc/passwd');
      }).toThrow(FilePathError);
    });

    it('should reject symlinks', () => {
      const realFile = path.join(tmpDir, 'real.txt');
      fs.writeFileSync(realFile, 'secret');
      const linkPath = path.join(workspaceDir, 'link.txt');
      fs.symlinkSync(realFile, linkPath);

      expect(() => {
        resolveFilePath(workspaceDir, 'link.txt');
      }).toThrow(FilePathError);
    });

    it('should allow nested valid paths', () => {
      const nested = path.join(workspaceDir, 'src', 'main.ts');
      fs.mkdirSync(path.join(workspaceDir, 'src'), { recursive: true });
      fs.writeFileSync(nested, 'code');
      const resolved = resolveFilePath(workspaceDir, 'src/main.ts');
      expect(resolved).toBe(nested);
    });

    it('should handle non-existent files (for create)', () => {
      // Non-existent file in existing directory should work
      const resolved = resolveFilePath(workspaceDir, 'new-file.txt');
      expect(resolved).toBe(path.join(workspaceDir, 'new-file.txt'));
    });
  });

  describe('scanWorkspace', () => {
    it('should scan files in workspace', () => {
      fs.writeFileSync(path.join(workspaceDir, 'file1.txt'), 'hello');
      fs.writeFileSync(path.join(workspaceDir, 'file2.js'), 'code');

      const files = scanWorkspace(workspaceDir);
      expect(files).toHaveLength(2);
      expect(files.map(f => f.relativePath).sort()).toEqual(['file1.txt', 'file2.js']);
    });

    it('should scan nested directories', () => {
      fs.mkdirSync(path.join(workspaceDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(workspaceDir, 'src', 'app.ts'), 'code');

      const files = scanWorkspace(workspaceDir);
      expect(files).toHaveLength(1);
      expect(files[0]!.relativePath).toBe(path.join('src', 'app.ts'));
    });

    it('should skip symlinks', () => {
      const realFile = path.join(tmpDir, 'real.txt');
      fs.writeFileSync(realFile, 'secret');
      fs.symlinkSync(realFile, path.join(workspaceDir, 'link.txt'));
      fs.writeFileSync(path.join(workspaceDir, 'normal.txt'), 'ok');

      const files = scanWorkspace(workspaceDir);
      expect(files).toHaveLength(1);
      expect(files[0]!.relativePath).toBe('normal.txt');
    });

    it('should include file size and hash', () => {
      fs.writeFileSync(path.join(workspaceDir, 'data.txt'), 'test content');

      const files = scanWorkspace(workspaceDir);
      expect(files[0]!.size).toBe(12);
      expect(files[0]!.hash).toHaveLength(64); // SHA-256 hex
    });

    it('should return empty for empty workspace', () => {
      const files = scanWorkspace(workspaceDir);
      expect(files).toHaveLength(0);
    });
  });
});
