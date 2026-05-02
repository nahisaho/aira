/**
 * TypeScript fallback renderer (re-exports from markdown.ts).
 * Security parity with WASM per ADR-001.
 */
export { renderMarkdown, isBlockedUri } from '../components/chat/markdown';
