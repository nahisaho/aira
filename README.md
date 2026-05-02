# AIRA — AI Runway Application

> CoreClaw ライクな WASM ベースのチャットボットシステム  
> GitHub Copilot CLI をエージェントエンジンとして使用  
> **v1.0: シングルユーザー・localhost 専用**

## 概要

AIRA は、[CoreClaw](https://github.com/nahisaho/coreclaw) に着想を得た  
WASM ベースのチャットボットアプリケーションです。  
**プロジェクト単位**で Agent Skills と MCP サーバーを管理し、  
生成ファイルの閲覧・ダウンロードが可能です。

## 主な機能

- **チャット UI**: WebSocket ストリーミングによるリアルタイム応答
- **プロジェクト管理**: 作成・削除・名前変更
- **Agent Skills**: プロジェクトごとに Skills を割り当て
- **MCP 設定**: プロジェクトごとに MCP サーバーを設定
- **ファイル管理**: 生成ファイルの表示・ダウンロード (ZIP 一括含む)
- **WASM フロントエンド**: React + TypeScript + WASM コンポーネント

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 19 + TypeScript + Vite + Tailwind CSS |
| WASM | Rust + wasm-pack (Markdown/Mermaid レンダリング) |
| バックエンド | Node.js 22+ + TypeScript + Hono |
| DB | SQLite (better-sqlite3) |
| エージェント | GitHub Copilot CLI (@github/copilot) |

## 前提条件

- **OS**: Windows 10/11 または macOS 13+ (ネイティブ動作、WSL 不要)
- Node.js 22+
- GitHub Copilot ライセンス
- GitHub Token

## ドキュメント

- [要件定義書](docs/requirements/REQ-001-system-requirements.md)
- [システムアーキテクチャ設計](docs/design/DES-001-system-architecture.md)
- [ADR-001: フロントエンドフレームワーク選定](docs/adr/ADR-001-frontend-framework.md)
- [ADR-002: バックエンドランタイム選定](docs/adr/ADR-002-backend-runtime.md)
- [プロジェクト概要](steering/project.md)

## ライセンス

MIT
