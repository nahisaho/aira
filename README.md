# AIRA-β — AI Research Administrator

> Web ベースの AI Research Administrator  
> GitHub Copilot CLI をエージェントエンジンとして使用  
> **v2.0.0**

## 概要

AIRA-β は、GitHub Copilot CLI を推論エンジンとして活用する Web ベースの AI Research Administrator です。**プロジェクト単位**で Agent Skills と MCP サーバーを管理し、研究の全ライフサイクルを支援します。Docker イメージとして提供され、すぐに利用を開始できます。

## クイックスタート

```bash
# Docker イメージの取得
docker pull ghcr.io/nahisaho/aira:2.0.1

docker pull ghcr.io/nahisaho/aira:latest (最新版)

# コンテナの起動
docker run -d -p 3001:3000 \
  -e GITHUB_TOKEN="<your-github-token>" \
  -v aira-data:/app/backend/data \
  -v aira-projects:/app/backend/projects \
  ghcr.io/nahisaho/aira:v2.0.0
```

ブラウザで `http://localhost:3001` にアクセスしてください。

### 前提条件

- Docker
- GitHub Copilot ライセンス
- GitHub Token（`GITHUB_TOKEN` 環境変数または Settings 画面で設定）

## 主な機能

### プラットフォーム機能

| 機能 | 説明 |
|------|------|
| **チャット UI** | WebSocket ストリーミングによるリアルタイム応答、Markdown レンダリング対応 |
| **プロジェクト管理** | プロジェクトの作成・削除・名前変更、プロジェクト単位での設定管理 |
| **Agent Skills** | プロジェクトごとに研究支援スキルを割り当て・切替 |
| **MCP 設定** | プロジェクトごとに MCP サーバーを設定（有効/無効切替） |
| **ファイル管理** | 生成ファイルの表示・ダウンロード（ZIP 一括含む）、PDF / Excel / 画像ビューア内蔵 |
| **ファイルアップロード** | 入力データのアップロード |
| **実行履歴** | パイプライン進捗の可視化、プロンプト保存・ダウンロード |
| **外部 Agents リポジトリ** | GitHub リポジトリから Agent Skills を取得・同期（複数リポジトリ対応） |

### MCP サーバー連携

プロジェクトごとに MCP（Model Context Protocol）サーバーを有効化し、外部ツール・データソースにアクセスできます。

| MCP サーバー | 提供機能 |
|-------------|---------|
| **ToolUniverse** | 89 の科学データベース（PubMed、ChEMBL、UniProt、Ensembl、GWAS Catalog、ClinVar、Reactome 等）へのアクセス。化合物検索、遺伝子・タンパク質情報取得、パスウェイ解析、文献検索など |
| **Azure MCP** | Azure リソースの管理・操作。VM / GPU クラスタの構成確認、ストレージ操作、コスト見積もり、リソースデプロイなど |
| **Microsoft Learn MCP** | Microsoft Learn ドキュメントの検索・参照。Azure サービスの仕様確認、ベストプラクティス取得、技術ドキュメントの即時参照 |

### ビルトイン Agent Skills

#### 🧬 Co-Scientist（汎用研究パートナー）

研究の全ライフサイクルを協働で支援する汎用エージェントスイートです。**189 の専門サブスキル**を備え、以下の領域をカバーします。

| カテゴリ | 主なサブスキル |
|----------|--------------|
| **文献調査・レビュー** | 文献検索、系統的レビュー、メタ分析、引用チェック |
| **研究計画・実験設計** | 研究プランニング、実験デザイン（DOE）、仮説パイプライン |
| **データ分析・統計** | EDA、統計検定、ベイズ統計、因果推論、欠損データ分析 |
| **機械学習・AI** | 分類・回帰、深層学習、AutoML、説明可能AI、強化学習、連合学習 |
| **バイオインフォマティクス** | ゲノム解析、トランスクリプトミクス、プロテオミクス、メタボロミクス、シングルセル解析 |
| **創薬・薬理学** | 分子ドッキング、ADMET、化合物スクリーニング、ドラッグリポジショニング |
| **医療・臨床** | 臨床試験分析、医療画像AI、精密医療、薬理ゲノミクス |
| **学術執筆・発表** | 論文作成、LaTeX エクスポート、査読対応、プレゼンテーション作成 |
| **データベース連携（MCP）** | PubMed、ChEMBL、UniProt、Ensembl、GWAS Catalog 等 89 の科学データベースに MCP 経由でアクセス |

