import { AuthService } from './auth.service.js';
import { SkillsService } from './skills.service.js';
import { McpService } from './mcp.service.js';
import { createRedactorWithFlush } from './agent.service.js';
import { startRun, stopRun, clearSession } from './container-runner.js';
import { reconcileProjectFiles } from './file.service.js';
import { getDatabase } from '../db/index.js';
import * as pathConfig from '../config/paths.js';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

export interface ExecContext {
  token: string;
  workspaceDir: string;
  mcpConfigFile: string | null;
  redactSecrets: string[];
  extraEnv: Record<string, string>;
}

const authService = new AuthService();
const skillsService = new SkillsService();
const mcpService = new McpService();

/**
 * Ensure the workspace directory is a valid git repository root.
 *
 * The Copilot CLI discovers instruction files (AGENTS.md,
 * .github/copilot-instructions.md) by walking up the directory tree to find
 * a `.git` marker. Without one in the workspace, the CLI falls through to the
 * AIRA monorepo root and misses the per-project instruction files entirely.
 *
 * Idempotent — skips if `.git/HEAD` already exists.
 */
function ensureWorkspaceRepo(workspaceDir: string): void {
  const gitDir = path.join(workspaceDir, '.git');
  if (fs.existsSync(path.join(gitDir, 'HEAD'))) return;

  fs.mkdirSync(workspaceDir, { recursive: true });
  try {
    execSync('git init --quiet', {
      cwd: workspaceDir,
      stdio: 'pipe',
      timeout: 10_000,
    });
  } catch (err) {
    console.warn('[exec-context] git init failed, creating minimal .git marker:', (err as Error).message);
    // Fallback: create a minimal .git structure that git (and Copilot CLI) will
    // recognise as a repo root, even though it has no real history.
    fs.mkdirSync(gitDir, { recursive: true });
    fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
    fs.mkdirSync(path.join(gitDir, 'objects'), { recursive: true });
    fs.mkdirSync(path.join(gitDir, 'refs'), { recursive: true });
  }
}

/**
 * Recursively copy a directory tree.
 */
function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Sync skill instruction files to the project workspace.
 *
 * Layout follows the Agent Skills specification:
 *   - workspace/.github/copilot-instructions.md   ← custom instructions (auto-loaded by CLI)
 *   - workspace/.github/skills/{name}/SKILL.md    ← agent skills (auto-discovered by CLI)
 *   - workspace/.github/skills/{name}/*           ← scripts/resources (available to skill)
 *   - workspace/.github/agents/{file}.agent.md    ← custom agent definitions
 *   - workspace/AGENTS.md                         ← additional custom instructions
 *
 * The CLI natively discovers and loads these files:
 *   - copilot-instructions.md: loaded at session start as always-on context
 *   - SKILL.md: selected based on description match, injected when relevant
 *   - AGENTS.md: loaded as custom instructions
 *
 * The --prompt argument contains ONLY conversation history + current message.
 * Skill discovery and routing is handled entirely by the CLI.
 */
