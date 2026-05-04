import { create } from 'zustand';
import type { Locale } from '../i18n';

export type Theme = 'light' | 'dark';

export const LLM_MODELS = [
  { id: 'auto',                  label: 'Auto (Copilot default)' },
  // Anthropic via Copilot
  { id: 'claude-sonnet-4-5',     label: 'Claude Sonnet 4.5' },
  { id: 'claude-sonnet-4',       label: 'Claude Sonnet 4' },
  { id: 'claude-opus-4',         label: 'Claude Opus 4' },
  // OpenAI via Copilot
  { id: 'gpt-4.1',               label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini',          label: 'GPT-4.1 mini' },
  { id: 'gpt-4o',                label: 'GPT-4o' },
  { id: 'o3',                    label: 'o3' },
  { id: 'o4-mini',               label: 'o4-mini' },
] as const;

export type LlmModelId = (typeof LLM_MODELS)[number]['id'];

interface PreferencesStore {
  locale: Locale;
  theme: Theme;
  model: LlmModelId;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  setModel: (model: LlmModelId) => void;
}

function loadLocale(): Locale {
  const stored = localStorage.getItem('aira-locale');
  if (stored === 'en' || stored === 'ja') return stored;
  return navigator.language.startsWith('ja') ? 'ja' : 'en';
}

function loadTheme(): Theme {
  const stored = localStorage.getItem('aira-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function applyTheme(theme: Theme): void {
  const html = document.documentElement;
  html.classList.toggle('dark', theme === 'dark');
  html.classList.toggle('light', theme === 'light');
}

function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale === 'ja' ? 'ja' : 'en';
}

function loadModel(): LlmModelId {
  const stored = localStorage.getItem('aira-model');
  if (stored && LLM_MODELS.some((m) => m.id === stored)) return stored as LlmModelId;
  return 'auto';
}

export const usePreferencesStore = create<PreferencesStore>((set) => {
  const initialLocale = loadLocale();
  const initialTheme = loadTheme();
  const initialModel = loadModel();

  // Apply on load
  applyTheme(initialTheme);
  applyLocale(initialLocale);

  return {
    locale: initialLocale,
    theme: initialTheme,
    model: initialModel,

    setLocale: (locale: Locale) => {
      localStorage.setItem('aira-locale', locale);
      applyLocale(locale);
      set({ locale });
    },

    setTheme: (theme: Theme) => {
      localStorage.setItem('aira-theme', theme);
      applyTheme(theme);
      set({ theme });
    },

    setModel: (model: LlmModelId) => {
      localStorage.setItem('aira-model', model);
      set({ model });
    },
  };
});
