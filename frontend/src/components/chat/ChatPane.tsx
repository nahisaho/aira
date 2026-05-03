import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../stores/chat';
import { useProjectStore } from '../../stores/project';
import { useWSStore } from '../../stores/ws';
import { usePreferencesStore, LLM_MODELS } from '../../stores/preferences';
import { useFilesStore } from '../../stores/files';
import { useT } from '../../useT';
import { MessageItem } from './MessageItem';
import { filesApi } from '../../api/client';

export function ChatPane() {
  const { messages, loading, sending, fetchMessages, sendMessage } = useChatStore();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const wsStatus = useWSStore((s) => s.status);
  const theme = usePreferencesStore((s) => s.theme);
  const model = usePreferencesStore((s) => s.model);
  const setModel = usePreferencesStore((s) => s.setModel);
  const t = useT();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchFiles = useFilesStore((s) => s.fetchFiles);

  useEffect(() => {
    if (activeProjectId) {
      fetchMessages(activeProjectId);
    }
  }, [activeProjectId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || !activeProjectId || sending) return;

    // Upload attachments if any
    if (attachments.length > 0) {
      try {
        await filesApi.upload(activeProjectId, attachments);
        fetchFiles(activeProjectId);
      } catch (err) {
        console.error('Upload failed:', err);
      }
      setAttachments([]);
    }

    // Send message if there's text
    if (input.trim()) {
      const content = input;
      setInput('');
      await sendMessage(activeProjectId, content);
    }
  };

  const handleAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachments((prev) => [...prev, ...Array.from(files)]);
    }
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const light = theme === 'light';

  if (!activeProjectId) {
    return (
      <div className={`flex-1 flex items-center justify-center ${light ? 'text-gray-400' : 'text-gray-500'}`}>
        {t('chat.selectProject')}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && <p className={`text-sm ${light ? 'text-gray-400' : 'text-gray-500'}`}>{t('chat.loadingMessages')}</p>}
        {messages.map((msg) => (
          <MessageItem key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {sending && <ThinkingIndicator light={light} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`border-t p-4 ${light ? 'border-gray-200' : 'border-gray-700'}`}>
        {/* Connection status */}
        {wsStatus !== 'connected' && (
          <div className={`text-xs mb-2 px-2 py-1 rounded ${
            wsStatus === 'reconnecting'
              ? 'bg-yellow-900/30 text-yellow-400'
              : 'bg-red-900/30 text-red-400'
          }`}>
            {wsStatus === 'reconnecting' ? t('chat.reconnecting') : t('chat.disconnected')}
          </div>
        )}
        {/* Model selector */}
        <div className="mb-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as typeof model)}
            className={`text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              light
                ? 'bg-gray-100 text-gray-700 border border-gray-300'
                : 'bg-gray-800 text-gray-300 border border-gray-600'
            }`}
          >
            {LLM_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        {/* Attachment preview — above input */}
        {attachments.length > 0 && (
          <div className={`mb-2 rounded-lg border p-2 ${
            light ? 'border-blue-300 bg-blue-50' : 'border-blue-700 bg-blue-950/30'
          }`}>
            <div className={`text-xs font-medium mb-1.5 ${light ? 'text-blue-700' : 'text-blue-400'}`}>
              📎 {t('chat.attachedFiles')} ({attachments.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((file, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 pl-2 pr-1 py-1 rounded text-xs ${
                    light ? 'bg-white border border-blue-200 text-gray-700' : 'bg-gray-800 border border-blue-800 text-gray-300'
                  }`}
                >
                  <span className="truncate max-w-[180px]">{file.name}</span>
                  <span className={`text-[10px] ${light ? 'text-gray-400' : 'text-gray-500'}`}>
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="text-red-400 hover:text-red-300 ml-0.5 px-0.5"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachments.length > 0
              ? t('chat.placeholderWithFiles')
              : t('chat.placeholder')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              light
                ? 'bg-white text-gray-900 border border-gray-300'
                : 'bg-gray-800 text-gray-100'
            }`}
            rows={1}
            disabled={sending}
          />
          <button
            onClick={handleAttach}
            disabled={sending}
            className={`px-3 py-2 rounded-lg text-sm ${
              attachments.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : light
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            } disabled:opacity-50`}
            title={t('chat.attach')}
          >
            📎{attachments.length > 0 ? ` ${attachments.length}` : ''}
          </button>
          <button
            onClick={handleSend}
            disabled={(!input.trim() && attachments.length === 0) || sending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white"
          >
            {sending ? t('chat.sending') : t('chat.send')}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}

function ThinkingIndicator({ light }: { light: boolean }) {
  return (
    <div className="flex justify-start">
      <div className={`px-4 py-3 rounded-lg ${light ? 'bg-gray-100' : 'bg-gray-800'}`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full animate-bounce ${light ? 'bg-gray-400' : 'bg-gray-500'}`} style={{ animationDelay: '0ms' }} />
          <span className={`w-2 h-2 rounded-full animate-bounce ${light ? 'bg-gray-400' : 'bg-gray-500'}`} style={{ animationDelay: '150ms' }} />
          <span className={`w-2 h-2 rounded-full animate-bounce ${light ? 'bg-gray-400' : 'bg-gray-500'}`} style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
