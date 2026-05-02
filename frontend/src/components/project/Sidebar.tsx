import { useEffect, useState } from 'react';
import { useProjectStore } from '../../stores/project';
import { NewProjectModal } from './NewProjectModal';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { SettingsPane } from '../settings/SettingsPane';

export function Sidebar() {
  const { projects, activeProjectId, loading, fetchProjects, setActiveProject } =
    useProjectStore();
  const [showNewModal, setShowNewModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="flex flex-col h-full p-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-white">AIRA</h1>
          <p className="text-xs text-gray-400">AI Runway Application</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {loading && <p className="text-xs text-gray-500">Loading...</p>}
        {projects.map((project) => (
          <div
            key={project.id}
            className={`group flex items-center rounded transition-colors ${
              activeProjectId === project.id
                ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <button
              onClick={() => setActiveProject(project.id)}
              className="flex-1 text-left px-3 py-2 text-sm min-w-0"
            >
              <span className="block truncate">{project.name}</span>
              {project.last_activity && (
                <span className="block text-xs text-gray-500 mt-0.5">
                  {new Date(project.last_activity).toLocaleString()}
                </span>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(project.id);
              }}
              className="opacity-0 group-hover:opacity-100 px-2 text-xs text-red-400 hover:text-red-300"
              title="Delete project"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-700">
        <button
          onClick={() => setShowSettings(true)}
          className="text-xs text-gray-400 hover:text-gray-300"
        >
          ⚙ Settings
        </button>
      </div>

      {showNewModal && <NewProjectModal onClose={() => setShowNewModal(false)} />}
      {showSettings && <SettingsPane onClose={() => setShowSettings(false)} />}
      {deleteTarget && (
        <DeleteProjectDialog
          projectId={deleteTarget}
          projectName={projects.find((p) => p.id === deleteTarget)?.name ?? ''}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
