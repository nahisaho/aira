import { useEffect } from 'react';
import { useFilesStore } from '../../stores/files';
import { useProjectStore } from '../../stores/project';
import { usePreferencesStore } from '../../stores/preferences';
import { useT } from '../../useT';
import { filesApi, runsApi } from '../../api/client';

export function RightPanel() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const theme = usePreferencesStore((s) => s.theme);
  const t = useT();
  const { files, currentRun, runHistory, fetchFiles, fetchCurrentRun, fetchRunHistory } =
    useFilesStore();
  const light = theme === 'light';

  useEffect(() => {
    if (activeProjectId) {
      fetchFiles(activeProjectId);
      fetchCurrentRun(activeProjectId);
      fetchRunHistory(activeProjectId);
    }
  }, [activeProjectId, fetchFiles, fetchCurrentRun, fetchRunHistory]);

  if (!activeProjectId) {
    return (
      <div className={`p-3 text-sm ${light ? 'text-gray-400' : 'text-gray-500'}`}>
        {t('panel.noProject')}
      </div>
    );
  }

  const handleStop = async () => {
    if (activeProjectId) {
      await runsApi.stop(activeProjectId);
      fetchCurrentRun(activeProjectId);
    }
  };

  return (
    <div className="flex flex-col h-full p-3 overflow-y-auto">
      {/* Current Run Status */}
      <section className="mb-4">
        <h3 className={`text-xs font-semibold uppercase mb-2 ${light ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('panel.status')}
        </h3>
        {currentRun ? (
          <div className={`rounded p-3 ${light ? 'bg-gray-100' : 'bg-gray-800'}`}>
            <div className="flex items-center justify-between">
              <RunStatusBadge status={currentRun.status} />
              {currentRun.status === 'running' && (
                <button
                  onClick={handleStop}
                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white"
                >
                  {t('panel.stop')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={`text-sm ${light ? 'text-gray-400' : 'text-gray-500'}`}>{t('panel.idle')}</div>
        )}
      </section>

      {/* Run History */}
      <section className="mb-4">
        <h3 className={`text-xs font-semibold uppercase mb-2 ${light ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('panel.runHistory')} ({runHistory.length})
        </h3>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {runHistory.map((run) => (
            <div key={run.id} className={`flex items-center gap-2 text-xs ${light ? 'text-gray-500' : 'text-gray-400'}`}>
              <RunStatusBadge status={run.status} />
              <span>{new Date(run.created_at.endsWith('Z') ? run.created_at : run.created_at + 'Z').toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Files */}
      <section>
        <h3 className={`text-xs font-semibold uppercase mb-2 ${light ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('files.title')} ({files.length})
        </h3>
        <div className="space-y-1">
          {files.map((file) => (
            <div
              key={file.id}
              className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
                light ? 'bg-gray-100' : 'bg-gray-800'
              }`}
            >
              <span className={`truncate ${light ? 'text-gray-700' : 'text-gray-300'}`}>{file.file_path}</span>
              <div className="flex gap-1 flex-shrink-0 ml-2">
                <a
                  href={filesApi.downloadUrl(activeProjectId, file.id)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                  download
                >
                  ↓
                </a>
              </div>
            </div>
          ))}
          {files.length === 0 && (
            <p className={`text-xs ${light ? 'text-gray-400' : 'text-gray-500'}`}>{t('files.noFiles')}</p>
          )}
        </div>
      </section>
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: 'bg-yellow-600',
    running: 'bg-blue-600',
    completed: 'bg-green-600',
    failed: 'bg-red-600',
    cancelled: 'bg-gray-600',
    timeout: 'bg-orange-600',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs text-white ${
        colors[status] ?? 'bg-gray-600'
      }`}
    >
      {status}
    </span>
  );
}
