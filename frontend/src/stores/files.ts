import { create } from 'zustand';
import { filesApi, runsApi, type FileInfo, type Run } from '../api/client';

interface FilesStore {
  files: FileInfo[];
  currentRun: Run | null;
  runHistory: Run[];
  loading: boolean;

  fetchFiles: (projectId: string) => Promise<void>;
  fetchCurrentRun: (projectId: string) => Promise<void>;
  fetchRunHistory: (projectId: string) => Promise<void>;
  addFile: (file: FileInfo) => void;
  updateFile: (file: FileInfo) => void;
  removeFile: (fileId: string) => void;
  setCurrentRun: (run: Run | null) => void;
  reset: () => void;
}

export const useFilesStore = create<FilesStore>((set) => ({
  files: [],
  currentRun: null,
  runHistory: [],
  loading: false,

  fetchFiles: async (projectId: string) => {
    set({ loading: true });
    try {
      const files = await filesApi.list(projectId);
      set({ files, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchCurrentRun: async (projectId: string) => {
    try {
      const result = await runsApi.current(projectId);
      if ('id' in result) {
        set({ currentRun: result as Run });
      } else {
        set({ currentRun: null });
      }
    } catch {
      set({ currentRun: null });
    }
  },

  fetchRunHistory: async (projectId: string) => {
    try {
      const runs = await runsApi.list(projectId);
      set({ runHistory: runs });
    } catch {
      // ignore
    }
  },

  addFile: (file: FileInfo) => {
    set((s) => ({ files: [...s.files, file] }));
  },

  updateFile: (file: FileInfo) => {
    set((s) => ({
      files: s.files.map((f) => (f.id === file.id ? file : f)),
    }));
  },

  removeFile: (fileId: string) => {
    set((s) => ({ files: s.files.filter((f) => f.id !== fileId) }));
  },

  setCurrentRun: (run: Run | null) => {
    set({ currentRun: run });
  },

  reset: () => set({ files: [], currentRun: null, runHistory: [], loading: false }),
}));
