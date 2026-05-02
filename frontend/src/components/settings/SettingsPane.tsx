import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settings';
import { usePreferencesStore, type Theme } from '../../stores/preferences';
import { useT } from '../../useT';
import type { Locale } from '../../i18n';

export function SettingsPane({ onClose }: { onClose: () => void }) {
  const t = useT();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 dark:bg-gray-800 light:bg-white rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white dark:text-white light:text-gray-900">
            {t('settings.title')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
        </div>

        <div className="space-y-6">
          <LanguageSettings />
          <hr className="border-gray-700 dark:border-gray-700 light:border-gray-200" />
          <ThemeSettings />
          <hr className="border-gray-700 dark:border-gray-700 light:border-gray-200" />
          <AuthSettings />
        </div>
      </div>
    </div>
  );
}

function LanguageSettings() {
  const t = useT();
  const { locale, setLocale } = usePreferencesStore();

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-300 dark:text-gray-300 light:text-gray-700 mb-3">
        {t('settings.language')}
      </h3>
      <div className="flex gap-2">
        {([['ja', '日本語'], ['en', 'English']] as const).map(([code, label]) => (
          <button
            key={code}
            onClick={() => setLocale(code as Locale)}
            className={`px-4 py-2 rounded text-sm transition-colors ${
              locale === code
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 dark:bg-gray-700 light:bg-gray-200 light:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ThemeSettings() {
  const t = useT();
  const { theme, setTheme } = usePreferencesStore();

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-300 dark:text-gray-300 light:text-gray-700 mb-3">
        {t('settings.viewMode')}
      </h3>
      <div className="flex gap-2">
        {([['light', t('settings.light'), '☀'], ['dark', t('settings.dark'), '🌙']] as const).map(
          ([mode, label, icon]) => (
            <button
              key={mode}
              onClick={() => setTheme(mode as Theme)}
              className={`px-4 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                theme === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 dark:bg-gray-700 light:bg-gray-200 light:text-gray-700'
              }`}
            >
              <span>{icon}</span> {label}
            </button>
          ),
        )}
      </div>
    </section>
  );
}

function AuthSettings() {
  const t = useT();
  const { tokenConfigured, loading, checkToken, setToken, deleteToken, validateToken } =
    useSettingsStore();
  const [input, setInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; login?: string } | null>(null);

  useEffect(() => {
    checkToken();
  }, [checkToken]);

  const handleSet = async () => {
    if (!input.trim()) return;
    await setToken(input.trim());
    setInput('');
  };

  const handleDelete = async () => {
    await deleteToken();
    setValidationResult(null);
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const result = await validateToken();
      setValidationResult(result);
    } catch {
      setValidationResult({ valid: false });
    }
    setValidating(false);
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-300 dark:text-gray-300 light:text-gray-700 mb-3">
        {t('settings.token')}
      </h3>

      {loading && <p className="text-xs text-gray-500">{t('sidebar.loading')}</p>}

      {tokenConfigured === true && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-400">{t('settings.tokenConfigured')}</span>
            <button
              onClick={handleValidate}
              className="text-xs text-blue-400 hover:text-blue-300"
              disabled={validating}
            >
              {validating ? t('settings.validating') : t('settings.validate')}
            </button>
            <button
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-300"
            >
              {t('settings.remove')}
            </button>
          </div>
          {validationResult && (
            <p className={`text-xs ${validationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
              {validationResult.valid
                ? `${t('settings.tokenValid')} (${validationResult.login})`
                : t('settings.tokenInvalid')}
            </p>
          )}
        </div>
      )}

      {tokenConfigured === false && (
        <div className="space-y-3">
          <p className="text-xs text-yellow-400">{t('settings.tokenNotConfigured')}</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSet()}
              placeholder="ghp_..."
              className="flex-1 bg-gray-700 text-gray-100 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSet}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
            >
              {t('settings.save')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
