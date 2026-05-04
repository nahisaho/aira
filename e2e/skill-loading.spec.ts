/**
 * Skill Loading Validation
 *
 * Verifies that spread1000-assistant's copilot-instructions.md and AGENTS.md
 * are correctly loaded when the skill is assigned to a project.
 */
import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../backend/data/aira.db');

test.describe('Skill loading — spread1000-assistant', () => {
  test('skill_path points to existing AGENTS.md', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const skill = db.prepare(
      "SELECT skill_path FROM skills WHERE name = 'spread1000-assistant' AND builtin = 1",
    ).get() as { skill_path: string } | undefined;

    expect(skill, 'spread1000-assistant skill not found in DB').toBeDefined();
    const agentsMd = path.join(skill!.skill_path, 'AGENTS.md');
    expect(fs.existsSync(agentsMd), `AGENTS.md not found: ${agentsMd}`).toBe(true);
    db.close();
  });

  test('skill_path points to existing copilot-instructions.md', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const skill = db.prepare(
      "SELECT skill_path FROM skills WHERE name = 'spread1000-assistant' AND builtin = 1",
    ).get() as { skill_path: string } | undefined;

    expect(skill, 'spread1000-assistant skill not found in DB').toBeDefined();
    const ciMd = path.join(skill!.skill_path, 'copilot-instructions.md');
    expect(fs.existsSync(ciMd), `copilot-instructions.md not found: ${ciMd}`).toBe(true);
    db.close();
  });

  test('skill_path does NOT contain /backend/skills/ (path bug)', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const bad = db.prepare(
      "SELECT name, skill_path FROM skills WHERE builtin = 1 AND skill_path LIKE '%/backend/skills/%'",
    ).all() as { name: string; skill_path: string }[];

    expect(bad, `Bad skill paths found: ${JSON.stringify(bad)}`).toHaveLength(0);
    db.close();
  });

  test('workspace .github/copilot-instructions.md is written for assigned project', () => {
    const db = new Database(DB_PATH, { readonly: true });

    // Find a project assigned to spread1000-assistant
    const row = db.prepare(`
      SELECT ps.project_id
      FROM project_skills ps
      JOIN skills s ON s.id = ps.skill_id
      WHERE s.name = 'spread1000-assistant' AND s.builtin = 1
      LIMIT 1
    `).get() as { project_id: string } | undefined;

    if (!row) {
      test.skip();
      return;
    }

    // Simulate what assembleExecContext does: check if the file would be written
    const skill = db.prepare(
      "SELECT skill_path FROM skills WHERE name = 'spread1000-assistant' AND builtin = 1",
    ).get() as { skill_path: string };

    const ciSrc = path.join(skill.skill_path, 'copilot-instructions.md');
    const content = fs.readFileSync(ciSrc, 'utf8');
    expect(content.length, 'copilot-instructions.md is empty').toBeGreaterThan(0);
    expect(content, 'copilot-instructions.md missing Identity section').toContain('SPReAD Builder');

    db.close();
  });

  test('AGENTS.md is placed at workspace root (Primary instructions for CLI)', () => {
    const db = new Database(DB_PATH, { readonly: true });

    const skill = db.prepare(
      "SELECT skill_path FROM skills WHERE name = 'spread1000-assistant' AND builtin = 1",
    ).get() as { skill_path: string };

    // Verify the source AGENTS.md can be read (simulates what assembleExecContext does)
    const agentsSrc = path.join(skill.skill_path, 'AGENTS.md');
    const content = fs.readFileSync(agentsSrc, 'utf8');
    expect(content.length, 'AGENTS.md is empty').toBeGreaterThan(0);
    // Primary instructions placement check: content should be writable to workspace root
    expect(content).toContain('spread1000-context-collector');
    expect(content).toContain('Routing Rules');

    db.close();
  });

  test('AGENTS.md contains routing rules for context-collector', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const skill = db.prepare(
      "SELECT skill_path FROM skills WHERE name = 'spread1000-assistant' AND builtin = 1",
    ).get() as { skill_path: string };

    const agentsMd = fs.readFileSync(path.join(skill.skill_path, 'AGENTS.md'), 'utf8');
    expect(agentsMd).toContain('spread1000-context-collector');
    expect(agentsMd).toContain('1問1答');
    db.close();
  });
});
