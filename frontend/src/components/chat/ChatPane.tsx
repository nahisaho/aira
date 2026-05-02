import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../stores/chat';
import { useProjectStore } from '../../stores/project';
import { useWSStore } from '../../stores/ws';
import { MessageItem } from './MessageItem';

export function ChatPane() {
  const { messages, loading, sending, fetchMessages, sendMessage } = useChatStore();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const wsStatus = useWSStore((s) => s.status);
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
    if (!input.trim() || !activeProjectId || sending) return;
    const content = input;
    setInput('');
    await sendMessage(activeProjectId, content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select or create a project to begin
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && <p className="text-sm text-gray-500">Loading messages...</p>}
        {messages.map((msg) => (
          <MessageItem key={msg.id} role={msg.role} content={msg.content} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 p-4">
        {/* Connection status */}
        {wsStatus !== 'connected' && (
          <div className={`text-xs mb-2 px-2 py-1 rounded ${
            wsStatus === 'reconnecting'
              ? 'bg-yellow-900/30 text-yellow-400'
              : 'bg-red-900/30 text-red-400'
          }`}>
            {wsStatus === 'reconnecting' ? '⟳ Reconnecting...' : '⊘ Disconnected'}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 text-gray-100 rounded-lg px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={1}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
