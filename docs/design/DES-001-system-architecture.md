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

**再接続**: WebSocket 切断時、クライアントは指数バックオフで再接続を試みる。再接続後、以下の 3 API でスナップショット同期を行い、全ペインを復元する (REQ-ERR-003 準拠):
1. `GET /api/projects/:id/runs/current` — 右パネルの Run 進行状況を復元
2. `GET /api/projects/:id/files` — 右パネルのファイル一覧を復元
3. `GET /api/projects/:id/messages` — チャットペインの会話履歴を再構築

実行中 Run のストリーミング途中で切断した場合、再接続後のチャンクは途中から継続される (切断中のチャンクは欠損を許容し、Run 完了後に完全な assistant メッセージが DB に保存される)。  
**キャンセル**: ユーザーが停止を要求した場合、`AgentService.stop()` で子プロセスを停止する (OS 別戦略は DES-SEC-001 参照)。

### DES-PROJECT-001: プロジェクト管理設計

**対応要件**: REQ-PROJECT-001〜004, REQ-ERR-005

プロジェクトは UUID で識別される。作成時にワークスペースディレクトリ  
(`projects/{id}/workspace/`) が自動生成される。削除時はカスケードで  
関連データ (messages, project_skills, project_mcp_configs, project_files) と  
ワークスペースディレクトリを削除する。

**アクティブ Run ガード**:
- `PATCH /api/projects/:id` (名前変更) および `DELETE /api/projects/:id` は、  
  当該プロジェクトに `status IN ('running', 'queued')` の Run が存在する場合 **409 Conflict** を返す
- レスポンス: `{ "error": "project_busy", "message": "Cannot modify project while a run is active" }`
- UI: ボタンを disabled 化 + ツールチップで理由を表示

### DES-SKILLS-001: Skills 管理設計

**対応要件**: REQ-SKILLS-001〜004, REQ-ERR-006

Skills は `skills/` ディレクトリにローカルキャッシュされ、`skills` テーブルで管理される。  
プロジェクトへの割り当ては `project_skills` 中間テーブルで管理する。  
エージェント実行時、割り当て済み Skills の `SKILL.md` パスが Copilot CLI の  
`--skills` オプションとして渡される。

**Skills ライフサイクル**:
1. **インポート**: GitHub URL からローカル (`skills/{id}/`) にクローン/ダウンロード
   - URL バリデーション: `https://github.com/{owner}/{repo}` 形式のみ受け入れ (オプションで `/tree/...` サブパス付き)。パース方式: URL を構造的に分解し `host === 'github.com'`, パス先頭2セグメントを `owner/repo` として抽出。`/tree/` 以降はブランチ+パス (ブランチ名に `/` を含む場合があるため正規表現分割ではなく GitHub API で存在確認)。他ホスト/スキームは 400 エラー
2. **保存**: ローカルコピーを永続保存。ランタイム fetch は行わない (ローカルのみ参照)
3. **エラー**: インポート失敗 → `skills.status = 'error'`、`skills.last_error` に詳細記録
4. **実行時**: 割り当て済み Skills のうち `status = 'available'` のもののみ `--skills` に渡す
5. **リフレッシュ**: 手動更新 (再インポート) で最新化。自動更新は v1.0 スコープ外
6. **利用不可 Skills**: `status = 'error'` の Skill が割り当てられている場合、UI に警告表示し当該 Skill をスキップして実行を続行

**マーケットプレイス** (REQ-SKILLS-004 / P2):
- カタログソース: `skills-catalog.json` をアプリにバンドル (静的リスト)。v1.1+ で外部カタログ API に移行可能
- カタログエントリ: `{ id, name, description, author, category, repo_url }`
- API: `GET /api/skills/catalog` — バンドルされたカタログ一覧を返す (インストール済みは `installed: true` マーク付き)
- インストールフロー: カタログの `repo_url` を使用してインポート (上記ライフサイクル 1〜3 と同一)。ワンクリック = `POST /api/skills/import` に `repo_url` を送信
- 状態遷移: catalog item → importing → available / error

### DES-MCP-001: MCP 設定設計

**対応要件**: REQ-MCP-001〜003, REQ-ERR-004

プロジェクトごとの MCP 設定は JSON 形式で保存され、エージェント実行時に  
`--additional-mcp-config` オプションとして一時ファイル経由で渡される。  
プリセット MCP (GitHub MCP Tools, ToolUniverse, Deep Research) は  
`mcp-presets.json` に定義される。

