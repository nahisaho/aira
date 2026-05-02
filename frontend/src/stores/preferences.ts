import { create } from 'zustand';
import type { Locale } from '../i18n';

export type Theme = 'light' | 'dark';

interface PreferencesStore {
  locale: Locale;
  theme: Theme;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
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

export const usePreferencesStore = create<PreferencesStore>((set) => {
  const initialLocale = loadLocale();
  const initialTheme = loadTheme();

  // Apply on load
  applyTheme(initialTheme);
  applyLocale(initialLocale);

  return {
    locale: initialLocale,
    theme: initialTheme,

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
  };
});
