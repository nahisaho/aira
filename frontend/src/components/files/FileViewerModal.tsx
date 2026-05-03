import { useState, useEffect } from 'react';
import { filesApi } from '../../api/client';
import { renderMarkdown } from '../chat/markdown';
import { usePreferencesStore } from '../../stores/preferences';

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
  const light = usePreferencesStore((s) => s.theme) === 'light';

  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg'].includes(ext);
  const isMarkdown = ['md', 'markdown'].includes(ext);

  useEffect(() => {
    if (isImage) {
      setLoading(false);
      return;
    }
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
  }, [projectId, fileId, isImage]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className={`rounded-lg w-[80vw] max-h-[80vh] flex flex-col ${
          light ? 'bg-white' : 'bg-gray-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${
          light ? 'border-gray-200' : 'border-gray-700'
        }`}>
          <span className={`text-sm truncate ${light ? 'text-gray-700' : 'text-gray-300'}`}>{filePath}</span>
          <div className="flex gap-2">
            <a
              href={filesApi.downloadUrl(projectId, fileId)}
              download
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              ⬇ Download
            </a>
            <button
              onClick={onClose}
              className={`text-lg ${light ? 'text-gray-400 hover:text-gray-600' : 'text-gray-400 hover:text-gray-200'}`}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && <p className={`text-sm ${light ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {isImage && (
            <div className="flex items-center justify-center">
              <img
                src={filesApi.downloadUrl(projectId, fileId)}
                alt={filePath}
                className="max-w-full max-h-[60vh] object-contain"
              />
            </div>
          )}

          {content !== null && !isImage && isMarkdown && (
            <div
              className={`prose prose-sm max-w-none ${light ? '' : 'prose-invert'}`}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}

          {content !== null && !isImage && !isMarkdown && (
            <pre className={`text-sm font-mono whitespace-pre-wrap ${
              light ? 'text-gray-800' : 'text-gray-200'
            }`}>
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