**MCP シークレット保護** (env / headers 共通):
- DB 保存: `config_json.env` および `config_json.headers` にキー・値ペアとして格納 (v1.0 は平文、settings.json と同レベル)
- API レスポンス: `GET /api/projects/:id/mcp` は env / headers の値を `"***"` にマスクして返す。設定画面で再編集時は空欄表示 (再入力を要求)
- ログ出力: env / headers 値は一切ログに出力しない。CLI の stdout/stderr にシークレットが含まれる可能性があるため、ストリーミング前にベストエフォートで redact を行う: `config_json.env` および `config_json.headers` の各値を正規表現マッチし `***` に置換。完全な防止は保証しない (部分一致・エンコード変換等) が、平文漏洩リスクを低減する
- 一時設定ファイル: `data/.tmp/` (事前に ACL/パーミッション設定済み) 配下にランダム名で作成。POSIX は親ディレクトリが 0700 であることを保証。Windows は Token ファイルと同じ NTFS ACL 戦略を適用。プロセス終了 (正常・異常とも) の finally ブロックで即時削除 (`fs.unlink`)。削除失敗はログ警告のみ (次回起動時のプリフライトでも残存一時ファイルをクリーンアップ)

**MCP プロバイダ障害時の動作**:
- AIRA は MCP 設定の構文検証のみ行い、接続確認は Copilot CLI に委ねる
- 個別プロバイダの接続失敗は CLI 側で処理される (AIRA は CLI の出力から検知)
- `enabled = 0` のプロバイダは設定ファイルに含めない (無効化によるユーザー制御の粒度化)

**GitHub MCP Tools カテゴリ選択** (REQ-MCP-003):
- `project_mcp_configs.config_json` に `categories` フィールドを格納: `{ "categories": ["repos", "issues", "pull_requests"] }`
- 全カテゴリ選択時は `categories` を省略 (= 全ツール有効)
- ランタイム変換: `categories` 配列を GitHub MCP Tools の `--tools` フィルタに変換して一時設定ファイルに書き出す。カテゴリ → ツール名のマッピングは `mcp-presets.json` 内の `toolCategories` に定義
- UI: GitHub MCP Tools プリセット選択時のみカテゴリチェックボックスを表示
- CLI がプロバイダ接続失敗を報告した場合: 右パネルに警告表示、Run 自体は続行
- 全プロバイダ接続不可でも Run は `completed` / `failed` は CLI の exit code で判定

### DES-FILE-001: ファイル管理設計

**対応要件**: REQ-FILE-001〜006

生成ファイルはワークスペースディレクトリに保存される。ファイルビューアは  
MIME タイプに基づいて適切なレンダラーを選択する。ZIP ダウンロードは  
サーバーサイドで archiver パッケージを使用して生成する。

**ファイル操作**:
- **View**: アプリ内モーダルでファイルを表示 (Markdown, コード, 画像, PDF, JSON, Mermaid)
- **Open**: バックエンド API 経由で OS デフォルトアプリケーションを起動 (macOS: `spawn('open', ['--', path])`, Windows: `spawn('powershell.exe', ['-NoProfile', '-Command', \`Invoke-Item -LiteralPath '${escapedPath}'\`])`)
  - **Allowlist 方式**: Open は許可リストに含まれる拡張子のみ許可 (テキスト/コード/画像/ドキュメント系)。未知・実行可能拡張子は 403 で拒否。許可リストは REQ-FILE-005 定義に準拠
- **Download**: ブラウザネイティブダウンロード (Content-Disposition)
- **Delete**: 確認後にファイルシステムと DB から削除

**ファイル API エラーコントラクト** (POST open / DELETE):
| 状況 | ステータスコード |
|---|---|
| 成功 | 200 OK |
| ファイル未存在 | 404 Not Found |
| ブロック対象拡張子 | 403 (`blocked_file_type`) |
| 権限エラー (EACCES) | 403 (`permission_denied`) |
| ファイルロック (EBUSY / Windows EPERM+sharing violation) | 423 Locked |
| OS コマンド実行失敗 | 500 Internal Server Error |

