import { create } from 'zustand';
import { messagesApi, type Message } from '../api/client';

interface ChatStore {
  messages: Message[];
  loading: boolean;
  sending: boolean;

  fetchMessages: (projectId: string) => Promise<void>;
  sendMessage: (projectId: string, content: string) => Promise<void>;
  clearMessages: (projectId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  appendToLast: (content: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  loading: false,
  sending: false,

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
      const message = await messagesApi.send(projectId, content);
      set((s) => ({ messages: [...s.messages, message], sending: false }));
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
      }
      return { messages: msgs };
    });
  },

  reset: () => set({ messages: [], loading: false, sending: false }),
}));
