import { create } from 'zustand';
import { settingsApi } from '../api/client';

type TokenSource = 'environment' | 'settings';

interface SettingsStore {
  tokenConfigured: boolean | null;
  tokenSource: TokenSource | null;
  tokenError: string | null;
  loading: boolean;

  checkToken: () => Promise<void>;
  setToken: (token: string) => Promise<boolean>;
  deleteToken: () => Promise<boolean>;
  validateToken: () => Promise<{ valid: boolean; login?: string }>;
  clearTokenError: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  tokenConfigured: null,
  tokenSource: null,
  tokenError: null,
  loading: false,

  checkToken: async () => {
    set({ loading: true });
    try {
      const result = await settingsApi.getToken();
      set({
        tokenConfigured: result.token.configured,
        tokenSource: result.token.source as TokenSource,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  setToken: async (token: string) => {
    try {
      await settingsApi.setToken(token);
      set({ tokenConfigured: true, tokenError: null });
      return true;
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to save token';
      set({ tokenError: msg });
      return false;
    }
  },

  deleteToken: async () => {
    try {
      await settingsApi.deleteToken();
      set({ tokenConfigured: false, tokenError: null });
      return true;
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to delete token';
      set({ tokenError: msg });
      return false;
    }
  },

  validateToken: async () => {
    return settingsApi.validateToken();
  },

  clearTokenError: () => set({ tokenError: null }),
}));