> **Windows ファイルロック検出**: Windows では他プロセスが使用中のファイルに対する操作が `EBUSY` ではなく `EPERM` で返される場合がある。判別ロジック: `EPERM` 受信時に `fs.open(path, 'r')` を試行し、同じく失敗すれば `423 Locked` (使用中)、成功すれば `403` (真の権限エラー) として分類する。

### DES-PROGRESS-001: 進行状況・右パネル設計

**対応要件**: REQ-PROGRESS-001〜003, REQ-UI-001

**レイアウト**: 画面右側に固定幅 (~320px) のパネルを配置。上部に進行状況 (現行 Run)、中部に Run 履歴、下部にファイル一覧。

**Run 履歴** (REQ-CHAT-002 関連):
- `RunHistoryList` コンポーネント: 過去の Run を新しい順に最大 20 件表示
- 各エントリ: ステータスアイコン / 開始日時 / 経過時間 / exit code
- クリックで詳細表示 (status, started_at, finished_at, exit_code)。v1.0 ではログ再生は非対応 (v1.1+)
- API: `GET /api/projects/:id/runs` (ページネーション対応、デフォルト 20 件)

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

**Token ファイル保護の OS 別実装** (アトミック作成):
| OS | 方式 | 実装 |
|---|---|---|
| macOS | POSIX パーミッション | `fs.open(path, O_WRONLY|O_CREAT|O_TRUNC, 0o600)` でファイルを作成 (作成時点で 0600)。fd に書き込み後 close。`writeFile` 後の `chmod` は使わない |
| Windows | NTFS ACL | 1. ユーザー専用一時ディレクトリ (`data/.tmp/`) に ACL を事前設定 (icacls) 2. 一時ディレクトリ内にファイルを書き込み 3. `fs.rename()` で `data/settings.json` にアトミック移動。ドメイン環境では `USERDOMAIN\\USERNAME` 形式を使用 |

> **原則**: シークレットを含むファイルは、デフォルト/継承パーミッションで一瞬でもディスクに存在してはならない。POSIX はファイル作成時の mode 引数で保証。Windows は事前にセキュリティ設定済みディレクトリ内で作成することで保証する。MCP 一時設定ファイルも同じ戦略を適用する。

- ACL/パーミッション設定失敗時: Token 保存を失敗として扱う (500 エラー)。エラーメッセージに「ファイル権限を設定できませんでした」と具体的な対処法を表示。設定失敗のまま Token を平文保存しない
- 起動時のプリフライトチェックで `data/settings.json` のパーミッションを検証し、不適切な場合は警告表示 + Token 利用を一時停止 (再設定を促す)

**ブラウザ Origin 防御**:
- 全状態変更リクエスト (POST/PUT/PATCH/DELETE) および WS upgrade で `Origin` ヘッダーを検証
- 許可 Origin: `http://localhost:<port>`, `http://127.0.0.1:<port>`, `http://[::1]:<port>`
- Anti-CSRF トークン: サーバーメモリに保持、`GET /api/csrf-token` で発行、`X-AIRA-Token` ヘッダーで検証
- CORS: `Access-Control-Allow-Origin` をリクエスト Origin に対してエコー (許可リスト内のみ。ワイルドカード不可)

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

**スキャンルール**:
- ファイルシステム走査: `fs.readdir` + `fs.lstat` (NOT `fs.stat`) を使用
- シンボリックリンク/ジャンクション: `lstat.isSymbolicLink()` が true の場合スキップ (追跡しない)
- chokidar 設定: `followSymlinks: false`, `ignorePermissionErrors: true`
- 変更検出 (高速パス): `mtime_ms` + `size_bytes` の比較。いずれかが変化 → `file_modified` イベント
- 変更検出 (精密パス): `mtime_ms` が変化かつ `size_bytes` が同一の場合のみ `content_hash` (SHA-256) を再計算して比較
- 新規ファイル: `project_files` に未登録のパス → INSERT + `file_added` イベント
- 削除検出: DB に存在するがファイルシステムに存在しない → DELETE + `file_deleted` イベント

**クリーンアップ**: プロジェクト削除時に `fs.rm(projects/{project_id}/, { recursive: true, force: true })` を実行。  
パストラバーサル防止のため、削除対象パスが `projects/` 配下であることを検証する。

### DES-SEC-001: セキュリティ設計

**対応要件**: REQ-SEC-001〜003, REQ-NFR-003

