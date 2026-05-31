# AIRA-γ — AI Research Administrator

> Web ベースの AI Research Assistant
> GitHub Copilot CLI をエージェントエンジンとして使用
> Jupyter カーネルでステートフルな Python 実行 + 計算的プロベナンス検証
> **v3.2.1**

## 概要

AIRA-β は、GitHub Copilot CLI を推論エンジンとして活用する Web ベースの AI Research Administrator です。**プロジェクト単位**で Agent Skills、MCP サーバー、および **Structured RAG**（知識抽出・検索）を管理し、研究の全ライフサイクルを支援します。Docker イメージとして提供され、すぐに利用を開始できます。

## クイックスタート

```bash
# Docker イメージの取得
docker pull ghcr.io/nahisaho/aira:latest
```

### A. ローカル PC 単独で使う(最小構成)

```bash
docker run -d \
  --name aira \
  -p 3001:3000 \
  -e GITHUB_TOKEN="<your-github-token>" \
  -v aira-data:/app/data \
  -v aira-projects:/app/projects \
  -v aira-npm-global:/app/.npm-global \
  ghcr.io/nahisaho/aira:latest
```

ブラウザで `http://localhost:3001` にアクセス。

- エージェント経由の Jupyter MCP は内部で動作するので、AIRA チャットからは Python の stateful 実行ができる
- ただし **AIRA UI 内の「ノートブック」タブで JupyterLab GUI を見たい場合は B または C を使う**

### B. ローカル PC + JupyterLab GUI(同一マシン、ブラウザもローカル)

`-p 8888:8888` と `-e AIRA_JUPYTER_BIND=0.0.0.0` を追加(v3.0.0+):

```bash
docker run -d \
  --name aira \
  -p 3001:3000 \
  -p 8888:8888 \
  -e AIRA_JUPYTER_BIND=0.0.0.0 \
  -e AIRA_JUPYTER_TOKEN=my-stable-jupyter-token \
  -e GITHUB_TOKEN="<your-github-token>" \
  -v aira-data:/app/data \
  -v aira-projects:/app/projects \
  -v aira-npm-global:/app/.npm-global \
  ghcr.io/nahisaho/aira:latest
```

ブラウザで `http://localhost:3001` → プロジェクト → 右ペインの「ノートブック」タブ → JupyterLab が iframe で表示。`AIRA_JUPYTER_TOKEN` は任意(指定すると Jupyter URL がブックマーク可で再起動後も同一)。

### C. リモート/LAN(AIRA は別マシン、ブラウザは手元)

例: AIRA は `192.168.1.15` で稼働、ブラウザは別 PC。AIRA がブラウザに見える URL を 2 つ env で教える(v3.1.3+):

```bash
docker run -d \
  --name aira \
  -p 3000:3000 \
  -p 8888:8888 \
  -e AIRA_JUPYTER_BIND=0.0.0.0 \
  -e AIRA_JUPYTER_PUBLIC_URL=http://192.168.1.15:8888 \   # iframe 用 (ブラウザから見える Jupyter URL)
  -e AIRA_PUBLIC_URL=http://192.168.1.15:3000 \           # AIRA UI 自身の URL (CORS/CSRF/frame-ancestors)
  -e AIRA_JUPYTER_TOKEN=my-stable-jupyter-token \
  -e GITHUB_TOKEN="<your-github-token>" \
  -v aira-data:/app/data \
  -v aira-projects:/app/projects \
  -v aira-npm-global:/app/.npm-global \
  ghcr.io/nahisaho/aira:latest
```

ブラウザで `http://192.168.1.15:3000` → 「ノートブック」タブで iframe 表示。

**なぜ env が 2 つ必要か**: AIRA backend は「ブラウザがどの URL でアクセスしてくるか」予測できない(`localhost` か `192.168.x.x` かホスト名か reverse proxy 越しか)。`AIRA_PUBLIC_URL` で AIRA 自身の Origin、`AIRA_JUPYTER_PUBLIC_URL` で iframe の `src` を明示する。

### 前提条件

- Docker
- GitHub Copilot ライセンス
- GitHub Token(`GITHUB_TOKEN` 環境変数または Settings 画面で設定)

### 起動オプション 早見表

