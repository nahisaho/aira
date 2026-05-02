import { renderMarkdown } from './markdown';
import { usePreferencesStore } from '../../stores/preferences';

interface MessageItemProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const CLI_METADATA_RE = /\n*(?:Changes\s+\+\d+\s+-\d+\s*\n)?(?:Requests\s+.+\n)?(?:Tokens?\s+[↑↓•\d\s.kKmM()cached,]+\s*)$/;
// Strip tool call blocks: ●/✗ header + │/└ continuation lines
const TOOL_BLOCK_RE = /^[●✗][^\n]*\n?(?:[ \t]*[│└][^\n]*\n?)*/gm;
// Strip tool headers without bullet (e.g. "Create output directories (shell)")
const TOOL_HEADER_RE = /^[A-Z][^\n]*\((?:shell|MCP:[^)]+)\)\s*\n?/gm;
// Strip orphan tree lines
const ORPHAN_TREE_RE = /^[ \t]*[│└][^\n]*\n?/gm;

function stripCliMetadata(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(TOOL_BLOCK_RE, '');
  cleaned = cleaned.replace(TOOL_HEADER_RE, '');
  cleaned = cleaned.replace(ORPHAN_TREE_RE, '');
  cleaned = cleaned.replace(CLI_METADATA_RE, '');
  return cleaned.trimStart().trimEnd();
}

export function MessageItem({ role, content }: MessageItemProps) {
  const theme = usePreferencesStore((s) => s.theme);
  const light = theme === 'light';

  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2 rounded-lg text-sm bg-blue-600 text-white">
          <pre className="whitespace-pre-wrap font-sans">{content}</pre>
        </div>
      </div>
    );
  }

  // Assistant/System: render as markdown
  const cleaned = role === 'assistant' ? stripCliMetadata(content) : content;
  const html = renderMarkdown(cleaned);

  return (
    <div className="flex justify-start">
      <div className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
        light
          ? 'bg-gray-100 text-gray-900'
          : 'bg-gray-800 text-gray-200'
      }`}>
        <div
          className={`prose prose-sm max-w-none ${light ? '' : 'prose-invert'}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
