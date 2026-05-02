/**
 * Markdown renderer with security sanitization.
 * WASM main path with TS fallback (Phase 14).
 * For now, uses basic text rendering with code block detection.
 */

const URI_BLOCKLIST = /^(javascript|vbscript|data:text\/html)/i;

/**
 * Simple markdown-to-HTML renderer (TS fallback path).
 * Full implementation in Phase 14 with WASM + DOMPurify.
 */
export function renderMarkdown(content: string): string {
  // Basic escaping
  let html = escapeHtml(content);

  // Code blocks
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, lang, code) =>
      `<pre class="bg-gray-900 rounded p-3 my-2 overflow-x-auto"><code class="language-${lang}">${code}</code></pre>`,
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded text-sm">$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links (block dangerous URIs)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, href) => {
    if (URI_BLOCKLIST.test(href)) {
      return text;
    }
    return `<a href="${escapeHtml(href)}" class="text-blue-400 underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if URI scheme is blocked.
 */
export function isBlockedUri(uri: string): boolean {
  return URI_BLOCKLIST.test(uri.trim());
}
