# ADR-002: バックエンドランタイム選定

**日付**: 2026-05-02  
**ステータス**: Proposed  
**決定者**: プロジェクトチーム

---

## コンテキスト

GitHub Copilot CLI (`@github/copilot`) は Node.js 環境で動作する。  
バックエンドのランタイムを決定する必要がある。

## 検討した選択肢

### 選択肢 1: Node.js 22+ (TypeScript + tsx)
- **メリット**: CoreClaw と同じスタック、安定性、Copilot CLI との互換性保証
- **デメリット**: 相対的に遅い起動時間

### 選択肢 2: Bun 1.x
- **メリット**: 高速起動、TypeScript ネイティブサポート、Node.js 互換 API
- **デメリット**: 一部 Node.js API の互換性問題の可能性

### 選択肢 3: Deno 2.x
- **メリット**: セキュリティモデル、TypeScript ネイティブ
- **デメリット**: npm エコシステムとの完全互換ではない場合がある

## 決定

**選択肢 1 を採用**: Node.js 22+ + TypeScript (tsx/esbuild ビルド)

### 理由
1. GitHub Copilot CLI が Node.js 環境を前提とする
2. CoreClaw との互換性が最大
3. 本番実績が豊富

## 影響

- ランタイム: Node.js 22+
- TypeScript コンパイル: esbuild (tsx)
- パッケージ管理: npm
- HTTP フレームワーク: Hono
