import { useEffect, useState, useCallback } from 'react';
import { useFilesStore } from '../../stores/files';
import { useProjectStore } from '../../stores/project';
import { usePreferencesStore } from '../../stores/preferences';
import { usePipelineStore } from '../../stores/pipeline';
import { useT } from '../../useT';
import { filesApi, runsApi } from '../../api/client';

export function RightPanel() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const theme = usePreferencesStore((s) => s.theme);
  const t = useT();
  const { files, currentRun, runHistory, fetchFiles, fetchCurrentRun, fetchRunHistory, removeFile } =
    useFilesStore();
  const pipelineSteps = usePipelineStore((s) => s.steps);
  const light = theme === 'light';

  const [viewingFile, setViewingFile] = useState<{ path: string; content: string } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    if (activeProjectId) {
      fetchFiles(activeProjectId);
      fetchCurrentRun(activeProjectId);
      fetchRunHistory(activeProjectId);
    }
  }, [activeProjectId, fetchFiles, fetchCurrentRun, fetchRunHistory]);

  const handleView = useCallback(async (fileId: string) => {
    if (!activeProjectId) return;
    setViewLoading(true);
    try {
      const result = await filesApi.view(activeProjectId, fileId);
      setViewingFile(result);
    } catch {
      // If text view fails (binary), trigger download instead
      window.open(filesApi.downloadUrl(activeProjectId, fileId), '_blank');
    } finally {
      setViewLoading(false);
    }
  }, [activeProjectId]);

  const handleDelete = useCallback(async (fileId: string) => {
    if (!activeProjectId) return;
    if (!confirm(t('files.deleteConfirm'))) return;
    try {
      await filesApi.delete(activeProjectId, fileId);
      removeFile(fileId);
    } catch {
      // ignore
    }
  }, [activeProjectId, removeFile, t]);

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
            {currentRun.status === 'running' && (
              <div className="mt-2 h-1 rounded-full overflow-hidden bg-gray-700">
                <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" style={{ animation: 'indeterminate 1.5s infinite ease-in-out' }} />
              </div>
            )}
          </div>
        ) : (
          <div className={`text-sm ${light ? 'text-gray-400' : 'text-gray-500'}`}>{t('panel.idle')}</div>
        )}
      </section>

      {/* Pipeline Progress */}
      {pipelineSteps.length > 0 && (
        <section className="mb-4">
          <h3 className={`text-xs font-semibold uppercase mb-2 ${light ? 'text-gray-500' : 'text-gray-400'}`}>
            Pipeline
          </h3>
          <div className="space-y-0.5">
            {pipelineSteps.map((step, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs py-1 ${
                step.status === 'running' ? (light ? 'text-blue-700' : 'text-blue-400') :
                step.status === 'done' ? (light ? 'text-green-700' : 'text-green-400') :
                (light ? 'text-gray-400' : 'text-gray-500')
              }`}>
                <span className="flex-shrink-0 w-4 text-center">
                  {step.status === 'done' ? '✓' : step.status === 'running' ? '►' : '○'}
                </span>
                <span className={`truncate ${step.status === 'running' ? 'font-medium' : ''}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Run History */}
      <section className="mb-4">
        <h3 className={`text-xs font-semibold uppercase mb-2 ${light ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('panel.runHistory')} ({runHistory.length})
        </h3>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {runHistory.map((run) => {
            const start = run.created_at ? new Date(run.created_at.endsWith('Z') ? run.created_at : run.created_at + 'Z') : null;
            const end = run.finished_at ? new Date(run.finished_at.endsWith('Z') ? run.finished_at : run.finished_at + 'Z') : null;
            const elapsed = start && end ? Math.round((end.getTime() - start.getTime()) / 1000) : null;
            const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return (
              <div key={run.id} className={`rounded p-2 text-xs ${light ? 'bg-gray-50' : 'bg-gray-800/50'}`}>
                <div className="flex items-center gap-2">
                  <RunStatusBadge status={run.status} />
                  {run.status === 'running' && start ? (
                    <LiveElapsed startTime={start} light={light} />
                  ) : elapsed !== null ? (
                    <span className={light ? 'text-gray-600' : 'text-gray-300'}>{formatElapsed(elapsed)}</span>
                  ) : null}
                </div>
                <div className={`mt-1 flex gap-3 ${light ? 'text-gray-400' : 'text-gray-500'}`}>
                  {start && <span>▶ {formatTime(start)}</span>}
                  {end && <span>■ {formatTime(end)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Files */}
      <section>
        <h3 className={`text-xs font-semibold uppercase mb-2 ${light ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('files.title')} ({files.length})
        </h3>
        <div className="space-y-1">
          {files.map((file) => {
            const ext = file.file_path.split('.').pop()?.toLowerCase() ?? '';
            const icon = fileIcon(ext);
            return (
              <div
                key={file.id}
                className={`rounded px-3 py-2 text-sm ${light ? 'bg-gray-100' : 'bg-gray-800'}`}
              >
                <div className={`truncate mb-1 ${light ? 'text-gray-700' : 'text-gray-300'}`}>
                  <span className="mr-1.5">{icon}</span>
                  {file.file_path}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleView(file.id)}
                    disabled={viewLoading}
                    className={`text-xs px-2 py-0.5 rounded ${
                      light
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-blue-900/40 text-blue-400 hover:bg-blue-900/60'
                    }`}
                    title={t('files.view')}
                  >
                    👁 {t('files.view')}
                  </button>
                  <a
                    href={filesApi.downloadUrl(activeProjectId, file.id)}
                    className={`text-xs px-2 py-0.5 rounded inline-block ${
                      light
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
                    }`}
                    download
                    title={t('files.download')}
                  >
                    ⬇ {t('files.download')}
                  </a>
                  <button
                    onClick={() => handleDelete(file.id)}
                    className={`text-xs px-2 py-0.5 rounded ${
                      light
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-red-900/40 text-red-400 hover:bg-red-900/60'
                    }`}
                    title={t('files.delete')}
                  >
                    🗑 {t('files.delete')}
                  </button>
                </div>
              </div>
            );
          })}
          {files.length === 0 && (
            <p className={`text-xs ${light ? 'text-gray-400' : 'text-gray-500'}`}>{t('files.noFiles')}</p>
          )}
        </div>
      </section>

      {/* File Viewer Modal */}
      {viewingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setViewingFile(null)}>
          <div
            className={`relative w-[90vw] max-w-4xl max-h-[80vh] rounded-lg shadow-2xl flex flex-col ${
              light ? 'bg-white' : 'bg-gray-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-4 py-3 border-b ${
              light ? 'border-gray-200' : 'border-gray-700'
            }`}>
              <span className={`text-sm font-medium truncate ${light ? 'text-gray-800' : 'text-gray-200'}`}>
                {viewingFile.path}
              </span>
              <button
                onClick={() => setViewingFile(null)}
                className={`text-sm px-3 py-1 rounded ${
                  light ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-gray-800 text-gray-400'
                }`}
              >
                ✕ {t('files.close')}
              </button>
            </div>
            <pre className={`flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap ${
              light ? 'text-gray-800 bg-gray-50' : 'text-gray-200 bg-gray-950'
            }`}>
              {viewingFile.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function fileIcon(ext: string): string {
  const icons: Record<string, string> = {
    md: '📝', txt: '📝', csv: '📊', json: '📋',
    py: '🐍', rs: '🦀', ts: '📘', js: '📒',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', svg: '🖼️', gif: '🖼️',
    pdf: '📄', html: '🌐',
  };
  return icons[ext] ?? '📁';
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
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-white ${
        colors[status] ?? 'bg-gray-600'
      }`}
    >
      {status === 'running' && (
        <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
      )}
      {status}
    </span>
  );
}

function formatElapsed(s: number): string {
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

function LiveElapsed({ startTime, light }: { startTime: Date; light: boolean }) {
  const [elapsed, setElapsed] = useState(() => Math.round((Date.now() - startTime.getTime()) / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className={`font-mono ${light ? 'text-blue-600' : 'text-blue-400'}`}>
      {formatElapsed(elapsed)}
    </span>
  );
}
