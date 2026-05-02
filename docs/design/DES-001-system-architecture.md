# DES-001: システムアーキテクチャ設計 (C4 モデル)

**バージョン**: 1.0.0  
**作成日**: 2026-05-02  
**ステータス**: Draft

## トレーサビリティ

- 要件: REQ-CHAT-001〜005, REQ-PROJECT-001〜004, REQ-SKILLS-001〜004,  
  REQ-MCP-001〜003, REQ-FILE-001〜006, REQ-PROGRESS-001〜003, REQ-UI-001,  
  REQ-AUTH-001〜005, REQ-WORKSPACE-001〜003, REQ-SEC-001〜003,  
  REQ-ERR-001〜009, REQ-NFR-001〜009

---

## C4 Level 1: システムコンテキスト図

```
┌──────────────────────────────────────────────────────────────┐
│                         外部アクター                          │
│                                                              │
│   ┌─────────────┐     ┌──────────────────────────────┐      │
│   │  エンドユーザー  │     │  GitHub (Copilot API / MCP)  │      │
│   │  (ブラウザ)  │     │                              │      │
│   └──────┬──────┘     └───────────────┬──────────────┘      │
│          │                            │                      │
│          │ HTTP/WS                    │ HTTPS API            │
│          ▼                            ▼                      │
│   ┌─────────────────────────────────────────────────────┐    │
│   │                    AIRA システム                     │    │
│   │      (WASM SPA + Node.js バックエンド)                │    │
│   └─────────────────────────────────────────────────────┘    │
│          │                            │                      │
│          │                            │                      │
│   ┌──────▼──────┐     ┌──────────────▼──────────────┐       │
│   │  MCP サーバー │     │    GitHub Copilot CLI        │       │
│   │  (外部)     │     │    (@github/copilot)         │       │
│   └─────────────┘     └─────────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

---

## C4 Level 2: コンテナ図

```
┌─────────────────────────────────────────────────────────────────────┐
│  AIRA システム                                                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  フロントエンド SPA (React + TypeScript + WASM)               │   │
│  │  ポート: 5173 (開発) / 静的ファイル配信 (本番)                │   │
│  │                                                              │   │
│  │  ├── チャット UI コンポーネント                               │   │
│  │  ├── プロジェクト管理 UI                                      │   │
│  │  ├── Skills 設定 UI                                          │   │
│  │  ├── MCP 設定 UI                                             │   │
│  │  ├── ファイルビューア / ダウンローダー                         │   │
│  │  └── WASM モジュール (Markdown/Mermaid レンダリング)           │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │ HTTP REST / WebSocket                  │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │  API サーバー (Node.js + TypeScript)                          │   │
│  │  ポート: 3000                                                 │   │
│  │                                                              │   │
│  │  ├── REST API (Hono)                                         │   │
│  │  │   ├── /api/projects     (プロジェクト CRUD)                │   │
│  │  │   ├── /api/skills       (Skills 管理)                     │   │
│  │  │   ├── /api/mcp          (MCP 設定管理)                    │   │
│  │  │   ├── /api/files        (ファイル管理)                    │   │
│  │  │   └── /api/settings     (システム設定)                    │   │
│  │  ├── WebSocket サーバー (チャットストリーミング)               │   │
│  │  ├── エージェント実行サービス                                  │   │
│  │  │   └── 子プロセス管理 (child_process)                       │   │
│  │  └── 認証プロキシ (GitHub Token)                              │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                        │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │  SQLite データベース                                          │   │
│  │  (data/aira.db)                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  エージェントプロセス (子プロセス)                             │   │
│  │                                                              │   │
│  │  ├── GitHub Copilot CLI (@github/copilot)                    │   │
│  │  ├── MCP サーバー設定 (--additional-mcp-config)              │   │
│  │  ├── Skills ディレクトリ参照                                  │   │
│  │  └── ワークスペース: projects/{id}/workspace/                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## C4 Level 3: コンポーネント図

### DES-CHAT-001: チャット・ストリーミング設計

**対応要件**: REQ-CHAT-001〜005

チャット機能は WebSocket を使用したリアルタイムストリーミングで実装する。

