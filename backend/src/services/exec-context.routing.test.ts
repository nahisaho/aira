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

describe('syncSkillFiles dynamic routing (v3.6.1)', () => {
  let tmpDir: string;
  let originalBaseDir: string;
  let skillSrcRoot: string;
  let projectId: string;

  // A big skill (> threshold): 10 sub-skills named after mandatory routing skills
  // (will match a genomics prompt) + 30 filler sub-skills (won't match).
  const MANDATORY_MATCH = [
    'co-scientist-academic-writing', 'co-scientist-citation-checker', 'co-scientist-data-analysis',
    'co-scientist-deep-learning', 'co-scientist-ml-classification', 'co-scientist-statistical-testing',
    'co-scientist-publication-figures', 'co-scientist-reproducibility', 'co-scientist-literature-review',
    'co-scientist-data-preprocessing',
  ];
  const FILLER = Array.from({ length: 30 }, (_, i) => `co-scientist-filler-${i}`);
  // A small skill (<= threshold): never filtered, names not in any selection set.
  const SMALL = Array.from({ length: 13 }, (_, i) => `spread1000-${i}`);

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-routing-test-'));
    originalBaseDir = getBaseDir();
    setBaseDir(tmpDir);
    closeDatabase();
    await initializeDatabase();

    skillSrcRoot = path.join(tmpDir, 'skill-src');
    const bigDir = makeSkill(skillSrcRoot, 'co-scientist', [...MANDATORY_MATCH, ...FILLER]);
    const smallDir = makeSkill(skillSrcRoot, 'spread1000-assistant', SMALL);

    const db = getDatabase();
    projectId = crypto.randomUUID();
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(projectId, 'Routing Test');
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
    delete process.env.AIRA_DYNAMIC_SKILL_ROUTING;
    closeDatabase();
    setBaseDir(originalBaseDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('without a prompt, syncs ALL sub-skills (assignment-time behaviour)', () => {
    const summary = syncSkillFiles(projectId);
    expect(summary.routing).toBeUndefined();
    expect(syncedSubSkills(projectId)).toHaveLength(MANDATORY_MATCH.length + FILLER.length + SMALL.length);
  });

  it('with a prompt, filters the big skill but keeps the small skill intact', () => {
    const summary = syncSkillFiles(projectId, 'Run a GWAS on this genome variant dataset');
    const synced = syncedSubSkills(projectId);

    // Big skill: only the 10 matching sub-skills survive; 30 fillers dropped.
    for (const s of MANDATORY_MATCH) expect(synced).toContain(s);
    for (const s of FILLER) expect(synced).not.toContain(s);
    // Small skill (13 ≤ threshold): every sub-skill kept — NOT disabled.
    for (const s of SMALL) expect(synced).toContain(s);

    expect(summary.routing?.applied).toBe(true);
    expect(summary.routing?.domains).toContain('genomics');
    expect(summary.routing?.selected).toBe(MANDATORY_MATCH.length);
    expect(summary.routing?.skipped).toBe(FILLER.length);
  });

  it('opts out of filtering when AIRA_DYNAMIC_SKILL_ROUTING=off', () => {
    process.env.AIRA_DYNAMIC_SKILL_ROUTING = 'off';
    const summary = syncSkillFiles(projectId, 'Run a GWAS on this genome');
    expect(summary.routing).toBeUndefined();
    expect(syncedSubSkills(projectId)).toHaveLength(MANDATORY_MATCH.length + FILLER.length + SMALL.length);
  });

  it('falls back to syncing all when no sub-skill matches the selection (drift safety)', () => {
    // Rebuild the big skill with 40 names that are NOT in any selection set.
    fs.rmSync(skillSrcRoot, { recursive: true, force: true });
    const onlyFiller = Array.from({ length: 40 }, (_, i) => `co-scientist-unknown-${i}`);
    const bigDir = makeSkill(skillSrcRoot, 'co-scientist', onlyFiller);
    const smallDir = makeSkill(skillSrcRoot, 'spread1000-assistant', SMALL);
    const db = getDatabase();
    db.prepare("UPDATE skills SET skill_path = ? WHERE name = 'co-scientist'").run(bigDir);
    db.prepare("UPDATE skills SET skill_path = ? WHERE name = 'spread1000-assistant'").run(smallDir);

    const summary = syncSkillFiles(projectId, 'genome variant analysis');
    // No match → fallback syncs all 40 + 13.
    expect(syncedSubSkills(projectId)).toHaveLength(40 + SMALL.length);
    expect(summary.routing?.applied).toBe(false);
  });
});
