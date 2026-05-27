# Changelog

All notable changes to AIRA are documented in this file.

## [v2.4.1] — 2026-05-28

### Fixed
- **Co-Scientist paper.md 生成強制化**: paper.md が約35%の実験で未生成だった構造的問題を修正
  - Time Budget: 15分→20分、Paper writing 配分を2分→5分に増加
  - Quality Gates: paper.md の存在チェック、語数チェック（≥1,500語）、IMRaD構造チェックを追加
  - Research Lifecycle Phase 4: paper.md 生成を必須と明記（Single-Turn Mode 含む）
  - Required Output Layout: paper.md をレイアウトに追加
  - Co-Scientist バージョン: v4.4.0 → v4.5.0

## [v2.4.0] — 2026-05-27

### Added
- **マルチアーキテクチャ Docker イメージ**: linux/amd64 + linux/arm64 の両アーキテクチャに対応
  - GitHub Actions で QEMU + Buildx によるマルチプラットフォームビルド
  - `docker pull` 時にホストのアーキテクチャに合ったイメージが自動選択

### Fixed
- **設定画面のトークン管理**: 環境変数管理時のエラーハンドリング改善
  - トークンソースの表示（「環境変数で管理」バッジ）
  - 環境変数設定時は削除ボタン非表示
  - 設定/削除失敗時のエラーメッセージ表示
- **Docker ボリュームマウントパス修正**: `/app/backend/data` → `/app/data`、`/app/backend/projects` → `/app/projects`
- **Copilot CLI 永続化**: npm グローバルプレフィックスを `/app/.npm-global` に変更し、ボリュームマウントで更新を永続化可能に

## [v2.3.0] — 2026-05-24

### Changed
- **Co-Scientist スキル v5.0「引き算の改善」（v3.0.0）**: v4.0 の過剰設計を是正し v3.0 品質水準への回復を目指す
  - **スキル総行数 60%削減**: ~2,250行 → ~900行（コンテキストウィンドウ圧迫の解消）
  - **カスタムエージェント全削除**: research-lead, methods-auditor, statistician, data-steward, writing-coach の5体を削除
  - **Review 5段階→1回**: Deep Review（Phase 4 後）のみ残し、問題があれば1回修正
  - **Mandatory Skill Chain 削除**: 4スキル順次呼び出しを自然なフローに変更
  - **テンプレート大幅削減**: Reproducibility Table, Seed Propagation, Validation Plan, Ablation Variants, Report 5セクション強制を削除
  - **Claim Calibration 簡素化**: 8行テーブル → 1行の置換ルール
  - **Paper Quality Lint 簡素化**: 8チェック → 3チェック（Limitations, 語数, バルク引用）
  - **Repair Prompt 簡素化**: 6テンプレート → 1テンプレート（Limitations 補完のみ）
  - **Quality Gates 厳選**: 各スキル3項目のみ（Limitations 200語以上, report.md 1,000語以上, 不確実性指標）
  - **効果実証済み機能は維持**: Limitations リテラルスケルトン（100%維持）, バルク引用 Lint（2%達成）, 深さ優先原則

## [v2.2.0] — 2026-05-24

### Changed
- **Co-Scientist スキル v4.0 品質改善（v2.0.0）**: 3 層アプローチによる論文品質の抜本的改善
  - **Layer 1 — プロンプト直接注入**:
    - CI/± 必須フォーマット + few-shot 例（statistical-testing, academic-writing）
    - Phrase blacklist を HARD CONSTRAINT に強化（advisory → 強制）
    - Limitations リテラルスケルトン（自由記述 → 穴埋め方式）
    - report.md 最低 1,000 語、External Validation Statement 必須化
  - **Layer 2 — Post-processing Lint + Repair**:
    - Paper Quality Lint（Mode 3）: 8 項目の regex ベース形式チェック（L1–L8）
    - Repair Prompt Templates（RP-1〜RP-6）: Limitations / CI / 過大主張 / report 拡張 / 外部検証 / バルク引用分解
    - Severity 分類: Critical（進行禁止）/ Major（修正試行）/ Minor（記録のみ）
    - バルク引用 `[N-M]` 分解 linter + DOI-conditional metadata 戦略
  - **Layer 3 — ワークフロー再設計**:
    - Closed-loop review: PASS/FAIL/RETRY state machine（最大 2 回リトライ）
    - Reproducibility artifact propagation（seed-config.md → analysis → writing）
    - Ablation variant 自動生成 + Sensitivity analysis 必須化
    - Multi-seed execution protocol（5+ シード + Bootstrap CI）

### Added
- **フロントエンド自動リロード**: タブ復帰時のデータ自動更新、実行完了後のメッセージ再取得、WS file_modified イベントによるファイルビューア自動更新

## [v2.1.2] — 2026-05-24

### Changed
- **Co-Scientist スキル v3.0 品質改善**: v2.0 の 100 本実験分析に基づく 9 問題の系統的修正
  - Limitations and Future Work セクションの必須化（問題 1）
  - Hard Quality Gates による統計的不確実性の強制チェック（問題 2）
  - Claim Calibration の Automated Filter 化 — 禁止語スキャン + 主張-証拠整合性チェック（問題 3）
  - Validation Strategy Template（Tier 1-3）の追加（問題 4）
  - DOI ベース書誌情報検証 + メタデータ正規化ワークフロー（問題 5）
  - Ablation Study Design テンプレートの追加（問題 6）
  - Reproducibility Checklist の追加（問題 7）
  - report.md 構造化テンプレート（最低 1,200 語）の追加（問題 8）
  - 🦆 Phase Gate Reviews（5 段階）+ Deep Review ワークフローの組み込み（問題 9）
  - Mandatory Skill Chain による統計検定・不確実性定量化のスキップ防止
  - IMRaD テンプレートの更新（Limitations セクション、再現性情報、Ablation study）

