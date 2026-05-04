import { AuthService } from './auth.service.js';
import { SkillsService } from './skills.service.js';
import { McpService } from './mcp.service.js';
import { createRedactorWithFlush } from './agent.service.js';
import { startRun, stopRun } from './container-runner.js';
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
 * Sync skill instruction files to the project workspace.
 *
 * Mirrors CoreClaw's skills-sync approach:
 *   - workspace/AGENTS.md                          ← routing rules (CLI Primary instructions)
 *   - workspace/.github/copilot-instructions.md   ← repo-wide instructions
 *   - workspace/.github/skills/{name}/SKILL.md    ← per-subskill instructions
 *   - workspace/.github/agents/{file}.agent.md    ← agent definitions
 *
 * The agent discovers subskill instructions on demand via read_file,
 * which enables genuine 1問1答 routing (ask one question → wait for user → ask next).
 * Inlining everything into --prompt bypasses this protocol.
 *
 * Called at skill assignment time and as a safety net before each run.
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

    // Subskill SKILL.md → .github/skills/{name}/SKILL.md
    // The agent reads these on demand via read_file when routing to a subskill.
    try {
      const subSkills = fs.readdirSync(path.join(dir, 'skills'), { withFileTypes: true });
      for (const entry of subSkills) {
        if (!entry.isDirectory()) continue;
        const src = path.join(dir, 'skills', entry.name, 'SKILL.md');
        try {
          const dest = path.join(skillsOutDir, entry.name, 'SKILL.md');
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
        } catch { /* skip missing */ }
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
    // Append a meta-hint so the agent knows where subskill files are located.
    const subskillHint = [
      '',
      '## Subskill File Locations',
      '',
      'When routing to a subskill, read its detailed instructions from:',
      '  `.github/skills/{subskill-name}/SKILL.md`',
      '',
      'Example: to activate `spread1000-context-collector`, execute:',
      '  read_file .github/skills/spread1000-context-collector/SKILL.md',
      'then follow those instructions exactly.',
    ].join('\n');

    fs.writeFileSync(
      path.join(workspaceDir, 'AGENTS.md'),
      agentsSections.join('\n\n') + subskillHint,
      'utf8',
    );
  }
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
 * Build a contextualized prompt by prepending conversation history.
 * The agent-runner maintains in-memory state between turns, but we also
 * embed DB history so that a freshly spawned runner (after idle timeout)
 * can resume without losing context.
 */
function buildContextualPrompt(
  history: { role: string; content: string }[],
  currentMessage: string,
): string {
  if (history.length === 0) return currentMessage;

  const MAX_CONTENT_LEN = 3000;
  const lines: string[] = ['# Conversation History\n'];

  for (const msg of history) {
    const label = msg.role === 'user' ? 'User' : 'Assistant';
    const content = msg.content.length > MAX_CONTENT_LEN
      ? msg.content.slice(0, MAX_CONTENT_LEN) + '\n...[truncated]'
      : msg.content;
    lines.push(`## ${label}\n\n${content}\n`);
  }

  lines.push('---\n\n# Current Message\n');
  lines.push(currentMessage);
  return lines.join('\n');
}

/**
 * Execute a chat message by spawning an agent run (Docker container or host
 * process, depending on availability).
 *
 * Each user message triggers a fresh Copilot CLI invocation with the full
 * conversation history prepended to the prompt — enabling multi-turn dialogue
 * without relying on a persistent process. This mirrors the CoreClaw model:
 * one container per run, stateless by default, context reconstructed from DB.
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
  },
): string {
  const db = getDatabase();
  const ctx = assembleExecContext(projectId);

  // Fetch conversation history BEFORE saving current message so context is complete.
  const historyRows = db.prepare(
    `SELECT id, role, content FROM messages
     WHERE project_id = ? AND role IN ('user', 'assistant')
     ORDER BY created_at ASC LIMIT 40`,
  ).all(projectId) as { id: string; role: string; content: string }[];

  // Atomic message + run creation
  const { msgId, runId } = (db.transaction(() => {
    let msgId = callbacks.existingMessageId;
    const runId = crypto.randomUUID();

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

    return { msgId, runId };
  }) as () => { msgId: string; runId: string })();

  // Build prompt: history + current message (cold-start recovery via DB)
  const filteredHistory = historyRows.filter(m => m.id !== msgId);
  const fullPrompt = buildContextualPrompt(filteredHistory, userMessage);

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
      prompt: fullPrompt,
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