export function syncSkillFiles(projectId: string): void {
  const workspaceDir = pathConfig.getWorkspaceDir(projectId);
  fs.mkdirSync(workspaceDir, { recursive: true });

  const skills = skillsService.getProjectSkills(projectId);
  const skillDirs = skills
    .filter(s => s.status === 'available')
    .map(s => path.resolve(s.skill_path));

  // Log resolved skill directories for debugging
  for (const dir of skillDirs) {
    const exists = fs.existsSync(dir);
    console.log(`[syncSkillFiles] skill dir: ${dir} (exists=${exists})`);
  }

  const githubDir = path.join(workspaceDir, '.github');
  const skillsOutDir = path.join(githubDir, 'skills');
  const agentsOutDir = path.join(githubDir, 'agents');

  // Clean previous system files so stale subskills from removed skills don't linger.
  fs.rmSync(githubDir, { recursive: true, force: true });
  try { fs.unlinkSync(path.join(workspaceDir, 'AGENTS.md')); } catch { /* ok */ }

  if (skillDirs.length === 0) return;

  fs.mkdirSync(githubDir, { recursive: true });

  const agentsSections: string[] = [];
  const ciSections: string[] = [];

  for (const dir of skillDirs) {
    // AGENTS.md → workspace root (merged across all assigned skills)
    try {
      agentsSections.push(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'));
    } catch { /* skip */ }

    // copilot-instructions.md → .github/ (merged)
    try {
      ciSections.push(fs.readFileSync(path.join(dir, 'copilot-instructions.md'), 'utf8'));
    } catch { /* skip */ }

    // Subskill directories → .github/skills/{name}/
    // The CLI auto-discovers all files in a skill directory alongside SKILL.md.
    try {
      const subSkills = fs.readdirSync(path.join(dir, 'skills'), { withFileTypes: true });
      for (const entry of subSkills) {
        if (!entry.isDirectory()) continue;
        const srcDir = path.join(dir, 'skills', entry.name);
        const destDir = path.join(skillsOutDir, entry.name);
        copyDirRecursive(srcDir, destDir);
      }
    } catch { /* no skills/ dir */ }

    // Agent .agent.md → .github/agents/{file}.agent.md
    try {
      const agentFiles = fs.readdirSync(path.join(dir, 'agents')).filter(f => f.endsWith('.agent.md'));
      for (const file of agentFiles) {
        try {
          const dest = path.join(agentsOutDir, file);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(path.join(dir, 'agents', file), dest);
        } catch { /* skip */ }
      }
    } catch { /* no agents/ dir */ }
  }

  if (ciSections.length > 0) {
    fs.writeFileSync(
      path.join(githubDir, 'copilot-instructions.md'),
      ciSections.join('\n\n'),
      'utf8',
    );
  }

  if (agentsSections.length > 0) {
    fs.writeFileSync(
      path.join(workspaceDir, 'AGENTS.md'),
      agentsSections.join('\n\n'),
      'utf8',
    );
  }

  // Log final workspace layout for debugging
  const skillCount = fs.existsSync(skillsOutDir)
    ? fs.readdirSync(skillsOutDir, { withFileTypes: true }).filter(e => e.isDirectory()).length
    : 0;
  console.log(`[syncSkillFiles] workspace: ${workspaceDir}`);
  console.log(`[syncSkillFiles]   .github/copilot-instructions.md: ${ciSections.length > 0 ? 'yes' : 'no'}`);
  console.log(`[syncSkillFiles]   AGENTS.md: ${agentsSections.length > 0 ? 'yes' : 'no'}`);
  console.log(`[syncSkillFiles]   .github/skills/: ${skillCount} skills`);
}

/**
 * Assemble execution context for an agent run.
 * Gathers token, skills, MCP config, and sets up redaction.
 */
export function assembleExecContext(projectId: string): ExecContext {
  // Token
  const token = authService.resolveToken();
  if (!token) {
    throw new Error('GitHub Token not configured. Set GITHUB_TOKEN or configure via Settings.');
  }

  const workspaceDir = pathConfig.getWorkspaceDir(projectId);
  // Ensure workspace is a valid git repo so Copilot CLI discovers instruction files.
  ensureWorkspaceRepo(workspaceDir);

  // Sync skill files to workspace before spawning the CLI.
  // This is a safety net; normally done at skill-assignment time via the API.
  syncSkillFiles(projectId);

  // MCP temp config
  const mcpConfigFile = mcpService.generateTempConfig(projectId);

  // Secrets for redaction
  const mcpSecrets = mcpService.getSecretsForRedaction(projectId);
  const redactSecrets = [token, ...mcpSecrets];

  // Build extra env
  const extraEnv: Record<string, string> = {};

  return {
    token,
    workspaceDir,
    mcpConfigFile,
    redactSecrets,
    extraEnv,
  };
}


/**
 * Execute a chat message by spawning an agent run (Docker container or host
 * process, depending on availability).
 *
 * Each user message triggers a fresh Copilot CLI invocation. On the first
 * message for a project, a named session is created (--name). Subsequent
 * messages resume the same session (--resume) so the CLI preserves its own
 * conversation history. DB history is kept as cold-start recovery.
 */
export function executeChat(
  projectId: string,
  userMessage: string,
  callbacks: {
    existingMessageId?: string;
    model?: string;
    onChunk: (content: string) => void;
    onProgress?: (message: string) => void;
    onStatus: (runId: string, status: string) => void;
    onComplete: (runId: string, exitCode: number | null) => void;
    onFileCreated?: (file: { id: string; file_path: string; size_bytes: number }) => void;
  },
): string {
  const db = getDatabase();
  const ctx = assembleExecContext(projectId);

  // Check if this project has existing messages (for cold-start detection)
  const existingMsgCount = (db.prepare(
    `SELECT COUNT(*) as cnt FROM messages WHERE project_id = ? AND role IN ('user', 'assistant')`,
  ).get(projectId) as { cnt: number }).cnt;

  // Atomic message + run creation
  const { runId } = (db.transaction(() => {
    let msgId = callbacks.existingMessageId;
    const runId = crypto.randomUUID();

    // Cancel any orphaned running/queued runs for this project
    db.prepare(
      "UPDATE agent_runs SET status = 'failed', finished_at = CURRENT_TIMESTAMP, error_type = 'server_crash' WHERE project_id = ? AND status IN ('running', 'queued')",
    ).run(projectId);

    if (!msgId) {
      msgId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, 'user', ?)",
      ).run(msgId, projectId, userMessage);
    }

    db.prepare(
      "INSERT INTO agent_runs (id, project_id, message_id, status, prompt) VALUES (?, ?, ?, 'running', ?)",
    ).run(runId, projectId, msgId, userMessage);

    db.prepare('UPDATE projects SET last_activity = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);

    return { runId };
  }) as () => { runId: string })();

  // CLI maintains its own history via --resume; just pass the raw user message.
  // On cold-start (resume fails → new session), the CLI won't have history.
  // Build a full conversation prompt so the new session has context.
  const isFirstMessage = existingMsgCount === 0;

  let prompt: string;
  if (isFirstMessage) {
    // First message — no history needed, just the user message.
    prompt = userMessage;
    clearSession(projectId);
  } else {
    // Subsequent message — include conversation history for cold-start recovery.
    // If --resume succeeds, the CLI ignores stdin history (it already has it).
    // If --resume fails and a new session is created, this history ensures continuity.
    const history = db.prepare(
      `SELECT role, content FROM messages
       WHERE project_id = ? AND role IN ('user', 'assistant') AND content != ''
       ORDER BY created_at ASC`,
    ).all(projectId) as Array<{ role: string; content: string }>;

    // Exclude the last entry if it's the empty assistant placeholder we just inserted,
    // and exclude the current user message (already in history from the INSERT above).
    const pastMessages = history.filter(m => m.content.trim() !== '');

    if (pastMessages.length > 1) {
      // Build a multi-turn prompt: previous turns as context, current message last.
      const turns = pastMessages.slice(0, -1).map(m =>
        m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`
      ).join('\n\n');
      prompt = `[Previous conversation]\n${turns}\n\n[Current message]\n${userMessage}`;
      console.log(`[exec-context] cold-start prompt: ${pastMessages.length - 1} history turns + current message`);
    } else {
      prompt = userMessage;
    }
  }

  console.log(`[exec-context] prompt=${prompt.length}chars first=${isFirstMessage}`);

  // Create assistant message for streaming accumulation
  const assistantMsgId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO messages (id, project_id, run_id, role, content) VALUES (?, ?, ?, 'assistant', '')",
  ).run(assistantMsgId, projectId, runId);

  const redactor = createRedactorWithFlush(ctx.redactSecrets);

  callbacks.onStatus(runId, 'running');

  startRun(
    {
      projectId,
      workspaceDir: ctx.workspaceDir,
      prompt,
      token: ctx.token,
      model: callbacks.model,
      mcpConfigFile: ctx.mcpConfigFile,
    },
    {
      onChunk: (raw) => {
        const redacted = redactor.push(raw);
        if (redacted) {
          db.prepare('UPDATE messages SET content = content || ? WHERE id = ?').run(redacted, assistantMsgId);
          callbacks.onChunk(redacted);
        }
      },
      onProgress: (msg) => callbacks.onProgress?.(msg),
      onFileCreated: (absPath) => {
        // Register file immediately when CLI creates it (don't wait for reconcile)
        const workspaceDir = ctx.workspaceDir;
        if (!absPath.startsWith(workspaceDir)) return;
        const relativePath = path.relative(workspaceDir, absPath);
        // Skip system files
        const topSegment = relativePath.split(path.sep)[0];
        if (topSegment === '.github' || topSegment === '.git' || topSegment === 'AGENTS.md') return;
        try {
          const stat = fs.statSync(absPath);
          const filename = path.basename(relativePath);
          const id = crypto.randomUUID();
          db.prepare(`
            INSERT INTO project_files (id, project_id, filename, file_path, size_bytes, mtime_ms, source)
            VALUES (?, ?, ?, ?, ?, ?, 'agent')
            ON CONFLICT(project_id, file_path) DO UPDATE SET
              size_bytes = excluded.size_bytes, mtime_ms = excluded.mtime_ms, updated_at = CURRENT_TIMESTAMP
          `).run(id, projectId, filename, relativePath, stat.size, stat.mtimeMs);
          // Broadcast to frontend
          callbacks.onFileCreated?.({ id, file_path: relativePath, size_bytes: stat.size });
        } catch { /* file may not exist yet or be transient */ }
      },
      onDone: (exitCode) => {
        const remaining = redactor.flush();
        if (remaining) {
          db.prepare('UPDATE messages SET content = content || ? WHERE id = ?').run(remaining, assistantMsgId);
          callbacks.onChunk(remaining);
        }

        const status = exitCode === 0 ? 'completed' : 'failed';
        db.prepare(
          "UPDATE agent_runs SET status = ?, exit_code = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('running', 'queued')",
        ).run(status, exitCode, runId);

        const finalRow = db.prepare('SELECT status FROM agent_runs WHERE id = ?').get(runId) as { status: string } | undefined;

        try {
          reconcileProjectFiles(projectId, db);
          const fileCount = (db.prepare('SELECT COUNT(*) as cnt FROM project_files WHERE project_id = ?').get(projectId) as { cnt: number }).cnt;
          console.log(`[exec-context] reconciled ${fileCount} files for project ${projectId}`);
        } catch (err) {
          console.warn('File reconciliation failed:', (err as Error).message);
        }

        if (ctx.mcpConfigFile) {
          try { fs.unlinkSync(ctx.mcpConfigFile); } catch { /* ignore */ }
        }

        callbacks.onStatus(runId, finalRow?.status ?? status);
        callbacks.onComplete(runId, exitCode);
      },
      onError: (errMsg) => {
        // Send error message to chat as assistant message
        const isAuthError = errMsg.includes('authentication') || errMsg.includes('GITHUB_TOKEN')
          || errMsg.includes('Token not configured');
        const userFacingMsg = isAuthError
          ? '⚠️ GitHubトークンが未設定または無効です。設定画面からトークンを設定してください。'
          : `⚠️ エラーが発生しました: ${errMsg.split('\n')[0]}`;

        db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(userFacingMsg, assistantMsgId);
        callbacks.onChunk(userFacingMsg);

        db.prepare(
          "UPDATE agent_runs SET status = 'failed', finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('running', 'queued')",
        ).run(runId);

        if (ctx.mcpConfigFile) {
          try { fs.unlinkSync(ctx.mcpConfigFile); } catch { /* ignore */ }
        }

        callbacks.onStatus(runId, 'failed');
        callbacks.onComplete(runId, null);
        console.error(`[exec-context] Run error (project=${projectId}): ${errMsg}`);
      },
    },
  );

  return runId;
}

/**
 * Stop the active run for a project (called from the stop API endpoint).
 * Returns true if a run was stopped.
 */
export function stopChat(projectId: string): boolean {
  return stopRun(projectId);
}
