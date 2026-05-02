import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../db/index.js';
import { AuthService } from './auth.service.js';

const PROJECTS_DIR = path.resolve('projects');

export interface PreflightCheck {
  ok: boolean;
  code?: string;
  message?: string;
}

export interface PreflightResult {
  os: PreflightCheck;
  cli: PreflightCheck;
  dataDir: PreflightCheck;
  projectsDir: PreflightCheck;
  token: PreflightCheck;
  allPassed: boolean;
}

let cachedCliPath: string | undefined;

export function getCachedCliPath(): string | undefined {
  return cachedCliPath;
}

/**
 * Run all preflight checks. Some are fatal (cli, dataDir), others are warnings (token).
 */
export function runPreflight(): PreflightResult {
  const osCheck = checkOs();
  const cliCheck = checkCli();
  const dataDirCheck = checkDataDir();
  const projectsDirCheck = checkProjectsDir();
  const tokenCheck = checkToken();

  const allPassed =
    osCheck.ok && cliCheck.ok && dataDirCheck.ok && projectsDirCheck.ok;

  return {
    os: osCheck,
    cli: cliCheck,
    dataDir: dataDirCheck,
    projectsDir: projectsDirCheck,
    token: tokenCheck,
    allPassed,
  };
}

function checkOs(): PreflightCheck {
  const platform = process.platform;
  if (platform === 'darwin' || platform === 'win32' || platform === 'linux') {
    return { ok: true, message: `${platform} (${process.arch})` };
  }
  return { ok: false, code: 'UNSUPPORTED_OS', message: `Unsupported platform: ${platform}` };
}

function checkCli(): PreflightCheck {
  try {
    const result = detectCliCommand();
    if (!result) {
      return { ok: false, code: 'CLI_NOT_FOUND', message: 'GitHub Copilot CLI not found in PATH' };
    }

    cachedCliPath = result.command;
    return { ok: true, message: `Copilot CLI ${result.version} (${result.command})` };
  } catch (err) {
    return {
      ok: false,
      code: 'CLI_NOT_FOUND',
      message: `CLI detection failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

interface CliDetectionResult {
  command: string;
  version: string;
}

function detectCliCommand(): CliDetectionResult | null {
  // Try 'copilot' directly first
  const candidates = process.platform === 'win32'
    ? ['copilot.cmd', 'copilot']
    : ['copilot'];

  for (const cmd of candidates) {
    try {
      const output = execFileSync(cmd, ['--version'], {
        encoding: 'utf-8',
        timeout: 10_000,
        windowsHide: true,
        // Windows .cmd files need shell:true for execFileSync detection,
        // but actual spawn will resolve the exe path directly
        shell: process.platform === 'win32',
      }).trim();

      return { command: cmd, version: output };
    } catch {
      // Try next candidate
    }
  }

  return null;
}

function checkDataDir(): PreflightCheck {
  try {
    // Ensure data/ exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { mode: 0o700, recursive: true });
    }

    // Verify permissions (POSIX only)
    if (process.platform !== 'win32') {
      const stat = fs.statSync(DATA_DIR);
      const mode = stat.mode & 0o777;
      if (mode !== 0o700) {
        try {
          fs.chmodSync(DATA_DIR, 0o700);
        } catch {
          return {
            ok: false,
            code: 'DATA_DIR_PERMS',
            message: `data/ permissions are ${mode.toString(8)}, expected 700. Auto-repair failed.`,
          };
        }
      }
    }

    // Verify writable
    const testFile = path.join(DATA_DIR, `.preflight-${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    // Clean stale temp files
    cleanTempFiles(DATA_DIR);

    return { ok: true, message: 'data/ directory OK' };
  } catch (err) {
    return {
      ok: false,
      code: 'DATA_DIR_ERROR',
      message: `data/ check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function checkProjectsDir(): PreflightCheck {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) {
      fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    }

    // Verify writable
    const testFile = path.join(PROJECTS_DIR, `.preflight-${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    return { ok: true, message: 'projects/ directory OK' };
  } catch (err) {
    return {
      ok: false,
      code: 'PROJECTS_DIR_ERROR',
      message: `projects/ check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function checkToken(): PreflightCheck {
  const authService = new AuthService();
  if (authService.hasToken()) {
    const source = authService.isEnvToken() ? 'environment variable' : 'settings.json';
    return { ok: true, message: `Token configured (${source})` };
  }
  // Token missing is a warning, not a fatal error
  return {
    ok: true,
    code: 'TOKEN_MISSING',
    message: 'GitHub Token not configured. Agent invocation will fail until configured.',
  };
}

function cleanTempFiles(dir: string): void {
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (entry.endsWith('.tmp')) {
        try {
          fs.unlinkSync(path.join(dir, entry));
        } catch {
          // Best-effort cleanup
        }
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

export { PROJECTS_DIR };
