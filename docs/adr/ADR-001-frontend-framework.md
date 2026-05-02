# ADR-001: フロントエンドフレームワーク選定 (WASM ベース)

**日付**: 2026-05-02  
**ステータス**: Proposed  
**決定者**: プロジェクトチーム

---

## コンテキスト

AIRA は「WASM ベースのアプリケーション」として開発する。フロントエンドに  
どの技術を採用するかを決定する必要がある。

## 検討した選択肢

### 選択肢 1: Blazor WebAssembly (.NET 9 / C#)
- **メリット**: .NET エコシステム、型安全、豊富な UI コンポーネント、真の WASM
- **デメリット**: .NET ランタイムの初回ダウンロードが大きい (~10MB)、TypeScript との親和性が低い

### 選択肢 2: React + TypeScript (+ WASM コンポーネント)
- **メリット**: CoreClaw と同じ TypeScript スタック、巨大なエコシステム
- **デメリット**: 純粋な WASM ではない

### 選択肢 3: Leptos / Yew (Rust + WASM)
- **メリット**: 真の WASM、高パフォーマンス
- **デメリット**: Rust の学習コスト、エコシステムが小さい

### 選択肢 4: React + TypeScript (Vite ビルド) + wasm-pack 統合
- **メリット**: CoreClaw との技術的一貫性、開発効率、段階的 WASM 統合
- **デメリット**: 初期段階では WASM 部分が限定的

## 決定

**選択肢 4 を採用**: React + TypeScript (Vite) をベースとし、  
パフォーマンスクリティカルな処理 (Markdown レンダリング、ファイル処理) に  
wasm-pack 経由の Rust WASM コンポーネントを段階的に統合する。

### 理由
1. CoreClaw の TypeScript 資産の再利用が容易
2. 段階的な WASM 統合が可能
3. バックエンド (Node.js) との技術スタック統一
4. 開発・デプロイのシンプルさ

## WASM 境界定義

v1.0 における WASM (Rust/wasm-pack) と TypeScript の責務境界を以下に定める。

| 処理 | 実装先 | 理由 |
|---|---|---|
| Markdown → HTML レンダリング | Rust/WASM (pulldown-cmark) | パフォーマンス、サニタイズ一体化 |
| Mermaid 図レンダリング | Rust/WASM | SVG 生成を WASM 内で完結 |
| シンタックスハイライト | Rust/WASM (syntect) | 大量コードブロックの高速処理 |
| UI コンポーネント・状態管理 | TypeScript (React + Zustand) | エコシステム活用、開発効率 |
| API 通信・WebSocket | TypeScript | React ライフサイクルとの統合 |
| ファイルビューア (PDF/画像) | TypeScript (ブラウザネイティブ) | WASM 不要 |

**フォールバック**: WASM ロード失敗時は、TypeScript 実装 (react-markdown + remark) にフォールバックする。フォールバックパスは WASM パスと同一のセキュリティポリシーを必須とする: DOMPurify サニタイズ、`javascript:`/`vbscript:`/`data:text/html` URI ブロック、Mermaid `securityLevel: 'strict'`、外部画像のインライン拒否 (REQ-SEC-003 準拠)。レンダリング等価性テスト (visual + security) により両パスの一貫性を保証する。

## 影響

- フロントエンド: React + TypeScript + Vite
- ビルドツール: Vite + vite-plugin-wasm
- スタイリング: Tailwind CSS
- 状態管理: Zustand