| env / flag | A 最小 | B ローカル GUI | C LAN GUI | 説明 |
|---|:---:|:---:|:---:|---|
| `-p 3001:3000` (任意のホストポート) | ✅ | ✅ | ✅ | AIRA UI |
| `-p 8888:8888` | — | ✅ | ✅ | JupyterLab UI(GUI 利用時のみ) |
| `-e GITHUB_TOKEN` | ✅ | ✅ | ✅ | Copilot CLI 認証 |
| `-e AIRA_JUPYTER_BIND=0.0.0.0` | — | ✅ | ✅ | コンテナ外から Jupyter 到達可に(default は 127.0.0.1 で内部のみ) |
| `-e AIRA_JUPYTER_TOKEN=<secret>` | — | 推奨 | 推奨 | 固定 token(default はランダム、再起動毎に変化) |
| `-e AIRA_PUBLIC_URL=<URL>` | — | — | ✅ | LAN/リモート時の AIRA UI URL |
| `-e AIRA_JUPYTER_PUBLIC_URL=<URL>` | — | — | ✅ | LAN/リモート時の iframe 用 Jupyter URL |
| `-v aira-data:/app/data` | 推奨 | 推奨 | 推奨 | DB / 設定の永続化 |
| `-v aira-projects:/app/projects` | 推奨 | 推奨 | 推奨 | プロジェクト workspace / notebook の永続化 |
| `-v aira-npm-global:/app/.npm-global` | 推奨 | 推奨 | 推奨 | Copilot CLI アップデートの永続化 |

## 主な機能

### プラットフォーム機能

| 機能 | 説明 |
|------|------|
| **チャット UI** | WebSocket ストリーミングによるリアルタイム応答、Markdown レンダリング対応 |
| **プロジェクト管理** | プロジェクトの作成・削除・名前変更、プロジェクト単位での設定管理 |
| **Agent Skills** | プロジェクトごとに研究支援スキルを割り当て・切替 |
| **MCP 設定** | プロジェクトごとに MCP サーバーを設定(有効/無効切替、編集・追加) |
| **ファイル管理** | 生成ファイルの表示・ダウンロード(ZIP 一括含む)、PDF / Excel / 画像 / SVG ビューア内蔵 |
| **ファイルアップロード** | 入力データのアップロード(`data/raw/` への直接配置に対応 v3.2+) |
| **実行履歴** | パイプライン進捗の可視化、プロンプト保存・ダウンロード |
| **外部 Agents リポジトリ** | GitHub リポジトリから Agent Skills を取得・同期(複数リポジトリ対応) |
| **🐍 Stateful Python (Jupyter MCP)** | プロジェクトごとに JupyterLab カーネルを保持、エージェントの解析が state を跨いで継続(v3.0+) |
| **📓 JupyterLab GUI 統合** | AIRA UI 内のノートブックタブで iframe 表示、エージェントが書いた cell を人間が直接編集・実行可(v3.1+) |
| **🔬 Computational Provenance** | 数値→`[cell:<id>]` 引用 linter、再現性ゲート 4 種(seed/env/no-error/coverage)、`notebook.ipynb` の自動 trace、`data/raw/` 規約による出自管理(v3.2+) |

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

### 🧠 Structured RAG（v2.1.0）