**特徴**: ファイルファースト出力、検証ループ（PLAN → EXECUTE → VERIFY → REPORT → LOG）、再現性保証、カラーバリアフリー図表

#### 📋 SPReAD-1000 Assistant（SPReAD 公募支援）

文部科学省「AI for Science 萌芽的挑戦研究創出事業（SPReAD）」の公募申請を一貫して支援する専門エージェントスイートです。**12 の専門サブスキル**で申請プロセス全体をカバーします。

| サブスキル | 役割 |
|-----------|------|
| **context-collector** | 研究テーマのコンテキスト収集、3 層メタプロンプト生成（事実/仮説/制約） |
| **research-planner** | 文献調査に基づく 180 日間の研究計画策定 |
| **proposal-writer** | 審査 6 観点に最適化された申請書草稿の作成 |
| **azure-architect** | 研究計画に基づく Azure クラウド構成設計 |
| **cost-estimator** | Azure リソースの月額/年間コスト見積もり（500 万円直接経費内） |
| **azure-deployer** | Bicep/Terraform による Azure 環境のデプロイ |
| **iac-deployer** | IaC テンプレートの生成・検証・デプロイ |
| **diagram-generator** | アーキテクチャ図・研究フロー図の自動生成 |
| **experiment-guide** | 実験プロトコル設計・データ管理ガイダンス |
| **final-reviewer** | 申請書の最終品質レビュー・改善提案 |
| **submission-guide** | e-Rad 提出手続きのガイダンス |
| **post-award** | 採択後の報告書作成・進捗管理支援 |

**特徴**: 1 問 1 答のコンテキスト収集、3 層メタプロンプト（事実/推定/プログラム制約）、SPReAD 審査基準に最適化

### 🔗 外部 Agents リポジトリ（v2.0.1）

Settings から GitHub リポジトリを登録し、カスタム Agent Skills を追加できます。

```
リポジトリ構成例:
your-repo/
└── agents/
    ├── agent-a/
    │   ├── AGENTS.md
    │   ├── copilot-instructions.md
    │   └── skills/
    ├── agent-b/
    └── agent-c/
```

- **複数リポジトリ対応**: 複数の GitHub リポジトリを登録可能
- **Private リポジトリ対応**: 設定済み GitHub Token で認証
- **自動同期**: サーバー起動時に自動同期、手動同期ボタンあり

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Zustand 5 |
| バックエンド | Node.js 22 + TypeScript + Hono |
| DB | SQLite（better-sqlite3、WAL モード） |
| エージェント | GitHub Copilot CLI（@githubnext/copilot） |
| コンテナ | Docker（マルチステージビルド） |

## 開発

### ソースからビルド

```bash
git clone https://github.com/nahisaho/aira.git
cd aira
npm install
npm run build

# Docker イメージのビルド
docker build -t aira-app .
```

### テスト

```bash
npm test
npm run lint
```

### プロジェクト構成

```
aira/
├── frontend/          # React フロントエンド
├── backend/           # Hono バックエンド
├── skills/            # ビルトイン Agent Skills
│   ├── co-scientist/          # 汎用研究パートナー（189 サブスキル）
│   └── spread1000-assistant/  # SPReAD 公募支援（12 サブスキル）
├── docs/              # 設計ドキュメント
└── Dockerfile         # マルチステージ Docker ビルド
```

## 環境変数

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | — |
| `AIRA_PORT` | バックエンドポート | `3000` |

## ライセンス

MIT
