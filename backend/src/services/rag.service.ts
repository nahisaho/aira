/**
 * Structured RAG Service
 *
 * Per-project knowledge indexing and retrieval inspired by TypeAgent's KnowPro.
 * Two-tier extraction:
 *   1. Synchronous: lightweight regex-based token extraction (no LLM)
 *   2. Asynchronous: LLM-based structured extraction (entities, actions, topics)
 *
 * Storage: SQLite inverted index (rag_knowledge + rag_index tables)
 * Retrieval: term-based search → ranked knowledge → context assembly
 */

import type { CompatDatabase } from '../db/index.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface KnowledgeEntity {
  name: string;
  type: string[];
  facets?: Array<{ name: string; value: string }>;
}

export interface KnowledgeAction {
  verbs: string[];
  subject: string;
  object: string;
  tense: 'past' | 'present' | 'future';
}

export interface KnowledgeResponse {
  entities: KnowledgeEntity[];
  actions: KnowledgeAction[];
  topics: string[];
}

export interface RagSettings {
  project_id: string;
  enabled: boolean;
  max_context_chars: number;
  auto_index_files: boolean;
}

export interface RagStats {
  knowledge_count: number;
  index_term_count: number;
  indexed_messages: number;
  indexed_files: number;
}

export interface SearchResult {
  knowledge_id: number;
  type: string;
  data_json: string;
  score: number;
  source_message_id: string | null;
  source_file: string | null;
}

// ── Settings ───────────────────────────────────────────────────────────

export function getRagSettings(db: CompatDatabase, projectId: string): RagSettings {
  const row = db.prepare(
    'SELECT * FROM rag_settings WHERE project_id = ?',
  ).get(projectId) as { project_id: string; enabled: number; max_context_chars: number; auto_index_files: number } | undefined;

  if (!row) {
    return {
      project_id: projectId,
      enabled: false,
      max_context_chars: 4000,
      auto_index_files: true,
    };
  }

  return {
    project_id: row.project_id,
    enabled: row.enabled === 1,
    max_context_chars: row.max_context_chars,
    auto_index_files: row.auto_index_files === 1,
  };
}

export function updateRagSettings(
  db: CompatDatabase,
  projectId: string,
  updates: Partial<Pick<RagSettings, 'enabled' | 'max_context_chars' | 'auto_index_files'>>,
): RagSettings {
  const current = getRagSettings(db, projectId);
  const enabled = updates.enabled ?? current.enabled;
  const maxChars = updates.max_context_chars ?? current.max_context_chars;
  const autoFiles = updates.auto_index_files ?? current.auto_index_files;

  db.prepare(`
    INSERT INTO rag_settings (project_id, enabled, max_context_chars, auto_index_files)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      enabled = excluded.enabled,
      max_context_chars = excluded.max_context_chars,
      auto_index_files = excluded.auto_index_files
  `).run(projectId, enabled ? 1 : 0, maxChars, autoFiles ? 1 : 0);

  return { project_id: projectId, enabled, max_context_chars: maxChars, auto_index_files: autoFiles };
}

// ── Stats ──────────────────────────────────────────────────────────────

export function getRagStats(db: CompatDatabase, projectId: string): RagStats {
  const kCount = (db.prepare(
    'SELECT COUNT(*) as cnt FROM rag_knowledge WHERE project_id = ?',
  ).get(projectId) as { cnt: number })?.cnt ?? 0;

  const tCount = (db.prepare(
    'SELECT COUNT(DISTINCT term) as cnt FROM rag_index WHERE project_id = ?',
  ).get(projectId) as { cnt: number })?.cnt ?? 0;

  const mCount = (db.prepare(
    'SELECT COUNT(DISTINCT message_id) as cnt FROM rag_knowledge WHERE project_id = ? AND message_id IS NOT NULL',
  ).get(projectId) as { cnt: number })?.cnt ?? 0;

  const fCount = (db.prepare(
    'SELECT COUNT(DISTINCT file_path) as cnt FROM rag_knowledge WHERE project_id = ? AND file_path IS NOT NULL',
  ).get(projectId) as { cnt: number })?.cnt ?? 0;

  return {
    knowledge_count: kCount,
    index_term_count: tCount,
    indexed_messages: mCount,
    indexed_files: fCount,
  };
}

// ── Lightweight Token Extraction (Synchronous, No LLM) ────────────────

