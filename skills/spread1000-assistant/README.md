# SPReAD Builder

文部科学省「AI for Science 萌芽的挑戦研究創出事業（SPReAD）」公募支援 GitHub Copilot / Claude Code スキルスイート。

## インストール

```bash
npm install @nahisaho/spread1000-builder
```

インストール時に以下のファイルがプロジェクトへ自動配置されます。

| 配置先 | 内容 |
|--------|------|
| `.github/skills/spread1000-*/` | GitHub Copilot 用の 12 サブスキル |
| `.github/agents/*.agent.md` | GitHub Copilot 用カスタムエージェント定義 |
| `.github/AGENTS.md` | 共有オーケストレーター（WHEN/DO ルーティング） |
| `.github/copilot-instructions.md` | GitHub Copilot 用の追加規約 |
| `.claude/skills/spread1000-*/` | Claude Code 用の 12 サブスキル |
| `.claude/agents/*.md` | Claude Code 用 subagent 定義 |
| `CLAUDE.md` | Claude Code のプロジェクト指示。共有ルールを import する |

> `.github/AGENTS.md`、`.github/copilot-instructions.md`、`CLAUDE.md` は既存ファイルがある場合スキップされます。

### アンインストール

```bash
npm uninstall @nahisaho/spread1000-builder
```

スキルとエージェント定義が `.github/` と `.claude/` から削除されます（`.github/AGENTS.md`、`.github/copilot-instructions.md`、`CLAUDE.md` は保持）。

## 概要

AI を自身の研究に組み込みたいがアプローチがわからない研究者を対象に、以下のワークフローを一貫して支援します。

0. **コンテキスト収集** — 1問1答で不足情報を収集しメタプロンプトを生成（shikigami パターン）
1. **研究プラン策定** — Web リサーチを通じた AI 活用研究計画の作成
2. **Azure 構成設計** — 研究プランに最適な Microsoft Azure アーキテクチャの設計
3. **システム構成図** — draw.io MCP による Azure 構成図生成（Azure 設計直後に実行）
4. **コスト算出** — Azure 構成に基づく費用の見積もり
5. **申請書作成** — SPReAD 公募申請書の作成支援
6. **最終レビュー** — 全フェーズ横断検証・6審査観点スコアリング・提出可否判定
7. **応募手続き** — AIインタビュー・e-Rad提出・応募資格確認
8. **IaC / CI/CD** — Bicep テンプレート生成とデプロイパイプライン構築
9. **Azure デプロイ** — Bicep デプロイ実行・OIDC設定・デプロイ後検証
10. **実験手順書** — デプロイ済み基盤での実験実施手順（環境構築・学習・推論・再現性管理）
11. **採択後管理** — 交付申請・中間報告・最終報告・予算変更

## サブスキル一覧

| スキル | 概要 |
|--------|------|
| `spread1000-context-collector` | 1問1答コンテキスト収集・メタプロンプト生成 |
| `spread1000-research-planner` | AI 活用研究プランの策定支援 |
| `spread1000-azure-architect` | Azure アーキテクチャ設計 |
| `spread1000-cost-estimator` | Azure コスト算出 |
| `spread1000-proposal-writer` | SPReAD 申請書作成支援 |
| `spread1000-final-reviewer` | 提出前最終レビュー・6審査観点スコアリング・提出可否判定 |
| `spread1000-submission-guide` | 応募手続き・ AIインタビュー・e-Rad・資格確認 |
| `spread1000-diagram-generator` | draw.io MCP によるシステム構成図生成 |
| `spread1000-post-award` | 採択後管理・中間報告・最終報告・予算変更 |
| `spread1000-iac-deployer` | Bicep / CI/CD パイプライン生成 |
| `spread1000-azure-deployer` | Azure デプロイ実行・OIDC設定・デプロイ後検証 |
| `spread1000-experiment-guide` | 実験手順書生成（環境構築・学習・推論・再現性管理） |

## デプロイ後のディレクトリ構成

```
.github/
├── AGENTS.md                          # オーケストレーター
├── copilot-instructions.md            # スイート規約
├── agents/
│   ├── research-advisor.agent.md      # フルツールエージェント
│   └── proposal-reviewer.agent.md     # 読み取り専用レビューア
└── skills/
    ├── spread1000-context-collector/
    ├── spread1000-research-planner/
    ├── spread1000-azure-architect/
    ├── spread1000-cost-estimator/
    ├── spread1000-proposal-writer/
    ├── spread1000-submission-guide/
    ├── spread1000-diagram-generator/
    ├── spread1000-final-reviewer/
    ├── spread1000-post-award/
    ├── spread1000-iac-deployer/
    ├── spread1000-azure-deployer/
    └── spread1000-experiment-guide/

  .claude/
  ├── agents/
  │   ├── research-advisor.md            # Claude Code 用 subagent
  │   └── proposal-reviewer.md           # Claude Code 用 subagent
  └── skills/
    ├── spread1000-context-collector/
    ├── spread1000-research-planner/
    ├── spread1000-azure-architect/
    ├── spread1000-cost-estimator/
    ├── spread1000-proposal-writer/
    ├── spread1000-submission-guide/
    ├── spread1000-diagram-generator/
    ├── spread1000-final-reviewer/
    ├── spread1000-post-award/
    ├── spread1000-iac-deployer/
    ├── spread1000-azure-deployer/
    └── spread1000-experiment-guide/

  CLAUDE.md                              # .github/AGENTS.md を import する Claude Code 指示
```

