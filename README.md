# AIRA — AI Research Administrator

> CoreClaw ライクな WASM ベースのチャットボットシステム  
> GitHub Copilot CLI をエージェントエンジンとして使用  
> **v0.1.0: シングルユーザー・localhost 専用**

## 概要

AIRA は、[CoreClaw](https://github.com/nahisaho/coreclaw) に着想を得た  
WASM ベースのチャットボットアプリケーションです。  
**プロジェクト単位**で Agent Skills と MCP サーバーを管理し、  
生成ファイルの閲覧・ダウンロードが可能です。

## 主な機能

- **チャット UI**: WebSocket ストリーミングによるリアルタイム応答
- **プロジェクト管理**: 作成・削除・名前変更
- **Agent Skills**: プロジェクトごとに Skills を割り当て
- **MCP 設定**: プロジェクトごとに MCP サーバーを設定（有効/無効切替）
- **ファイル管理**: 生成ファイルの表示・ダウンロード (ZIP 一括含む)
- **ファイルアップロード**: 入力ファイルのアップロード
- **Excel ビューア**: xlsx/xls/csv ファイルのマルチシート表示
- **実行履歴**: プロンプト保存・ダウンロード付き
- **WASM フロントエンド**: React + TypeScript + WASM コンポーネント

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Zustand 5 |
| WASM | Rust + wasm-pack (Markdown/Mermaid レンダリング) |
| バックエンド | Node.js 22+ + TypeScript + Hono |
| DB | SQLite (better-sqlite3, WAL モード) |
| エージェント | GitHub Copilot CLI (@github/copilot) |
| デスクトップ | Electron (オプション) |
| コンテナ | Docker (マルチステージビルド) |

## 前提条件

- **OS**: Linux, macOS 13+, Windows 10/11
- Node.js 22+
- GitHub Copilot ライセンス
- GitHub Token (`GITHUB_TOKEN` 環境変数 または Settings 画面で設定)

## クイックスタート (Web 版)

```bash
# リポジトリクローン
git clone https://github.com/nahisaho/aira.git
cd aira

# 依存関係インストール
npm install

# ビルド (フロントエンド + バックエンド)
npm run build

# バックエンド起動
cd backend && node dist/server.js

# フロントエンド開発サーバー起動 (別ターミナル)
cd frontend && npm run dev
```

ブラウザで `http://localhost:5173` にアクセス。

## ビルド方法

### Web 版 (開発)

```bash
# 全ワークスペースをビルド
npm run build

# バックエンドのみ
npm run build --workspace=backend

# フロントエンドのみ
npm run build --workspace=frontend

# 開発モード (ホットリロード)
npm run dev
```

### Docker

```bash
# イメージビルド
npm run docker:build
# または
docker build -t aira:latest .

# コンテナ実行
npm run docker:run
# または
docker run -p 3000:3000 \
  -e GITHUB_TOKEN=your_token \
  -v aira-data:/app/data \
  -v aira-projects:/app/projects \
  aira:latest
```

Docker イメージには Copilot CLI が内包されています。  
`http://localhost:3000` でフロントエンドとAPIの両方にアクセスできます。

### Electron (デスクトップアプリ)

```bash
# 開発モード
npm run electron:dev

# パッケージング
npm run electron:build:linux   # Linux AppImage
npm run electron:build:win     # Windows NSIS installer
npm run electron:build:mac     # macOS DMG
```

出力は `dist-electron/` に生成されます。

### テスト

```bash
# ユニットテスト
npm test

# E2E テスト (Playwright)
npm run test:e2e

# リント
npm run lint
```

## プロジェクト構成

```
aira/
├── frontend/          # React フロントエンド
├── backend/           # Hono バックエンド
│   └── src/
│       ├── config/    # パス設定 (Electron/Docker 対応)
│       ├── routes/    # API ルート
│       ├── services/  # ビジネスロジック
│       ├── middleware/ # セキュリティミドルウェア
│       ├── lifecycle.ts  # 組み込み可能なサーバーAPI
│       └── server.ts     # CLI エントリポイント
├── electron/          # Electron メインプロセス
├── skills/            # ビルトイン Agent Skills
├── wasm/              # Rust WASM モジュール
├── docs/              # 設計ドキュメント
├── Dockerfile         # マルチステージ Docker ビルド
└── electron-builder.yml
```

## 環境変数

| 変数 | 説明 | デフォルト |
|---|---|---|
| `GITHUB_TOKEN` | GitHub Personal Access Token | — |
| `AIRA_PORT` | バックエンドポート | `3000` |
| `AIRA_SERVE_FRONTEND` | フロントエンドを同一ポートで配信 | `false` |
| `VITE_DEV_PORT` | Vite 開発サーバーポート | `5173` |

## ドキュメント

- [要件定義書](docs/requirements/REQ-001-system-requirements.md)
- [システムアーキテクチャ設計](docs/design/DES-001-system-architecture.md)
- [ADR-001: フロントエンドフレームワーク選定](docs/adr/ADR-001-frontend-framework.md)
- [ADR-002: バックエンドランタイム選定](docs/adr/ADR-002-backend-runtime.md)
- [プロジェクト概要](steering/project.md)

## ライセンス

MIT