// Japanese particles and common stop words
const STOP_WORDS = new Set([
  // English
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'and', 'but', 'or', 'nor', 'if', 'while', 'because', 'until',
  'about', 'this', 'that', 'these', 'those', 'it', 'its',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them',
  // Japanese particles/auxiliaries
  'の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ',
  'ある', 'いる', 'する', 'なる', 'れる', 'できる', 'ない', 'この', 'その',
  'また', 'および', 'など', 'もの', 'こと', 'ため', 'よう', 'つまり',
  'です', 'ます', 'から', 'まで', 'より', 'という', 'として', 'について',
]);

/**
 * Extract lightweight tokens from text (no LLM required).
 * Returns candidate terms suitable for inverted index.
 */
export function extractTokens(text: string): string[] {
  const tokens = new Set<string>();

  // 1. Extract CamelCase / PascalCase identifiers
  for (const m of text.matchAll(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g)) {
    tokens.add(m[1]!.toLowerCase());
  }

  // 2. Extract UPPER_CASE constants
  for (const m of text.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
    tokens.add(m[1]!.toLowerCase());
  }

  // 3. Extract quoted strings (likely names/terms)
  for (const m of text.matchAll(/[「"'`]([^「」"'`]{2,40})[」"'`]/g)) {
    tokens.add(m[1]!.trim().toLowerCase());
  }

  // 4. Extract markdown headings
  for (const m of text.matchAll(/^#{1,4}\s+(.+)$/gm)) {
    tokens.add(m[1]!.trim().toLowerCase());
  }

  // 5. Extract Japanese compound words (katakana sequences ≥ 2 chars)
  for (const m of text.matchAll(/[\u30A0-\u30FF]{2,}/g)) {
    tokens.add(m[0]);
  }

  // 6. Extract kanji compound words (≥ 2 chars, likely nouns/terms)
  for (const m of text.matchAll(/[\u4E00-\u9FFF]{2,}/g)) {
    tokens.add(m[0]);
  }

  // 7. Extract English words (≥ 3 chars, not stop words)
  for (const m of text.matchAll(/\b([a-zA-Z]{3,})\b/g)) {
    const w = m[1]!.toLowerCase();
    if (!STOP_WORDS.has(w)) {
      tokens.add(w);
    }
  }

  // 8. Extract URLs and file paths as single tokens
  for (const m of text.matchAll(/(?:https?:\/\/[^\s]+|[\w./\\-]+\.\w{1,5})/g)) {
    tokens.add(m[0].toLowerCase());
  }

  // 9. Extract numbers with units
  for (const m of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(万円|円|GB|MB|TB|日間?|時間|分|秒|件|名|人|個)\b/g)) {
    tokens.add(`${m[1]}${m[2]}`);
  }

  return [...tokens].filter(t => t.length >= 2 && t.length <= 100);
}

// ── Knowledge Indexing ─────────────────────────────────────────────────

/**
 * Extract terms from a KnowledgeResponse for the inverted index.
 */
function extractTermsFromKnowledge(kr: KnowledgeResponse): Map<string, { type: string; dataJson: string; score: number }[]> {
  const termMap = new Map<string, { type: string; dataJson: string; score: number }[]>();

  function addTerm(term: string, type: string, dataJson: string, score: number): void {
    const key = term.toLowerCase().trim();
    if (key.length < 2) return;
    const entries = termMap.get(key) ?? [];
    entries.push({ type, dataJson, score });
    termMap.set(key, entries);
  }

  for (const entity of kr.entities) {
    const json = JSON.stringify(entity);
    addTerm(entity.name, 'entity', json, 1.0);
    for (const t of entity.type) {
      addTerm(t, 'entity', json, 0.8);
    }
    if (entity.facets) {
      for (const f of entity.facets) {
        addTerm(f.value, 'entity', json, 0.6);
      }
    }
  }

  for (const action of kr.actions) {
    const json = JSON.stringify(action);
    for (const v of action.verbs) {
      addTerm(v, 'action', json, 1.0);
    }
    addTerm(action.subject, 'action', json, 0.8);
    addTerm(action.object, 'action', json, 0.8);
  }

  for (const topic of kr.topics) {
    const json = JSON.stringify(topic);
    addTerm(topic, 'topic', json, 1.0);
    // Also index individual significant words from topic
    for (const word of topic.split(/\s+/)) {
      const w = word.toLowerCase().replace(/[^\w\u3000-\u9FFF\u30A0-\u30FF]/g, '');
      if (w.length >= 2 && !STOP_WORDS.has(w)) {
        addTerm(w, 'topic', json, 0.5);
      }
    }
  }

  return termMap;
}

/**
 * Index a message's tokens (synchronous, lightweight).
 * Called before CLI invocation for immediate availability.
 */
export function indexMessageTokens(
  db: CompatDatabase,
  projectId: string,
  messageId: string,
  text: string,
): number {
  const tokens = extractTokens(text);
  if (tokens.length === 0) return 0;

  let indexed = 0;
  const insertKnowledge = db.prepare(`
    INSERT INTO rag_knowledge (project_id, message_id, type, data_json)
    VALUES (?, ?, 'topic', ?)
    ON CONFLICT DO NOTHING
  `);
  const insertIndex = db.prepare(`
    INSERT INTO rag_index (term, project_id, knowledge_id, score)
    VALUES (?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);

  // Group tokens as a single "topic" knowledge entry per message
  const topicJson = JSON.stringify(tokens.slice(0, 50).join(', '));
  insertKnowledge.run(projectId, messageId, topicJson);
  const kRow = db.prepare(
    'SELECT id FROM rag_knowledge WHERE project_id = ? AND message_id = ? AND type = ? AND data_json = ?',
  ).get(projectId, messageId, 'topic', topicJson) as { id: number } | undefined;

  if (kRow) {
    for (const token of tokens) {
      insertIndex.run(token, projectId, kRow.id, 0.5);
      indexed++;
    }
  }

  return indexed;
}

/**
 * Index structured knowledge (from LLM extraction).
 * Called asynchronously after CLI completes.
 */
export function indexStructuredKnowledge(
  db: CompatDatabase,
  projectId: string,
  messageId: string | null,
  filePath: string | null,
  knowledge: KnowledgeResponse,
): number {
  const termMap = extractTermsFromKnowledge(knowledge);
  let indexed = 0;

  const insertKnowledge = db.prepare(`
    INSERT INTO rag_knowledge (project_id, message_id, file_path, type, data_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);
  const insertIndex = db.prepare(`
    INSERT INTO rag_index (term, project_id, knowledge_id, score)
    VALUES (?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);

  // Deduplicate knowledge entries
  const seenKnowledge = new Set<string>();

  db.transaction(() => {
    for (const [term, entries] of termMap) {
      for (const entry of entries) {
        try {
          const knowledgeKey = `${entry.type}:${entry.dataJson}`;
          let knowledgeId: number;

          if (!seenKnowledge.has(knowledgeKey)) {
            seenKnowledge.add(knowledgeKey);
            insertKnowledge.run(projectId, messageId, filePath, entry.type, entry.dataJson);
            const kRow = db.prepare(
              `SELECT id FROM rag_knowledge WHERE project_id = ? AND type = ? AND data_json = ?
               AND (message_id = ? OR (message_id IS NULL AND ? IS NULL))
               AND (file_path = ? OR (file_path IS NULL AND ? IS NULL))
               ORDER BY id DESC LIMIT 1`,
            ).get(projectId, entry.type, entry.dataJson, messageId, messageId, filePath, filePath) as { id: number } | undefined;
            if (!kRow) continue;
            knowledgeId = kRow.id;
          } else {
            const kRow = db.prepare(
              `SELECT id FROM rag_knowledge WHERE project_id = ? AND type = ? AND data_json = ?
               AND (message_id = ? OR (message_id IS NULL AND ? IS NULL))
               AND (file_path = ? OR (file_path IS NULL AND ? IS NULL))
               ORDER BY id DESC LIMIT 1`,
            ).get(projectId, entry.type, entry.dataJson, messageId, messageId, filePath, filePath) as { id: number } | undefined;
            if (!kRow) continue;
            knowledgeId = kRow.id;
          }

          insertIndex.run(term, projectId, knowledgeId, entry.score);
          indexed++;
        } catch (itemErr) {
          console.warn(`[rag] failed to index term "${term}":`, (itemErr as Error).message);
        }
      }
    }
  })();

  return indexed;
}

// ── Search ─────────────────────────────────────────────────────────────

/**
 * Search the RAG index for knowledge relevant to a query.
 * Returns ranked results within the character budget.
 */
export function searchKnowledge(
  db: CompatDatabase,
  projectId: string,
  query: string,
  maxResults: number = 20,
): SearchResult[] {
  const queryTokens = extractTokens(query);
  if (queryTokens.length === 0) return [];

  // Build parameterized IN clause
  const placeholders = queryTokens.map(() => '?').join(',');
  const params = [projectId, ...queryTokens];

  const rows = db.prepare(`
    SELECT
      rk.id as knowledge_id,
      rk.type,
      rk.data_json,
      rk.message_id as source_message_id,
      rk.file_path as source_file,
      SUM(ri.score) as total_score,
      COUNT(DISTINCT ri.term) as matching_terms
    FROM rag_index ri
    JOIN rag_knowledge rk ON ri.knowledge_id = rk.id AND rk.project_id = ri.project_id
    WHERE ri.project_id = ?
      AND ri.term IN (${placeholders})
    GROUP BY rk.id
    ORDER BY matching_terms DESC, total_score DESC
    LIMIT ${maxResults}
  `).all(...params) as Array<{
    knowledge_id: number;
    type: string;
    data_json: string;
    source_message_id: string | null;
    source_file: string | null;
    total_score: number;
    matching_terms: number;
  }>;

  return rows.map(r => ({
    knowledge_id: r.knowledge_id,
    type: r.type,
    data_json: r.data_json,
    score: r.total_score,
    source_message_id: r.source_message_id,
    source_file: r.source_file,
  }));
}

// ── Context Assembly ───────────────────────────────────────────────────

/**
 * Build a context string from search results, respecting the character budget.
 */
export function buildContext(
  results: SearchResult[],
  maxChars: number,
): string {
  if (results.length === 0) return '';

  const sections: string[] = [];
  let totalChars = 0;

  // Group by type
  const entities = results.filter(r => r.type === 'entity');
  const actions = results.filter(r => r.type === 'action');
  const topics = results.filter(r => r.type === 'topic');

  // Entities section
  if (entities.length > 0) {
    const lines: string[] = ['## Entities'];
    for (const e of entities) {
      try {
        const data = JSON.parse(e.data_json) as KnowledgeEntity;
        const line = `- **${data.name}** (${data.type.join(', ')})${data.facets?.map(f => ` [${f.name}: ${f.value}]`).join('') ?? ''}`;
        if (totalChars + line.length > maxChars) break;
        lines.push(line);
        totalChars += line.length + 1;
      } catch { /* skip malformed */ }
    }
    if (lines.length > 1) sections.push(lines.join('\n'));
  }

  // Actions section
  if (actions.length > 0 && totalChars < maxChars) {
    const lines: string[] = ['## Actions'];
    for (const a of actions) {
      try {
        const data = JSON.parse(a.data_json) as KnowledgeAction;
        const line = `- ${data.subject} → ${data.verbs.join('/')} → ${data.object} (${data.tense})`;
        if (totalChars + line.length > maxChars) break;
        lines.push(line);
        totalChars += line.length + 1;
      } catch { /* skip malformed */ }
    }
    if (lines.length > 1) sections.push(lines.join('\n'));
  }

  // Topics section
  if (topics.length > 0 && totalChars < maxChars) {
    const lines: string[] = ['## Topics'];
    const seenTopics = new Set<string>();
    for (const t of topics) {
      try {
        const topicText = JSON.parse(t.data_json) as string;
        if (seenTopics.has(topicText)) continue;
        seenTopics.add(topicText);
        const line = `- ${topicText}`;
        if (totalChars + line.length > maxChars) break;
        lines.push(line);
        totalChars += line.length + 1;
      } catch { /* skip malformed */ }
    }
    if (lines.length > 1) sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * Full retrieval pipeline: search + build context.
 */
export function retrieveContext(
  db: CompatDatabase,
  projectId: string,
  query: string,
): string {
  const settings = getRagSettings(db, projectId);
  if (!settings.enabled) return '';

  const results = searchKnowledge(db, projectId, query);
  return buildContext(results, settings.max_context_chars);
}

// ── Index Management ───────────────────────────────────────────────────

/**
 * Clear all RAG index data for a project.
 */
export function clearIndex(db: CompatDatabase, projectId: string): void {
  db.transaction(() => {
    db.prepare('DELETE FROM rag_index WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM rag_knowledge WHERE project_id = ?').run(projectId);
  })();
}

/**
 * Check if a message has already been indexed.
 */
export function isMessageIndexed(db: CompatDatabase, projectId: string, messageId: string): boolean {
  const row = db.prepare(
    'SELECT 1 FROM rag_knowledge WHERE project_id = ? AND message_id = ? LIMIT 1',
  ).get(projectId, messageId);
  return !!row;
}

/**
 * Check if a file has been indexed with the given hash.
 */
export function isFileIndexed(db: CompatDatabase, projectId: string, filePath: string, hash: string): boolean {
  const row = db.prepare(
    'SELECT 1 FROM rag_knowledge WHERE project_id = ? AND file_path = ? AND source_hash = ? LIMIT 1',
  ).get(projectId, filePath, hash);
  return !!row;
}

/**
 * Remove knowledge entries for a specific file (before reindexing).
 */
export function clearFileKnowledge(db: CompatDatabase, projectId: string, filePath: string): void {
  // CASCADE will handle rag_index cleanup
  db.prepare('DELETE FROM rag_knowledge WHERE project_id = ? AND file_path = ?').run(projectId, filePath);
}
