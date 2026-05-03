import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDataDir } from '../config/paths.js';

function SETTINGS_PATH(): string { return path.join(getDataDir(), 'settings.json'); }

interface Settings {
  token?: string;
}

export class AuthService {
  /**
   * Resolve GitHub Token with precedence: env > settings.json > undefined
   */
  resolveToken(): string | undefined {
    const envToken = process.env.GITHUB_TOKEN;
    if (envToken) {
      return envToken;
    }
    return this.readStoredToken();
  }

  /**
   * Check if token is available (from any source)
   */
  hasToken(): boolean {
    return this.resolveToken() !== undefined;
  }

  /**
   * Check if token comes from environment variable
   */
  isEnvToken(): boolean {
    return !!process.env.GITHUB_TOKEN;
  }

  /**
   * Store token to settings.json with atomic write and restrictive permissions.
   * Throws if GITHUB_TOKEN env var is set (env takes precedence).
   */
  storeToken(token: string): void {
    if (process.env.GITHUB_TOKEN) {
      throw new TokenConflictError('Cannot store token: GITHUB_TOKEN environment variable is set');
    }

    const settings: Settings = { token };
    const content = JSON.stringify(settings, null, 2);

    if (process.platform === 'win32') {
      this.atomicWriteWindows(content);
    } else {
      this.atomicWritePosix(content);
    }
  }

  /**
   * Delete stored token from settings.json.
   */
  deleteToken(): void {
    const settingsPath = SETTINGS_PATH();
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }
  }

  /**
   * Validate token against GitHub API.
   * Returns true if token is valid, false otherwise.
   */
  async validateToken(): Promise<{ valid: boolean; login?: string; scopes?: string }> {
    const token = this.resolveToken();
    if (!token) {
      return { valid: false };
    }

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'AIRA/1.0',
          Accept: 'application/vnd.github+json',
        },
      });

      if (!response.ok) {
        return { valid: false };
      }

      const data = (await response.json()) as { login?: string };
      const scopes = response.headers.get('x-oauth-scopes') ?? '';

      return { valid: true, login: data.login, scopes };
    } catch {
      return { valid: false };
    }
  }

  private readStoredToken(): string | undefined {
    try {
      const settingsPath = SETTINGS_PATH();
      if (!fs.existsSync(settingsPath)) {
        return undefined;
      }
      const content = fs.readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(content) as Settings;
      return settings.token;
    } catch {
      return undefined;
    }
  }

  /**
   * POSIX: Write to temp file with 0600, then rename atomically.
   * File never exists with default permissions.
   */
  private atomicWritePosix(content: string): void {
    const settingsPath = SETTINGS_PATH();
    const tmpPath = `${settingsPath}.${crypto.randomUUID()}.tmp`;
    const fd = fs.openSync(tmpPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    try {
      fs.writeSync(fd, content);
      fs.closeSync(fd);
      fs.renameSync(tmpPath, settingsPath);
    } catch (err) {
      fs.closeSync(fd);
      try { fs.unlinkSync(tmpPath); } catch { /* cleanup best-effort */ }
      throw err;
    }
  }

  /**
   * Windows: Write to temp file in data/ (already ACL-protected), then rename.
   */
  private atomicWriteWindows(content: string): void {
    const settingsPath = SETTINGS_PATH();
    const tmpPath = path.join(getDataDir(), `settings.${crypto.randomUUID()}.tmp`);
    fs.writeFileSync(tmpPath, content, 'utf-8');
    try {
      fs.renameSync(tmpPath, settingsPath);
    } catch (err) {
      try { fs.unlinkSync(tmpPath); } catch { /* cleanup best-effort */ }
      throw err;
    }
  }
}

export class TokenConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenConflictError';
  }
}

// Re-export for use by other modules
export { SETTINGS_PATH };
