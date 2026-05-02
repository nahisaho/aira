import { create } from 'zustand';
import { settingsApi } from '../api/client';

interface SettingsStore {
  tokenConfigured: boolean | null;
  loading: boolean;

  checkToken: () => Promise<void>;
  setToken: (token: string) => Promise<void>;
  deleteToken: () => Promise<void>;
  validateToken: () => Promise<{ valid: boolean; login?: string }>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  tokenConfigured: null,
  loading: false,

  checkToken: async () => {
    set({ loading: true });
    try {
      const result = await settingsApi.getToken();
      set({ tokenConfigured: result.token.configured, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setToken: async (token: string) => {
    await settingsApi.setToken(token);
    set({ tokenConfigured: true });
  },

  deleteToken: async () => {
    await settingsApi.deleteToken();
    set({ tokenConfigured: false });
  },

  validateToken: async () => {
    return settingsApi.validateToken();
  },
}));
