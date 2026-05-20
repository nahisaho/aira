/**
 * RAG Knowledge Extractor
 *
 * Isolated LLM-based knowledge extraction runner.
 * Spawns a separate Copilot CLI process WITHOUT --allow-all or MCP tools
 * to extract structured knowledge (entities, actions, topics) from text.
 *
 * Security:
 *  - No tool access (no --allow-all)
 *  - No MCP tools
 *  - No session name (one-shot)
 *  - Input/output size limits
 *  - JSON schema validation
 *  - Timeout protection
 */

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { CompatDatabase } from '../db/index.js';
import {
  type KnowledgeResponse,
  indexStructuredKnowledge,
  indexMessageTokens,
  getRagSettings,
  isMessageIndexed,
  isFileIndexed,
  clearFileKnowledge,
  clearIndex,
} from './rag.service.js';

// ── Constants ──────────────────────────────────────────────────────────

const EXTRACTION_TIMEOUT_MS = 60_000; // 1 minute per extraction
const MAX_INPUT_CHARS = 8_000;        // Limit text sent for extraction
const MAX_CONCURRENT = 2;             // Max concurrent extractions

// ── State ──────────────────────────────────────────────────────────────

let activeExtractions = 0;
const extractionQueue: Array<() => void> = [];

// ── CLI Resolution ─────────────────────────────────────────────────────

function resolveExtractionCli(): { command: string; argsPrefix: string[] } {
  try {
    execSync('copilot --version', { encoding: 'utf8', timeout: 10_000, stdio: 'pipe' });
    return { command: 'copilot', argsPrefix: [] };
  } catch { /* fall through */ }
  try {
    const scriptPath = require.resolve('@github/copilot/dist/cli.js');
    return { command: process.execPath, argsPrefix: [scriptPath] };
  } catch { /* fall through */ }
  throw new Error('Copilot CLI not found for RAG extraction');
}

// ── Extraction Prompt ──────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a knowledge extraction system. Extract structured knowledge from the given text.
Return ONLY valid JSON with exactly this structure (no markdown, no explanation):
{
  "entities": [{"name": "string", "type": ["string"], "facets": [{"name": "string", "value": "string"}]}],
  "actions": [{"verbs": ["string"], "subject": "string", "object": "string", "tense": "past|present|future"}],
  "topics": ["string"]
}

Rules:
- entities: concrete people, organizations, technologies, places, products mentioned
- actions: relationships between entities (subject → verb → object)
- topics: short descriptive keyword phrases summarizing the content
- Keep names in their original language
- Extract at most 10 entities, 5 actions, 10 topics
- If no meaningful knowledge can be extracted, return {"entities":[],"actions":[],"topics":[]}

Text to extract from:
"""
`;

// ── LLM Extraction ────────────────────────────────────────────────────

/**
 * Run LLM extraction via isolated Copilot CLI (no tools, no session).
 */
function extractWithLlm(
  text: string,
  token: string,
  cwd: string,
): Promise<KnowledgeResponse | null> {
  return new Promise((resolve) => {
    const truncatedText = text.length > MAX_INPUT_CHARS
      ? text.slice(0, MAX_INPUT_CHARS) + '\n[truncated]'
      : text;

    const fullPrompt = EXTRACTION_PROMPT + truncatedText + '\n"""';

    let cli: { command: string; argsPrefix: string[] };
    try {
      cli = resolveExtractionCli();
    } catch {
      console.warn('[rag-extractor] CLI not available, skipping extraction');
      resolve(null);
      return;
    }

    const args = [
      ...cli.argsPrefix,
      '--prompt', fullPrompt,
      '--output-format', 'json',
      '--stream', 'off',
      // NO --allow-all: prevents tool execution from injected text
      // NO --additional-mcp-config: no MCP tool access
      // NO --name/--resume: one-shot, no session state
    ];

    const child = spawn(cli.command, args, {
      cwd,
      env: { ...process.env, GITHUB_TOKEN: token },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stdin?.end();

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 3000);
    }, EXTRACTION_TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        console.warn(`[rag-extractor] CLI exited with code ${code}`);
        resolve(null);
        return;
      }

      // Parse JSON output — the CLI may output JSONL events
      const result = parseExtractionOutput(stdout);
      if (result) {
        console.log(`[rag-extractor] extracted: ${result.entities.length} entities, ${result.actions.length} actions, ${result.topics.length} topics`);
      }
      resolve(result);
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      console.warn(`[rag-extractor] spawn error: ${err.message}`);
      resolve(null);
    });
  });
}

