# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is an npm workspaces monorepo (`frontend`, `backend`) using Node.js ≥22.

```bash
# Dev — runs frontend (Vite) + backend (tsx watch) concurrently
npm run dev

# Build everything (frontend tsc+vite, backend tsc)
npm run build

# Unit tests (vitest) in both workspaces
npm test

# Run a single backend test
cd backend && npx vitest run src/services/agent.service.test.ts

# Frontend single test
cd frontend && npx vitest run src/path/to/file.test.tsx

# E2E (Playwright) — boots `backend/dist/server.js` with AIRA_SERVE_FRONTEND=true on port 3000
npm run test:e2e
npx playwright test tests/e2e/co-scientist.spec.ts          # single spec
npx playwright test --grep "duplication"                    # by name

# Lint / format
npm run lint
npm run format          # write
npm run format:check    # verify

# Docker
npm run docker:build
npm run docker:run
```

E2E tests reuse an existing server on port 3000 if one is running (`reuseExistingServer: true`). If a test hangs, check whether a stale backend is bound to 3000. The backend itself does NOT auto-build for E2E — you must run `npm run build` first or it will run an old `dist/`.

## Architecture

AIRA is a single-user, localhost-first web app that wraps the **GitHub Copilot CLI** (`@github/copilot`) as the agent engine. Each "project" is an isolated workspace with its own skills, MCP servers, RAG store, and chat history.

### Backend flow (Hono + sql.js)

`backend/src/server.ts` is a thin CLI entry that calls `lifecycle.ts:startServer()`, which performs in order: preflight checks → init sql.js DB (`data/aira.db`) → recover orphan runs (mark `running`/`queued` rows as `failed`) → seed built-in skills + MCP → sync external agents repos → start credential proxy → bind HTTP (IPv4 + IPv6 for `127.0.0.1`) → attach WebSocket. Routes are mounted in `app.ts`; all `/api/projects/:id*` paths gate on a UUID regex before reaching handlers.

A **single chat message** goes: WS `chat` event → `ws.service.ts:handleChatMessage` → `exec-context.ts:executeChat` (resolves token, syncs skills into `workspace/.github/`, builds prompt with conversation history + RAG context) → `container-runner.ts:startRun` spawns Copilot CLI via stdin in **interactive mode** (no `--prompt` flag, so `ask_user` stays available). First message uses `--name aira-<projectId>`; subsequent messages use `--resume` so the CLI owns its own session state. Streamed JSON events (`assistant.message_delta`, `tool.execution_start`, `session.info`) are parsed line-by-line and forwarded as WS `chunk`/`progress`/`file_added` events to the originating client only (broadcasting causes 5× duplication — see v2.5.0 fix).

When the last WS client for a project disconnects, the in-flight CLI run is killed (`ws.service.ts` → `stopRun`). Exit code **42** from the backend signals "restart me" and is handled by the Docker entrypoint loop.

### Workspace layout per project

`backend/src/config/paths.ts` is the only source of truth for storage paths. Everything is rooted at `getBaseDir()` (defaults to `process.cwd()`, overridable for tests via `setBaseDir`):

```
<baseDir>/
├── data/aira.db                          ← sql.js DB (debounced write-back, 100ms)
└── projects/<uuid>/workspace/            ← Copilot CLI cwd for that project
    ├── .git/                             ← auto-created by ensureWorkspaceRepo (required so CLI finds instruction files)
    ├── .github/
    │   ├── copilot-instructions.md       ← merged from all assigned skills' copilot-instructions.md
    │   ├── skills/<name>/SKILL.md        ← copied from skills/<skill>/skills/<sub>/
    │   └── agents/<name>.agent.md
    └── AGENTS.md                         ← merged from all assigned skills' AGENTS.md
```

`syncSkillFiles()` in `exec-context.ts` **wipes and rewrites** `.github/` + `AGENTS.md` on every run, so never expect manual edits to those paths to survive — make changes in `skills/<skill>/` instead. Built-in skills live at `skills/co-scientist/` (189 sub-skills) and `skills/spread1000-assistant/` (12 sub-skills); external agents repos are cloned to `backend/agents-cache/` and registered via the Settings UI.

