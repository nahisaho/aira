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
- Run の状態遷移: `queued → running → completed | failed | cancelled | timeout`
- 右パネルは**現在選択中のプロジェクト**の最新 Run を表示する
- プロジェクト切り替え時、右パネルの表示も切り替わる

**受入基準**:
- [ ] プロジェクト選択中のチャットでは、そのプロジェクトの Skills が使用される
- [ ] プロジェクト選択中のチャットでは、そのプロジェクトの MCP 設定が適用される
- [ ] 異なるプロジェクト間での並行実行が可能 (最大 5 プロセス)
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
- [ ] 画像リンクがインライン表示される
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
- [ ] アクティブ/アイドル/実行中のステータスが視覚的に表示される
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
THE SYSTEM SHALL display a list of all files generated within a project, showing filename, file type, size, and creation timestamp.

**説明**: プロジェクト内で生成されたファイルの一覧を表示する。

**受入基準**:
- [ ] ファイル一覧パネルがある
- [ ] ファイル名・種別・サイズ・作成日時が表示される
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
WHEN a user clicks "Open" on a file, THE SYSTEM SHALL open the file using the OS default application associated with the file type.

**説明**: ファイルをOSのデフォルトアプリケーション (VS Code, テキストエディタ等) で開く。

**受入基準**:
- [ ] ファイル行に「開く」ボタンがある
- [ ] クリックで OS のデフォルトアプリケーションが起動する
- [ ] バックエンド API (`/api/projects/:id/files/:fileId/open`) でファイルを開く
- [ ] サポート対象 OS: Linux (xdg-open), macOS (open), Windows (start)

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
THE SYSTEM SHALL display agent execution progress in a dedicated right panel, showing current run status (idle/running/completed/error), elapsed time, and a real-time activity log.

**説明**: 画面右側の専用パネルにエージェント実行の進行状況を表示する。

**受入基準**:
- [ ] 右パネルに進行状況セクションが表示される
- [ ] ステータスバッジ (idle/running/completed/error) が表示される
- [ ] 実行中は経過時間がリアルタイムで表示される
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
**優先度**: P1

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
2. **保存場所**: サーバーサイドの `data/settings.json` に暗号化保存 (環境変数が優先)
3. **永続性**: サーバー再起動後も保持される (永続保存)
4. **クライアント通知**: Token の設定有無 (boolean) のみ API レスポンスに含む
5. **子プロセス注入**: `child_process.spawn()` の `env` オプションで渡す
6. **失効時**: エージェント実行エラーとしてユーザーに通知し、再設定を促す

**受入基準**:
- [ ] 環境変数 `GITHUB_TOKEN` が設定されていればそちらを使用する
- [ ] 環境変数未設定時は、設定 API で Token を登録できる
- [ ] Token が未設定の場合、チャット送信時に「Token 未設定」エラーが表示される
- [ ] GET /api/settings は Token の設定有無 (boolean) のみ返す (Token 値は返さない)
- [ ] Token の有効性を検証するエンドポイント (POST /api/settings/validate-token) がある

**トレーサビリティ**: DES-AUTH-001

---

#### REQ-AUTH-002
**種別**: UNWANTED  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL NOT expose the GitHub Token in any client-side code, API responses, or browser storage.

**説明**: セキュリティ要件: GitHub Token はクライアントサイドに渡さない。

**受入基準**:
- [ ] Token が API レスポンスに含まれない
- [ ] Token が localStorage / sessionStorage に保存されない
- [ ] Token がブラウザの開発者ツールで確認できない

**トレーサビリティ**: DES-AUTH-001

---

#### REQ-AUTH-003
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL operate as a single-user localhost application in v1.0, requiring no application-level authentication or authorization.

**説明**: v1.0 はローカルマシン上で単一ユーザーが使用する前提とする。アプリケーションレベルの認証・認可は不要。すべての API エンドポイントは localhost からのみアクセス可能とする。

**受入基準**:
- [ ] API サーバーが localhost (127.0.0.1) のみバインドされる
- [ ] 外部ネットワークからのアクセスが拒否される
- [ ] アプリケーションレベルのログイン画面が不要

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
- [ ] 最大同時実行数が 5 プロセスに制限される
- [ ] パストラバーサル攻撃 (`../`) が API レベルで防止される

**トレーサビリティ**: DES-SEC-001

---

#### REQ-SEC-002
**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:  
THE SYSTEM SHALL enforce a maximum execution time of 10 minutes per agent invocation and terminate the process if exceeded.

**説明**: エージェント実行にタイムアウトを設定し、無限ループや過度なリソース消費を防止する。

**受入基準**:
- [ ] プロセスに 10 分のタイムアウトが設定される
- [ ] タイムアウト超過でプロセスが SIGTERM → SIGKILL で停止される
- [ ] タイムアウト発生がユーザーに通知される

**トレーサビリティ**: DES-SEC-001

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