**実行ライフサイクル**:
1. クライアントが WebSocket 接続を確立 (`/ws/projects/:id/chat`)
2. ユーザーメッセージ受信 → `messages` テーブルに保存 (role=user)
3. `AgentService.spawn()` でプロジェクト専用の子プロセスを起動
4. 子プロセスの stdout をチャンク単位で WebSocket に転送
5. プロセス終了 → 完了メッセージを `messages` テーブルに保存 (role=assistant)
6. ワークスペーススキャン → 新規ファイルをインデックス

**再接続**: WebSocket 切断時、クライアントは指数バックオフで再接続を試みる。  
**キャンセル**: ユーザーが停止を要求した場合、`AgentService.stop()` で子プロセスを SIGTERM → SIGKILL する。

### DES-PROJECT-001: プロジェクト管理設計

**対応要件**: REQ-PROJECT-001〜004

プロジェクトは UUID で識別される。作成時にワークスペースディレクトリ  
(`projects/{id}/workspace/`) が自動生成される。削除時はカスケードで  
関連データ (messages, project_skills, project_mcp_configs, project_files) と  
ワークスペースディレクトリを削除する。

### DES-SKILLS-001: Skills 管理設計

**対応要件**: REQ-SKILLS-001〜004

Skills は `skills/` ディレクトリにインストールされ、`skills` テーブルで管理される。  
プロジェクトへの割り当ては `project_skills` 中間テーブルで管理する。  
エージェント実行時、割り当て済み Skills の `SKILL.md` パスが Copilot CLI の  
`--skills` オプションとして渡される。

### DES-MCP-001: MCP 設定設計

**対応要件**: REQ-MCP-001〜003

プロジェクトごとの MCP 設定は JSON 形式で保存され、エージェント実行時に  
`--additional-mcp-config` オプションとして一時ファイル経由で渡される。  
プリセット MCP (GitHub MCP Tools, ToolUniverse, Deep Research) は  
`mcp-presets.json` に定義される。

### DES-FILE-001: ファイル管理設計

**対応要件**: REQ-FILE-001〜006

生成ファイルはワークスペースディレクトリに保存される。ファイルビューアは  
MIME タイプに基づいて適切なレンダラーを選択する。ZIP ダウンロードは  
サーバーサイドで archiver パッケージを使用して生成する。

**ファイル操作**:
- **View**: アプリ内モーダルでファイルを表示 (Markdown, コード, 画像, PDF, JSON, Mermaid)
- **Open**: バックエンド API 経由で OS デフォルトアプリケーションを起動 (macOS: `open`, Windows: `Start-Process -LiteralPath`)
- **Download**: ブラウザネイティブダウンロード (Content-Disposition)
- **Delete**: 確認後にファイルシステムと DB から削除

### DES-PROGRESS-001: 進行状況・右パネル設計

**対応要件**: REQ-PROGRESS-001〜003, REQ-UI-001

**レイアウト**: 画面右側に固定幅 (~320px) のパネルを配置。上部に進行状況、下部にファイル一覧。

**進行状況の仕組み**:
- WebSocket でエージェントの stdout/stderr をリアルタイム受信
- ステータス変更を即座に反映 (Run 状態: `queued` / `running` / `completed` / `failed` / `cancelled` / `timeout`。Run 未存在時は UI 上 `idle` 表示)
- ファイル生成イベント (chokidar) を WebSocket で通知し、ファイル一覧を即時更新
- 経過時間はクライアントサイドタイマーで表示

**WebSocket イベント型**:
```typescript
type WSEvent =
  | { type: 'status'; runId: string; status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout' }
  | { type: 'log'; message: string; timestamp: string }
  | { type: 'chunk'; content: string }  // チャット応答
  | { type: 'file_added'; file: FileInfo }
  | { type: 'file_modified'; file: FileInfo }
  | { type: 'file_deleted'; fileId: string }
```

### DES-AUTH-001: 認証設計

**対応要件**: REQ-AUTH-001〜005

v1.0 は localhost シングルユーザーモデル。API サーバーはループバックインターフェース (`127.0.0.1` および `::1`) に**2 ソケット方式**でバインドする (dual-stack 非依存)。  
GitHub Token はサーバーサイドの環境変数 (`GITHUB_TOKEN`) または  
設定 API 経由で `data/settings.json` に保存 (OS ファイル権限 0600 / NTFS ACL で保護)。  
エージェントプロセスには環境変数として注入する。Token は API レスポンスに含めない。

