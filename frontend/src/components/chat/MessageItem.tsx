import { renderMarkdown } from './markdown';

interface MessageItemProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function MessageItem({ role, content }: MessageItemProps) {
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
      <div className="max-w-[80%] px-4 py-2 rounded-lg text-sm bg-gray-800 text-gray-200">
        <div
          className="prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
