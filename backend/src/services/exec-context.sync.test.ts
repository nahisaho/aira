import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { initializeDatabase, getDatabase, closeDatabase } from '../db/index.js';
import { setBaseDir, getBaseDir, getWorkspaceDir } from '../config/paths.js';
import { syncSkillFiles } from './exec-context.js';

/** Create a skill source dir with `skills/<name>/SKILL.md` for each sub-skill name. */
function makeSkill(root: string, skillName: string, subSkills: string[]): string {
  const dir = path.join(root, skillName);
  for (const sub of subSkills) {
    const subDir = path.join(dir, 'skills', sub);
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'SKILL.md'), `# ${sub}\n`, 'utf8');
  }
  return dir;
}

function syncedSubSkills(projectId: string): string[] {
  const out = path.join(getWorkspaceDir(projectId), '.github', 'skills');
  if (!fs.existsSync(out)) return [];
  return fs.readdirSync(out, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
}

/**
 * v3.8.0 removed AIRA-side prompt routing — skill selection is delegated to the
 * Copilot CLI's description-based progressive disclosure. syncSkillFiles must
 * therefore sync EVERY assigned sub-skill, regardless of skill-set size. These
 * tests guard against accidentally re-introducing a pre-filter.
 */
describe('syncSkillFiles syncs all sub-skills (v3.8.0 — no AIRA routing)', () => {
  let tmpDir: string;
  let originalBaseDir: string;
  let projectId: string;

  // One big skill (would have been filtered pre-v3.8.0) + one small skill.
  const BIG = Array.from({ length: 40 }, (_, i) => `co-scientist-skill-${i}`);
  const SMALL = Array.from({ length: 13 }, (_, i) => `spread1000-${i}`);

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-sync-test-'));
    originalBaseDir = getBaseDir();
    setBaseDir(tmpDir);
    closeDatabase();
    await initializeDatabase();

    const skillSrcRoot = path.join(tmpDir, 'skill-src');
    const bigDir = makeSkill(skillSrcRoot, 'co-scientist', BIG);
    const smallDir = makeSkill(skillSrcRoot, 'spread1000-assistant', SMALL);

    const db = getDatabase();
    projectId = crypto.randomUUID();
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(projectId, 'Sync Test');
    const bigId = crypto.randomUUID();
    const smallId = crypto.randomUUID();
    db.prepare(
      "INSERT INTO skills (id, name, source_type, skill_path, status) VALUES (?, ?, 'local', ?, 'available')",
    ).run(bigId, 'co-scientist', bigDir);
    db.prepare(
      "INSERT INTO skills (id, name, source_type, skill_path, status) VALUES (?, ?, 'local', ?, 'available')",
    ).run(smallId, 'spread1000-assistant', smallDir);
    db.prepare('INSERT INTO project_skills (project_id, skill_id) VALUES (?, ?)').run(projectId, bigId);
    db.prepare('INSERT INTO project_skills (project_id, skill_id) VALUES (?, ?)').run(projectId, smallId);
  });

  afterEach(() => {
    closeDatabase();
    setBaseDir(originalBaseDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('syncs every sub-skill of every assigned skill', () => {
    const summary = syncSkillFiles(projectId);
    const synced = syncedSubSkills(projectId);
    expect(synced).toHaveLength(BIG.length + SMALL.length);
    for (const s of [...BIG, ...SMALL]) expect(synced).toContain(s);
    // Summary reflects all sub-skills and carries no routing metadata.
    const total = summary.skills.reduce((n, s) => n + s.subSkills.length, 0);
    expect(total).toBe(BIG.length + SMALL.length);
    expect((summary as Record<string, unknown>).routing).toBeUndefined();
  });

  it('takes no prompt argument (signature is projectId-only)', () => {
    expect(syncSkillFiles.length).toBe(1);
  });
});