/**
 * Parse extraction output from CLI.
 * The CLI outputs JSONL events; we need the assistant.message content.
 */
function parseExtractionOutput(output: string): KnowledgeResponse | null {
  // Try to find the assistant.message event with the JSON response
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const event = JSON.parse(trimmed) as { type?: string; data?: { content?: string } };
      if (event.type === 'assistant.message' && event.data?.content) {
        return parseKnowledgeJson(event.data.content);
      }
    } catch { /* not JSON or wrong format */ }
  }

  // Fallback: try to parse the entire output as JSON
  return parseKnowledgeJson(output);
}

/**
 * Parse and validate knowledge JSON from LLM output.
 */
function parseKnowledgeJson(text: string): KnowledgeResponse | null {
  // Extract JSON from possible markdown code fences
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]!.trim()) as Record<string, unknown>;

    // Validate structure
    const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    const topics = Array.isArray(parsed.topics) ? parsed.topics : [];

    // Validate and sanitize entities
    const validEntities = entities
      .filter((e: unknown): e is { name: string; type: unknown[] } =>
        typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>).name === 'string')
      .map(e => ({
        name: String(e.name).slice(0, 200),
        type: (Array.isArray(e.type) ? e.type : []).map(String).slice(0, 5),
        facets: Array.isArray((e as Record<string, unknown>).facets)
          ? ((e as Record<string, unknown>).facets as Array<{ name: string; value: string }>)
              .filter(f => typeof f.name === 'string' && typeof f.value === 'string')
              .slice(0, 10)
          : undefined,
      }))
      .slice(0, 10);

    // Validate and sanitize actions
    const validActions = actions
      .filter((a: unknown): a is { verbs: unknown[]; subject: string; object: string } =>
        typeof a === 'object' && a !== null &&
        typeof (a as Record<string, unknown>).subject === 'string' &&
        typeof (a as Record<string, unknown>).object === 'string')
      .map(a => ({
        verbs: (Array.isArray(a.verbs) ? a.verbs : []).map(String).slice(0, 5),
        subject: String(a.subject).slice(0, 200),
        object: String(a.object).slice(0, 200),
        tense: (['past', 'present', 'future'].includes(String((a as Record<string, unknown>).tense))
          ? String((a as Record<string, unknown>).tense)
          : 'present') as 'past' | 'present' | 'future',
      }))
      .slice(0, 5);

    // Validate and sanitize topics
    const validTopics = topics
      .filter((t: unknown) => typeof t === 'string' && t.length > 0)
      .map(t => String(t).slice(0, 200))
      .slice(0, 10);

    return {
      entities: validEntities,
      actions: validActions,
      topics: validTopics,
    };
  } catch {
    return null;
  }
}

// ── Queue Management ───────────────────────────────────────────────────

function acquireSlot(): Promise<void> {
  if (activeExtractions < MAX_CONCURRENT) {
    activeExtractions++;
    return Promise.resolve();
  }
  return new Promise(resolve => {
    extractionQueue.push(resolve);
  });
}

