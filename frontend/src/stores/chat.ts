import { create } from 'zustand';
import { messagesApi, type Message } from '../api/client';
import { wsClient } from '../api/ws';

interface ChatStore {
  messages: Message[];
  loading: boolean;
  sending: boolean;
  runStatus: 'idle' | 'running' | 'completed' | 'failed';

  fetchMessages: (projectId: string) => Promise<void>;
  sendMessage: (projectId: string, content: string) => Promise<void>;
  clearMessages: (projectId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  appendToLast: (content: string) => void;
  setRunStatus: (status: ChatStore['runStatus']) => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  loading: false,
  sending: false,
  runStatus: 'idle',

  fetchMessages: async (projectId: string) => {
    set({ loading: true });
    try {
      const messages = await messagesApi.list(projectId);
      set({ messages, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  sendMessage: async (projectId: string, content: string) => {
    set({ sending: true });
    try {
      // Save user message via REST
      const message = await messagesApi.send(projectId, content);
      set((s) => ({ messages: [...s.messages, message], sending: false }));

      // Trigger agent execution via WebSocket
      wsClient.send({ type: 'chat', content, messageId: message.id });
    } catch {
      set({ sending: false });
    }
  },

  clearMessages: async (projectId: string) => {
    await messagesApi.clear(projectId);
    set({ messages: [] });
  },

  addMessage: (message: Message) => {
    set((s) => ({ messages: [...s.messages, message] }));
  },

  appendToLast: (content: string) => {
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + content };
      } else {
        // First chunk: create assistant message placeholder
        msgs.push({
          id: `streaming-${Date.now()}`,
          project_id: '',
          run_id: null,
          role: 'assistant',
          content,
          created_at: new Date().toISOString(),
        });
      }
      return { messages: msgs };
    });
  },

  setRunStatus: (status) => set({ runStatus: status }),

  reset: () => set({ messages: [], loading: false, sending: false, runStatus: 'idle' }),
}));

// Wire WS events to chat store
wsClient.onEvent((event) => {
  const store = useChatStore.getState();
  switch (event.type) {
    case 'chunk':
      store.appendToLast(event.content);
      break;
    case 'status':
      if (event.runId) {
        if (event.status === 'running') {
          store.setRunStatus('running');
        } else if (event.status === 'completed') {
          store.setRunStatus('idle');
        } else if (event.status === 'failed') {
          store.setRunStatus('idle');
        }
      }
      break;
  }
});
