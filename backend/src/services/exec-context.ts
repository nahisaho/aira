import { AuthService } from './auth.service.js';
import { SkillsService } from './skills.service.js';
import { McpService } from './mcp.service.js';
import { createRedactorWithFlush, spawnAgent } from './agent.service.js';
import { reconcileProjectFiles } from './file.service.js';
import { getDatabase } from '../db/index.js';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

export interface ExecContext {
  token: string;
  workspaceDir: string;
  skillPaths: string[];
  mcpConfigFile: string | null;
  redactSecrets: string[];
  extraEnv: Record<string, string>;
}

const authService = new AuthService();
const skillsService = new SkillsService();
const mcpService = new McpService();

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

  // Workspace
  const workspaceDir = path.resolve('projects', projectId, 'workspace');
  fs.mkdirSync(workspaceDir, { recursive: true });

  // Skills (available only)
  const skills = skillsService.getProjectSkills(projectId);
  const skillPaths = skills
    .filter(s => s.status === 'available')
    .map(s => path.resolve(s.skill_path, 'AGENTS.md'));

  // MCP temp config
  const mcpConfigFile = mcpService.generateTempConfig(projectId);

  // Secrets for redaction
  const mcpSecrets = mcpService.getSecretsForRedaction(projectId);
  const redactSecrets = [token, ...mcpSecrets];

  // Build extra env
  const extraEnv: Record<string, string> = {};
  // Skills and MCP args would be added to CLI args, not env

  return {
    token,
    workspaceDir,
    skillPaths,
    mcpConfigFile,
    redactSecrets,
    extraEnv,
  };
}

/**
 * Execute a chat message: create run, spawn agent, stream output.
 */
export function executeChat(
  projectId: string,
  userMessage: string,
  callbacks: {
    existingMessageId?: string;
    model?: string;
    onChunk: (content: string) => void;
    onStatus: (runId: string, status: string) => void;
    onComplete: (runId: string, exitCode: number | null) => void;
  },
): string {
  const db = getDatabase();
  const ctx = assembleExecContext(projectId);

  // Atomic message + run creation
  const result = db.transaction(() => {
    let msgId = callbacks.existingMessageId;
    const runId = crypto.randomUUID();

    if (!msgId) {
      // Create user message if not already saved via REST
      msgId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, 'user', ?)",
      ).run(msgId, projectId, userMessage);
    }

    db.prepare(
      "INSERT INTO agent_runs (id, project_id, message_id, status) VALUES (?, ?, ?, 'running')",
    ).run(runId, projectId, msgId);

    db.prepare('UPDATE projects SET last_activity = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);

    return { msgId, runId };
  })();

  const { runId } = result;

  // Set up redactor
  const redactor = createRedactorWithFlush(ctx.redactSecrets);

  // Create assistant message for streaming accumulation
  const assistantMsgId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO messages (id, project_id, run_id, role, content) VALUES (?, ?, ?, 'assistant', '')",
  ).run(assistantMsgId, projectId, runId);

  callbacks.onStatus(runId, 'running');

  spawnAgent({
    runId,
    projectId,
    workspaceDir: ctx.workspaceDir,
    prompt: userMessage,
    token: ctx.token,
    model: callbacks.model,
    extraEnv: ctx.extraEnv,
    onData: (raw: string) => {
      const redacted = redactor.push(raw);
      if (redacted) {
        // Append to DB
        db.prepare('UPDATE messages SET content = content || ? WHERE id = ?').run(redacted, assistantMsgId);
        callbacks.onChunk(redacted);
      }
    },
    onClose: (exitCode: number | null) => {
      // Flush remaining
      const remaining = redactor.flush();
      if (remaining) {
        db.prepare('UPDATE messages SET content = content || ? WHERE id = ?').run(remaining, assistantMsgId);
        callbacks.onChunk(remaining);
      }

      // Update run status
      const status = exitCode === 0 ? 'completed' : exitCode === null ? 'failed' : 'failed';
      db.prepare(
        'UPDATE agent_runs SET status = ?, exit_code = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?',
      ).run(status, exitCode, runId);

      // Reconcile workspace files into DB
      try {
        reconcileProjectFiles(projectId, db);
      } catch (err) {
        console.warn('File reconciliation failed:', (err as Error).message);
      }

      // Clean up MCP temp config
      if (ctx.mcpConfigFile) {
        try {
          fs.unlinkSync(ctx.mcpConfigFile);
        } catch {
          console.warn(`Failed to delete temp MCP config: ${ctx.mcpConfigFile}`);
        }
      }

      callbacks.onStatus(runId, status);
      callbacks.onComplete(runId, exitCode);
    },
  });

  return runId;
}