### Database (sql.js / WASM)

There is no native sqlite driver. `backend/src/db/index.ts` wraps sql.js with a `better-sqlite3`-compatible synchronous API (`prepare().all/get/run`, `transaction(fn)`). Writes are **in-memory** and flushed to `data/aira.db` via atomic temp-file rename, debounced at 100ms. Implications:

- After a process crash, the last <100ms of writes are lost — `recoverOrphanRuns()` exists for this reason.
- Long-running transactions block the event loop because everything is synchronous.
- In tests, prefer `test-helper.ts` over touching the singleton; the DB is reset by closing + re-initialising.

### Security model

`backend/src/middleware/security.ts` applies CORS + CSP + Origin check + CSRF token to all routes. The CSRF token is fetched from `/api/csrf-token` and sent back in the `X-AIRA-Token` header on every state-changing request. In **serve-frontend mode** (Docker, `AIRA_SERVE_FRONTEND=true`), Origin checks are relaxed because CSRF tokens alone are the defence — this is required so users can hit the container by LAN IP/hostname. Don't tighten Origin checks in that mode without removing the LAN-access use case first.

Secrets (tokens, etc.) are streamed-redacted in `agent.service.ts:createRedactor` — it buffers up to `maxSecretLen` characters at the boundary so a token split across two chunks still gets redacted. Pattern-based redaction (ghp_, gho_, ghs_, sk-, AKIA…, Bearer …) is applied as a safety net even when no exact secrets are registered.

### Frontend (React 19 + Zustand + Tailwind v4)

`frontend/src/App.tsx` is a three-pane layout (Sidebar / ChatPane / RightPanel), each pane in a `ResizablePanel` with width persisted to `localStorage`. State is split across small Zustand stores per concern (`chat`, `files`, `pipeline`, `preferences`, `project`, `settings`, `ws`). The chat store **receives streamed chunks via WS and appends to the active message** — don't refetch the message list during a run, you'll race the stream.

API calls go through `frontend/src/api/client.ts` which auto-attaches the CSRF token. The WS client (`api/ws.ts`) connects to `/ws/projects/:id/chat`. In Docker mode the frontend is served by the backend on the same port; in dev it runs on Vite (5173/5174/5175 — all are pre-allowlisted in CORS/CSP/WS-origin).

## Conventions

- **Always edit existing files**; the project deliberately avoids new abstractions (steering doc and v2.3.0 changelog reinforce this — Co-Scientist was rolled back from v4.0 to v3.0 by deleting ~60% of its content).
- **Skill-side authoring**: when modifying agent behaviour, prefer editing the markdown under `skills/<name>/skills/<sub>/SKILL.md` rather than backend code — the CLI loads these natively based on description matching.
- **Routes register through `app.ts`** — add `app.route('/', xxxRoutes)` there or the route is dead.
- **Path config**: never `path.join(process.cwd(), 'data', …)` directly. Use `getDataDir()` / `getWorkspaceDir(projectId)` so tests can sandbox via `setBaseDir`.
- **No native sqlite addons** — sql.js is intentional (matches Docker base image, avoids rebuild on every node bump). Don't propose swapping it without discussion.
- **WS streaming**: send chunks via `sendToClient(ws, …)` (unicast). Broadcasting message_delta chunks caused the v2.5.0 duplication bug.

## Environment

| Var | Purpose |
|-----|---------|
| `GITHUB_TOKEN` | Copilot CLI auth (also settable via Settings UI → stored in DB) |
| `AIRA_PORT` | Backend listen port (default `3000`) |
| `AIRA_SERVE_FRONTEND` | `true` → backend serves `frontend/dist` and binds `0.0.0.0` (Docker mode) |
| `AIRA_ALLOWED_ORIGINS` | Comma-separated extra Origins for non-Docker mode |
| `VITE_DEV_PORT` | Override Vite port for CORS/CSP (default 5173) |
| `CONTAINER_TIMEOUT` | Max ms for a single Copilot CLI run (default 3h) |
