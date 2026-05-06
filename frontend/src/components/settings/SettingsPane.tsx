import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settings';
import { usePreferencesStore, type Theme } from '../../stores/preferences';
import { useT } from '../../useT';
import { settingsApi, agentsRepoApi } from '../../api/client';
import type { AgentsRepo } from '../../api/client';
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
          <hr className="border-gray-700 dark:border-gray-700 light:border-gray-200" />
          <CliUpdateSettings />
          <hr className="border-gray-700 dark:border-gray-700 light:border-gray-200" />
          <AgentsRepoSettings />
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

function CliUpdateSettings() {
  const t = useT();
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    settingsApi.getCliVersion().then((res) => {
      setVersion(res.version);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    setResult(null);
    try {
      const res = await settingsApi.updateCli();
      if (res.success) {
        if (res.version) setVersion(res.version);
        setResult({ success: true, message: t('settings.cliUpdateSuccess') });
      } else {
        setResult({ success: false, message: `${t('settings.cliUpdateFailed')}: ${res.output}` });
      }
    } catch {
      setResult({ success: false, message: t('settings.cliUpdateFailed') });
    }
    setUpdating(false);
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-300 dark:text-gray-300 light:text-gray-700 mb-3">
        {t('settings.cli')}
      </h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {t('settings.cliVersion')}:{' '}
            {loading ? '...' : version ? (
              <span className="text-gray-200 font-mono">{version}</span>
            ) : (
              <span className="text-yellow-400">{t('settings.cliNotFound')}</span>
            )}
          </span>
          <button
            onClick={handleUpdate}
            disabled={updating || loading}
            className={`text-xs px-3 py-1 rounded transition-colors ${
              updating
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {updating ? t('settings.cliUpdating') : t('settings.cliUpdate')}
          </button>
        </div>
        {result && (
          <p className={`text-xs ${result.success ? 'text-green-400' : 'text-red-400'}`}>
            {result.message}
          </p>
        )}
      </div>
    </section>
  );
}
function AgentsRepoSettings() {
  const t = useT();
  const [repos, setRepos] = useState<AgentsRepo[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = async () => {
    try {
      const data = await agentsRepoApi.list();
      setRepos(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchRepos(); }, []);

  const handleAdd = async () => {
    if (!urlInput.trim()) return;
    setError(null);
    try {
      await agentsRepoApi.add(urlInput.trim());
      setUrlInput('');
      await fetchRepos();
    } catch (err: unknown) {
      const errorCode = (err as { data?: { error_code?: string } })?.data?.error_code;
      if (errorCode) {
        const key = `settings.agentsRepoError.${errorCode}` as Parameters<typeof t>[0];
        setError(t(key));
      } else {
        const msg = (err as { data?: { error?: string } })?.data?.error;
        setError(msg || (err instanceof Error ? err.message : 'Failed to add'));
      }
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await agentsRepoApi.remove(id);
      await fetchRepos();
    } catch { /* ignore */ }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    setError(null);
    try {
      await agentsRepoApi.sync(id);
      await fetchRepos();
    } catch (err: unknown) {
      const errorCode = (err as { data?: { error_code?: string } })?.data?.error_code;
      if (errorCode) {
        const key = `settings.agentsRepoError.${errorCode}` as Parameters<typeof t>[0];
        setError(t(key));
      } else {
        const msg = (err as { data?: { error?: string } })?.data?.error;
        setError(msg || (err instanceof Error ? err.message : 'Sync failed'));
      }
      await fetchRepos();
    }
    setSyncing(null);
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-300 dark:text-gray-300 light:text-gray-700 mb-3">
        {t('settings.agentsRepo')}
      </h3>

      {/* Add repo form */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="https://github.com/owner/repo"
          className="flex-1 bg-gray-700 text-gray-100 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
        >
          {t('settings.agentsRepoAdd')}
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {/* Repos list */}
      {loading ? (
        <p className="text-xs text-gray-500">{t('sidebar.loading')}</p>
      ) : repos.length === 0 ? (
        <p className="text-xs text-gray-500">{t('settings.agentsRepoNone')}</p>
      ) : (
        <div className="space-y-2">
          {repos.map((repo) => (
            <div key={repo.id} className="flex items-center gap-2 bg-blue-100/80 rounded px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-900 truncate font-medium">{repo.name}</p>
                <p className="text-xs text-gray-400 truncate">{repo.url}</p>
                {repo.lastSync && (
                  <p className="text-xs text-gray-500">
                    {t('settings.agentsRepoLastSync')}: {new Date(repo.lastSync).toLocaleString()}
                  </p>
                )}
                {repo.error && (
                  <p className="text-xs text-red-400 truncate">
                    {t((`settings.agentsRepoError.${repo.error}`) as Parameters<typeof t>[0]) !== `settings.agentsRepoError.${repo.error}`
                      ? t((`settings.agentsRepoError.${repo.error}`) as Parameters<typeof t>[0])
                      : repo.error}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleSync(repo.id)}
                disabled={syncing === repo.id}
                className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-500"
              >
                {syncing === repo.id ? '⟳' : t('settings.agentsRepoSync')}
              </button>
              <button
                onClick={() => handleRemove(repo.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                {t('settings.remove')}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
