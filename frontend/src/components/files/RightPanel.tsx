import { useEffect } from 'react';
import { useFilesStore } from '../../stores/files';
import { useProjectStore } from '../../stores/project';
import { filesApi, runsApi } from '../../api/client';

export function RightPanel() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { files, currentRun, runHistory, fetchFiles, fetchCurrentRun, fetchRunHistory } =
    useFilesStore();

  useEffect(() => {
    if (activeProjectId) {
      fetchFiles(activeProjectId);
      fetchCurrentRun(activeProjectId);
      fetchRunHistory(activeProjectId);
    }
  }, [activeProjectId, fetchFiles, fetchCurrentRun, fetchRunHistory]);

  if (!activeProjectId) {
    return (
      <div className="p-3 text-sm text-gray-500">
        No project selected
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
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Status</h3>
        {currentRun ? (
          <div className="bg-gray-800 rounded p-3">
            <div className="flex items-center justify-between">
              <RunStatusBadge status={currentRun.status} />
              {currentRun.status === 'running' && (
                <button
                  onClick={handleStop}
                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Idle</div>
        )}
      </section>

      {/* Run History */}
      <section className="mb-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Run History ({runHistory.length})
        </h3>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {runHistory.map((run) => (
            <div key={run.id} className="flex items-center gap-2 text-xs text-gray-400">
              <RunStatusBadge status={run.status} />
              <span>{new Date(run.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Files */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Files ({files.length})
        </h3>
        <div className="space-y-1">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between bg-gray-800 rounded px-3 py-2 text-sm"
            >
              <span className="truncate text-gray-300">{file.file_path}</span>
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
            <p className="text-xs text-gray-500">No files yet</p>
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