## [v2.1.1] — 2026-05-22

### Fixed
- **SVG ファイル表示**: ファイルビューアで SVG ファイルをインライン表示可能に（CSP ヘッダーによる XSS 防止付き）

## [v2.1.0] — 2026-05-21

### Added
- **Structured RAG**: プロジェクト単位の知識抽出・検索機能（[TypeAgent](https://github.com/microsoft/typeagent) 参考）
  - LLM による会話・ファイルからのエンティティ・アクション・トピック抽出
  - トークンベース転置インデックスによる高速検索（SQLite 内蔵）
  - `rag-context.md` による検索結果の自動コンテキスト注入
  - プロジェクトごとの RAG 有効/無効設定、最大コンテキスト文字数設定
  - 手動再インデックス API
- **品質評価フレームワーク**: 400 の評価シナリオによる網羅的品質検証（20 ラウンド × 20 プロンプト）

### Fixed
- **セキュリティ修正**（14 件 HIGH）:
  - 静的ファイル配信のパス走査攻撃防止
  - MCP 設定のプロトタイプ汚染防止（トップレベル + ネスト）
  - JSON.parse の安全なエラーハンドリング（4 箇所）
  - Content-Disposition ヘッダーインジェクション防止
  - CLI ストリームの parseLine クラッシュ防止
  - hashFile の大容量ファイルメモリスパイク防止
  - startRun のレース条件修正（プレースホルダー予約方式）
  - プロジェクト ID の UUID バリデーションミドルウェア追加
- **安定性修正**（28 件 MEDIUM）:
  - stderr / stdout バッファ上限設定（64KB / 1MB）
  - ストリームエラーハンドラー追加
  - extractTokens 入力サイズ上限（100KB）
  - credential proxy 30 秒タイムアウト
  - scanWorkspace 深度制限（50 階層）
  - ファイル表示 5MB サイズ制限
  - アップロードファイル名検証（パス走査拒否、200 バイト長制限）
  - reindexProject の clearIndex 原子性修正
  - DB 破損時のグレースフルリカバリ（バックアップ + 再作成）
  - その他バッファ・バリデーション・エラーハンドリング改善
- **軽微な修正**（8 件 LOW）:
  - JSON パースログのレート制限
  - アップロードファイル名エッジケース対応

### Changed
- DB エンジンを better-sqlite3 から sql.js（WASM）に変更
- テストフレームワークの依存を sql.js ベースに統一

## [v2.0.4] — 2026-05-08

### Fixed
- ファイル検出パイプラインの 3 つのバグを修正（サブディレクトリファイルの表示、AI 応答テキストの重複防止）

## [v2.0.3] — 2026-05-08

### Fixed
- reconcile files on list to show all subdirectory files
- prevent AI response text duplication by separating resume/cold-start prompts

## [v2.0.2] — 2026-05-07

### Added
- **メッセージ送信オプション**: 設定画面から送信キーを選択可能
  - Enter キー（デフォルト）: Enter で送信、Shift+Enter で改行
  - Ctrl+Enter キー: Ctrl+Enter で送信、Enter で改行

## [v2.0.0] — 2026-05-07

### Added
- **外部 Agents リポジトリ連携**: Settings から複数の GitHub リポジトリを登録し、`agents/` ディレクトリ内のエージェントを Agent Skills として自動取得
  - 複数リポジトリのサポート
  - 同期ボタンによる手動更新
  - サーバー起動時の自動同期
  - Private リポジトリ対応（GitHub Token 認証）
- 日本語エラーメッセージ（リポジトリ不在、認証エラー時）

### Changed
- タイトルを AIRA-α → AIRA-β に変更
- skills テーブルに `github-agents` source_type を追加（DB 自動マイグレーション対応）

## [v1.0.0] — 2026-05-06

### Added
- **チャット UI**: WebSocket ストリーミング、Markdown レンダリング、ファイル添付
- **プロジェクト管理**: 作成・削除・名前変更、プロジェクト単位の設定管理
- **Agent Skills**: プロジェクトごとにスキルを割り当て・切替
  - Co-Scientist（189 サブスキル）: 文献調査、実験設計、データ分析、論文作成
  - SPReAD-1000 Assistant（12 サブスキル）: SPReAD 公募申請支援
- **MCP サーバー連携**: プロジェクトごとに MCP サーバーを設定
  - ToolUniverse（89 科学 DB）、Azure MCP、Microsoft Learn MCP
- **ファイル管理**: 生成ファイルの表示・ダウンロード（ZIP 一括）、PDF / Excel / 画像ビューア
- **ファイルアップロード**: 入力データのアップロード
- **実行履歴**: パイプライン進捗の可視化、プロンプト保存
- **PDF ビューア**: 出力ファイルの PDF インラインプレビュー
- **サイドバー**: プロジェクト名の下に割り当て済みスキル名を表示
- **3 層メタプロンプト**: 事実/推定/制約による高品質 LLM 出力
- **Settings**: GitHub Token 管理、Copilot CLI アップデート、言語切替（日/英）、テーマ切替
- **Docker**: マルチステージビルド、GHCR 公開

### Technical
- React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Zustand 5
- Node.js 22 + Hono + SQLite (better-sqlite3, WAL)
- GitHub Copilot CLI エージェントエンジン
