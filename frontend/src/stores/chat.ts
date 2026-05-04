import { create } from 'zustand';
import { messagesApi, type Message } from '../api/client';
import { wsClient } from '../api/ws';

// Chunk buffer for batching rapid WebSocket updates into single React renders
let chunkBuffer = '';
let rafId: number | null = null;

function flushChunkBuffer() {
  rafId = null;
  if (!chunkBuffer) return;
  const buffered = chunkBuffer;
  chunkBuffer = '';
  useChatStore.getState().appendToLast(buffered);
}

function queueChunk(content: string) {
  chunkBuffer += content;
  if (rafId === null) {
    rafId = requestAnimationFrame(flushChunkBuffer);
  }
}

interface ChatStore {
  messages: Message[];
  loading: boolean;
  sending: boolean;
  runStatus: 'idle' | 'running' | 'completed' | 'failed';
  progressMessage: string | null;

  fetchMessages: (projectId: string) => Promise<void>;
  sendMessage: (projectId: string, content: string) => Promise<void>;
  clearMessages: (projectId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  appendToLast: (content: string) => void;
  setRunStatus: (status: ChatStore['runStatus']) => void;
  setProgressMessage: (message: string | null) => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  loading: false,
  sending: false,
  runStatus: 'idle',
  progressMessage: null,

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
      set((s) => ({ messages: [...s.messages, message] }));
      // Keep sending=true until run starts (WS will drive it)

      // Get selected model
      const { usePreferencesStore } = await import('./preferences');
      const selectedModel = usePreferencesStore.getState().model;
      const model = selectedModel === 'auto' ? undefined : selectedModel;

      // Trigger agent execution via WebSocket
      wsClient.send({ type: 'chat', content, messageId: message.id, model });
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

  setProgressMessage: (message) => set({ progressMessage: message }),

  reset: () => set({ messages: [], loading: false, sending: false, runStatus: 'idle', progressMessage: null }),
}));

// Wire WS events to chat store
wsClient.onEvent((event) => {
  const store = useChatStore.getState();
  switch (event.type) {
    case 'chunk':
      queueChunk(event.content);
      store.setProgressMessage(null);
      break;
    case 'progress':
      store.setProgressMessage(event.message);
      break;
    case 'status':
      if (event.runId) {
        if (event.status === 'running') {
          store.setRunStatus('running');
          store.setProgressMessage(null); // clear old progress
          useChatStore.setState({ sending: false }); // REST phase done; run is live
          // Refresh run history to show running state
          import('./files').then(({ useFilesStore }) => {
            import('./project').then(({ useProjectStore }) => {
              const projectId = useProjectStore.getState().activeProjectId;
              if (projectId) {
                useFilesStore.getState().fetchCurrentRun(projectId);
                useFilesStore.getState().fetchRunHistory(projectId);
              }
            });
          });
        } else if (event.status === 'completed' || event.status === 'failed' || event.status === 'cancelled') {
          // Flush any remaining buffered chunks before finalizing
          if (chunkBuffer) flushChunkBuffer();
          if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
          store.setRunStatus('idle');
          store.setProgressMessage(null);
          useChatStore.setState({ sending: false }); // safety: clear if still pending
          // Trigger files & runs refresh
          import('./files').then(({ useFilesStore }) => {
            import('./project').then(({ useProjectStore }) => {
              const projectId = useProjectStore.getState().activeProjectId;
              if (projectId) {
                useFilesStore.getState().fetchFiles(projectId);
                useFilesStore.getState().fetchRunHistory(projectId);
                useFilesStore.getState().fetchCurrentRun(projectId);
              }
            });
          });
        }
      }
      break;

    // ── Real-time file updates from the agent workspace ──
    case 'file_added':
      import('./files').then(({ useFilesStore }) => {
        const f = event.file;
        useFilesStore.getState().addFile({
          id: f.id,
          project_id: '',
          file_path: f.file_path,
          size_bytes: f.size_bytes,
          content_hash: '',
          source: 'agent',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });
      break;

    case 'file_modified':
      import('./files').then(({ useFilesStore }) => {
        const f = event.file;
        useFilesStore.getState().updateFile({
          id: f.id,
          project_id: '',
          file_path: f.file_path,
          size_bytes: f.size_bytes,
          content_hash: '',
          source: 'agent',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });
      break;

    case 'file_deleted':
      import('./files').then(({ useFilesStore }) => {
        useFilesStore.getState().removeFile(event.fileId);
      });
      break;
  }
});
