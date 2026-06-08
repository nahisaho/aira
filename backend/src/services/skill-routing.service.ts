/**
 * Skill Routing Log — v3.6.0
 *
 * The Copilot CLI performs skill discovery/routing natively: AIRA syncs SKILL.md
 * files into `.github/skills/` and the CLI decides which to load and engage for a
 * given turn. That decision was previously invisible — only `console.log`'d — so
 * when the same skill set produced different agent behaviour across runs (e.g. the
 * Co-Science citation-density difference) there was no record to investigate.
 *
 * This module persists a per-run routing timeline:
 *   - 'synced'        AIRA-side, deterministic: which skill dirs + sub-skills were
 *                     written into the workspace before the CLI started.
 *   - 'skills_loaded' CLI event: skills the CLI reported loading for the turn.
 *   - 'tool_invoked'  CLI event: a tool call whose arguments reference a skill
 *                     file (strong evidence the skill was actually engaged).
 *
 * Reads/writes go through the sql.js singleton like the other per-concern
 * services (notebook-trace, rag).
 */

import crypto from 'node:crypto';
import { getDatabase } from '../db/index.js';

export type SkillRoutingEventType = 'synced' | 'skills_loaded' | 'tool_invoked';

export interface SkillRoutingLog {
  id: string;
  project_id: string;
  run_id: string | null;
  event_type: SkillRoutingEventType;
  payload: unknown;
  created_at: string;
}

/**
 * Record one skill-routing event. Never throws — routing telemetry must not be
 * able to break an in-flight run, so all DB errors are swallowed with a warning.
 */
export function recordSkillRouting(
  projectId: string,
  runId: string | null,
  eventType: SkillRoutingEventType,
  payload: unknown,
): void {
  try {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO skill_routing_logs (id, project_id, run_id, event_type, payload)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(crypto.randomUUID(), projectId, runId, eventType, JSON.stringify(payload ?? null));
  } catch (err) {
    console.warn(`[skill-routing] failed to record ${eventType}: ${(err as Error).message}`);
  }
}

function parseRow(row: {
  id: string;
  project_id: string;
  run_id: string | null;
  event_type: string;
  payload: string;
  created_at: string;
}): SkillRoutingLog {
  let payload: unknown;
  try { payload = JSON.parse(row.payload); } catch { payload = row.payload; }
  return {
    id: row.id,
    project_id: row.project_id,
    run_id: row.run_id,
    event_type: row.event_type as SkillRoutingEventType,
    payload,
    created_at: row.created_at,
  };
}

/**
 * Most recent routing events for a project, newest first. `limit` caps the row
 * count so a long-lived project doesn't return an unbounded log.
 */
export function getSkillRoutingForProject(projectId: string, limit = 300): SkillRoutingLog[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT id, project_id, run_id, event_type, payload, created_at
       FROM skill_routing_logs
      WHERE project_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT ?`,
  ).all(projectId, limit) as Array<Parameters<typeof parseRow>[0]>;
  return rows.map(parseRow);
}

/**
 * Skills synced vs actually invoked for a project's most recent run (v3.10.0).
 * `synced` = sub-skill names AIRA wrote to the workspace ('synced' event);
 * `invoked` = skill names the CLI actually engaged ('tool_invoked' /
 * skill.invoked). Used by the validator's skill-usage honesty check.
 */
export function getSkillUsageForLatestRun(projectId: string): { synced: string[]; invoked: string[] } {
  // Resilient: if the DB isn't initialized or has no routing data, return empty
  // so callers (e.g. the validator) never break on missing telemetry.
  try {
    const db = getDatabase();
    const row = db.prepare(
      `SELECT run_id FROM skill_routing_logs
        WHERE project_id = ? AND run_id IS NOT NULL
        ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    ).get(projectId) as { run_id: string } | undefined;
    if (!row?.run_id) return { synced: [], invoked: [] };

    const synced = new Set<string>();
    const invoked = new Set<string>();
    for (const ev of getSkillRoutingForRun(row.run_id)) {
      if (ev.event_type === 'synced') {
        const p = ev.payload as { skills?: Array<{ subSkills?: string[] }> } | null;
        for (const s of p?.skills ?? []) for (const sub of s.subSkills ?? []) synced.add(sub);
      } else if (ev.event_type === 'tool_invoked') {
        const p = ev.payload as { skill?: string } | null;
        if (p?.skill) invoked.add(p.skill);
      }
    }
    return { synced: Array.from(synced), invoked: Array.from(invoked) };
  } catch {
    return { synced: [], invoked: [] };
  }
}

/** All routing events for a single run, oldest first (chronological timeline). */
export function getSkillRoutingForRun(runId: string): SkillRoutingLog[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT id, project_id, run_id, event_type, payload, created_at
       FROM skill_routing_logs
      WHERE run_id = ?
      ORDER BY created_at ASC, rowid ASC`,
  ).all(runId) as Array<Parameters<typeof parseRow>[0]>;
  return rows.map(parseRow);
}