function releaseSlot(): void {
  activeExtractions--;
  const next = extractionQueue.shift();
  if (next) {
    activeExtractions++;
    next();
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Queue async LLM extraction for a message.
 * Non-blocking — runs in background.
 */
export function queueMessageExtraction(
  db: CompatDatabase,
  projectId: string,
  messageId: string,
  content: string,
  token: string,
  workspaceDir: string,
): void {
  const settings = getRagSettings(db, projectId);
  if (!settings.enabled) return;

  // Skip if already indexed with structured knowledge
  if (isMessageIndexed(db, projectId, messageId)) return;

  // Skip very short messages
  if (content.trim().length < 20) return;

  (async () => {
    await acquireSlot();
    try {
      const result = await extractWithLlm(content, token, workspaceDir);
      if (result && (result.entities.length > 0 || result.actions.length > 0 || result.topics.length > 0)) {
        const indexed = indexStructuredKnowledge(db, projectId, messageId, null, result);
        console.log(`[rag-extractor] indexed ${indexed} terms for message ${messageId.slice(0, 8)}`);
      }
    } catch (err) {
      console.warn(`[rag-extractor] extraction failed for message ${messageId.slice(0, 8)} (content ${content.length} chars):`, (err as Error).message);
      // Index sync tokens as fallback when LLM extraction fails
      try {
        indexMessageTokens(db, projectId, messageId, content);
        console.log(`[rag-extractor] fallback: indexed sync tokens for message ${messageId.slice(0, 8)}`);
      } catch { /* best effort */ }
    } finally {
      releaseSlot();
    }
  })();
}

/**
 * Index a workspace file's contents.
 * Called when files are created or modified.
 */
export function queueFileExtraction(
  db: CompatDatabase,
  projectId: string,
  filePath: string,
  absolutePath: string,
  contentHash: string,
  token: string,
  workspaceDir: string,
): void {
  const settings = getRagSettings(db, projectId);
  if (!settings.enabled || !settings.auto_index_files) return;

  // Check if already indexed with this hash
  if (isFileIndexed(db, projectId, filePath, contentHash)) return;

  // Only index text files
  const ext = path.extname(filePath).toLowerCase();
  const TEXT_EXTENSIONS = new Set([
    '.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.csv',
    '.py', '.ts', '.tsx', '.js', '.jsx', '.rs', '.go', '.java', '.c', '.cpp',
    '.h', '.hpp', '.cs', '.rb', '.php', '.swift', '.kt', '.scala', '.sql',
    '.css', '.scss', '.less', '.vue', '.svelte', '.sh', '.bash', '.zsh',
    '.r', '.m', '.jl', '.lua', '.pl', '.tex', '.bib',
  ]);
  if (!TEXT_EXTENSIONS.has(ext)) return;

  // Size limit: 100KB
  try {
    const stat = fs.statSync(absolutePath);
    if (stat.size > 100_000) return;
  } catch { return; }

  (async () => {
    await acquireSlot();
    try {
      const content = fs.readFileSync(absolutePath, 'utf8');

      // Clear old knowledge for this file before reindexing
      clearFileKnowledge(db, projectId, filePath);

      const result = await extractWithLlm(content, token, workspaceDir);
      if (result && (result.entities.length > 0 || result.actions.length > 0 || result.topics.length > 0)) {
        const indexed = indexStructuredKnowledge(db, projectId, null, filePath, result);
        // Update source_hash
        db.prepare(
          'UPDATE rag_knowledge SET source_hash = ? WHERE project_id = ? AND file_path = ?',
        ).run(contentHash, projectId, filePath);
        console.log(`[rag-extractor] indexed ${indexed} terms for file ${filePath}`);
      }
    } catch (err) {
      console.warn(`[rag-extractor] extraction failed for file ${filePath}:`, (err as Error).message);
    } finally {
      releaseSlot();
    }
  })();
}

/**
 * Reindex all messages and files for a project.
 */
export async function reindexProject(
  db: CompatDatabase,
  projectId: string,
  token: string,
  workspaceDir: string,
): Promise<{ messages: number; files: number }> {
  // Clear existing index before rebuilding — atomic within this function
  clearIndex(db, projectId);

  // Get all messages
  const messages = db.prepare(
    `SELECT id, content FROM messages
     WHERE project_id = ? AND role IN ('user', 'assistant') AND content != ''
     ORDER BY created_at ASC`,
  ).all(projectId) as Array<{ id: string; content: string }>;

  let msgCount = 0;
  for (const msg of messages) {
    if (msg.content.trim().length < 20) continue;
    await acquireSlot();
    try {
      const result = await extractWithLlm(msg.content, token, workspaceDir);
      if (result) {
        indexStructuredKnowledge(db, projectId, msg.id, null, result);
        msgCount++;
      }
    } catch (err) {
      console.warn(`[rag-extractor] reindex failed for message ${msg.id.slice(0, 8)}:`, (err as Error).message);
    } finally {
      releaseSlot();
    }
  }

  // Get all text files
  const files = db.prepare(
    'SELECT file_path, content_hash FROM project_files WHERE project_id = ?',
  ).all(projectId) as Array<{ file_path: string; content_hash: string | null }>;

  let fileCount = 0;
  for (const file of files) {
    const absPath = path.join(workspaceDir, file.file_path);
    if (file.content_hash) {
      queueFileExtraction(db, projectId, file.file_path, absPath, file.content_hash, token, workspaceDir);
      fileCount++;
    }
  }

  return { messages: msgCount, files: fileCount };
}
