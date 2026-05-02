import crypto from 'node:crypto';
import { getDatabase } from '../db/index.js';

export interface Message {
  id: string;
  project_id: string;
  run_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export class MessageService {
  /**
   * Get message history for a project, ordered by creation time.
   */
  getHistory(projectId: string, limit = 100, offset = 0): Message[] {
    const db = getDatabase();
    return db
      .prepare(
        'SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?',
      )
      .all(projectId, limit, offset) as Message[];
  }

  /**
   * Create a new message.
   */
  create(projectId: string, role: Message['role'], content: string, runId?: string): Message {
    const db = getDatabase();
    const id = crypto.randomUUID();

    db.prepare(
      'INSERT INTO messages (id, project_id, run_id, role, content) VALUES (?, ?, ?, ?, ?)',
    ).run(id, projectId, runId ?? null, role, content);

    // Update project activity
    db.prepare('UPDATE projects SET last_activity = CURRENT_TIMESTAMP WHERE id = ?').run(
      projectId,
    );

    return db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message;
  }

  /**
   * Append content to an existing assistant message (for streaming).
   */
  appendContent(messageId: string, additionalContent: string): void {
    const db = getDatabase();
    db.prepare('UPDATE messages SET content = content || ? WHERE id = ?').run(
      additionalContent,
      messageId,
    );
  }

  /**
   * Clear all messages for a project. Rejects if a run is active (409).
   */
  clearHistory(projectId: string): void {
    const db = getDatabase();

    const activeRun = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM agent_runs WHERE project_id = ? AND status IN ('running', 'queued')",
      )
      .get(projectId) as { cnt: number };

    if (activeRun.cnt > 0) {
      throw new ClearHistoryDuringRunError(projectId);
    }

    // Delete messages; agent_runs.message_id uses ON DELETE SET NULL
    db.prepare('DELETE FROM messages WHERE project_id = ?').run(projectId);
  }

  /**
   * Get messages created after a given timestamp (for reconnect resync).
   */
  getMessagesSince(projectId: string, since: string): Message[] {
    const db = getDatabase();
    return db
      .prepare(
        'SELECT * FROM messages WHERE project_id = ? AND created_at > ? ORDER BY created_at ASC',
      )
      .all(projectId, since) as Message[];
  }
}

export class ClearHistoryDuringRunError extends Error {
  constructor(projectId: string) {
    super(`Cannot clear history while run is active for project: ${projectId}`);
    this.name = 'ClearHistoryDuringRunError';
  }
}
