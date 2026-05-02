/**
 * WASM Markdown/Mermaid renderer loader.
 * Phase 14: WASM is the v1 main path.
 * Falls back to TS renderer on init failure (security parity required).
 */

export interface RenderResult {
  html: string;
  source: 'wasm' | 'ts-fallback';
}

let activeRenderer: { renderMarkdown: (s: string) => string } | null = null;
let activeSource: 'wasm' | 'ts-fallback' = 'ts-fallback';

/**
 * Initialize WASM module. Falls back to TS on failure.
 */
export async function initRenderer(): Promise<'wasm' | 'ts-fallback'> {
  try {
    const wasm = await import('./pkg/aira_wasm.js');
    await wasm.default();
    activeRenderer = { renderMarkdown: wasm.render_markdown };
    activeSource = 'wasm';
    return 'wasm';
  } catch (err) {
    console.warn('[aira] WASM init failed, using TS fallback:', (err as Error).message);
    const fallback = await import('./fallback');
    activeRenderer = fallback;
    activeSource = 'ts-fallback';
    return 'ts-fallback';
  }
}

/**
 * Render markdown to sanitized HTML.
 */
export function render(markdown: string): RenderResult {
  if (!activeRenderer) {
    // Synchronous fallback if init not called yet
    const { renderMarkdown } = require('./fallback') as typeof import('./fallback');
    return { html: renderMarkdown(markdown), source: 'ts-fallback' };
  }

  return {
    html: activeRenderer.renderMarkdown(markdown),
    source: activeSource,
  };
}

/**
 * Check if WASM is the active renderer.
 */
export function isWasmActive(): boolean {
  return activeSource === 'wasm';
}
