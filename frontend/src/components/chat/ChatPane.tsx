import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../stores/chat';
import { useProjectStore } from '../../stores/project';
import { useWSStore } from '../../stores/ws';
import { usePreferencesStore, LLM_MODELS } from '../../stores/preferences';
import { useFilesStore } from '../../stores/files';
import { useT } from '../../useT';
import { MessageItem } from './MessageItem';
import { runsApi } from '../../api/client';

export function ChatPane() {
  const { messages, loading, sending, runStatus, progressMessage, fetchMessages, sendMessage } = useChatStore();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const fetchCurrentRun = useFilesStore((s) => s.fetchCurrentRun);
  const wsStatus = useWSStore((s) => s.status);
  const theme = usePreferencesStore((s) => s.theme);
  const model = usePreferencesStore((s) => s.model);
  const setModel = usePreferencesStore((s) => s.setModel);
  const sendKey = usePreferencesStore((s) => s.sendKey);
  const t = useT();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeProjectId) {
      fetchMessages(activeProjectId);
    }
  }, [activeProjectId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !activeProjectId || isActive) return;

    const content = input;
    setInput('');
    await sendMessage(activeProjectId, content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (sendKey === 'Ctrl+Enter') {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        handleSend();
      }
    } else {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const light = theme === 'light';
  // True while any run activity is in progress (REST save phase OR active WS run)
  const isActive = sending || runStatus === 'running';

  const handleStop = async () => {
    if (activeProjectId) {
      await runsApi.stop(activeProjectId);
      fetchCurrentRun(activeProjectId);
    }
  };

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
        {isActive && <ThinkingIndicator light={light} message={progressMessage ?? undefined} onStop={handleStop} />}
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
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              light
                ? 'bg-white text-gray-900 border border-gray-300'
                : 'bg-gray-800 text-gray-100'
            }`}
            rows={1}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isActive}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white"
          >
            {isActive ? t('chat.sending') : t('chat.send')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ThinkingIndicator({ light, message, onStop }: { light: boolean; message?: string; onStop: () => void }) {
  return (
    <div className="flex justify-start">
      <div className={`px-4 py-3 rounded-lg ${light ? 'bg-gray-100' : 'bg-gray-800'}`}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full animate-bounce ${light ? 'bg-gray-400' : 'bg-gray-500'}`} style={{ animationDelay: '0ms' }} />
            <span className={`w-2 h-2 rounded-full animate-bounce ${light ? 'bg-gray-400' : 'bg-gray-500'}`} style={{ animationDelay: '150ms' }} />
            <span className={`w-2 h-2 rounded-full animate-bounce ${light ? 'bg-gray-400' : 'bg-gray-500'}`} style={{ animationDelay: '300ms' }} />
          </div>
          {message && (
            <span className={`text-xs truncate max-w-xs ${light ? 'text-gray-500' : 'text-gray-400'}`}>{message}</span>
          )}
          <button
            onClick={onStop}
            className="ml-2 text-xs px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white"
          >
            ■ Stop
          </button>
        </div>
      </div>
    </div>
  );
}


