import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;

function initMermaid(dark: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? 'dark' : 'default',
    securityLevel: 'strict',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  });
  mermaidInitialized = true;
}

interface MarkdownContentProps {
  html: string;
  className?: string;
  dark?: boolean;
}

export function MarkdownContent({ html, className = '', dark = true }: MarkdownContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mermaidBlocks = el.querySelectorAll<HTMLPreElement>('pre.mermaid');
    if (mermaidBlocks.length === 0) return;

    if (!mermaidInitialized) initMermaid(dark);

    let cancelled = false;

    (async () => {
      for (const block of mermaidBlocks) {
        if (cancelled) return;
        const source = block.textContent ?? '';
        if (!source.trim()) continue;
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        try {
          const { svg } = await mermaid.render(id, source);
          if (!cancelled) {
            block.innerHTML = svg;
            block.classList.add('mermaid-rendered');
          }
        } catch {
          // Leave raw text if rendering fails
        }
      }
    })();

    return () => { cancelled = true; };
  }, [html, dark]);

  return (
    <div
      ref={ref}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