**ブラウザ Origin 防御**:
- 全状態変更リクエスト (POST/PUT/PATCH/DELETE) および WS upgrade で `Origin` ヘッダーを検証
- 許可 Origin: `http://localhost:<port>`, `http://127.0.0.1:<port>`
- Anti-CSRF トークン: サーバーメモリに保持、`GET /api/csrf-token` で発行、`X-AIRA-Token` ヘッダーで検証
- CORS: `Access-Control-Allow-Origin` を明示的に設定 (ワイルドカード不可)

### DES-WORKSPACE-001: ワークスペースライフサイクル設計

**対応要件**: REQ-WORKSPACE-001〜003

**ディレクトリレイアウト**:
```
projects/
├── {project-id-1}/
│   └── workspace/           # Copilot CLI の cwd として使用
│       ├── src/             # エージェントが生成したファイル
│       └── output/
├── {project-id-2}/
│   └── workspace/
```

**ファイルインデックス**: エージェント実行完了後、`FileService` がワークスペースを走査し、  
前回スキャンとの差分を検出して `project_files` テーブルを更新する。  
検出対象: 新規ファイル追加、既存ファイル変更 (mtime/size)、ファイル削除。

**クリーンアップ**: プロジェクト削除時に `fs.rm(projects/{project_id}/, { recursive: true, force: true })` を実行。  
パストラバーサル防止のため、削除対象パスが `projects/` 配下であることを検証する。

### DES-SEC-001: セキュリティ設計

**対応要件**: REQ-SEC-001〜003, REQ-NFR-003

**信頼モデル**: v1.0 はローカルユーザーが自ら設定した Skills/MCP を信頼する前提。  
シングルユーザー・localhost 専用のため、コンテナ隔離は不要。

**プロセスセキュリティ**:
- エージェントは `child_process.spawn()` で起動
- cwd を `projects/{project_id}/workspace/` に制限
- 環境変数で `GITHUB_TOKEN` を渡す (ホストの環境変数から取得)
- タイムアウト: 10 分。macOS: SIGTERM → 5秒後 SIGKILL (プロセスグループ)、Windows: `taskkill /T /F /PID`
- 最大同時実行数: デフォルト 5 プロセス (REQ-NFR-002 で設定可能)

**入力バリデーション**:
- API 入力値にスキーマバリデーション (zod) を適用
- ファイルパスの `../` トラバーサルを防止
- SQLite プリペアドステートメントで SQL インジェクション防止

**レンダリングセキュリティ (XSS 防御)**:
- Markdown: DOMPurify でサニタイズ。生 HTML は除去、許可タグのホワイトリスト方式
- URI スキーム: `javascript:`, `vbscript:`, `data:text/html` をブロック
- Mermaid: `securityLevel: 'strict'` でレンダリング
- CSP ヘッダー: `script-src 'self' 'wasm-unsafe-eval'` (unsafe-inline 禁止)
- 画像: `data:image/*`, `http(s)://localhost:*` のみ許可

### API サーバー コンポーネント

