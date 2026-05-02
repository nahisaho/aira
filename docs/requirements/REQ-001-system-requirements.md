# AIRA 要件定義書

**バージョン**: 1.0.0  
**作成日**: 2026-05-02  
**ステータス**: Draft

---

## 1. システム概要

### 1.1 目的
AIRA (AI Runway Application) は、GitHub Copilot CLI をエージェントエンジンとして使用する  
WASM ベースのチャットボットシステムである。ユーザーはプロジェクト単位で  
Agent Skills および MCP (Model Context Protocol) サーバーを設定でき、  
プロジェクト内で生成されたファイルの閲覧・ダウンロードが可能である。

> **v1.0 デプロイモデル**: シングルユーザー・localhost 専用。  
> マルチユーザー・リモートデプロイは v2.0 以降のスコープとする。

### 1.2 システム境界

```
┌─────────────────────────────────────────────────────────────────┐
│  ブラウザ (WASM SPA)                                            │
│  ├── チャット UI                                                │
│  ├── プロジェクト管理 UI                                        │
│  ├── Skills 設定 UI                                             │
│  ├── MCP 設定 UI                                                │
│  └── ファイルビューア / ダウンローダー                          │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP / WebSocket
┌────────────────────▼────────────────────────────────────────────┐
│  AIRA バックエンド (Node.js 22+)                                │
│  ├── API サーバー (REST + WebSocket)                            │
│  ├── プロジェクト管理サービス                                   │
│  ├── Skills 管理サービス                                        │
│  ├── MCP 設定サービス                                           │
│  ├── エージェント実行サービス (Copilot CLI 子プロセス)           │
│  ├── ファイル管理サービス                                       │
│  └── SQLite DB                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 利用者

| アクター | 説明 |
|---|---|
| エンドユーザー | チャットボットを使用してタスクを実行する利用者 |
| 管理者 | プロジェクト・Skills・MCP を設定する利用者 (同一人物可) |

---

## 2. 機能要件

### 2.1 チャット機能

#### REQ-CHAT-001
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL provide a real-time chat interface that streams responses from the GitHub Copilot CLI agent via WebSocket.

**説明**: ユーザーがメッセージを送信すると、エージェントからの応答がリアルタイムでストリーミング表示される。

**受入基準**:
- [ ] チャット入力フォームが表示される
- [ ] メッセージ送信後、応答がリアルタイムで表示される
- [ ] WebSocket が切断された場合、自動再接続を試みる
- [ ] Markdown・コードブロックがレンダリングされる

**トレーサビリティ**: DES-CHAT-001

---

#### REQ-CHAT-002
**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:  
WHEN a user sends a message in a project, THE SYSTEM SHALL create a new Run, invoke the GitHub Copilot CLI with the project-specific Skills and MCP configuration, and stream the response.

**説明**: 各プロジェクトに設定された Skills と MCP 設定が、エージェント実行時に適用される。

**Run (実行) モデル**:
- 1 プロジェクトにつき同時に 1 Run のみ実行可能
- 実行中にメッセージを送信した場合はキューイング (最大 1 件)
- キューが埋まっている状態で追加送信した場合は拒否 (UI でエラー表示)
- Run の状態遷移: `queued → running → completed | failed | cancelled | timeout`
- `idle` は UI 表示専用であり Run エンティティの状態ではない (Run が存在しない状態)
- 右パネルは**現在選択中のプロジェクト**の最新 Run を表示する
- プロジェクト切り替え時、右パネルの表示も切り替わる
- Run 履歴は永続保存され、過去の Run をプログレスパネルから参照可能 (ステータス・開始/終了時刻・exit code。リアルタイムログは現在 Run のみ表示、過去 Run のログ再生は v1.1+ スコープ)

**Run エンティティ定義**:
| フィールド | 型 | 説明 |
|---|---|---|
| id | UUID | Run 一意識別子 |
| project_id | FK | 所属プロジェクト |
| message_id | FK (nullable) | トリガーとなったユーザーメッセージ |
| status | ENUM | `queued` / `running` / `completed` / `failed` / `cancelled` / `timeout` |
| created_at | DATETIME | キュー投入時刻 |
| started_at | DATETIME (nullable) | 実行開始時刻 |
| finished_at | DATETIME (nullable) | 終了時刻 |
| exit_code | INTEGER (nullable) | プロセス終了コード |
| error_type | TEXT (nullable) | エラー種別 (`cli_missing` / `auth_failure` / `timeout` / `spawn_failure` / `unknown`) |
| cancel_reason | TEXT (nullable) | キャンセル理由 (`user` / `system`) |

**受入基準**:
- [ ] プロジェクト選択中のチャットでは、そのプロジェクトの Skills が使用される
- [ ] プロジェクト選択中のチャットでは、そのプロジェクトの MCP 設定が適用される
- [ ] 異なるプロジェクト間での並行実行が可能 (デフォルト最大 5 プロセス、REQ-NFR-002 で設定可能)
- [ ] 同一プロジェクトで実行中に新メッセージ送信した場合、キューイングされる
- [ ] 右パネルは選択中プロジェクトの Run 状態を表示する

**トレーサビリティ**: DES-CHAT-001, DES-PROJECT-001

---

#### REQ-CHAT-003
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL maintain conversation history per project and display previous messages when the user opens a project chat.

**説明**: プロジェクトごとに会話履歴が保持され、再アクセス時に表示される。

**受入基準**:
- [ ] 会話履歴が SQLite に保存される
- [ ] プロジェクトを開くと過去のメッセージが読み込まれる
- [ ] 会話履歴のクリア機能がある

**トレーサビリティ**: DES-CHAT-001

---

#### REQ-CHAT-004
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL render Markdown content including code blocks with syntax highlighting in chat messages.

**説明**: チャットメッセージの基本 Markdown レンダリング。コードブロックはシンタックスハイライト付きで表示する。

**受入基準**:
- [ ] コードブロックがシンタックスハイライト付きで表示される
- [ ] インラインコード (`backticks`) が適切にスタイリングされる
- [ ] 見出し・リスト・強調が正しくレンダリングされる
- [ ] リンクがクリック可能に表示される

**トレーサビリティ**: DES-CHAT-001

---

#### REQ-CHAT-005
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL render tables, embedded image links, and provide a copy button on code blocks in chat messages.

**説明**: チャットメッセージの拡張 Markdown レンダリング (テーブル・画像・コピーボタン)。

**受入基準**:
- [ ] テーブルが適切にレンダリングされる
- [ ] CSP 許可ソース (`'self'`, `data:image/*`, `blob:`) の画像リンクがインライン表示される
- [ ] 外部 URL (`http(s)://`) の画像はインライン表示せず、クリック可能なリンクとして表示される (CSP `img-src` 制限)
- [ ] コードブロックにコピーボタンが付く
- [ ] Mermaid 記法が図としてレンダリングされる

**トレーサビリティ**: DES-CHAT-001

---

### 2.2 プロジェクト管理機能

#### REQ-PROJECT-001
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL allow users to create new projects with a unique name and optional description.

**説明**: ユーザーはプロジェクトを作成できる。プロジェクト名は一意である必要がある。

**受入基準**:
- [ ] プロジェクト作成フォームが表示される (名前・説明)
- [ ] プロジェクト名の重複チェックが行われる
- [ ] 作成後、プロジェクト一覧に表示される
- [ ] プロジェクト名は 1〜100 文字

**トレーサビリティ**: DES-PROJECT-001

---

#### REQ-PROJECT-002
**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:  
WHEN a user requests project deletion, THE SYSTEM SHALL prompt for confirmation before permanently deleting the project and all associated data.

**説明**: プロジェクト削除は確認ダイアログを経て実行される。関連データ (会話履歴・Skills・MCP 設定・生成ファイル) もすべて削除される。

**受入基準**:
- [ ] 削除前に確認ダイアログが表示される
- [ ] キャンセルで削除が中止される
- [ ] 削除後、プロジェクト一覧から除外される
- [ ] 関連する会話履歴・設定・ファイルが削除される

**トレーサビリティ**: DES-PROJECT-001

---

#### REQ-PROJECT-003
**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:  
WHEN a user renames a project, THE SYSTEM SHALL update the project name while preserving all associated data and configurations.

**説明**: プロジェクト名の変更。既存の会話履歴・Skills・MCP 設定・ファイルはそのまま保持される。

**受入基準**:
- [ ] プロジェクト名をインライン編集できる
- [ ] 変更後の名前が一意であることが検証される
- [ ] 名前変更後も会話履歴・設定が保持される
- [ ] UI がリアルタイムで更新される

**トレーサビリティ**: DES-PROJECT-001

---

#### REQ-PROJECT-004
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL display a list of all projects in the sidebar with their names, last activity timestamp, and status indicator.

**説明**: サイドバーにプロジェクト一覧を表示。最終アクティビティ日時とステータスを含む。

**受入基準**:
- [ ] サイドバーにプロジェクト一覧が表示される
- [ ] 最終アクティビティ日時が表示される
- [ ] ステータスが視覚的に表示される (`idle` / `running` は agent_runs から派生。`active` は直近アクティビティで判定)
- [ ] プロジェクトをクリックして選択できる

**トレーサビリティ**: DES-PROJECT-001

---

### 2.3 Agent Skills 管理機能

#### REQ-SKILLS-001
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL allow users to assign one or more Agent Skills to a project from the available skills library.

**説明**: プロジェクトに 1 つ以上の Agent Skill を割り当て可能。利用可能な Skills 一覧から選択する。

**受入基準**:
- [ ] プロジェクト設定画面に Skills 選択 UI がある
- [ ] 利用可能な Skills 一覧が表示される (名前・説明)
- [ ] 複数 Skills を選択できる
- [ ] 選択した Skills がプロジェクトに保存される

**トレーサビリティ**: DES-SKILLS-001

---

#### REQ-SKILLS-002
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL allow importing Skills from GitHub repositories via URL.

**説明**: GitHub リポジトリ URL から Skills をインポートできる。

**受入基準**:
- [ ] GitHub リポジトリ URL を入力できる
- [ ] `SKILL.md` を含む Skills ディレクトリを自動検出する
- [ ] インポートした Skills が利用可能 Skills 一覧に追加される
- [ ] インポートエラー時にわかりやすいエラーメッセージが表示される

**トレーサビリティ**: DES-SKILLS-001

---

#### REQ-SKILLS-003
**種別**: EVENT-DRIVEN  
**優先度**: P1

**要件**:  
WHEN the Copilot CLI agent is invoked for a project, THE SYSTEM SHALL load and inject all Skills assigned to that project.

**説明**: エージェント実行時に、プロジェクトに割り当てられた Skills が自動的に読み込まれる。

**受入基準**:
- [ ] エージェント実行時にプロジェクトの Skills が使用される
- [ ] Skills の内容 (SKILL.md) がエージェントのコンテキストに渡される
- [ ] Skills が正しく読み込まれたことがログで確認できる

**トレーサビリティ**: DES-SKILLS-001, DES-CHAT-001

---

#### REQ-SKILLS-004
**種別**: UBIQUITOUS  
**優先度**: P2

**要件**:  
THE SYSTEM SHALL provide a Skills marketplace that lists available skill packages with descriptions and one-click installation.

**説明**: Skills マーケットプレイス機能。既知の Skills パッケージ一覧からワンクリックでインストールできる。

**受入基準**:
- [ ] マーケットプレイス画面に Skills 一覧が表示される
- [ ] 各 Skills の説明・カテゴリ・作者が表示される
- [ ] ワンクリックでインストールできる
- [ ] インストール済み Skills にはマークが表示される

**トレーサビリティ**: DES-SKILLS-001

---

### 2.4 MCP 設定機能

#### REQ-MCP-001
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL allow users to configure MCP servers per project with server name, type (stdio/SSE), command, arguments, and environment variables.

**説明**: プロジェクトごとに MCP サーバーを設定できる。stdio および SSE タイプをサポートする。

**受入基準**:
- [ ] MCP サーバー追加フォームがある (名前・タイプ・コマンド・引数・環境変数)
- [ ] stdio / SSE タイプを選択できる
- [ ] 設定がプロジェクトに保存される
- [ ] 設定した MCP がエージェント実行時に `--additional-mcp-config` で渡される

**トレーサビリティ**: DES-MCP-001

---

#### REQ-MCP-002
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL provide preset MCP server configurations (GitHub MCP Tools, ToolUniverse, Deep Research) that can be enabled with a single toggle.

**説明**: プリセット MCP 設定 (GitHub MCP Tools、ToolUniverse、Deep Research) をトグルで有効化できる。

**受入基準**:
- [ ] プリセット MCP 一覧が表示される
- [ ] トグルで有効/無効を切り替えられる
- [ ] プリセットの説明が表示される
- [ ] プリセット設定がプロジェクトに保存される

**トレーサビリティ**: DES-MCP-001

---

#### REQ-MCP-003
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL allow users to enable GitHub MCP Tools per project with granular tool category selection.

**説明**: プロジェクトごとに GitHub MCP Tools を有効化し、ツールカテゴリ (repos/issues/PRs 等) を選択できる。

**受入基準**:
- [ ] GitHub MCP Tools を有効化するトグルがある
- [ ] 全ツール / 部分ツール (repos, issues, PRs) を選択できる
- [ ] 設定がプロジェクトに保存される

**トレーサビリティ**: DES-MCP-001

---

### 2.5 ファイル管理機能

#### REQ-FILE-001
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL display a list of all files generated within a project, showing filename, file type, size, and first-indexed timestamp.

**説明**: プロジェクト内で生成されたファイルの一覧を表示する。タイムスタンプは AIRA がファイルを最初にインデックスした日時 (`project_files.created_at`) を使用する。

**受入基準**:
- [ ] ファイル一覧パネルがある
- [ ] ファイル名・種別・サイズ・初回インデックス日時が表示される
- [ ] ファイルをクリックしてビューアを開ける

**トレーサビリティ**: DES-FILE-001

---

#### REQ-FILE-002
**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:  
WHEN a user clicks on a file, THE SYSTEM SHALL open a viewer appropriate for the file type (Markdown, code, image, PDF, JSON, Mermaid diagram).

**説明**: ファイルタイプに応じた適切なビューアが開く。

**受入基準**:
- [ ] Markdown ファイルがレンダリングされて表示される
- [ ] コードファイルがシンタックスハイライト付きで表示される
- [ ] 画像ファイル (PNG, JPG, SVG) がインライン表示される
- [ ] PDF ファイルが埋め込みビューアで表示される
- [ ] JSON ファイルがフォーマット済みで表示される
- [ ] Mermaid 記法が図としてレンダリングされる

**トレーサビリティ**: DES-FILE-001

---

#### REQ-FILE-003
**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:  
WHEN a user requests file download, THE SYSTEM SHALL initiate a browser download of the selected file with its original filename.

**説明**: ファイルをブラウザダウンロードできる。元のファイル名が保持される。

**受入基準**:
- [ ] ファイルビューアにダウンロードボタンがある
- [ ] ファイル一覧からダウンロードできる
- [ ] 元のファイル名でダウンロードされる
- [ ] バイナリファイル (画像・PDF) も正しくダウンロードされる

**トレーサビリティ**: DES-FILE-001

---

#### REQ-FILE-004
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL support bulk download of all files in a project as a ZIP archive.

**説明**: プロジェクト内の全ファイルを ZIP でまとめてダウンロードできる。

**受入基準**:
- [ ] 「全てダウンロード (ZIP)」ボタンがある
- [ ] プロジェクト名を含む ZIP ファイルが生成される
- [ ] ZIP 内にフォルダ構造が保持される

**トレーサビリティ**: DES-FILE-001

---

#### REQ-FILE-005
**種別**: EVENT-DRIVEN  
**優先度**: P1

**要件**:  
WHEN a user clicks "Open" on a file, THE SYSTEM SHALL open the file using the OS default application associated with the file type, provided the file type is not in the blocked executable list.

**説明**: ファイルをOSのデフォルトアプリケーション (VS Code, テキストエディタ等) で開く。セキュリティのため、スクリプト・実行可能ファイルの直接起動はブロックする。

**ブロック対象ファイル拡張子** (大文字小文字不問):
- Windows 実行形式: `.exe`, `.msi`, `.bat`, `.cmd`, `.ps1`, `.vbs`, `.vbe`, `.js` (WSH), `.wsf`, `.wsh`, `.scr`, `.com`, `.pif`
- ショートカット/プロトコル: `.lnk`, `.url`, `.desktop`
- macOS 実行形式: `.command`, `.app`, `.action`, `.workflow`
- スクリプト共通: `.sh`, `.bash`, `.zsh`

> **注意**: ブロック対象ファイルには「開く」ボタンの代わりに「View」のみ表示。ユーザーが内容を確認した上で手動でファイルシステムから実行する必要がある。

**OS 別実行方法**:
| OS | コマンド | 注意事項 |
|---|---|---|
| macOS | `open <path>` | spawn で直接実行可。パスはシェルエスケープ不要 (引数として渡す) |
| Windows | `powershell.exe -NoProfile -Command "Start-Process -LiteralPath '<path>'"` | `-LiteralPath` でメタ文字 (`&`, `%`, `^` 等) を安全に処理。パスに `'` が含まれる場合は `''` でエスケープ |

**受入基準**:
- [ ] ファイル行に「開く」ボタンがある (ブロック対象拡張子のファイルには非表示)
- [ ] ブロック対象拡張子のファイルは「View」のみ利用可能
- [ ] クリックで OS のデフォルトアプリケーションが起動する
- [ ] バックエンド API (`POST /api/projects/:id/files/:fileId/open`) のレスポンス:
  - 成功: 200 OK
  - ファイル未存在: 404 Not Found
  - ブロック対象拡張子: 403 Forbidden (`{ "error": "blocked_file_type" }`)
  - ファイルロック (Windows EBUSY): 423 Locked
  - 権限エラー (EPERM/EACCES): 403 Forbidden (`{ "error": "permission_denied" }`)
  - OS コマンド実行失敗: 500 Internal Server Error
- [ ] macOS では `open` コマンド、Windows では `Start-Process -LiteralPath` を使用する
- [ ] パスにスペース・日本語文字を含むファイルが正しく開ける
- [ ] パスにシェルメタ文字 (`&`, `%`, `^`, `(`, `)`) を含むファイルが正しく開ける

**トレーサビリティ**: DES-FILE-001

---

#### REQ-FILE-006
**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:  
WHEN a user requests file deletion, THE SYSTEM SHALL prompt for confirmation and then remove the file from both the filesystem and the project_files table.

**説明**: ファイルを削除できる。確認ダイアログ後にファイルシステムと DB から削除する。

**受入基準**:
- [ ] ファイル行に「削除」ボタンがある
- [ ] 削除前に確認ダイアログが表示される
- [ ] 確認後にファイルがディスクから削除される
- [ ] project_files テーブルからレコードが削除される
- [ ] ファイル一覧がリアルタイムで更新される

**トレーサビリティ**: DES-FILE-001

---

### 2.6 進行状況表示機能

#### REQ-PROGRESS-001
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL display agent execution progress in a dedicated right panel, showing current run status, elapsed time, and a real-time activity log.

**説明**: 画面右側の専用パネルにエージェント実行の進行状況を表示する。Run が存在しない場合は `idle` (UI 表示専用、Run の状態ではない) と表示する。

**受入基準**:
- [ ] 右パネルに進行状況セクションが表示される
- [ ] Run 未実行時は「idle」表示 (UI 表示のみ、Run エンティティの状態ではない)
- [ ] Run 実行中は状態バッジ (`queued` / `running`) と経過時間がリアルタイム表示される
- [ ] Run 完了後は最終状態 (`completed` / `failed` / `cancelled` / `timeout`) が表示される
- [ ] エージェントのアクティビティログが表示される (ファイル作成、ツール呼び出し等)

**トレーサビリティ**: DES-PROGRESS-001

---

#### REQ-PROGRESS-002
**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:  
WHEN a new file is generated during agent execution, THE SYSTEM SHALL immediately update the file list in the right panel via WebSocket event from the live workspace watcher (REQ-WORKSPACE-002).

**説明**: エージェント実行中に生成されたファイルがリアルタイムでファイル一覧に反映される。ライブ監視 (chokidar) がファイル変更を検出し、WebSocket で通知する。

**受入基準**:
- [ ] 実行中にファイルが追加されると 2 秒以内にファイル一覧が更新される
- [ ] 新規ファイルにはハイライトアニメーション (3 秒間) が付く
- [ ] 実行完了を待たずにファイル操作 (View/Download/Open) が可能
- [ ] 大量ファイル生成時はバッチ更新 (500ms debounce) で UI 負荷を抑える

**トレーサビリティ**: DES-PROGRESS-001

---

#### REQ-PROGRESS-003
**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:  
WHEN a user clicks the stop button during agent execution, THE SYSTEM SHALL terminate the agent process and update the status to "cancelled".

**説明**: 実行中のエージェントをキャンセルできる。

**受入基準**:
- [ ] 実行中のみ「停止」ボタンが表示される
- [ ] クリックでエージェントプロセスが停止される
- [ ] ステータスが「cancelled」に更新される
- [ ] それまでに生成されたファイルは保持される

**トレーサビリティ**: DES-PROGRESS-001

---

### 2.7 画面レイアウト

#### REQ-UI-001
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL provide a 3-column layout: left sidebar (project list), center pane (chat/settings), and right panel (progress + file list).

**説明**: 3 カラムレイアウトで、右パネルに進行状況と出力ファイル一覧を常時表示する。

**受入基準**:
- [ ] 3 カラムレイアウトが表示される
- [ ] 左サイドバー: プロジェクト一覧 (幅 ~240px、リサイズ可)
- [ ] 中央: チャット/設定 (可変幅)
- [ ] 右パネル: 進行状況 + ファイル一覧 (幅 ~320px、リサイズ可)
- [ ] 右パネルは折りたたみ/展開が可能

**トレーサビリティ**: DES-PROGRESS-001, DES-FILE-001

---

### 2.8 認証・設定機能

#### REQ-AUTH-001
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL require a valid GitHub Token to be configured before invoking the Copilot CLI agent.

**説明**: GitHub Token が設定されていない場合、エージェントを呼び出せない。Token は設定 UI またはサーバーサイドの環境変数 (`GITHUB_TOKEN`) から取得する。

**Token ライフサイクル**:
1. **入力元**: 環境変数 (`GITHUB_TOKEN`) またはサーバー設定 API 経由
2. **保存場所**: サーバーサイドの `data/settings.json` に保存 (環境変数が優先)
3. **保護方式 (v1.0)**: OS ファイル権限 (0600) による保護。アプリケーションレベルの暗号化は v1.1+ スコープ
4. **永続性**: サーバー再起動後も保持される (永続保存)
5. **クライアント通知**: Token の設定有無 (boolean) のみ API レスポンスに含む
6. **子プロセス注入**: `child_process.spawn()` の `env` オプションで渡す
7. **失効時**: エージェント実行エラーとしてユーザーに通知し、再設定を促す

> **注意 (v1.0 セキュリティ前提)**: localhost シングルユーザーのため、Token は平文保存 + ファイル権限保護で許容する。  
> v1.1+ で OS ネイティブ秘密ストア (macOS Keychain / Windows DPAPI) への移行を計画。

**受入基準**:
- [ ] 環境変数 `GITHUB_TOKEN` が設定されていればそちらを使用する
- [ ] 環境変数未設定時は、設定 API で Token を登録できる
- [ ] `data/settings.json` のファイル権限が 0600 (owner read/write only) で作成される
- [ ] Windows では `data/settings.json` が NTFS ACL でカレントユーザーのみ読み書き可能に設定される
- [ ] Token が未設定の場合、チャット送信時に「Token 未設定」エラーが表示される
- [ ] GET /api/settings は Token の設定有無 (boolean) のみ返す (Token 値は返さない)
- [ ] Token の有効性を検証するエンドポイント (POST /api/settings/validate-token) がある。サーバー保存済み Token を GitHub API に対して検証する (リクエストボディに Token を含まない)

**トレーサビリティ**: DES-AUTH-001

---

#### REQ-AUTH-005
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL validate the Origin header on all WebSocket upgrade requests and state-changing HTTP requests, and reject requests not originating from the served SPA.

**説明**: localhost アプリであっても、悪意あるWebサイトからの CSRF / Cross-Origin リクエストを防止する必要がある。ブラウザから送信される `Origin` ヘッダーを検証し、AIRA が配信する SPA 以外からのリクエストを拒否する。

**防御レイヤー**:
1. **Origin 検証**: すべての状態変更リクエスト (POST/PUT/PATCH/DELETE) および WS upgrade で `Origin` ヘッダーが許可リストと一致することを確認。許可 Origin: `http://localhost:<port>`, `http://127.0.0.1:<port>`, `http://[::1]:<port>`
2. **Anti-CSRF トークン**: SPA 初回ロード時にサーバーが生成するランダムトークンを `X-AIRA-Token` ヘッダーとして状態変更リクエストに付与
3. **CORS ポリシー**: `Access-Control-Allow-Origin` をリクエストの Origin に対してエコー (許可リスト内の場合のみ)。ワイルドカード不可

**受入基準**:
- [ ] 状態変更 HTTP リクエスト (POST/PUT/PATCH/DELETE) に `Origin` ヘッダー検証ミドルウェアが適用される
- [ ] WebSocket upgrade リクエストに `Origin` ヘッダー検証が適用される
- [ ] `Origin` が許可リスト (`http://localhost:<port>`, `http://127.0.0.1:<port>`, `http://[::1]:<port>`) に含まれない場合、403 Forbidden を返す
- [ ] SPA 初回ロード時に `GET /api/csrf-token` でトークンが発行される
- [ ] 状態変更リクエストに `X-AIRA-Token` ヘッダーが必須 (未付与/不一致は 403)
- [ ] CORS `Access-Control-Allow-Origin` がワイルドカード (`*`) でない
- [ ] トークンは暗号学的に安全な乱数 (crypto.randomUUID() 以上) で生成される
- [ ] トークンはサーバーメモリに保持 (再起動時再発行、DB 保存不要)

**トレーサビリティ**: DES-AUTH-001

---

#### REQ-AUTH-002
**種別**: UNWANTED  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL NOT persist, re-expose, or cache the GitHub Token in API responses, browser storage, logs, or subsequent UI state after the initial submission.

**説明**: セキュリティ要件: Token はユーザーが明示的に設定 API に送信する瞬間のみネットワーク上を流れる。送信後は一切クライアントサイドに保持・再表示しない。

**受入基準**:
- [ ] GET API レスポンスに Token 値が含まれない (有無の boolean のみ)
- [ ] Token が localStorage / sessionStorage / cookie に保存されない
- [ ] Token 設定後、設定画面のフォームフィールドが即座にクリアされる
- [ ] サーバーログに Token 値が出力されない (マスク処理)
- [ ] PUT /api/settings/token のリクエスト/レスポンスを除き、Token がネットワーク上を流れない

**トレーサビリティ**: DES-AUTH-001

---

#### REQ-AUTH-003
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL operate as a single-user localhost application in v1.0, requiring no application-level authentication or authorization.

**説明**: v1.0 はローカルマシン上で単一ユーザーが使用する前提とする。アプリケーションレベルの認証・認可は不要。すべての API エンドポイントは localhost からのみアクセス可能とする。

**受入基準**:
- [ ] API サーバーがループバックインターフェースのみにバインドされる (`127.0.0.1` および `::1`)
- [ ] 外部ネットワークからのアクセスが拒否される
- [ ] `localhost` での接続が Windows / macOS 両方で動作する (IPv4/IPv6 両対応)
- [ ] アプリケーションレベルのログイン画面が不要

**バインド戦略**:  
Node.js の `server.listen(port, '::')` は OS の dual-stack 設定に依存するため、**2 ソケット方式**を採用する:
1. `server.listen(port, '127.0.0.1')` — IPv4 ループバック
2. `server.listen(port, '::1')` — IPv6 ループバック  

いずれか一方のバインドが失敗した場合 (例: IPv6 無効環境)、もう一方のみで起動しログに警告を出力する。

**トレーサビリティ**: DES-AUTH-001

---

#### REQ-AUTH-004
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL pass the GitHub Token to agent child processes via environment variable, and SHALL NOT write it to workspace directories, log files, or any user-visible output.

**説明**: エージェントプロセスへの認証情報注入方法。Token は `child_process.spawn()` の `env` パラメータで渡す。プロセス終了後、OS がプロセスメモリを解放するため自動的に消去される。サーバーサイドの永続保存 (`data/settings.json`) は REQ-AUTH-001 で定義。

**受入基準**:
- [ ] 子プロセス起動時に `env.GITHUB_TOKEN` で Token が渡される
- [ ] ワークスペースディレクトリに Token が書き込まれない
- [ ] アプリケーションログに Token が出力されない (マスク処理)
- [ ] WebSocket メッセージに Token が含まれない

**トレーサビリティ**: DES-AUTH-001

---

### 2.9 ワークスペース・ファイルライフサイクル

#### REQ-WORKSPACE-001
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL maintain a dedicated workspace directory per project at `projects/{project_id}/workspace/` for agent-generated files.

**説明**: プロジェクトごとに独立したワークスペースディレクトリを持ち、エージェントが生成したファイルはここに保存される。

**受入基準**:
- [ ] プロジェクト作成時にワークスペースディレクトリが作成される
- [ ] エージェントプロセスの cwd がワークスペースに設定される
- [ ] ファイルパスが `projects/{project_id}/workspace/` 配下に限定される

**トレーサビリティ**: DES-WORKSPACE-001

---

#### REQ-WORKSPACE-002
**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:  
WHEN an agent process is running, THE SYSTEM SHALL watch the workspace directory for file changes (using chokidar/fs.watch) and emit WebSocket events for new/modified/deleted files. WHEN the agent process completes, THE SYSTEM SHALL perform a full reconciliation scan to ensure consistency.

**説明**: 二段階のファイル検出メカニズム:
1. **ライブ監視**: 実行中は chokidar でワークスペースを監視し、即時にファイルイベントを発行
2. **完了後スキャン**: プロセス終了後にフルスキャンで DB との整合性を確保

**受入基準**:
- [ ] エージェント実行開始時にワークスペース監視が開始される
- [ ] ファイル追加時に `file_added` WebSocket イベントが発行される
- [ ] ファイル変更時に `file_modified` WebSocket イベントが発行される
- [ ] ファイル削除時に `file_deleted` WebSocket イベントが発行される
- [ ] プロセス終了後にフルスキャンで project_files テーブルが更新される
- [ ] ライブ監視で検出漏れがあっても、最終スキャンで補完される

**トレーサビリティ**: DES-WORKSPACE-001

---

#### REQ-WORKSPACE-003
**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:  
WHEN a project is deleted, THE SYSTEM SHALL remove the project's workspace directory and all associated files from the filesystem.

**説明**: プロジェクト削除時に、ワークスペースディレクトリとファイルを完全に削除する。

**受入基準**:
- [ ] プロジェクト削除でワークスペースディレクトリが削除される
- [ ] 関連する project_files レコードが削除される (CASCADE)
- [ ] 他のプロジェクトのワークスペースに影響しない

**トレーサビリティ**: DES-WORKSPACE-001

---

### 2.10 セキュリティ・信頼モデル

#### REQ-SEC-001
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL confine all API-level and UI-level file operations to the resolved project workspace path, and SHALL set the agent process working directory to the project workspace.

**説明**: v1.0 の信頼モデル: ローカルユーザーが自ら設定した Skills/MCP を信頼する前提。セキュリティ境界は **API/UI レベル** でのパス制限であり、子プロセス自体のホストアクセスを完全に隔離するものではない (localhost シングルユーザーのため許容)。

**セキュリティ範囲**:
- API エンドポイント: ファイルパスを `realpath()` で解決し、ワークスペース外アクセスを拒否
- UI: ワークスペース外のパスを表示・操作不可
- エージェントプロセス: cwd をワークスペースに設定 (ベストエフォート)
- **注意**: 子プロセスはホストユーザー権限で動作するため、悪意ある Skills/MCP が設定された場合、ワークスペース外にアクセスする可能性がある (v1.0 では許容)

**受入基準**:
- [ ] ファイル API が `realpath()` でパスを解決し、ワークスペース外を 403 で拒否する
- [ ] エージェントプロセスの cwd が `projects/{id}/workspace/` に設定される
- [ ] 最大同時実行数がデフォルト 5 プロセスに制限される (REQ-NFR-002 で設定可能)
- [ ] パストラバーサル攻撃 (`../`) が API レベルで防止される

**トレーサビリティ**: DES-SEC-001

---

#### REQ-SEC-002
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL enforce a maximum execution time of 10 minutes per agent invocation and terminate the process tree if exceeded.

**説明**: エージェント実行にタイムアウトを設定し、無限ループや過度なリソース消費を防止する。プロセスツリー全体 (子プロセスの孫プロセスを含む) を確実に停止する。

**OS 別プロセス停止戦略**:
| OS | 手順 | 詳細 |
|---|---|---|
| macOS | `SIGTERM` → 5秒待機 → `SIGKILL` | `process.kill(-pid, signal)` でプロセスグループ全体を停止 |
| Windows | `taskkill /T /F /PID <pid>` | `/T` でプロセスツリー全体、`/F` で強制終了。Node の `child_process.spawn('taskkill', ...)` で実行 |

**受入基準**:
- [ ] プロセスに 10 分のタイムアウトが設定される
- [ ] macOS: タイムアウト超過で SIGTERM → 5秒後 SIGKILL (プロセスグループ)
- [ ] Windows: タイムアウト超過で `taskkill /T /F /PID` によるツリー停止
- [ ] タイムアウト/キャンセル後、Copilot CLI プロセスおよび子孫プロセスが両 OS で残存しない
- [ ] タイムアウト発生がユーザーに通知される
- [ ] Run ステータスが `timeout` に更新される

**トレーサビリティ**: DES-SEC-001

---

#### REQ-SEC-003
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL sanitize all rendered content (Markdown, Mermaid, code blocks) to prevent XSS, and apply a Content Security Policy (CSP) to the SPA.

**説明**: localhost アプリでも XSS は深刻な脅威である。注入されたスクリプトが特権ローカル API を呼び出し、ファイル削除やプロセス停止を実行できるため、レンダリング時のサニタイズと CSP が必須。

**サニタイズルール**:
1. **Raw HTML**: Markdown 内の生 HTML タグは除去またはエスケープ (`allowedTags` ホワイトリスト方式)
2. **URI スキーム**: `javascript:`, `vbscript:`, `data:text/html` を含むリンク/画像 URL をブロック。許可スキーム: `http:`, `https:`, `mailto:`, `data:image/*`
3. **Mermaid**: サンドボックスモード (`securityLevel: 'strict'`) でレンダリング。クリックイベントハンドラ無効化
4. **コードブロック**: テキストとしてレンダリング。HTML として解釈しない
5. **画像**: ワークスペース内ファイル (`'self'`)、`data:image/*` のみ許可。外部 URL (`http(s)://`) の画像は表示しない (v1.0 セキュリティ優先。外部画像プロキシは v1.1+ スコープ)
6. **SVG**: `<img src="blob:...">` または `<img src="data:image/svg+xml,...">` として画像コンテキストでのみ表示。インライン DOM 挿入 (`innerHTML`)、`<object>`、`<iframe>` での SVG レンダリングは禁止 (SVG 内スクリプト実行を防止)

**CSP ポリシー** (v1.0):
```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
connect-src 'self' http://localhost:* http://127.0.0.1:* http://[::1]:* ws://localhost:* ws://127.0.0.1:* ws://[::1]:*;
object-src 'none';
base-uri 'self';
```

> **注意**: `connect-src` に HTTP loopback を含めるのは、開発時に SPA (Vite dev server) と API サーバーが異なるポートで動作するため。プロダクションビルドでは同一オリジンだが、CSP は開発/本番共通で適用する。  
> `img-src` に `blob:` を含めるのは、SVG ファイルを安全な画像コンテキスト (`<img src="blob:...">`) で表示するため。

**受入基準**:
- [ ] Markdown レンダリング時に生 HTML タグがエスケープまたは除去される
- [ ] `javascript:` スキームのリンクがレンダリングされない
- [ ] `data:text/html` を含む URL がブロックされる
- [ ] Mermaid が `securityLevel: 'strict'` でレンダリングされる
- [ ] SVG ファイルが `<img>` タグ (画像コンテキスト) でのみ表示され、インライン DOM 挿入されない
- [ ] CSP ヘッダーが全 HTML レスポンスに付与される
- [ ] `script-src` に `unsafe-inline` が含まれない
- [ ] エージェント出力に `<script>` タグが含まれていても実行されない
- [ ] サニタイズライブラリ (DOMPurify 等) が使用される

**トレーサビリティ**: DES-SEC-001, DES-CHAT-001, DES-FILE-001

---

### 2.11 障害・エラーハンドリング

#### REQ-ERR-001
**種別**: UNWANTED  
**優先度**: P0

**要件**:  
IF the GitHub Copilot CLI is not installed or not found in PATH, THE SYSTEM SHALL display a clear error message indicating the missing dependency and prevent agent execution.

**受入基準**:
- [ ] CLI 未検出時、具体的なインストール手順を含むエラーメッセージが表示される
- [ ] CLI 未検出状態でチャット送信した場合、Run は `failed` 状態になる
- [ ] エラーメッセージがトースト通知として表示される

**トレーサビリティ**: DES-CHAT-001, DES-SEC-001

---

#### REQ-ERR-002
**種別**: UNWANTED  
**優先度**: P0

**要件**:  
IF the GitHub token is missing, expired, or invalid, THE SYSTEM SHALL notify the user of the authentication failure and guide them to re-authenticate.

**受入基準**:
- [ ] トークン未設定時、設定画面への誘導を含むエラーが表示される
- [ ] CLI が認証エラー (exit code) を返した場合、トークン再設定を促す
- [ ] 認証エラー発生時、Run は `failed` 状態になる

**トレーサビリティ**: DES-AUTH-001

---

#### REQ-ERR-003
**種別**: UNWANTED  
**優先度**: P0

**要件**:  
IF a WebSocket connection is lost during an active Run, THE SYSTEM SHALL automatically attempt reconnection and resync the Run state upon reconnection.

**再接続プロトコル**:
1. **切断検知**: WebSocket `close` / `error` イベント
2. **リトライ**: 指数バックオフ (1s → 2s → 4s → 8s → 16s、最大 16s)
3. **再接続後の状態同期**: スナップショット方式
   - クライアントが `GET /api/projects/:id/runs/current` で現在の Run 状態を取得
   - クライアントが `GET /api/projects/:id/files` で最新ファイル一覧を取得
   - 右パネルの UI をスナップショットで完全再構築
4. **リトライ上限**: 5 回連続失敗後は自動リトライ停止、手動リロードを促す

> **設計判断**: イベント再送 (replay) 方式はバッファ管理・シーケンス管理が複雑なため、v1.0 ではスナップショット方式を採用。再接続時にイベント間のギャップは生じるが、スナップショットにより最終状態は常に正確。

**受入基準**:
- [ ] 切断検知後 1 秒以内にリコネクト試行が開始される
- [ ] 指数バックオフでリトライ間隔が増加する (1s → 2s → 4s → 8s → 16s)
- [ ] リコネクト中は UI に接続状態インジケーターが表示される (`connected` / `reconnecting` / `disconnected`)
- [ ] 再接続後に `GET /api/projects/:id/runs/current` で Run スナップショットを取得する
- [ ] 再接続後に `GET /api/projects/:id/files` でファイル一覧を再取得する
- [ ] 5 回連続失敗後に「ページを再読み込みしてください」メッセージが表示される
- [ ] 再接続成功後にリトライカウンターがリセットされる

**トレーサビリティ**: DES-PROGRESS-001

---

#### REQ-ERR-004
**種別**: UNWANTED  
**優先度**: P1

**要件**:  
IF an MCP configuration is invalid or a provider is unreachable at runtime, THE SYSTEM SHALL report the error and allow the Run to proceed without the failed MCP provider.

**障害の発生タイミング**:
1. **保存時バリデーション** (ユーザー操作): JSON 構文エラー、最低限の構造検証 (type/name フィールドの存在) → 保存拒否 (400 Bad Request)、UI にエラー表示。接続先の到達性は検証しない (構文のみ)
2. **Run 実行時** (自動): MCP サーバー接続失敗/タイムアウト → Copilot CLI の出力から検知、右パネルに警告表示、当該プロバイダなしで Run 続行

**受入基準**:
- [ ] MCP 設定保存時に JSON 構文エラー・必須フィールド (type, name) 欠落が即時表示される
- [ ] 保存時に接続確認は行わない (構文/構造バリデーションのみ)
- [ ] 実行時に CLI 出力から MCP 接続失敗を検知した場合、右パネルのログに警告が表示される
- [ ] MCP 接続失敗があっても Run 自体は続行される (CLI の判断に委ねる)
- [ ] `enabled = 0` の MCP プロバイダは設定ファイルに含まれない

**トレーサビリティ**: DES-MCP-001

---

#### REQ-ERR-005
**種別**: UNWANTED  
**優先度**: P1

**要件**:  
IF a user attempts to delete or rename a project while a Run is active, THE SYSTEM SHALL block the operation and inform the user that the Run must be stopped or completed first.

**受入基準**:
- [ ] 実行中プロジェクトの削除ボタンが無効化される (disabled)
- [ ] 実行中プロジェクトのリネームが拒否される
- [ ] 拒否時に「Run を停止してから操作してください」メッセージが表示される

**トレーサビリティ**: DES-PROJECT-001

---

#### REQ-ERR-006
**種別**: UNWANTED  
**優先度**: P1

**要件**:  
IF a Skill import or refresh fails (unreachable URL, invalid manifest, network error), THE SYSTEM SHALL mark the Skill as unavailable (`status='error'`), record the error reason, and allow agent Runs to proceed without the failed Skill.

**障害の発生タイミング**:
1. **インポート/リフレッシュ時** (ユーザー操作): URL 到達不能、マニフェスト不正 → `skills.status = 'error'`, `skills.last_error` に詳細記録、UI にエラー表示
2. **Run 実行時** (自動): 割り当て済み Skill のうち `status != 'available'` のものは自動スキップ。ローカルファイル読み取り失敗 (削除・破損) も同様にスキップし警告表示

**受入基準**:
- [ ] Skill インポート時に URL 到達不能の場合、`status='error'` に設定される
- [ ] Skill インポート時にマニフェスト不正の場合、バリデーションエラーが表示される
- [ ] `status='error'` の Skill がスキルリストで「エラー」状態表示される
- [ ] Run 実行時に `status='error'` の Skill は自動スキップされ、残りの Skill で実行が続行される
- [ ] スキップされた Skill の情報が右パネルのログに警告表示される

**トレーサビリティ**: DES-SKILLS-001

---

#### REQ-ERR-007
**種別**: UNWANTED  
**優先度**: P0

**要件**:  
IF a file operation (delete, open, read) fails due to OS-level permission denial or file lock (common on Windows), THE SYSTEM SHALL return a specific error indicating the cause and suggest the user close the locking application.

**受入基準**:
- [ ] ファイル削除時に `EBUSY` / `EPERM` / `EACCES` エラーが発生した場合、具体的なエラーメッセージが表示される
- [ ] エラーメッセージに「ファイルを使用中のアプリケーションを閉じてください」を含む
- [ ] Windows でのファイルロック状態が正しく検知される
- [ ] ファイルオープン/削除失敗時にファイルロックが原因なら 423 (Locked) を返し、権限エラーなら 403 を返す

**トレーサビリティ**: DES-FILE-001

---

#### REQ-ERR-008
**種別**: UNWANTED  
**優先度**: P0

**要件**:  
IF the agent child process fails to spawn (ENOENT, EACCES, or other OS error), THE SYSTEM SHALL set the Run status to `failed` with `error_type: spawn_failure` and display the OS-level error message.

**受入基準**:
- [ ] spawn 失敗 (ENOENT 以外も含む) が Run `failed` 状態に反映される
- [ ] `error_type` フィールドに `spawn_failure` が設定される
- [ ] OS エラーメッセージがユーザーに表示される
- [ ] Windows の権限エラーと macOS の権限エラーの両方が処理される

**トレーサビリティ**: DES-CHAT-001, DES-SEC-001

---

#### REQ-ERR-009
**種別**: UNWANTED  
**優先度**: P1

**要件**:  
IF the workspace file watcher (chokidar) fails to start or encounters an OS-level error, THE SYSTEM SHALL log the error, fall back to post-completion reconciliation scan only, and notify the user that real-time file updates are unavailable.

**受入基準**:
- [ ] watcher 起動失敗時にエラーがログに記録される
- [ ] Run は中断されず続行される (リアルタイム更新なしで)
- [ ] 右パネルに「リアルタイム更新無効」の警告が表示される
- [ ] 完了後のフルスキャンでファイル一覧が最終的に正確になる

**トレーサビリティ**: DES-WORKSPACE-001, DES-PROGRESS-001

---

## 3. 非機能要件

### 3.1 パフォーマンス

#### REQ-NFR-001
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL respond to user interactions (button clicks, page transitions) within 200ms under normal load.

**受入基準**:
- [ ] UI 操作のレスポンスが 200ms 以内 (Lighthouse CI で計測)
- [ ] プロジェクト一覧の読み込みが 500ms 以内 (10 プロジェクト時)

**トレーサビリティ**: DES-CHAT-001, DES-PROJECT-001

---

#### REQ-NFR-002
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL support a configurable maximum number of concurrent agent process executions (default: 5).

**説明**: 最大同時実行数は環境変数 `AIRA_MAX_CONCURRENT_RUNS` またはサーバー設定で変更可能。デフォルト値は 5。

**受入基準**:
- [ ] デフォルト設定で 5 プロジェクトの同時実行が可能
- [ ] 最大並行数超過時に Run が `queued` 状態で待機する
- [ ] 設定値を変更して同時実行数を増減できる
- [ ] 同時実行テストは CI 環境 (2 vCPU / 4GB RAM 相当) で検証する

**トレーサビリティ**: DES-SEC-001, DES-CHAT-001

---

### 3.2 セキュリティ

#### REQ-NFR-003
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL isolate project data at the API level by resolving file paths with `realpath()` and rejecting any access outside the project's workspace directory.

**受入基準**:
- [ ] ファイル API が realpath でパスを正規化し、ワークスペース外を拒否する
- [ ] エージェントプロセスの cwd がプロジェクト専用ワークスペースに設定される
- [ ] 他プロジェクトのファイルが API 経由で取得できない

---

#### REQ-NFR-004
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL validate all API inputs and sanitize file paths to prevent path traversal attacks.

**受入基準**:
- [ ] API 入力値にバリデーションが適用される
- [ ] ファイルパスの `../` 等のトラバーサルが防止される
- [ ] SQL インジェクション対策が施される (プリペアドステートメント)

**トレーサビリティ**: DES-SEC-001

---

### 3.3 ユーザビリティ

#### REQ-NFR-005
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL provide a responsive UI that works on desktop browsers (Chrome, Firefox, Safari, Edge) with a minimum width of 1024px.

**受入基準**:
- [ ] 主要デスクトップブラウザで動作する (Chrome 120+, Firefox 120+, Safari 17+, Edge 120+)
- [ ] 1024px 以上の画面幅でレイアウトが崩れない

**トレーサビリティ**: DES-CHAT-001, DES-PROGRESS-001

---

#### REQ-NFR-006
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL support Japanese language display including proper rendering of CJK characters in generated files and chat messages.

**受入基準**:
- [ ] 日本語テキストが正しく表示される
- [ ] 生成ファイル内の日本語が文字化けしない
- [ ] ファイル名に日本語を含むファイルが正しく処理される (Windows/macOS 両方)

**トレーサビリティ**: DES-CHAT-001, DES-FILE-001

---

#### REQ-NFR-007
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL run on both Windows (native, not WSL) and macOS without platform-specific installation steps beyond the documented prerequisites.

**説明**: ユーザーは Windows または macOS のどちらでも同一の手順でインストール・起動できる。パス区切り文字、シェル差異、ファイルシステム差異を吸収する。

**受入基準**:
- [ ] Windows 10/11 (x64) でネイティブ動作する (WSL 不要)
- [ ] macOS 13+ (ARM/Intel) で動作する
- [ ] パス操作に `path.join()` / `path.resolve()` を使用し、ハードコードされた `/` や `\\` がない
- [ ] child_process.spawn で使用するコマンドが OS に応じて解決される (例: `npx` vs `npx.cmd`)
- [ ] ファイル監視 (chokidar) が両 OS で正常動作する
- [ ] npm scripts が両 OS で実行可能 (cross-env 等で環境変数を統一)
- [ ] CI で Windows + macOS の両方のテストが PASS する

**トレーサビリティ**: DES-SEC-001, DES-WORKSPACE-001, DES-FILE-001, DES-CHAT-001

---

#### REQ-NFR-008
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL perform a preflight health check on startup, verifying OS compatibility, Copilot CLI availability, and workspace directory writability, and display actionable error messages for any failures.

**プリフライトチェック項目**:
1. **OS 判定**: `process.platform` が `darwin` (macOS) または `win32` (Windows) であることを確認。それ以外 (Linux/WSL 含む) は警告表示
2. **CLI 検出**: ランタイム spawn パスと同じコマンドで `copilot --version` (または相当) を実行し、バージョン文字列を取得
3. **ランタイムデータディレクトリ**: `data/` および `projects/` ディレクトリが書き込み可能か `fs.access(W_OK)` で確認。存在しない場合は自動作成を試行
4. **Token**: 環境変数または settings.json の存在確認 (未設定は警告のみ)

**受入基準**:
- [ ] 起動時に `copilot --version` (または同等コマンド) を実行して CLI の存在と応答を確認する
- [ ] `process.platform` が `darwin` / `win32` 以外の場合、警告ログが出力される
- [ ] ワークスペースのベースディレクトリ (`data/` および `projects/`) が書き込み可能か確認する
- [ ] 確認失敗時に具体的なエラーメッセージと解決手順を表示する
- [ ] プリフライト結果が API (`GET /api/health`) で JSON として取得可能 (`{ cli: bool, workspace: bool, os: string, token: bool }`)
- [ ] Token 未設定は警告のみ (エージェント実行時にエラー)

**トレーサビリティ**: DES-SEC-001, DES-CHAT-001

---

#### REQ-NFR-009
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL handle cross-platform path edge cases: case-insensitive path comparison on Windows, rejection of Windows reserved filenames (CON, PRN, NUL, etc.), and proper handling of Unicode/spaces in file paths.

**説明**: Windows と macOS のファイルシステム差異を吸収するためのパス正規化ルール。

**受入基準**:
- [ ] Windows で大文字小文字の異なるパスが同一ファイルとして扱われる
- [ ] Windows 予約ファイル名 (CON, PRN, AUX, NUL, COM1-9, LPT1-9) およびその拡張子付き形式 (例: `CON.txt`) がファイル作成時に拒否される
- [ ] 末尾にドット (`.`) やスペースを含むファイル名が拒否される (Windows で自動削除されるため)
- [ ] パスにスペース・日本語を含むファイルが正常に操作できる
- [ ] ファイル名にシェルメタ文字 (`&`, `%`, `^`, `(`, `)`) を含むファイルが正常に操作できる
- [ ] シンボリックリンク/ジャンクションは追跡しない (ワークスペース内の実ファイルのみ対象)

**トレーサビリティ**: DES-WORKSPACE-001, DES-FILE-001, DES-SEC-001

---

## 4. 制約事項

| 制約 | 内容 |
|---|---|
| ランタイム | Node.js 22+ が必要 |
| GitHub Copilot | 有効な GitHub Copilot ライセンスおよび Copilot CLI が必要 |
| ブラウザ | WASM をサポートするモダンブラウザが必要 |
| OS | Windows 10/11 (ネイティブ) / macOS 13+ |
| デプロイ | v1.0 は localhost シングルユーザーのみ |

---

## 5. 用語定義

| 用語 | 定義 |
|---|---|
| プロジェクト | AIRA における作業単位。独自の Skills・MCP・会話履歴・ファイルを持つ |
| Agent Skills | GitHub Copilot CLI エージェントの動作を定義する SKILL.md ファイルの集合 |
| MCP | Model Context Protocol。エージェントが使用する外部ツールの接続設定 |
| WASM | WebAssembly。ブラウザ上でネイティブに近い速度で動作するバイナリ形式 |
| ストリーミング | WebSocket を使用したリアルタイム応答表示 |

---

## 6. 要件トレーサビリティマトリクス

| 要件 ID | 優先度 | カテゴリ | 設計 ID |
|---|---|---|---|
| REQ-CHAT-001 | P0 | チャット | DES-CHAT-001 |
| REQ-CHAT-002 | P0 | チャット | DES-CHAT-001, DES-PROJECT-001 |
| REQ-CHAT-003 | P1 | チャット | DES-CHAT-001 |
| REQ-CHAT-004 | P0 | チャット | DES-CHAT-001 |
| REQ-CHAT-005 | P1 | チャット | DES-CHAT-001 |
| REQ-PROJECT-001 | P0 | プロジェクト | DES-PROJECT-001 |
| REQ-PROJECT-002 | P0 | プロジェクト | DES-PROJECT-001 |
| REQ-PROJECT-003 | P0 | プロジェクト | DES-PROJECT-001 |
| REQ-PROJECT-004 | P1 | プロジェクト | DES-PROJECT-001 |
| REQ-SKILLS-001 | P0 | Skills | DES-SKILLS-001 |
| REQ-SKILLS-002 | P1 | Skills | DES-SKILLS-001 |
| REQ-SKILLS-003 | P1 | Skills | DES-SKILLS-001, DES-CHAT-001 |
| REQ-SKILLS-004 | P2 | Skills | DES-SKILLS-001 |
| REQ-MCP-001 | P0 | MCP | DES-MCP-001 |
| REQ-MCP-002 | P1 | MCP | DES-MCP-001 |
| REQ-MCP-003 | P1 | MCP | DES-MCP-001 |
| REQ-FILE-001 | P0 | ファイル | DES-FILE-001 |
| REQ-FILE-002 | P0 | ファイル | DES-FILE-001 |
| REQ-FILE-003 | P0 | ファイル | DES-FILE-001 |
| REQ-FILE-004 | P1 | ファイル | DES-FILE-001 |
| REQ-FILE-005 | P1 | ファイル | DES-FILE-001 |
| REQ-FILE-006 | P0 | ファイル | DES-FILE-001 |
| REQ-PROGRESS-001 | P0 | 進行状況 | DES-PROGRESS-001 |
| REQ-PROGRESS-002 | P0 | 進行状況 | DES-PROGRESS-001 |
| REQ-PROGRESS-003 | P0 | 進行状況 | DES-PROGRESS-001 |
| REQ-UI-001 | P0 | レイアウト | DES-PROGRESS-001, DES-FILE-001 |
| REQ-AUTH-001 | P0 | 認証 | DES-AUTH-001 |
| REQ-AUTH-002 | P0 | 認証 | DES-AUTH-001 |
| REQ-AUTH-003 | P0 | 認証 | DES-AUTH-001 |
| REQ-AUTH-004 | P0 | 認証 | DES-AUTH-001 |
| REQ-AUTH-005 | P0 | 認証 | DES-AUTH-001 |
| REQ-WORKSPACE-001 | P0 | ワークスペース | DES-WORKSPACE-001 |
| REQ-WORKSPACE-002 | P0 | ワークスペース | DES-WORKSPACE-001 |
| REQ-WORKSPACE-003 | P0 | ワークスペース | DES-WORKSPACE-001 |
| REQ-SEC-001 | P0 | セキュリティ | DES-SEC-001 |
| REQ-SEC-002 | P0 | セキュリティ | DES-SEC-001 |
| REQ-SEC-003 | P0 | セキュリティ | DES-SEC-001, DES-CHAT-001, DES-FILE-001 |
| REQ-ERR-001 | P0 | エラー処理 | DES-CHAT-001, DES-SEC-001 |
| REQ-ERR-002 | P0 | エラー処理 | DES-AUTH-001 |
| REQ-ERR-003 | P0 | エラー処理 | DES-PROGRESS-001 |
| REQ-ERR-004 | P1 | エラー処理 | DES-MCP-001 |
| REQ-ERR-005 | P1 | エラー処理 | DES-PROJECT-001 |
| REQ-ERR-006 | P1 | エラー処理 | DES-SKILLS-001 |
| REQ-ERR-007 | P0 | エラー処理 | DES-FILE-001 |
| REQ-ERR-008 | P0 | エラー処理 | DES-CHAT-001, DES-SEC-001 |
| REQ-ERR-009 | P1 | エラー処理 | DES-WORKSPACE-001, DES-PROGRESS-001 |
| REQ-NFR-001 | P1 | 性能 | DES-CHAT-001, DES-PROJECT-001 |
| REQ-NFR-002 | P1 | 性能 | DES-SEC-001, DES-CHAT-001 |
| REQ-NFR-003 | P0 | セキュリティ | DES-SEC-001 |
| REQ-NFR-004 | P0 | セキュリティ | DES-SEC-001 |
| REQ-NFR-005 | P1 | ユーザビリティ | DES-CHAT-001, DES-PROGRESS-001 |
| REQ-NFR-006 | P1 | ユーザビリティ | DES-CHAT-001, DES-FILE-001 |
| REQ-NFR-007 | P0 | 互換性 | DES-SEC-001, DES-WORKSPACE-001, DES-FILE-001, DES-CHAT-001 |
| REQ-NFR-008 | P0 | 互換性 | DES-SEC-001, DES-CHAT-001 |
| REQ-NFR-009 | P0 | 互換性 | DES-WORKSPACE-001, DES-FILE-001, DES-SEC-001 |
