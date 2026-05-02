import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settings';

export function SettingsPane({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
        </div>

        <AuthSettings />
      </div>
    </div>
  );
}

function AuthSettings() {
  const { tokenConfigured, loading, checkToken, setToken, deleteToken, validateToken } =
    useSettingsStore();
  const [input, setInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; user?: string } | null>(null);

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
      <h3 className="text-sm font-semibold text-gray-300 mb-3">GitHub Token</h3>

      {loading && <p className="text-xs text-gray-500">Loading...</p>}

      {tokenConfigured === true && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-400">✓ Token configured</span>
            <button
              onClick={handleValidate}
              className="text-xs text-blue-400 hover:text-blue-300"
              disabled={validating}
            >
              {validating ? 'Validating...' : 'Validate'}
            </button>
            <button
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>
          {validationResult && (
            <p className={`text-xs ${validationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
              {validationResult.valid
                ? `✓ Valid (${validationResult.user})`
                : '✗ Invalid token'}
            </p>
          )}
        </div>
      )}

      {tokenConfigured === false && (
        <div className="space-y-3">
          <p className="text-xs text-yellow-400">⚠ Token not configured</p>
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
              Save
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