**信頼モデル**: v1.0 はローカルユーザーが自ら設定した Skills/MCP を信頼する前提。  
シングルユーザー・localhost 専用のため、コンテナ隔離は不要。

**プロセスセキュリティ**:
- エージェントは `child_process.spawn()` で起動。**POSIX (macOS) では `detached: true` を指定し、子プロセスを独立したプロセスグループ/セッションで起動する**。これにより `process.kill(-pid, signal)` でプロセスツリー全体にシグナル送信が可能
- cwd を `projects/{project_id}/workspace/` に制限
- Token 注入: `AgentService` が解決済み Token を `spawn(..., { env: { GITHUB_TOKEN } })` で渡す
  - 解決優先順位: `process.env.GITHUB_TOKEN` > `data/settings.json` > 未設定 (エラー)
- タイムアウト: 10 分。macOS: `process.kill(-pid, 'SIGTERM')` → 5秒後 `process.kill(-pid, 'SIGKILL')` (プロセスグループ全体)。Windows: `taskkill /T /F /PID` (プロセスツリー)
- 最大同時実行数: デフォルト 5 プロセス (REQ-NFR-002 で設定可能)

**入力バリデーション**:
- API 入力値にスキーマバリデーション (zod) を適用
- ファイルパスの `../` トラバーサルを防止
- SQLite プリペアドステートメントで SQL インジェクション防止

**パス正規化・検証アルゴリズム** (REQ-NFR-009 対応):
ファイル API (create/open/delete/view/download) およびワークスペーススキャンで共通使用:
1. `path.resolve(workspaceDir, inputPath)` で絶対パスに解決
2. **境界安全検証**: `path.relative(workspaceDir, candidate)` を計算し、以下の場合は拒否 (403):
   - 結果が絶対パス (例: `/etc/passwd`)
   - 結果が `..` で始まる (例: `../sibling-project/secret`)
   - Windows: 比較前に両方を `.toLowerCase()` で case-fold
3. 存在するファイルに対しては `fs.realpath()` で解決後に再度ステップ 2 を適用 (シンボリックリンク経由の escape 防止)
4. Windows (`process.platform === 'win32'`) の場合:
   - 予約名チェック: ファイル名 (拡張子除去後) が `/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i` にマッチ → 拒否 (400)
   - 末尾ドット/スペース: ファイル名が `.` または ` ` で終わる → 拒否 (400)
5. シンボリックリンク/ジャンクション: `lstat` で判定、リンクの場合は拒否 (403)
6. 適用箇所: `FileService.resolve()` メソッドに集約し、全ファイル操作 API で呼び出す

