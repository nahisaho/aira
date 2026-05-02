# AIRA プロジェクト概要

## プロジェクト名
**AIRA** — AI Runway Application (WASM-based)

## ビジョン
CoreClaw ライクな WASM ベースのチャットボットアプリケーション。  
GitHub Copilot CLI をエージェントエンジンとして使用し、プロジェクト単位で  
Agent Skills と MCP を管理できる AI アシスタント基盤。

## 背景
CoreClaw は Node.js + Docker ベースのサーバーサイドアプリケーションである。  
AIRA は以下の差別化を図る:
- フロントエンドを WASM ベースの SPA として実装
- プロジェクト単位での Skills / MCP 管理
- 生成ファイルの表示・ダウンロード機能

## 技術方針
- **フロントエンド**: React 19 + TypeScript + Vite + Tailwind CSS + WASM コンポーネント (Rust/wasm-pack)
- **バックエンド**: Node.js 22+ + TypeScript + Hono
- **エージェントエンジン**: GitHub Copilot CLI (`@github/copilot`)
- **データ永続化**: SQLite (better-sqlite3)
- **状態管理**: Zustand

## デプロイモデル (v1.0)
**シングルユーザー・localhost 専用**。  
v1.0 はローカルマシン上で単一ユーザーが使用する前提で設計する。  
マルチユーザー・リモートデプロイは v2.0 以降のスコープとする。

## スコープ (v1.0)
- チャット UI (リアルタイムストリーミング)
- プロジェクト管理 (CRUD + 名前変更)
- プロジェクト別 Agent Skills 設定
- プロジェクト別 MCP サーバー設定
- 生成ファイル管理 (一覧・表示・ダウンロード)

## スコープ外 (v1.0)
- マルチユーザー認証・認可
- Skills マーケットプレイス
- リモートデプロイ・HTTPS

## 参照
- CoreClaw: https://github.com/nahisaho/coreclaw
- 作成日: 2026-05-02
