import { renderMarkdown } from './markdown';
import { usePreferencesStore } from '../../stores/preferences';

interface MessageItemProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
  const html = renderMarkdown(content);

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
