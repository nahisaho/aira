/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderMarkdown, isBlockedUri } from './markdown';

describe('renderMarkdown', () => {
  it('renders bold text', () => {
    const html = renderMarkdown('**hello**');
    expect(html).toContain('<strong>hello</strong>');
  });

  it('renders italic text', () => {
    const html = renderMarkdown('*world*');
    expect(html).toContain('<em>world</em>');
  });

  it('renders code blocks with language', () => {
    const html = renderMarkdown('```js\nconsole.log("hi")\n```');
    expect(html).toContain('<pre');
    expect(html).toContain('language-js');
    expect(html).toContain('console.log');
  });

  it('renders inline code', () => {
    const html = renderMarkdown('use `npm install`');
    expect(html).toContain('<code>npm install</code>');
  });

  it('renders links with target=_blank', () => {
    const html = renderMarkdown('[GitHub](https://github.com)');
    expect(html).toContain('href="https://github.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('blocks javascript: URI in links', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<a');
  });

  it('blocks vbscript: URI in links', () => {
    const html = renderMarkdown('[click](vbscript:msgbox)');
    expect(html).not.toContain('vbscript:');
  });

  it('blocks data:text/html URI in links', () => {
    const html = renderMarkdown('[click](data:text/html,<script>alert(1)</script>)');
    expect(html).not.toContain('data:text/html');
  });

  it('strips script tags via DOMPurify', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert');
  });

  it('strips iframe tags', () => {
    const html = renderMarkdown('<iframe src="https://evil.com"></iframe>');
    expect(html).not.toContain('<iframe');
  });

  it('strips svg tags', () => {
    const html = renderMarkdown('<svg onload="alert(1)"><circle/></svg>');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('onload');
  });

  it('renders tables', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const html = renderMarkdown(md);
    expect(html).toContain('<table');
    expect(html).toContain('<td>');
  });

  it('renders mermaid code blocks with class', () => {
    const md = '```mermaid\ngraph TD\nA-->B\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('class="mermaid');
  });

  it('escapes HTML in code blocks', () => {
    const md = '```\n<div>test</div>\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('&lt;div&gt;');
  });

  it('strips event handlers from allowed tags', () => {
    const html = renderMarkdown('<a href="#" onclick="alert(1)">test</a>');
    expect(html).not.toContain('onclick');
  });
});

describe('isBlockedUri', () => {
  it('blocks javascript:', () => {
    expect(isBlockedUri('javascript:alert(1)')).toBe(true);
  });

  it('blocks vbscript:', () => {
    expect(isBlockedUri('vbscript:exec')).toBe(true);
  });

  it('blocks data:text/html', () => {
    expect(isBlockedUri('data:text/html,<h1>hi</h1>')).toBe(true);
  });

  it('allows https:', () => {
    expect(isBlockedUri('https://example.com')).toBe(false);
  });

  it('allows data:image/', () => {
    expect(isBlockedUri('data:image/png;base64,abc')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isBlockedUri('JavaScript:void(0)')).toBe(true);
  });
});

describe('renderMarkdown — image src resolver (v3.11.1)', () => {
  it('renders a relative image as a link WITHOUT a resolver (default safety)', () => {
    const html = renderMarkdown('![ROC](figures/roc.png)');
    expect(html).not.toContain('<img');
    expect(html).toContain('<a');
    expect(html).toContain('figures/roc.png');
  });

  it('renders a relative image as <img> WITH a resolver mapping it to a servable URL', () => {
    const html = renderMarkdown('![ROC](figures/roc.png)', {
      resolveImageSrc: (src) => `/api/projects/p1/files/raw?path=${encodeURIComponent(src)}`,
    });
    expect(html).toContain('<img');
    expect(html).toContain('/api/projects/p1/files/raw?path=figures%2Froc.png');
    expect(html).toContain('alt="ROC"');
  });

  it('does not route absolute / data / external images through the resolver', () => {
    const resolver = (): string => '/should-not-be-used';
    expect(renderMarkdown('![x](/already/abs.png)', { resolveImageSrc: resolver })).toContain('src="/already/abs.png"');
    const ext = renderMarkdown('![x](https://example.com/a.png)', { resolveImageSrc: resolver });
    expect(ext).toContain('<a');                 // external still a link
    expect(ext).not.toContain('/should-not-be-used');
  });

  it('clears the resolver after the call (no leak to the next render)', () => {
    renderMarkdown('![x](figures/a.png)', { resolveImageSrc: () => '/api/raw' });
    const html = renderMarkdown('![y](figures/b.png)'); // no resolver this time
    expect(html).not.toContain('<img');
    expect(html).toContain('<a');
  });
});
