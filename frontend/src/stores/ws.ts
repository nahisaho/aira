import { create } from 'zustand';
import { wsClient } from '../api/ws';

interface WSStore {
  status: 'connected' | 'reconnecting' | 'disconnected';
  setStatus: (status: WSStore['status']) => void;
}

export const useWSStore = create<WSStore>((set) => ({
  status: 'disconnected',
  setStatus: (status) => set({ status }),
}));

// Sync WS status to store
wsClient.onEvent((event) => {
  if (event.type === 'status' && event.runId === '') {
    useWSStore.getState().setStatus(event.status as WSStore['status']);
  }
});