プロジェクト単位の知識抽出・検索機能です。会話履歴とワークスペースファイルから構造化された知識を自動抽出し、後続の対話に活用します。[TypeAgent](https://github.com/microsoft/typeagent) を参考に実装しています。

| 機能 | 説明 |
|------|------|
| **知識抽出** | LLM を使用して会話・ファイルからエンティティ・アクション・トピックを抽出 |
| **転置インデックス** | トークンベースの高速検索（SQLite 内蔵） |
| **コンテキスト注入** | 検索結果を `rag-context.md` として自動注入 |
| **プロジェクト設定** | RAG の有効/無効、最大コンテキスト文字数をプロジェクトごとに設定 |
| **手動再インデックス** | 全メッセージ・ファイルの再抽出 |

### 🐍 Stateful Python via Jupyter MCP(v3.0.0)

プロジェクトごとに JupyterLab カーネルを Docker に同梱し、`jupyter-mcp-server` (Datalayer) 経由でエージェントが cell 単位で操作します。`df = pd.read_csv(...)` の後の `df.describe()` が**同一プロセス**で実行されるため、ターンを跨いで state が保持されます。`notebook.ipynb` は `workspace/` 直下に 1 プロジェクト 1 ファイル。

| 機能 | 説明 |
|------|------|
| **stateful カーネル** | 変数 / DataFrame / 学習済みモデルがターンを跨いで保持 |
| **JupyterLab GUI iframe 統合** | 「ノートブック」タブで AIRA UI 内に埋め込み表示、人間が直接編集・実行可(v3.1+) |
| **NumPy / pandas / scipy / scikit-learn / matplotlib / seaborn / sympy** 同梱 | 一般的な解析ワークフローが追加 pip なしで動く |

### 🔬 Computational Provenance(v3.2.0)

「Jupyter で書けるようになった」次に「**数値が本当に計算結果に由来するか**」を機械検証する仕組み。Qiita 記事 [AIRA-γ: フィクションからノンフィクションへ](https://qiita.com/hisaho/items/cb2debe43e85d65a6095) の論点に基づく v3 系列の柱機能。

| 機能 | 説明 |
|------|------|
| **Notebook 実行トレース** | agent run ごとに `notebook.ipynb` を snapshot して `workspace/.trace/execution-trace.jsonl` に append。env_hash (pip freeze sha256) 付き |
| **`[cell:<id>]` 引用 linter** | `report.md` / `paper.md` の数値クレーム (AUROC=0.83, p<0.001, n=1024 等) を抽出し、近傍の cell 引用と cross-check。`uncited` / `unknown_citations` を別レポート |
| **再現性ゲート 4 種** | `seed_presence` (RNG cell に seed)、`env_capture` (requirements.txt or pip freeze)、`no_error_in_cited` (引用 cell の stderr 空)、`citation_coverage` (≥80%) |
| **`data/raw/` 規約** | 入力データの配置先を workspace 内に固定。`data/SOURCES.md` skeleton (URL/DOI/sha256/size/license のテーブル) を自動生成 |
| **🔬 Validate ボタン** | AIRA UI 右ペインのファイルタブから検証実行、4 gate の pass/fail + 違反 cell を一覧表示 |
| **Co-Scientist v4.7.0** | スキル文書に引用規律 + gate 説明を組み込み、エージェントが自発的に provenance 規律を守る |

> **AIRA-α / β / γ の進化**: α = LLM 単体推論、β = 科学基盤モデル (NatureLM/GALACTICA) 参照、γ = Jupyter MCP で実コード実行 + provenance 検証。

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Zustand 5 |
| バックエンド | Node.js 22 + TypeScript + Hono |
| DB | SQLite（sql.js / WASM） |
| RAG | Structured RAG（LLM 知識抽出 + 転置インデックス） |
| エージェント | GitHub Copilot CLI（@githubnext/copilot） |
| コンテナ | Docker（マルチステージビルド、linux/amd64 + linux/arm64） |

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

### 基本

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token (Settings 画面でも設定可) | — |
| `AIRA_PORT` | バックエンドポート | `3000` |
| `AIRA_PUBLIC_URL` | LAN/リモート時にブラウザから見える AIRA UI の URL (CORS / CSRF / iframe parent 用) | — |
| `AIRA_ALLOWED_ORIGINS` | 追加 Origin の CSV(`AIRA_PUBLIC_URL` の複数版) | — |

### Jupyter 関連(v3.0+)

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `AIRA_JUPYTER_BIND` | JupyterLab の bind アドレス。iframe 利用には `0.0.0.0` 必須 | `127.0.0.1` |
| `AIRA_JUPYTER_PORT` | JupyterLab ポート | `8888` |
| `AIRA_JUPYTER_TOKEN` | 固定 token(default はランダム、再起動毎に変化) | random |
| `AIRA_JUPYTER_PUBLIC_URL` | LAN/リモート時にブラウザが見える Jupyter URL(v3.1.3+) | `http://localhost:<port>` |

### セキュリティ(v2.5+)

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `AIRA_CSRF_TTL_MS` | CSRF token TTL | `86400000` (24h) |
| `AIRA_CSRF_MAX_TOKENS` | CSRF token store の最大件数 | `10000` |
| `AIRA_MAX_UPLOAD_FILE_BYTES` | ファイルアップロード 1 ファイル上限 | `104857600` (100 MB) |
| `AIRA_MAX_UPLOAD_TOTAL_BYTES` | 同 1 リクエスト合計上限 | `524288000` (500 MB) |
| `AIRA_GITHUB_HOSTS` | 外部 Agents repo で token 埋め込み可能ホストの追加(CSV、`github.com` は default) | — |
| `AIRA_SERVE_FRONTEND` | Docker モードで backend が frontend dist を serve | `false` |

## ライセンス

MIT
