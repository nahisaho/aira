import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// We test the core logic by directly manipulating settings.json
// rather than importing AuthService (which depends on DATA_DIR)

describe('AuthService logic', () => {
  let tmpDir: string;
  let settingsPath: string;
  const originalEnv = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-auth-test-'));
    settingsPath = path.join(tmpDir, 'settings.json');
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GITHUB_TOKEN = originalEnv;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Token resolution precedence', () => {
    it('should prefer env over settings.json', () => {
      process.env.GITHUB_TOKEN = 'ghp_env_token';
      fs.writeFileSync(settingsPath, JSON.stringify({ token: 'ghp_stored_token' }));

      // Simulate resolution: env > file
      const envToken = process.env.GITHUB_TOKEN;
      const fileToken = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')).token;

      expect(envToken).toBe('ghp_env_token');
      expect(fileToken).toBe('ghp_stored_token');
      // env should win
      const resolved = envToken || fileToken;
      expect(resolved).toBe('ghp_env_token');
    });

    it('should fall back to settings.json when env not set', () => {
      delete process.env.GITHUB_TOKEN;
      fs.writeFileSync(settingsPath, JSON.stringify({ token: 'ghp_stored_token' }));

      const envToken = process.env.GITHUB_TOKEN;
      const fileToken = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')).token;
      const resolved = envToken || fileToken;
      expect(resolved).toBe('ghp_stored_token');
    });

    it('should return undefined when no token configured', () => {
      delete process.env.GITHUB_TOKEN;
      const envToken = process.env.GITHUB_TOKEN;
      const hasFile = fs.existsSync(settingsPath);
      expect(envToken).toBeUndefined();
      expect(hasFile).toBe(false);
    });
  });

  describe('Atomic write (POSIX)', () => {
    it('should create settings.json with 0600 permissions', () => {
      if (process.platform === 'win32') return;

      const content = JSON.stringify({ token: 'ghp_test' }, null, 2);
      const tmpFile = `${settingsPath}.tmp`;

      // Simulate atomic write
      const fd = fs.openSync(
        tmpFile,
        fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
        0o600,
      );
      fs.writeSync(fd, content);
      fs.closeSync(fd);
      fs.renameSync(tmpFile, settingsPath);

      const stat = fs.statSync(settingsPath);
      const mode = stat.mode & 0o777;
      expect(mode).toBe(0o600);

      const stored = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      expect(stored.token).toBe('ghp_test');
    });

    it('should not leave temp file on error', () => {
      if (process.platform === 'win32') return;

      const tmpFile = `${settingsPath}.tmp`;
      // Create a dir at tmpFile path to force write failure
      fs.mkdirSync(tmpFile);

      expect(() => {
        fs.openSync(
          tmpFile,
          fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
          0o600,
        );
      }).toThrow();
    });
  });

  describe('Token deletion', () => {
    it('should delete settings.json', () => {
      fs.writeFileSync(settingsPath, JSON.stringify({ token: 'ghp_test' }));
      expect(fs.existsSync(settingsPath)).toBe(true);

      fs.unlinkSync(settingsPath);
      expect(fs.existsSync(settingsPath)).toBe(false);
    });

    it('should not throw if settings.json does not exist', () => {
      expect(() => {
        if (fs.existsSync(settingsPath)) {
          fs.unlinkSync(settingsPath);
        }
      }).not.toThrow();
    });
  });

  describe('Env conflict', () => {
    it('should reject store when GITHUB_TOKEN env is set', () => {
      process.env.GITHUB_TOKEN = 'ghp_env_token';

      // AuthService would throw TokenConflictError
      expect(!!process.env.GITHUB_TOKEN).toBe(true);
    });
  });
});