```
┌─────────────────────────────────────────────────────────────────────┐
│  API サーバー                                                        │
│                                                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ ProjectService  │  │  SkillsService   │  │   McpService     │  │
│  │                 │  │                  │  │                  │  │
│  │ - create()      │  │ - list()         │  │ - configure()    │  │
│  │ - rename()      │  │ - import()       │  │ - listPresets()  │  │
│  │ - delete()      │  │ - assign()       │  │ - enable()       │  │
│  │ - list()        │  │ - unassign()     │  │ - disable()      │  │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                    │                       │            │
│  ┌────────▼────────────────────▼───────────────────────▼─────────┐  │
│  │                    データアクセス層 (SQLite)                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  AgentService   │  │  FileService     │  │  AuthService     │  │
│  │                 │  │                  │  │                  │  │
│  │ - spawn()       │  │ - list()         │  │ - validateToken()│  │
│  │ - stream()      │  │ - read()         │  │ - proxyToken()   │  │
│  │ - stop()        │  │ - download()     │  │                  │  │
│  │ - getStatus()   │  │ - bulkDownload() │  │                  │  │
│  └─────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### フロントエンド コンポーネント

```
┌─────────────────────────────────────────────────────────────────────┐
│  フロントエンド SPA                                                  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  App (ルートコンポーネント) — 3 カラムレイアウト              │  │
│  │                                                              │  │
│  │  ├── Sidebar (左)                                            │  │
│  │  │   ├── ProjectList     (プロジェクト一覧)                   │  │
│  │  │   ├── ProjectItem     (プロジェクト行)                    │  │
│  │  │   └── NewProjectModal (プロジェクト作成ダイアログ)         │  │
│  │  │                                                          │  │
│  │  ├── CenterPane (中央)                                       │  │
│  │  │   ├── ChatPane                                           │  │
│  │  │   │   ├── MessageList   (メッセージ一覧)                  │  │
│  │  │   │   ├── MessageItem   (Markdown レンダリング)           │  │
│  │  │   │   └── ChatInput     (入力フォーム)                   │  │
│  │  │   └── SettingsPane                                       │  │
│  │  │       ├── SkillsSettings  (Skills 設定)                  │  │
│  │  │       ├── McpSettings     (MCP 設定)                     │  │
│  │  │       └── AuthSettings    (GitHub Token 設定)            │  │
│  │  │                                                          │  │
│  │  └── RightPanel (右) — 進行状況 + ファイル管理               │  │
│  │      ├── ProgressSection                                    │  │
│  │      │   ├── RunStatusBadge  (実行ステータス表示)            │  │
│  │      │   ├── ProgressLog     (リアルタイムログ/進行表示)     │  │
│  │      │   └── StopButton      (実行キャンセル)               │  │
│  │      │                                                      │  │
│  │      └── FilesSection                                       │  │
│  │          ├── FileList         (出力ファイル一覧)             │  │
│  │          ├── FileItem         (ファイル行)                   │  │
│  │          │   ├── OpenButton     (デフォルトアプリで開く)     │  │
│  │          │   ├── ViewButton     (アプリ内ビューア)          │  │
│  │          │   ├── DownloadButton (ダウンロード)              │  │
│  │          │   └── DeleteButton   (ファイル削除)              │  │
│  │          ├── BulkActions      (一括操作)                     │  │
│  │          │   └── DownloadAllZip (全ファイル ZIP)            │  │
│  │          └── FileViewerModal  (インラインビューア)           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## データモデル

### プロジェクト (projects)

```sql
CREATE TABLE projects (
  id            TEXT PRIMARY KEY,   -- UUID
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  last_activity DATETIME,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- ステータスは DB カラムではなく、agent_runs テーブルから派生:
--   running: 当該プロジェクトに status='running' の Run が存在
--   idle: running/queued の Run が存在しない
-- UI 表示用の "active" は last_activity が直近 N 分以内かで判定
```

### エージェント実行履歴 (agent_runs)

```sql
CREATE TABLE agent_runs (
  id          TEXT PRIMARY KEY,   -- UUID
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message_id  TEXT REFERENCES messages(id),  -- トリガーとなったユーザーメッセージ
  status      TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'running', 'completed', 'failed', 'timeout', 'cancelled')),
  error_type  TEXT CHECK(error_type IN ('cli_missing', 'auth_failure', 'timeout', 'spawn_failure', 'unknown')),
  cancel_reason TEXT CHECK(cancel_reason IN ('user', 'system')),
  started_at  DATETIME,
  finished_at DATETIME,
  exit_code   INTEGER,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- 1プロジェクトにつき同時実行は1件のみ (queued含め最大2件)
CREATE INDEX idx_agent_runs_project_status ON agent_runs(project_id, status);
```

### 会話メッセージ (messages)

