import { useState, useEffect } from 'react';
import { filesApi } from '../../api/client';
import { renderMarkdown } from '../chat/markdown';

interface FileViewerModalProps {
  projectId: string;
  fileId: string;
  filePath: string;
  onClose: () => void;
}

export function FileViewerModal({ projectId, fileId, filePath, onClose }: FileViewerModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    filesApi
      .view(projectId, fileId)
      .then((data) => {
        setContent(data.content);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [projectId, fileId]);

  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp'].includes(ext);
  const isMarkdown = ['md', 'markdown'].includes(ext);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-[80vw] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-sm text-gray-300 truncate">{filePath}</span>
          <div className="flex gap-2">
            <a
              href={filesApi.downloadUrl(projectId, fileId)}
              download
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Download
            </a>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && <p className="text-gray-500 text-sm">Loading...</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {content !== null && !isImage && isMarkdown && (
            <div
              className="prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}

          {content !== null && !isImage && !isMarkdown && (
            <pre className="text-sm text-gray-200 font-mono whitespace-pre-wrap">
              {content}
            </pre>
          )}

          {isImage && (
            <div className="flex items-center justify-center">
              <img
                src={filesApi.downloadUrl(projectId, fileId)}
                alt={filePath}
                className="max-w-full max-h-[60vh] object-contain"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
