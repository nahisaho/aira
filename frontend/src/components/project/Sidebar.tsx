import { useEffect, useState } from 'react';
import { useProjectStore } from '../../stores/project';
import { usePreferencesStore } from '../../stores/preferences';
import { useT } from '../../useT';
import { NewProjectModal } from './NewProjectModal';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { ProjectSettingsPane } from './ProjectSettingsPane';
import { SettingsPane } from '../settings/SettingsPane';

export function Sidebar() {
  const { projects, activeProjectId, loading, fetchProjects, setActiveProject } =
    useProjectStore();
  const theme = usePreferencesStore((s) => s.theme);
  const t = useT();
  const [showNewModal, setShowNewModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const light = theme === 'light';

  return (
    <div className="flex flex-col h-full p-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className={`text-lg font-bold ${light ? 'text-gray-900' : 'text-white'}`}>
            {t('sidebar.title')}
          </h1>
          <p className={`text-xs ${light ? 'text-gray-500' : 'text-gray-400'}`}>
            {t('sidebar.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
        >
          {t('sidebar.newProject')}
        </button>
      </div>
      <div className="flex justify-center mb-4">
        <img src="/AIRA_chibicara.png" alt="AIRA" className="w-36 h-36 object-contain" />
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {loading && <p className="text-xs text-gray-500">{t('sidebar.loading')}</p>}
        {projects.map((project) => (
          <div
            key={project.id}
            className={`group flex items-center rounded transition-colors ${
              activeProjectId === project.id
                ? light
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                : light
                  ? 'text-gray-700 hover:bg-gray-100'
                  : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <button
              onClick={() => setActiveProject(project.id)}
              className="flex-1 text-left px-3 py-2 text-sm min-w-0"
            >
              <span className="block truncate">{project.name}</span>
              {project.last_activity && (
                <span className={`block text-xs mt-0.5 ${light ? 'text-gray-400' : 'text-gray-500'}`}>
                  {new Date(project.last_activity.endsWith('Z') ? project.last_activity : project.last_activity + 'Z').toLocaleString()}
                </span>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowProjectSettings(project.id);
              }}
              className={`opacity-0 group-hover:opacity-100 px-1 text-xs ${light ? 'text-gray-400 hover:text-gray-600' : 'text-gray-500 hover:text-gray-300'}`}
              title="Skills / MCP"
            >
              ⚙
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(project.id);
              }}
              className="opacity-0 group-hover:opacity-100 px-1 text-xs text-red-400 hover:text-red-300"
              title={t('sidebar.deleteProject')}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className={`mt-2 pt-2 border-t ${light ? 'border-gray-200' : 'border-gray-700'}`}>
        <button
          onClick={() => setShowSettings(true)}
          className={`text-xs ${light ? 'text-gray-500 hover:text-gray-700' : 'text-gray-400 hover:text-gray-300'}`}
        >
          {t('sidebar.settings')}
        </button>
      </div>

      {showNewModal && <NewProjectModal onClose={() => setShowNewModal(false)} />}
      {showSettings && <SettingsPane onClose={() => setShowSettings(false)} />}
      {showProjectSettings && (
        <ProjectSettingsPane
          projectId={showProjectSettings}
          onClose={() => setShowProjectSettings(null)}
        />
      )}
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
