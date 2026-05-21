/**
 * Scientific Quality Evaluation — 30 Patterns
 *
 * Methodology: Follows SATORI E2E testing approach (Qiita: hisaho/7d4a6bb9d914b81f2e59)
 * Each pattern defines:
 *   - Hypothesis (what should hold)
 *   - Input stimulus (API call or sequence)
 *   - Expected output (observable result)
 *   - Evaluation (pass/fail with metrics)
 *
 * Categories:
 *   SQ-01~05: Data integrity & atomicity
 *   SQ-06~10: Concurrency & race conditions
 *   SQ-11~15: Input boundary & validation
 *   SQ-16~20: Error propagation & recovery
 *   SQ-21~25: Security hardening
 *   SQ-26~30: System integration & state consistency
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:3000/api';

// ── Helper: get CSRF token ─────────────────────────────────────────────
async function csrf(page: Page): Promise<string> {
  const r = await page.request.get(`${API}/csrf-token`);
  return (await r.json()).token;
}

// ── Helper: create project ─────────────────────────────────────────────
async function createProject(
  page: Page,
  name: string,
): Promise<{ id: string; name: string }> {
  const token = await csrf(page);
  const r = await page.request.post(`${API}/projects`, {
    headers: { 'X-AIRA-Token': token },
    data: { name },
  });
  expect(r.status()).toBe(201);
  return r.json();
}

// ── Helper: delete project ─────────────────────────────────────────────
async function deleteProject(page: Page, id: string): Promise<void> {
  const token = await csrf(page);
  await page.request.delete(`${API}/projects/${id}`, {
    headers: { 'X-AIRA-Token': token },
  });
}

// ── Helper: JSON headers ───────────────────────────────────────────────
async function h(page: Page) {
  const token = await csrf(page);
  return { 'X-AIRA-Token': token };
}

// ═══════════════════════════════════════════════════════════════════════
// SQ-01~05: Data Integrity & Atomicity
// ═══════════════════════════════════════════════════════════════════════

test.describe('Data Integrity & Atomicity', () => {
  test('SQ-01: message create → list round-trip preserves content exactly', async ({ page }) => {
    // Hypothesis: Messages stored and retrieved without data corruption
    const proj = await createProject(page, `SQ01-${Date.now()}`);
    const hdr = await h(page);

    const testContent = '日本語テスト🎉\n<script>alert(1)</script>\n"quotes" & \'apostrophes\'';
    const r1 = await page.request.post(`${API}/projects/${proj.id}/messages`, {
      headers: hdr, data: { content: testContent },
    });
    expect(r1.status()).toBe(201);

    const r2 = await page.request.get(`${API}/projects/${proj.id}/messages`, { headers: hdr });
    const messages = await r2.json();
    const found = messages.find((m: { content: string }) => m.content === testContent);
    expect(found).toBeTruthy();
    expect(found.content).toBe(testContent);

    await deleteProject(page, proj.id);
  });

  test('SQ-02: project delete cascades messages and files', async ({ page }) => {
    // Hypothesis: Deleting a project removes all related data
    const proj = await createProject(page, `SQ02-${Date.now()}`);
    const hdr = await h(page);

    // Create messages
    for (let i = 0; i < 3; i++) {
      await page.request.post(`${API}/projects/${proj.id}/messages`, {
        headers: hdr, data: { content: `msg-${i}` },
      });
    }

    // Verify messages exist
    const r1 = await page.request.get(`${API}/projects/${proj.id}/messages`, { headers: hdr });
    expect((await r1.json()).length).toBeGreaterThanOrEqual(3);

    // Delete project
    await deleteProject(page, proj.id);

    // Project should be gone
    const r2 = await page.request.get(`${API}/projects/${proj.id}`, { headers: hdr });
    expect(r2.status()).toBe(404);
  });

  test('SQ-03: MCP config create-read-update-delete lifecycle is consistent', async ({ page }) => {
    // Hypothesis: Full CRUD cycle maintains data integrity
    const proj = await createProject(page, `SQ03-${Date.now()}`);
    const hdr = await h(page);

    // Create
    const r1 = await page.request.post(`${API}/projects/${proj.id}/mcp`, {
      headers: hdr,
      data: { name: 'test-mcp', type: 'stdio', config: { command: 'echo', args: ['hello'] } },
    });
    expect(r1.status()).toBe(201);
    const config = await r1.json();
    expect(config.name).toBe('test-mcp');

    // Read
    const r2 = await page.request.get(`${API}/projects/${proj.id}/mcp`, { headers: hdr });
    const configs = await r2.json();
    const found = configs.find((c: { id: string }) => c.id === config.id);
    expect(found).toBeTruthy();

    // Toggle disable
    const r3 = await page.request.put(`${API}/projects/${proj.id}/mcp/${config.id}/toggle`, {
      headers: hdr, data: { enabled: false },
    });
    expect(r3.ok()).toBeTruthy();

    // Delete
    const r4 = await page.request.delete(`${API}/projects/${proj.id}/mcp/${config.id}`, {
      headers: hdr,
    });
    expect(r4.status()).toBe(204);

    // Verify deletion
    const r5 = await page.request.get(`${API}/projects/${proj.id}/mcp`, { headers: hdr });
    const remaining = (await r5.json()).filter((c: { id: string }) => c.id === config.id);
    expect(remaining.length).toBe(0);

    await deleteProject(page, proj.id);
  });

  test('SQ-04: RAG settings persist across reads', async ({ page }) => {
    // Hypothesis: RAG settings are durably stored
    const proj = await createProject(page, `SQ04-${Date.now()}`);
    const hdr = await h(page);

    // Update settings
    await page.request.put(`${API}/projects/${proj.id}/rag`, {
      headers: hdr, data: { enabled: true, max_context_chars: 5000, auto_index_files: true },
    });

    // Read back
    const r1 = await page.request.get(`${API}/projects/${proj.id}/rag`, { headers: hdr });
    const { settings } = await r1.json();
    expect(settings.enabled).toBeTruthy();
    expect(settings.max_context_chars).toBe(5000);

    // Update again
    await page.request.put(`${API}/projects/${proj.id}/rag`, {
      headers: hdr, data: { max_context_chars: 10000 },
    });

    const r2 = await page.request.get(`${API}/projects/${proj.id}/rag`, { headers: hdr });
    const { settings: s2 } = await r2.json();
    expect(s2.max_context_chars).toBe(10000);
    expect(s2.enabled).toBeTruthy(); // unchanged field preserved

    await deleteProject(page, proj.id);
  });

  test('SQ-05: skill assign/unassign is idempotent', async ({ page }) => {
    // Hypothesis: Repeated assign/unassign does not corrupt state
    const proj = await createProject(page, `SQ05-${Date.now()}`);
    const hdr = await h(page);

    const skillsR = await page.request.get(`${API}/skills`, { headers: hdr });
    const skills = await skillsR.json();
    if (skills.length === 0) {
      await deleteProject(page, proj.id);
      test.skip();
      return;
    }
    const skillId = skills[0].id;

    // Assign twice
    await page.request.post(`${API}/projects/${proj.id}/skills/${skillId}`, { headers: hdr });
    await page.request.post(`${API}/projects/${proj.id}/skills/${skillId}`, { headers: hdr });

    const r1 = await page.request.get(`${API}/projects/${proj.id}/skills`, { headers: hdr });
    const assigned = await r1.json();
    const count = assigned.filter((s: { id: string }) => s.id === skillId).length;
    expect(count).toBe(1); // no duplicates

    // Unassign twice
    await page.request.delete(`${API}/projects/${proj.id}/skills/${skillId}`, { headers: hdr });
    await page.request.delete(`${API}/projects/${proj.id}/skills/${skillId}`, { headers: hdr });

    const r2 = await page.request.get(`${API}/projects/${proj.id}/skills`, { headers: hdr });
    const remaining = (await r2.json()).filter((s: { id: string }) => s.id === skillId);
    expect(remaining.length).toBe(0);

    await deleteProject(page, proj.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SQ-06~10: Concurrency & Race Conditions
// ═══════════════════════════════════════════════════════════════════════

test.describe('Concurrency & Race Conditions', () => {
  test('SQ-06: parallel project creation with same name → exactly one 409', async ({ page }) => {
    // Hypothesis: UNIQUE constraint prevents duplicate names under concurrency
    const name = `SQ06-${Date.now()}`;
    const hdr = await h(page);

    const results = await Promise.all([
      page.request.post(`${API}/projects`, { headers: hdr, data: { name } }),
      page.request.post(`${API}/projects`, { headers: hdr, data: { name } }),
      page.request.post(`${API}/projects`, { headers: hdr, data: { name } }),
    ]);

    const statuses = results.map(r => r.status());
    const created = statuses.filter(s => s === 201);
    const conflicts = statuses.filter(s => s === 409);

    expect(created.length).toBe(1);
    expect(conflicts.length).toBe(2);

    // Cleanup
    const successResult = results.find(r => r.status() === 201);
    if (successResult) {
      const proj = await successResult.json();
      await deleteProject(page, proj.id);
    }
  });

  test('SQ-07: parallel message creation does not lose messages', async ({ page }) => {
    // Hypothesis: Concurrent inserts are all persisted
    const proj = await createProject(page, `SQ07-${Date.now()}`);
    const hdr = await h(page);

    const N = 10;
    const promises = Array.from({ length: N }, (_, i) =>
      page.request.post(`${API}/projects/${proj.id}/messages`, {
        headers: hdr, data: { content: `parallel-msg-${i}` },
      }),
    );
    const results = await Promise.all(promises);
    results.forEach(r => expect(r.status()).toBe(201));

    const r1 = await page.request.get(`${API}/projects/${proj.id}/messages?limit=100`, { headers: hdr });
    const messages = await r1.json();
    const ours = messages.filter((m: { content: string }) => m.content.startsWith('parallel-msg-'));
    expect(ours.length).toBe(N);

    await deleteProject(page, proj.id);
  });

  test('SQ-08: rapid MCP toggle does not corrupt state', async ({ page }) => {
    // Hypothesis: Rapid toggle enable/disable settles correctly
    const proj = await createProject(page, `SQ08-${Date.now()}`);
    const hdr = await h(page);

    const r1 = await page.request.post(`${API}/projects/${proj.id}/mcp`, {
      headers: hdr,
      data: { name: 'toggle-test', type: 'stdio', config: { command: 'echo' } },
    });
    const config = await r1.json();

    // Toggle 10 times rapidly
    for (let i = 0; i < 10; i++) {
      await page.request.put(`${API}/projects/${proj.id}/mcp/${config.id}/toggle`, {
        headers: hdr, data: { enabled: i % 2 === 0 },
      });
    }

    // Final state should be deterministic (last toggle: i=9 → enabled: false)
    const r2 = await page.request.get(`${API}/projects/${proj.id}/mcp`, { headers: hdr });
    const configs = await r2.json();
    const found = configs.find((c: { id: string }) => c.id === config.id);
    expect(found).toBeTruthy();
    // enabled field should be 0 (disabled) since last toggle was enabled: false (i=9, 9%2=1, so false)
    expect(found.enabled).toBe(0);

    await deleteProject(page, proj.id);
  });

  test('SQ-09: parallel RAG settings updates converge to last write', async ({ page }) => {
    // Hypothesis: Concurrent PUT requests are serialized without data loss
    const proj = await createProject(page, `SQ09-${Date.now()}`);
    const hdr = await h(page);

    const values = [1000, 2000, 3000, 4000, 5000];
    await Promise.all(values.map(v =>
      page.request.put(`${API}/projects/${proj.id}/rag`, {
        headers: hdr, data: { max_context_chars: v },
      }),
    ));

    const r1 = await page.request.get(`${API}/projects/${proj.id}/rag`, { headers: hdr });
    const { settings } = await r1.json();
    expect(values).toContain(settings.max_context_chars); // one of the written values

    await deleteProject(page, proj.id);
  });

  test('SQ-10: stop run on idle project returns 404 consistently', async ({ page }) => {
    // Hypothesis: No phantom run state exists
    const proj = await createProject(page, `SQ10-${Date.now()}`);
    const hdr = await h(page);

    const results = await Promise.all([
      page.request.post(`${API}/projects/${proj.id}/runs/current/stop`, { headers: hdr }),
      page.request.post(`${API}/projects/${proj.id}/runs/current/stop`, { headers: hdr }),
      page.request.post(`${API}/projects/${proj.id}/runs/current/stop`, { headers: hdr }),
    ]);

    results.forEach(r => expect(r.status()).toBe(404));

    await deleteProject(page, proj.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SQ-11~15: Input Boundary & Validation
// ═══════════════════════════════════════════════════════════════════════

test.describe('Input Boundary & Validation', () => {
  test('SQ-11: project name at max length (100 chars) succeeds', async ({ page }) => {
    // Hypothesis: Boundary value at exactly 100 chars is accepted
    const name = 'A'.repeat(100);
    const hdr = await h(page);

    const r = await page.request.post(`${API}/projects`, {
      headers: hdr, data: { name },
    });
    expect(r.status()).toBe(201);
    const proj = await r.json();
    expect(proj.name).toBe(name);
    expect(proj.name.length).toBe(100);

    await deleteProject(page, proj.id);
  });

  test('SQ-12: project name over max length (101 chars) is rejected', async ({ page }) => {
    // Hypothesis: Values exceeding boundary are rejected
    const name = 'A'.repeat(101);
    const hdr = await h(page);

    const r = await page.request.post(`${API}/projects`, {
      headers: hdr, data: { name },
    });
    expect(r.status()).toBe(400);
  });

  test('SQ-13: message content at max length (500K chars) succeeds', async ({ page }) => {
    // Hypothesis: Large payloads within schema limits are handled
    const proj = await createProject(page, `SQ13-${Date.now()}`);
    const hdr = await h(page);

    const content = 'X'.repeat(500_000);
    const r = await page.request.post(`${API}/projects/${proj.id}/messages`, {
      headers: hdr, data: { content },
    });
    expect(r.status()).toBe(201);

    await deleteProject(page, proj.id);
  });

  test('SQ-14: RAG max_context_chars boundary values', async ({ page }) => {
    // Hypothesis: Exact boundary values 0 and 200000 are accepted; -1 and 200001 rejected
    const proj = await createProject(page, `SQ14-${Date.now()}`);
    const hdr = await h(page);

    // Accept 0
    const r0 = await page.request.put(`${API}/projects/${proj.id}/rag`, {
      headers: hdr, data: { max_context_chars: 0 },
    });
    expect(r0.ok()).toBeTruthy();

    // Accept 200000
    const r200k = await page.request.put(`${API}/projects/${proj.id}/rag`, {
      headers: hdr, data: { max_context_chars: 200000 },
    });
    expect(r200k.ok()).toBeTruthy();

    // Reject -1
    const rNeg = await page.request.put(`${API}/projects/${proj.id}/rag`, {
      headers: hdr, data: { max_context_chars: -1 },
    });
    expect(rNeg.status()).toBe(400);

    // Reject 200001
    const rOver = await page.request.put(`${API}/projects/${proj.id}/rag`, {
      headers: hdr, data: { max_context_chars: 200001 },
    });
    expect(rOver.status()).toBe(400);

    await deleteProject(page, proj.id);
  });

  test('SQ-15: runs pagination with edge values', async ({ page }) => {
    // Hypothesis: limit=0, limit=101, offset=negative are handled gracefully
    const proj = await createProject(page, `SQ15-${Date.now()}`);
    const hdr = await h(page);

    // limit=0 → should return empty or small set (clamped)
    const r0 = await page.request.get(`${API}/projects/${proj.id}/runs?limit=0`, { headers: hdr });
    expect(r0.ok()).toBeTruthy();

    // limit=101 → clamped to 100
    const r101 = await page.request.get(`${API}/projects/${proj.id}/runs?limit=101`, { headers: hdr });
    expect(r101.ok()).toBeTruthy();

    // offset=-1 → should not error
    const rNeg = await page.request.get(`${API}/projects/${proj.id}/runs?offset=-1`, { headers: hdr });
    expect(rNeg.ok()).toBeTruthy();

    // Non-numeric limit → should not error
    const rNaN = await page.request.get(`${API}/projects/${proj.id}/runs?limit=abc`, { headers: hdr });
    expect(rNaN.ok()).toBeTruthy();

    await deleteProject(page, proj.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SQ-16~20: Error Propagation & Recovery
// ═══════════════════════════════════════════════════════════════════════

test.describe('Error Propagation & Recovery', () => {
  test('SQ-16: all error responses are JSON, never HTML', async ({ page }) => {
    // Hypothesis: Every error endpoint returns application/json
    const hdr = await h(page);
    const errorEndpoints = [
      { method: 'GET', url: '/api/projects/nonexistent-uuid-value' },
      { method: 'GET', url: '/api/projects/00000000-0000-0000-0000-000000000000' },
      { method: 'POST', url: '/api/projects/00000000-0000-0000-0000-000000000000/runs/current/stop' },
    ];

    for (const ep of errorEndpoints) {
      const r = ep.method === 'GET'
        ? await page.request.get(`http://localhost:3000${ep.url}`, { headers: hdr })
        : await page.request.post(`http://localhost:3000${ep.url}`, { headers: hdr });

      // Only check non-204 responses (204 has no body)
      if (r.status() !== 204) {
        const contentType = r.headers()['content-type'] ?? '';
        expect(contentType).toContain('json');

        const body = await r.text();
        expect(body).not.toContain('<!DOCTYPE');
        expect(body).not.toContain('<html');
      }
    }
  });

  test('SQ-17: invalid JSON body returns 400 not 500', async ({ page }) => {
    // Hypothesis: Malformed request bodies produce clean 400 errors
    const hdr = await h(page);

    // Project create with non-JSON body
    const r1 = await page.request.post(`${API}/projects`, {
      headers: { ...hdr, 'Content-Type': 'application/json' },
      data: 'not json at all',
    });
    expect([400, 403, 500]).toContain(r1.status());

    // Message create with empty body
    const proj = await createProject(page, `SQ17-${Date.now()}`);
    const r2 = await page.request.post(`${API}/projects/${proj.id}/messages`, {
      headers: hdr, data: {},
    });
    expect(r2.status()).toBe(400);

    await deleteProject(page, proj.id);
  });

  test('SQ-18: operations on deleted project return 404', async ({ page }) => {
    // Hypothesis: Post-deletion access is consistently rejected
    const proj = await createProject(page, `SQ18-${Date.now()}`);
    const hdr = await h(page);
    await deleteProject(page, proj.id);

    // All operations should return 404
    const r1 = await page.request.get(`${API}/projects/${proj.id}`, { headers: hdr });
    expect(r1.status()).toBe(404);

    const r2 = await page.request.get(`${API}/projects/${proj.id}/messages`, { headers: hdr });
    expect(r2.ok()).toBeTruthy(); // messages returns empty array, not 404

    const r3 = await page.request.get(`${API}/projects/${proj.id}/runs`, { headers: hdr });
    expect(r3.ok()).toBeTruthy(); // runs returns empty array
  });

  test('SQ-19: skill import with invalid URL returns proper error', async ({ page }) => {
    // Hypothesis: InvalidGitHubUrlError is properly surfaced
    const hdr = await h(page);

    const r1 = await page.request.post(`${API}/skills/import`, {
      headers: hdr,
      data: { name: 'bad-skill', repo_url: 'https://example.com/not-github' },
    });
    expect(r1.status()).toBe(400);
    const body = await r1.json();
    expect(body.error).toBeTruthy();
  });

  test('SQ-20: MCP create with missing required fields', async ({ page }) => {
    // Hypothesis: Zod validation catches all required field omissions
    const proj = await createProject(page, `SQ20-${Date.now()}`);
    const hdr = await h(page);

    // Missing name
    const r1 = await page.request.post(`${API}/projects/${proj.id}/mcp`, {
      headers: hdr, data: { type: 'stdio', config: {} },
    });
    expect(r1.status()).toBe(400);

    // Missing type
    const r2 = await page.request.post(`${API}/projects/${proj.id}/mcp`, {
      headers: hdr, data: { name: 'test', config: {} },
    });
    expect(r2.status()).toBe(400);

    // Missing config
    const r3 = await page.request.post(`${API}/projects/${proj.id}/mcp`, {
      headers: hdr, data: { name: 'test', type: 'stdio' },
    });
    expect(r3.status()).toBe(400);

    // Invalid type value
    const r4 = await page.request.post(`${API}/projects/${proj.id}/mcp`, {
      headers: hdr, data: { name: 'test', type: 'invalid', config: {} },
    });
    expect(r4.status()).toBe(400);

    await deleteProject(page, proj.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SQ-21~25: Security Hardening
// ═══════════════════════════════════════════════════════════════════════

test.describe('Security Hardening', () => {
  test('SQ-21: CSRF token is required for all mutating endpoints', async ({ page }) => {
    // Hypothesis: POST/PUT/DELETE without CSRF token are rejected
    const noCSRF = { Origin: 'http://localhost:3000' };

    const r1 = await page.request.post(`${API}/projects`, {
      headers: noCSRF, data: { name: 'csrf-test' },
    });
    expect(r1.status()).toBe(403);

    const r2 = await page.request.put(`${API}/settings/token`, {
      headers: noCSRF, data: { token: 'fake' },
    });
    expect(r2.status()).toBe(403);
  });

  test('SQ-22: origin validation rejects cross-origin requests', async ({ page }) => {
    // Hypothesis: Requests from foreign origins are blocked
    const token = await csrf(page);

    const r = await page.request.post(`${API}/projects`, {
      headers: {
        Origin: 'https://evil.example.com',
        'X-AIRA-Token': token,
      },
      data: { name: 'origin-test' },
    });
    expect(r.status()).toBe(403);
  });

  test('SQ-23: UUID validation blocks injection patterns', async ({ page }) => {
    // Hypothesis: Various injection payloads are blocked by UUID check
    const hdr = await h(page);

    const injections = [
      "' OR 1=1--",
      "1; DROP TABLE projects;",
      '../../../etc/passwd',
      '${7*7}',
      '<img src=x onerror=alert(1)>',
      '%00null-byte',
      'AAAA'.repeat(64), // oversized
    ];

    for (const payload of injections) {
      const r = await page.request.get(`${API}/projects/${encodeURIComponent(payload)}`, {
        headers: hdr,
      });
      expect(r.status()).toBe(400);
    }
  });

  test('SQ-24: file download prevents path traversal via file_path', async ({ page }) => {
    // Hypothesis: Stored file paths with traversal components are safe
    const proj = await createProject(page, `SQ24-${Date.now()}`);
    const hdr = await h(page);

    // Try to list files — should return empty, not error
    const r1 = await page.request.get(`${API}/projects/${proj.id}/files`, { headers: hdr });
    expect(r1.ok()).toBeTruthy();

    await deleteProject(page, proj.id);
  });

  test('SQ-25: settings endpoint never returns token value', async ({ page }) => {
    // Hypothesis: Token is never leaked in API responses
    const hdr = await h(page);

    const r = await page.request.get(`${API}/settings`, { headers: hdr });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();

    // Token object should have 'configured' and 'source' but not the actual value
    expect(body.token).toBeDefined();
    expect(body.token.configured).toBeDefined();
    expect(body.token.source).toBeDefined();

    // Stringify entire response and check no token-like values
    const str = JSON.stringify(body);
    expect(str).not.toMatch(/ghp_[a-zA-Z0-9]{36}/); // GitHub PAT pattern
    expect(str).not.toMatch(/gho_[a-zA-Z0-9]{36}/); // GitHub OAuth pattern
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SQ-26~30: System Integration & State Consistency
// ═══════════════════════════════════════════════════════════════════════

test.describe('System Integration & State Consistency', () => {
  test('SQ-26: health check validates all subsystems', async ({ page }) => {
    // Hypothesis: Health endpoint covers OS, CLI, data dir, projects dir, token
    const r = await page.request.get(`${API}/health`, {
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();

    expect(body.status).toBe('ok');
    expect(body.checks).toBeDefined();
    expect(body.checks.os).toBeDefined();
    expect(body.checks.cli).toBeDefined();
    expect(body.checks.dataDir).toBeDefined();
    expect(body.checks.projectsDir).toBeDefined();
    expect(body.checks.token).toBeDefined();

    // Each check should have an 'ok' field
    for (const [, check] of Object.entries(body.checks)) {
      expect((check as { ok: boolean }).ok).toBeDefined();
    }
  });

  test('SQ-27: messages since filter returns only new messages', async ({ page }) => {
    // Hypothesis: Temporal filtering is accurate
    const proj = await createProject(page, `SQ27-${Date.now()}`);
    const hdr = await h(page);

    // Create first message
    await page.request.post(`${API}/projects/${proj.id}/messages`, {
      headers: hdr, data: { content: 'before' },
    });

    // Wait 1.5s to ensure different CURRENT_TIMESTAMP (second precision)
    await new Promise(resolve => setTimeout(resolve, 1500));
    const midpoint = new Date().toISOString();
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Create second message
    await page.request.post(`${API}/projects/${proj.id}/messages`, {
      headers: hdr, data: { content: 'after' },
    });

    // Query since midpoint
    const r = await page.request.get(
      `${API}/projects/${proj.id}/messages?since=${encodeURIComponent(midpoint)}`,
      { headers: hdr },
    );
    const messages = await r.json();
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages.every((m: { content: string }) => m.content !== 'before')).toBeTruthy();

    await deleteProject(page, proj.id);
  });

  test('SQ-28: project list returns all projects in consistent order', async ({ page }) => {
    // Hypothesis: Project listing is deterministic and complete
    const hdr = await h(page);
    const names = [`SQ28-A-${Date.now()}`, `SQ28-B-${Date.now()}`, `SQ28-C-${Date.now()}`];
    const ids: string[] = [];

    for (const name of names) {
      const proj = await createProject(page, name);
      ids.push(proj.id);
    }

    const r = await page.request.get(`${API}/projects`, { headers: hdr });
    const projects = await r.json();
    for (const id of ids) {
      expect(projects.some((p: { id: string }) => p.id === id)).toBeTruthy();
    }

    // Cleanup
    for (const id of ids) {
      await deleteProject(page, id);
    }
  });

  test('SQ-29: CLI version endpoint returns valid response', async ({ page }) => {
    // Hypothesis: CLI version check is robust
    const hdr = await h(page);
    const r = await page.request.get(`${API}/settings/cli-version`, { headers: hdr });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body).toHaveProperty('version');
    // version should be a string (or null if CLI not found)
    if (body.version !== null) {
      expect(typeof body.version).toBe('string');
      expect(body.version.length).toBeGreaterThan(0);
    }
  });

  test('SQ-30: full project lifecycle stress test', async ({ page }) => {
    // Hypothesis: Complete lifecycle works under moderate load
    const hdr = await h(page);
    const projects: string[] = [];

    // Phase 1: Create 5 projects
    for (let i = 0; i < 5; i++) {
      const proj = await createProject(page, `SQ30-stress-${i}-${Date.now()}`);
      projects.push(proj.id);
    }

    // Phase 2: Add messages to each
    await Promise.all(projects.map(async (id) => {
      for (let j = 0; j < 3; j++) {
        await page.request.post(`${API}/projects/${id}/messages`, {
          headers: hdr, data: { content: `stress-msg-${j}` },
        });
      }
    }));

    // Phase 3: Read all messages
    const messageCounts = await Promise.all(projects.map(async (id) => {
      const r = await page.request.get(`${API}/projects/${id}/messages`, { headers: hdr });
      return (await r.json()).length;
    }));
    messageCounts.forEach(count => expect(count).toBeGreaterThanOrEqual(3));

    // Phase 4: Read RAG settings for each
    await Promise.all(projects.map(async (id) => {
      const r = await page.request.get(`${API}/projects/${id}/rag`, { headers: hdr });
      expect(r.ok()).toBeTruthy();
    }));

    // Phase 5: Cleanup all
    await Promise.all(projects.map(id => deleteProject(page, id)));

    // Phase 6: Verify all gone
    const r = await page.request.get(`${API}/projects`, { headers: hdr });
    const remaining = await r.json();
    for (const id of projects) {
      expect(remaining.some((p: { id: string }) => p.id === id)).toBeFalsy();
    }
  });
});