```sql
CREATE TABLE messages (
  id          TEXT PRIMARY KEY,   -- UUID
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id      TEXT REFERENCES agent_runs(id),  -- 関連する Run (NULL = システムメッセージ)
  role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### プロジェクト Skills 割り当て (project_skills)

```sql
CREATE TABLE project_skills (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill_id    TEXT NOT NULL,
  PRIMARY KEY (project_id, skill_id)
);
```

### Skills ライブラリ (skills)

```sql
CREATE TABLE skills (
  id          TEXT PRIMARY KEY,   -- UUID
  name        TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK(source_type IN ('local', 'github', 'marketplace')),
  source_url  TEXT,
  skill_path  TEXT NOT NULL,      -- ローカルパス
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### MCP 設定 (project_mcp_configs)

```sql
CREATE TABLE project_mcp_configs (
  id          TEXT PRIMARY KEY,   -- UUID
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('stdio', 'sse', 'preset')),
  config_json TEXT NOT NULL,      -- JSON: {command, args, env} or {url}
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 生成ファイル (project_files)

```sql
CREATE TABLE project_files (
  id          TEXT PRIMARY KEY,   -- UUID
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  file_path   TEXT NOT NULL,      -- サーバー上のパス
  mime_type   TEXT,
  size_bytes  INTEGER,
  mtime_ms    INTEGER,            -- ファイルの mtime (ミリ秒 epoch)。変更検出に使用
  content_hash TEXT,              -- SHA-256 ハッシュ (同一サイズ変更検出用、オプション)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## API エンドポイント設計

### プロジェクト API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/projects | プロジェクト一覧取得 |
| POST | /api/projects | プロジェクト作成 |
| GET | /api/projects/:id | プロジェクト詳細取得 |
| PATCH | /api/projects/:id | プロジェクト更新 (名前変更等) |
| DELETE | /api/projects/:id | プロジェクト削除 |

### チャット API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/projects/:id/messages | 会話履歴取得 |
| POST | /api/projects/:id/messages | メッセージ送信 |
| DELETE | /api/projects/:id/messages | 会話履歴クリア |
| WS | /ws/projects/:id/chat | リアルタイムストリーミング |

### Skills API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/skills | 利用可能 Skills 一覧 |
| POST | /api/skills/import | GitHub リポジトリから Skills インポート |
| GET | /api/projects/:id/skills | プロジェクト Skills 取得 |
| PUT | /api/projects/:id/skills | プロジェクト Skills 更新 |

### MCP API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/projects/:id/mcp | MCP 設定取得 |
| POST | /api/projects/:id/mcp | MCP サーバー追加 |
| PATCH | /api/projects/:id/mcp/:mcpId | MCP 設定更新 |
| DELETE | /api/projects/:id/mcp/:mcpId | MCP 設定削除 |
| GET | /api/mcp/presets | プリセット MCP 一覧 |

### ファイル API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/projects/:id/files | ファイル一覧取得 |
| GET | /api/projects/:id/files/:fileId | ファイル内容取得 (View) |
| GET | /api/projects/:id/files/:fileId/download | ファイルダウンロード |
| POST | /api/projects/:id/files/:fileId/open | OS デフォルトアプリで開く |
| DELETE | /api/projects/:id/files/:fileId | ファイル削除 |
| GET | /api/projects/:id/files/download-all | 全ファイル ZIP ダウンロード |

### エージェント実行 API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/projects/:id/runs | 実行履歴取得 |
| GET | /api/projects/:id/runs/current | 現在の実行状態取得 |
| POST | /api/projects/:id/runs/current/stop | 実行キャンセル |

### 設定・システム API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/settings | 設定取得 (Token 有無 boolean のみ) |
| POST | /api/settings/validate-token | Token 有効性検証 |
| GET | /api/health | プリフライト結果 JSON (`{ cli, workspace, os, token }`) |
| GET | /api/csrf-token | Anti-CSRF トークン取得 |

---

## ディレクトリ構成 (計画)

```
aira/
├── frontend/                    # React + TypeScript + WASM フロントエンド
│   ├── src/
│   │   ├── components/          # React コンポーネント
│   │   │   ├── chat/
│   │   │   ├── project/
│   │   │   ├── files/
│   │   │   └── settings/
│   │   ├── stores/              # Zustand ストア
│   │   ├── api/                 # API クライアント
│   │   ├── wasm/                # WASM モジュール (Rust)
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/                     # Node.js + TypeScript バックエンド
│   ├── src/
│   │   ├── server.ts            # メインサーバー
│   │   ├── routes/              # API ルーティング
│   │   ├── services/            # ビジネスロジック
│   │   │   ├── project.service.ts
│   │   │   ├── skills.service.ts
│   │   │   ├── mcp.service.ts
│   │   │   ├── agent.service.ts
│   │   │   ├── file.service.ts
│   │   │   └── auth.service.ts
│   │   ├── db/                  # SQLite データアクセス
│   │   └── agent/               # エージェントプロセス管理
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   ├── requirements/
│   ├── design/
│   └── adr/
├── steering/
│   ├── project.md
│   └── rules/
│       └── constitution.md
├── data/                        # ランタイムデータ (git-ignored)
├── projects/                    # プロジェクトワークスペース (git-ignored)
├── skills/                      # インストール済み Skills
├── .env.example
├── package.json                 # ルートパッケージ (ワークスペース)
└── README.md
```