**受入基準**:
- [ ] 切断検知後 3 秒以内にリコネクト試行が開始される
- [ ] リコネクト中は UI にインジケーターが表示される
- [ ] 再接続後、未受信イベントが再配信される (サーバー側バッファ 60 秒)
- [ ] 5 回連続失敗後は手動リロードを促す

**トレーサビリティ**: DES-PROGRESS-001

---

#### REQ-ERR-004
**種別**: UNWANTED  
**優先度**: P1

**要件**:  
IF an MCP configuration is invalid (unreachable server, malformed JSON, timeout), THE SYSTEM SHALL report the specific configuration error and allow the Run to proceed without the failed MCP provider.

**受入基準**:
- [ ] 無効な MCP 設定がバリデーション時にエラー表示される
- [ ] 実行時に MCP サーバー接続失敗した場合、該当 MCP なしで続行される
- [ ] MCP エラーがログパネルに記録される

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
IF a Skill URL is unreachable or returns an invalid manifest, THE SYSTEM SHALL mark the Skill as unavailable, display the error reason, and allow the Run to proceed without the failed Skill.

**受入基準**:
- [ ] 無効な Skill URL 登録時にバリデーションエラーが表示される
- [ ] 実行時に Skill 取得失敗した場合、該当 Skill なしで続行される
- [ ] 失敗した Skill がスキルリストで「エラー」状態表示される

**トレーサビリティ**: DES-SKILLS-001

---

## 3. 非機能要件

### 3.1 パフォーマンス

#### REQ-NFR-001
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL respond to user interactions (button clicks, page transitions) within 200ms under normal load.

**受入基準**:
- [ ] UI 操作のレスポンスが 200ms 以内
- [ ] プロジェクト一覧の読み込みが 500ms 以内

---

#### REQ-NFR-002
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL support at least 5 concurrent agent process executions.

**受入基準**:
- [ ] 5 プロジェクトの同時チャットが可能
- [ ] 最大並行数超過時にキューイングされる

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

---

### 3.3 ユーザビリティ

#### REQ-NFR-005
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL provide a responsive UI that works on desktop browsers (Chrome, Firefox, Safari, Edge) with a minimum width of 1024px.

**受入基準**:
- [ ] 主要デスクトップブラウザで動作する
- [ ] 1024px 以上の画面幅でレイアウトが崩れない

---

#### REQ-NFR-006
**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:  
THE SYSTEM SHALL support Japanese language display including proper rendering of CJK characters in generated files and chat messages.

**受入基準**:
- [ ] 日本語テキストが正しく表示される
- [ ] 生成ファイル内の日本語が文字化けしない

---

## 4. 制約事項

| 制約 | 内容 |
|---|---|
| ランタイム | Node.js 22+ が必要 |
| GitHub Copilot | 有効な GitHub Copilot ライセンスおよび Copilot CLI が必要 |
| ブラウザ | WASM をサポートするモダンブラウザが必要 |
| OS | Linux / macOS / Windows (WSL2) |
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
| REQ-PROGRESS-003 | P1 | 進行状況 | DES-PROGRESS-001 |
| REQ-UI-001 | P0 | レイアウト | DES-PROGRESS-001, DES-FILE-001 |
| REQ-AUTH-001 | P0 | 認証 | DES-AUTH-001 |
| REQ-AUTH-002 | P0 | 認証 | DES-AUTH-001 |
| REQ-AUTH-003 | P0 | 認証 | DES-AUTH-001 |
| REQ-AUTH-004 | P0 | 認証 | DES-AUTH-001 |
| REQ-WORKSPACE-001 | P0 | ワークスペース | DES-WORKSPACE-001 |
| REQ-WORKSPACE-002 | P0 | ワークスペース | DES-WORKSPACE-001 |
| REQ-WORKSPACE-003 | P0 | ワークスペース | DES-WORKSPACE-001 |
| REQ-SEC-001 | P0 | セキュリティ | DES-SEC-001 |
| REQ-SEC-002 | P0 | セキュリティ | DES-SEC-001 |
| REQ-ERR-001 | P0 | エラー処理 | DES-CHAT-001, DES-SEC-001 |
| REQ-ERR-002 | P0 | エラー処理 | DES-AUTH-001 |
| REQ-ERR-003 | P0 | エラー処理 | DES-PROGRESS-001 |
| REQ-ERR-004 | P1 | エラー処理 | DES-MCP-001 |
| REQ-ERR-005 | P1 | エラー処理 | DES-PROJECT-001 |
| REQ-ERR-006 | P1 | エラー処理 | DES-SKILLS-001 |
| REQ-NFR-001 | P1 | 性能 | — |
| REQ-NFR-002 | P1 | 性能 | — |
| REQ-NFR-003 | P0 | セキュリティ | DES-SEC-001 |
| REQ-NFR-004 | P0 | セキュリティ | — |
| REQ-NFR-005 | P1 | ユーザビリティ | — |
| REQ-NFR-006 | P1 | ユーザビリティ | — |
