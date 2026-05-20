import { Hono } from 'hono';
import { getDatabase } from '../db/index.js';
import { AuthService } from '../services/auth.service.js';
import * as pathConfig from '../config/paths.js';
import {
  getRagSettings,
  updateRagSettings,
  getRagStats,
  searchKnowledge,
  buildContext,
  clearIndex,
} from '../services/rag.service.js';
import { reindexProject } from '../services/rag-extractor.js';

const ragRoutes = new Hono();
const authService = new AuthService();

// GET /api/projects/:id/rag — Get RAG settings and stats
ragRoutes.get('/api/projects/:id/rag', (c) => {
  const projectId = c.req.param('id');
  const db = getDatabase();

  const settings = getRagSettings(db, projectId);
  const stats = getRagStats(db, projectId);

  return c.json({ settings, stats });
});

// PUT /api/projects/:id/rag — Update RAG settings
ragRoutes.put('/api/projects/:id/rag', async (c) => {
  const projectId = c.req.param('id');
  const db = getDatabase();

  const body = await c.req.json() as Partial<{
    enabled: boolean;
    max_context_chars: number;
    auto_index_files: boolean;
  }>;

  if (body.max_context_chars !== undefined) {
    if (typeof body.max_context_chars !== 'number' || body.max_context_chars < 0 || body.max_context_chars > 200_000) {
      return c.json({ error: 'max_context_chars must be between 0 and 200000' }, 400);
    }
  }

  const settings = updateRagSettings(db, projectId, body);
  return c.json({ settings });
});

// POST /api/projects/:id/rag/reindex — Manual reindex
ragRoutes.post('/api/projects/:id/rag/reindex', async (c) => {
  const projectId = c.req.param('id');
  const db = getDatabase();
  const token = authService.resolveToken();

  if (!token) {
    return c.json({ error: 'Token not configured' }, 401);
  }

  const workspaceDir = pathConfig.getWorkspaceDir(projectId);

  // Reindex in background — clear old index only after successful reindex
  reindexProject(db, projectId, token, workspaceDir)
    .then(result => {
      console.log(`[rag] reindex complete for ${projectId}: ${result.messages} messages, ${result.files} files`);
    })
    .catch(err => {
      console.error(`[rag] reindex failed for ${projectId}:`, (err as Error).message);
    });

  return c.json({ status: 'started', message: 'Reindexing started in background' });
});

// DELETE /api/projects/:id/rag/index — Clear index
ragRoutes.delete('/api/projects/:id/rag/index', (c) => {
  const projectId = c.req.param('id');
  const db = getDatabase();

  clearIndex(db, projectId);
  const stats = getRagStats(db, projectId);

  return c.json({ status: 'cleared', stats });
});

// GET /api/projects/:id/rag/search — Debug search
ragRoutes.get('/api/projects/:id/rag/search', (c) => {
  const projectId = c.req.param('id');
  const query = c.req.query('q');
  const db = getDatabase();

  if (!query) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }

  const settings = getRagSettings(db, projectId);
  const results = searchKnowledge(db, projectId, query);
  const context = buildContext(results, settings.max_context_chars);

  return c.json({ results, context });
});

export { ragRoutes };
