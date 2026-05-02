/**
 * WASM Markdown/Mermaid renderer loader.
 * Phase 14: WASM is the v1 main path.
 * Falls back to TS renderer on init failure (security parity required).
 */

let wasmReady = false;
let wasmModule: typeof import('./fallback') | null = null;

export interface RenderResult {
  html: string;
  source: 'wasm' | 'ts-fallback';
}

/**
 * Initialize WASM module. Falls back to TS on failure.
 */
export async function initRenderer(): Promise<'wasm' | 'ts-fallback'> {
  try {
    // Phase 14-2: Replace with actual wasm-pack module import
    // const wasm = await import('../../../wasm/pkg/aira_wasm');
    // await wasm.default();
    // wasmModule = wasm;
    // wasmReady = true;
    // return 'wasm';

    // Currently: WASM module not yet built, fall through to TS fallback
    throw new Error('WASM module not yet available');
  } catch {
    // Fallback to TypeScript renderer (security parity per ADR-001)
    const fallback = await import('./fallback');
    wasmModule = fallback;
    wasmReady = true;
    return 'ts-fallback';
  }
}

/**
 * Render markdown to sanitized HTML.
 */
export function render(markdown: string): RenderResult {
  if (!wasmReady || !wasmModule) {
    // Lazy init not called yet — use fallback synchronously
    const { renderMarkdown } = require('./fallback') as typeof import('./fallback');
    return { html: renderMarkdown(markdown), source: 'ts-fallback' };
  }

  return {
    html: wasmModule.renderMarkdown(markdown),
    source: wasmReady ? 'wasm' : 'ts-fallback',
  };
}

/**
 * Check if WASM is the active renderer.
 */
export function isWasmActive(): boolean {
  return wasmReady && wasmModule !== null;
}
