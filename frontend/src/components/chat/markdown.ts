/**
 * Markdown renderer with DOMPurify sanitization.
 * TS fallback path with security parity to WASM (per ADR-001).
 * Security: DOMPurify, URI scheme blocking, Mermaid strict mode.
 */

import DOMPurify from 'dompurify';
import { marked } from 'marked';

const URI_BLOCKLIST = /^(javascript|vbscript|data:text\/html)/i;

// Configure DOMPurify
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'strong', 'em', 'del', 's',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
];
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'];
const FORBID_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'svg'];

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Custom link renderer to block dangerous URIs
const renderer = new marked.Renderer();
renderer.link = ({ href, title, text }) => {
  if (!href || URI_BLOCKLIST.test(href.trim())) {
    return String(text);
  }
  const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
  return `<a href="${escapeAttr(href)}"${titleAttr} class="text-blue-400 underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

renderer.image = ({ href, title, text }) => {
  if (!href || URI_BLOCKLIST.test(href.trim())) {
    return text || '';
  }
  // Only allow self/data-image URIs inline
  const isSafe = href.startsWith('/') || href.startsWith('data:image/');
  if (!isSafe) {
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
    return `<a href="${escapeAttr(href)}"${titleAttr} class="text-blue-400 underline" target="_blank" rel="noopener noreferrer">${text || href}</a>`;
  }
  const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
  return `<img src="${escapeAttr(href)}" alt="${escapeAttr(text || '')}"${titleAttr} class="max-w-full rounded" />`;
};

renderer.code = ({ text, lang }) => {
  if (lang === 'mermaid') {
    return `<pre class="mermaid-source not-prose rounded p-3 my-2 overflow-x-auto">${escapeHtml(text)}</pre>`;
  }
  return `<pre class="not-prose rounded p-3 my-2 overflow-x-auto"><code class="language-${escapeAttr(lang || '')}">${escapeHtml(text)}</code></pre>`;
};

marked.use({ renderer });

/**
 * Render markdown to sanitized HTML.
 * DOMPurify + URI blocking + SVG exclusion.
 */
export function renderMarkdown(content: string): string {
  const rawHtml = marked.parse(content, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS,
  });
}

/**
 * Check if URI scheme is blocked.
 */
export function isBlockedUri(uri: string): boolean {
  return URI_BLOCKLIST.test(uri.trim());
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
