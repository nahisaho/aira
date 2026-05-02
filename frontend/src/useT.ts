import { usePreferencesStore } from './stores/preferences';
import { t, type TranslationKey } from './i18n';

export function useT() {
  const locale = usePreferencesStore((s) => s.locale);
  return (key: TranslationKey) => t(key, locale);
}
