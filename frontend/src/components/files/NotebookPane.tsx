import { useEffect, useState } from 'react';
import { jupyterApi, type JupyterSettings } from '../../api/client';
import { usePreferencesStore } from '../../stores/preferences';
import { useT } from '../../useT';

/**
 * Embed JupyterLab in an iframe deep-linked to the active project's notebook.
 *
 * Lifecycle:
 *  - On mount and on projectId change, fetch /api/settings/jupyter to learn
 *    whether Jupyter is reachable from the browser (depends on container bind).
 *  - "ready"   → render the iframe pointed at /lab/tree/<notebook-path>?token=...
 *  - "loopback"→ render an explainer with the docker run flags to enable iframe
 *  - "down"    → render an explainer saying the Jupyter Server is offline
 *
 * The iframe URL uses the absolute publicUrl (typically http://localhost:8888)
 * not a path on AIRA's origin — AIRA does NOT proxy Jupyter, it embeds the
 * separate origin and lets the browser load both. CSP frame-src on AIRA and
 * CSP frame-ancestors on Jupyter are both configured to allow this.
 */
export function NotebookPane({ projectId }: { projectId: string }) {
  const t = useT();
  const light = usePreferencesStore((s) => s.theme) === 'light';
  const [settings, setSettings] = useState<JupyterSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [stopMsg, setStopMsg] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  const handleStopKernels = async (): Promise<void> => {
    setStopping(true);
    setStopMsg(null);
    try {
      const { stopped } = await jupyterApi.stopKernels();
      setStopMsg(t('notebook.kernelsStopped').replace('{n}', String(stopped)));
    } catch {
      setStopMsg('⚠️');
    } finally {
      setStopping(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset loading on projectId change before re-fetching
    setLoading(true);
    jupyterApi
      .getSettings()
      .then((s) => { if (!cancelled) { setSettings(s); setLoading(false); } })
      .catch(() => { if (!cancelled) { setSettings({ available: 'down' }); setLoading(false); } });
    return () => { cancelled = true; };
  }, [projectId]);

  // The notebook path is well-known: every project has projects/<id>/workspace/notebook.ipynb
  // JupyterLab's tree URL uses paths relative to its rootdir (= AIRA's /app), so
  // we encode the same relative path.
  const notebookRelPath = `projects/${projectId}/workspace/notebook.ipynb`;

  function buildIframeUrl(s: JupyterSettings): string {
    if (!s.publicUrl || !s.token) return '';
    const base = s.publicUrl.replace(/\/+$/, '');
    return `${base}/lab/tree/${encodeURI(notebookRelPath)}?token=${encodeURIComponent(s.token)}`;
  }

  if (loading) {
    return (
      <div className={`p-4 text-sm ${light ? 'text-gray-500' : 'text-gray-400'}`}>
        {t('notebook.loading')}
      </div>
    );
  }

  if (!settings || settings.available === 'down') {
    return (
      <div className={`p-4 text-sm ${light ? 'text-gray-600' : 'text-gray-300'}`}>
        <p className="mb-2">⚠️ {t('notebook.unavailable')}</p>
        <p className={`text-xs ${light ? 'text-gray-500' : 'text-gray-400'}`}>
          Check the container logs (<code>docker logs aira</code>) for
          <code>[jupyter-server]</code> errors.
        </p>
      </div>
    );
  }

  if (settings.available === 'loopback') {
    return (
      <div className={`p-4 text-sm ${light ? 'text-gray-600' : 'text-gray-300'}`}>
        <p className="mb-3">🔒 {t('notebook.loopback')}</p>
        <pre className={`text-xs p-3 rounded overflow-x-auto ${
          light ? 'bg-gray-100 text-gray-800' : 'bg-gray-800 text-gray-200'
        }`}>{`docker run -d \\
  -p 3001:3000 -p 8888:8888 \\
  -e AIRA_JUPYTER_BIND=0.0.0.0 \\
  -e GITHUB_TOKEN="ghp_xxx" \\
  -v aira-data:/app/data \\
  -v aira-projects:/app/projects \\
  ghcr.io/nahisaho/aira:latest`}</pre>
      </div>
    );
  }

  const url = buildIframeUrl(settings);
  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center justify-between px-2 py-1 border-b ${
        light ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800'
      }`}>
        <span className={`text-xs truncate ${light ? 'text-gray-500' : 'text-gray-400'}`}>
          notebook.ipynb
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {stopMsg && <span className={`text-[11px] ${light ? 'text-gray-500' : 'text-gray-400'}`}>{stopMsg}</span>}
          <button
            onClick={handleStopKernels}
            disabled={stopping}
            title={t('notebook.stopKernelsHint')}
            className={`text-xs px-2 py-0.5 rounded disabled:opacity-50 ${
              light
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-red-900/40 text-red-400 hover:bg-red-900/60'
            }`}
          >
            ⏹ {t('notebook.stopKernels')}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs px-2 py-0.5 rounded ${
              light
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-blue-900/40 text-blue-400 hover:bg-blue-900/60'
            }`}
          >
            ↗ {t('notebook.openExternal')}
          </a>
        </div>
      </div>
      <iframe
        title="JupyterLab"
        src={url}
        className="flex-1 w-full border-0"
      />
    </div>
  );
}