**レンダリングセキュリティ (XSS 防御)**:
- Markdown: DOMPurify でサニタイズ。生 HTML は除去、許可タグのホワイトリスト方式
- URI スキーム: `javascript:`, `vbscript:`, `data:text/html` をブロック
- Mermaid: `securityLevel: 'strict'` でレンダリング
- SVG: `<img src="blob:...">` または `<img src="data:image/svg+xml,...">` としてのみ表示 (画像コンテキスト)。インライン DOM 挿入・`<object>`・`<iframe>` での SVG 表示は禁止
- CSP ヘッダー: `script-src 'self' 'wasm-unsafe-eval'` (unsafe-inline 禁止)
- 画像: `'self'` (ワークスペースファイル) + `data:image/*` のみ。外部画像は v1.0 では非表示

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
-- DB レベルで 1 プロジェクト 1 running を強制 (partial unique index)
CREATE UNIQUE INDEX idx_agent_runs_one_running ON agent_runs(project_id) WHERE status = 'running';
CREATE UNIQUE INDEX idx_agent_runs_one_queued ON agent_runs(project_id) WHERE status = 'queued';
```

**キュー制御トランザクション**:
新メッセージ受信時、以下を単一トランザクション (`BEGIN IMMEDIATE`) で実行:
1. `SELECT COUNT(*) FROM agent_runs WHERE project_id = ? AND status IN ('running', 'queued')` でプロジェクト内アクティブ数を確認
2. 0件 → グローバル上限チェック (下記) → OK なら `INSERT ... status='running'`
3. 1件 (running のみ) → `INSERT ... status='queued'` でキュー投入
4. 1件 (queued のみ、running なし) → 拒否 (HTTP 429)。queued Run は既に次回実行予約済みのため追加不可
5. 2件 (running + queued) → 拒否 (HTTP 429 Too Many Requests)
- `BEGIN IMMEDIATE` により書き込みロックを取得し、race condition を防止

**グローバル同時実行制御** (REQ-NFR-002):
- `SELECT COUNT(*) FROM agent_runs WHERE status = 'running'` でシステム全体の実行中 Run 数を取得
- 上限 (デフォルト 5、`AIRA_MAX_CONCURRENT_RUNS` で設定可能) に達している場合:
  - Run を `queued` 状態で INSERT (プロジェクト内キューとは別にシステムキューとして待機)
  - UI に「システム同時実行上限に達しています」を表示
- 昇格時もグローバル上限をチェック: 上限内の場合のみ `running` に昇格

**キュー昇格 (Queued → Running)**:
`running` Run が終端状態 (`completed` / `failed` / `cancelled` / `timeout`) に遷移した際:
1. 同一トランザクション内で:
   a. 同一プロジェクトの `queued` Run を昇格 (プロジェクトキュー優先)
   b. グローバル上限に空きがあれば、他プロジェクトの最古 `queued` Run も昇格対象
2. `UPDATE agent_runs SET status='running', started_at=NOW() WHERE id=?` で昇格
3. 昇格された Run が存在すれば、即座にプロセス起動 (`AgentService.spawn()`)
4. WS イベント `{ type: 'status', status: 'running' }` をクライアントに送信
5. 昇格対象がなければ何もしない (プロジェクトは idle 状態に戻る)

**起動時リカバリ (Orphan Run Reconciliation)**:
サーバー再起動時、前回クラッシュ等で終了処理されなかった Run を検出・回復する:
1. `SELECT id, project_id FROM agent_runs WHERE status IN ('running', 'queued')` で孤立 Run を取得
2. 各 Run を `failed` に更新: `UPDATE agent_runs SET status='failed', finished_at=NOW(), error_type='server_crash' WHERE id=?`
3. ログに「サーバー再起動により Run {id} を failed に移行」と記録
4. 全孤立 Run の処理後、キュー昇格ロジックを実行 (正常時と同じフロー)
5. プロジェクトのミューテーション (rename/delete) ブロックが解除される

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
  status      TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'importing', 'error')),
  last_error  TEXT,               -- インポート/更新失敗時のエラー詳細
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### MCP 設定 (project_mcp_configs)

```sql
CREATE TABLE project_mcp_configs (
  id          TEXT PRIMARY KEY,   -- UUID
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('stdio', 'sse', 'preset')),
  config_json TEXT NOT NULL,      -- JSON: stdio={command, args, env} / sse={url, headers} / preset={preset_id, categories?}
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
  file_path   TEXT NOT NULL,      -- ワークスペースルートからの相対パス (例: "src/main.rs")。絶対パスへの変換は FileService 内でのみ行う
  mime_type   TEXT,
  size_bytes  INTEGER,
  mtime_ms    INTEGER,            -- ファイルの mtime (ミリ秒 epoch)。変更検出に使用
  content_hash TEXT,              -- SHA-256 ハッシュ (同一サイズ変更検出用、オプション)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, file_path)   -- 同一プロジェクト内でパス重複を防止。ウォッチャー/リコンシリエーションは INSERT ... ON CONFLICT(project_id, file_path) DO UPDATE で UPSERT
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
| GET | /api/skills/catalog | マーケットプレイスカタログ一覧 (インストール済みマーク付き) |
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
| PUT | /api/settings/token | Token 登録・更新 (環境変数未設定時のみ有効) |
| DELETE | /api/settings/token | Token 削除 |
| POST | /api/settings/validate-token | サーバー保存済み Token を GitHub API で検証 (ボディなし) |
| GET | /api/health | プリフライト結果 JSON (`{ cli, workspace, os, token }`) |
| GET | /api/csrf-token | Anti-CSRF トークン取得 |

**PUT /api/settings/token 仕様**:
- リクエスト: `{ "token": "ghp_..." }`
- 環境変数 `GITHUB_TOKEN` が設定済みの場合: 409 Conflict (環境変数優先)
- 成功時: `data/settings.json` に保存 → 201 Created (新規) / 204 No Content (更新)
- CSRF トークン必須 (`X-AIRA-Token` ヘッダー)

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