## draw.io MCP Server のセットアップ

`spread1000-diagram-generator` スキルで Azure システム構成図を生成するには、[draw.io MCP Server（simonkurtz-MSFT）](https://github.com/simonkurtz-MSFT/drawio-mcp-server) のセットアップが必要です。700+ の Azure 公式アイコンが内蔵されており、ブラウザや draw.io インスタンスは不要です。

### ワンコマンドセットアップ（推奨）

```bash
# Docker 方式（推奨）— スイート配備 + イメージ取得 + コンテナ起動 + VS Code MCP 設定を一括実行
npx @nahisaho/spread1000-builder init

# Deno 方式 — スイート配備 + リポジトリクローン → VS Code MCP 設定
npx @nahisaho/spread1000-builder init deno
```

`init` コマンドは以下を自動実行します:

| ステップ | Docker | Deno |
|---------|--------|------|
| 1. スイート配備 | `.github/`、`.claude/`、`CLAUDE.md` を配置 | `.github/`、`.claude/`、`CLAUDE.md` を配置 |
| 2. 前提チェック | `docker` コマンド確認 | `deno` コマンド確認 |
| 3. インストール | `docker pull` + コンテナ起動 | `git clone` → `.drawio-mcp-server/` |
| 4. ヘルスチェック | `curl http://localhost:8080/health` | — |
| 5. VS Code 設定 | `.vscode/mcp.json` に HTTP 設定追加 | `.vscode/mcp.json` に stdio 設定追加 |
| 6. .gitignore | — | `.drawio-mcp-server/` を追加 |

### 手動セットアップ

以下は `init` コマンドを使わず手動でセットアップする場合の手順です。

### 方法比較

| | Docker（推奨） | ソースから実行 |
|---|---|---|
| **セットアップ** | `docker pull` のみ | Deno v2.3+ をインストール |
| **Azure アイコン** | 700+ 内蔵 | 700+ 内蔵 |
| **オフライン対応** | ✅ | ✅ |
| **トランスポート** | HTTP (port 8080) | stdio / HTTP / 両方 |

### 方法 1: Docker（推奨）

```bash
# Docker Hub からプル
docker pull simonkurtzmsft/drawio-mcp-server:latest

# 起動（HTTP トランスポート、ポート 8080）
docker run -d --name drawio-mcp-server -p 8080:8080 simonkurtzmsft/drawio-mcp-server:latest

# ヘルスチェック
curl http://localhost:8080/health
```

`.vscode/mcp.json`:

```json
{
  "servers": {
    "drawio": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

### 方法 2: ソースから実行

[Deno](https://deno.com/) v2.3 以上が必要です。

```bash
git clone https://github.com/simonkurtz-MSFT/drawio-mcp-server.git
cd drawio-mcp-server
deno run --allow-net --allow-read --allow-env src/index.ts
```

`.vscode/mcp.json`（stdio トランスポート）:

```json
{
  "servers": {
    "drawio": {
      "command": "deno",
      "args": [
        "run", "--allow-net", "--allow-read", "--allow-env",
        "/path/to/drawio-mcp-server/src/index.ts"
      ]
    }
  }
}
```

### 利用可能な MCP ツール

| カテゴリ | ツール | 説明 |
|---------|--------|------|
| シェイプ検索 | `search-shapes` | 700+ Azure アイコンをファジー検索。正確な style 文字列を返す |
| | `get-shape-categories` | シェイプカテゴリ一覧を取得 |
| | `get-shapes-in-category` | カテゴリ内の全シェイプを取得 |
| | `get-style-presets` | Azure/フローチャート等のスタイルプリセットを取得 |
| 図の操作 | `add-cells` | 頂点・エッジを一括追加（バッチ対応） |
| | `edit-cells` | セルのプロパティ（位置・サイズ・テキスト・スタイル）を更新 |
| | `create-groups` | グループ/コンテナ（VNet、Subnet、RG 等）を作成 |
| | `add-cells-to-group` | セルをグループに追加 |
| 図の出力 | `export-diagram` | draw.io XML としてエクスポート |
| | `import-diagram` | draw.io XML をインポート |
| レイヤー | `create-layer` / `list-layers` | レイヤー管理 |
| ページ | `create-page` / `list-pages` | マルチページ管理 |

> **パフォーマンス Tips**: `add-cells` は配列を受け付けるため、全セルを1回の呼び出しで追加できます。ツールを繰り返し呼ぶのではなく、バッチで渡してください。

### 使用例

```
@research-advisor Phase 1 の Azure 構成設計書からシステム構成図を
draw.io 形式で生成してください。Azure 公式アイコンを使用してください。
```

エージェントが `search-shapes` で Azure 公式アイコンの style を取得し、`create-groups` でネットワーク構造を作成、`add-cells` でリソースを配置してプロフェッショナルな構成図を生成します。出力先は `output/{project-name}/diagrams/` です。

## バージョン

v0.7.0
