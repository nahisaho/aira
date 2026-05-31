import { AuthService } from './auth.service.js';
import { SkillsService } from './skills.service.js';
import { McpService } from './mcp.service.js';
import { createRedactorWithFlush } from './agent.service.js';
import { startRun, stopRun, clearSession } from './container-runner.js';
import { reconcileProjectFiles } from './file.service.js';
import { captureSnapshot } from './notebook-trace.js';
import {
  getRagSettings,
  indexMessageTokens,
  retrieveContext,
} from './rag.service.js';
import { queueMessageExtraction } from './rag-extractor.js';
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
 * v3.2.0 Pillar 4 — ensure the data conventions exist:
 *   - workspace/data/raw/       (place user-provided real data here)
 *   - workspace/data/SOURCES.md (provenance log for data inputs)
 *
 * Idempotent. SOURCES.md gets a small skeleton on first creation so the agent
 * has a template to append to.
 */
function ensureDataConventions(projectId: string): void {
  const rawDir = pathConfig.getRawDataDir(projectId);
  const sourcesPath = pathConfig.getDataSourcesPath(projectId);
  fs.mkdirSync(rawDir, { recursive: true });
  if (!fs.existsSync(sourcesPath)) {
    const skeleton = `# Data Sources

Track every input dataset used by this project. The agent should append a row
for each file added under \`data/raw/\` and every external dataset / API
queried for analysis.

| File / Dataset | Source (URL / DOI / API endpoint) | SHA-256 | Size | Retrieved | License | Notes |
|---|---|---|---|---|---|---|
`;
    fs.writeFileSync(sourcesPath, skeleton, 'utf8');
  }
}

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
  // Size limit per skill file (1MB) to prevent excessive context injection
  const MAX_SKILL_FILE_SIZE = 1_000_000;

  for (const dir of skillDirs) {
    // AGENTS.md → workspace root (merged across all assigned skills)
    try {
      const content = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
      if (content.length <= MAX_SKILL_FILE_SIZE) agentsSections.push(content);
      else console.warn(`[syncSkillFiles] skipped oversized AGENTS.md (${content.length} chars) in ${dir}`);
    } catch { /* skip */ }

    // copilot-instructions.md → .github/ (merged)
    try {
      const content = fs.readFileSync(path.join(dir, 'copilot-instructions.md'), 'utf8');
      if (content.length <= MAX_SKILL_FILE_SIZE) ciSections.push(content);
      else console.warn(`[syncSkillFiles] skipped oversized copilot-instructions.md (${content.length} chars) in ${dir}`);
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
    try {
      fs.writeFileSync(
        path.join(githubDir, 'copilot-instructions.md'),
        ciSections.join('\n\n'),
        'utf8',
      );
    } catch (err) {
      console.warn(`[syncSkillFiles] failed to write copilot-instructions.md: ${(err as Error).message}`);
    }
  }

  if (agentsSections.length > 0) {
    try {
      fs.writeFileSync(
        path.join(workspaceDir, 'AGENTS.md'),
        agentsSections.join('\n\n'),
        'utf8',
      );
    } catch (err) {
      console.warn(`[syncSkillFiles] failed to write AGENTS.md: ${(err as Error).message}`);
    }
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
 * Write RAG context to the workspace so the CLI can discover it.
 * Creates .github/rag-context.md and appends a reference to copilot-instructions.md.
 * Called before each CLI invocation with fresh context based on the current query.
 */
function injectRagContext(projectId: string, userMessage: string): void {
  const db = getDatabase();
  const settings = getRagSettings(db, projectId);
  if (!settings.enabled) return;

  const workspaceDir = pathConfig.getWorkspaceDir(projectId);
  const githubDir = path.join(workspaceDir, '.github');
  const ragContextPath = path.join(githubDir, 'rag-context.md');

  // Step 1: Sync token extraction (lightweight, no LLM)
  // Index the current user message tokens for future queries
  // Use a temporary message ID — will be updated when actual message is created
  indexMessageTokens(db, projectId, `pending-${Date.now()}`, userMessage);

  // Step 2: RAG search — retrieve relevant context
  const contextStr = retrieveContext(db, projectId, userMessage);
  if (!contextStr) {
    // No relevant context found — remove stale rag-context.md
    try { fs.unlinkSync(ragContextPath); } catch { /* ok */ }
    return;
  }

  // Step 3: Write rag-context.md
  fs.mkdirSync(githubDir, { recursive: true });
  fs.writeFileSync(ragContextPath, contextStr, 'utf8');

  // Step 4: Ensure copilot-instructions.md references rag-context.md
  const ciPath = path.join(githubDir, 'copilot-instructions.md');
  const ragRef = '\n\n## Project Knowledge\nRefer to `.github/rag-context.md` for relevant project context and knowledge.\n';

  let ciContent = '';
  try { ciContent = fs.readFileSync(ciPath, 'utf8'); } catch { /* doesn't exist yet */ }

  if (!ciContent.includes('rag-context.md')) {
    fs.writeFileSync(ciPath, ciContent + ragRef, 'utf8');
  }

  console.log(`[rag] injected ${contextStr.length} chars context for project ${projectId}`);
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

  // v3.2.0 Pillar 4 — ensure data/raw + data/SOURCES.md skeleton exists.
  ensureDataConventions(projectId);

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

  // RAG: inject context before CLI invocation
  try {
    injectRagContext(projectId, userMessage);
  } catch (err) {
    console.warn('[exec-context] RAG context injection failed:', (err as Error).message);
  }

  // Check if this project has existing messages (for cold-start detection).
  // Note: the current user message was already created via REST before executeChat,
  // so count <= 1 means this is the first message (only the current one exists).
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

  // The prompt sent to the CLI depends on session mode:
  // - On --resume: only the raw user message (CLI already has history in its session).
  // - On --name (new session / cold-start fallback): full history for context continuity.
  // Previously, sending full history on --resume caused the model to see duplicated
  // context, leading to repeated/doubled response strings.
  const isFirstMessage = existingMsgCount <= 1;

  let coldStartPrompt: string | undefined;
  if (!isFirstMessage) {
    // Build a full conversation prompt for cold-start recovery (--name fallback).
    // Limit to recent turns to avoid exceeding CLI token limits (~128K context).
    // Rough estimate: 1 char ≈ 0.4 tokens → 80K chars ≈ 32K tokens (safe margin).
    const MAX_COLD_START_CHARS = 80_000;

    const history = db.prepare(
      `SELECT role, content FROM messages
       WHERE project_id = ? AND role IN ('user', 'assistant') AND content != ''
       ORDER BY created_at ASC`,
    ).all(projectId) as Array<{ role: string; content: string }>;

    const pastMessages = history.filter(m => m.content.trim() !== '');

    if (pastMessages.length > 1) {
      // Take turns from most recent backwards until budget is exhausted
      const allTurns = pastMessages.slice(0, -1);
      const selectedTurns: string[] = [];
      let charBudget = MAX_COLD_START_CHARS - userMessage.length - 100;
      for (let i = allTurns.length - 1; i >= 0 && charBudget > 0; i--) {
        const formatted = allTurns[i].role === 'user'
          ? `User: ${allTurns[i].content}`
          : `Assistant: ${allTurns[i].content}`;
        if (formatted.length > charBudget) {
          // Truncate this turn to fit remaining budget
          selectedTurns.unshift(formatted.slice(0, charBudget) + '…(truncated)');
          break;
        }
        charBudget -= formatted.length;
        selectedTurns.unshift(formatted);
      }
      const truncated = selectedTurns.length < allTurns.length;
      const prefix = truncated ? '[Previous conversation (recent history)]\n' : '[Previous conversation]\n';
      coldStartPrompt = `${prefix}${selectedTurns.join('\n\n')}\n\n[Current message]\n${userMessage}`;
      console.log(`[exec-context] cold-start prompt: ${selectedTurns.length}/${allTurns.length} history turns + current message (${coldStartPrompt.length} chars)`);
    }
  }

  // For first messages or cleared history, force a new session (skip --resume
  // which might hit a stale CLI session from a previous lifecycle).
  const forceNewSession = isFirstMessage;
  if (forceNewSession) {
    clearSession(projectId);
  }

  console.log(`[exec-context] prompt=${userMessage.length}chars first=${isFirstMessage} coldStart=${coldStartPrompt ? coldStartPrompt.length : 0}chars`);

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
      prompt: userMessage,
      coldStartPrompt,
      token: ctx.token,
      model: callbacks.model,
      mcpConfigFile: ctx.mcpConfigFile,
      forceNewSession,
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
        // Register file immediately when CLI creates/modifies it (don't wait for reconcile)
        const workspaceDir = ctx.workspaceDir;
        // Handle both absolute and relative paths from tool events
        const resolvedPath = path.isAbsolute(absPath) ? absPath : path.resolve(workspaceDir, absPath);
        // Secure boundary check: ensure resolved path is strictly inside workspace
        const rel = path.relative(workspaceDir, resolvedPath);
        if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return;
        const relativePath = rel;
        // Skip system files
        const topSegment = relativePath.split(path.sep)[0];
        if (topSegment === '.github' || topSegment === '.git' || topSegment === 'AGENTS.md') return;
        try {
          const stat = fs.lstatSync(resolvedPath);
          if (stat.isSymbolicLink()) return;
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

        // v3.2.0 — capture notebook snapshot for Computational Provenance
        try {
          const snap = captureSnapshot(projectId, runId);
          if (snap) {
            console.log(`[exec-context] trace: ${snap.cells.length} cells captured for project ${projectId.slice(0, 8)}`);
          }
        } catch (err) {
          console.warn('Notebook trace capture failed:', (err as Error).message);
        }

        if (ctx.mcpConfigFile) {
          try { fs.unlinkSync(ctx.mcpConfigFile); } catch { /* ignore */ }
        }

        // RAG: Queue async LLM extraction for user + assistant messages
        try {
          const ragSettings = getRagSettings(db, projectId);
          if (ragSettings.enabled) {
            const assistantContent = (db.prepare('SELECT content FROM messages WHERE id = ?').get(assistantMsgId) as { content: string } | undefined)?.content ?? '';
            // Index user message tokens synchronously (lightweight)
            const userMsgRow = db.prepare(
              `SELECT id FROM messages WHERE project_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1`,
            ).get(projectId) as { id: string } | undefined;
            if (userMsgRow) {
              indexMessageTokens(db, projectId, userMsgRow.id, userMessage);
            }
            // Queue async LLM extraction for assistant response
            if (assistantContent.length > 20) {
              queueMessageExtraction(db, projectId, assistantMsgId, assistantContent, ctx.token, ctx.workspaceDir);
            }
          }
        } catch (err) {
          console.warn('[exec-context] RAG extraction queue failed:', (err as Error).message);
        }

        callbacks.onStatus(runId, finalRow?.status ?? status);
        callbacks.onComplete(runId, exitCode);
      },
      onError: (errMsg) => {
        // Flush any accumulated redactor content
        const remaining = redactor.flush();
        if (remaining) {
          db.prepare('UPDATE messages SET content = content || ? WHERE id = ?').run(remaining, assistantMsgId);
          callbacks.onChunk(remaining);
        }

        // Send error message to chat as assistant message
        const isAuthError = errMsg.includes('authentication') || errMsg.includes('GITHUB_TOKEN')
          || errMsg.includes('Token not configured');
        const userFacingMsg = isAuthError
          ? '⚠️ GitHubトークンが未設定または無効です。設定画面からトークンを設定してください。'
          : `⚠️ エラーが発生しました: ${errMsg.split('\n')[0]}`;

        db.prepare('UPDATE messages SET content = content || ? WHERE id = ?').run(userFacingMsg, assistantMsgId);
        callbacks.onChunk(userFacingMsg);

        const isTimeout = errMsg === 'Run timed out';
        const runStatus = isTimeout ? 'timeout' : 'failed';
        const errorType = isTimeout ? 'timeout' : (isAuthError ? 'auth_failure' : 'unknown');
        db.prepare(
          "UPDATE agent_runs SET status = ?, error_type = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('running', 'queued')",
        ).run(runStatus, errorType, runId);

        // Reconcile files even on error — CLI may have created files before failing
        try {
          reconcileProjectFiles(projectId, db);
          const fileCount = (db.prepare('SELECT COUNT(*) as cnt FROM project_files WHERE project_id = ?').get(projectId) as { cnt: number }).cnt;
          console.log(`[exec-context] reconciled ${fileCount} files for project ${projectId} (after error)`);
        } catch (err) {
          console.warn('File reconciliation failed (error path):', (err as Error).message);
        }

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
