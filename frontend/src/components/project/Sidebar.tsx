import { useEffect } from 'react';
import { useProjectStore } from '../../stores/project';

export function Sidebar() {
  const { projects, activeProjectId, loading, fetchProjects, setActiveProject, createProject } =
    useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    const name = prompt('Project name:');
    if (!name) return;
    const project = await createProject(name);
    setActiveProject(project.id);
  };

  return (
    <div className="flex flex-col h-full p-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-white">AIRA</h1>
          <p className="text-xs text-gray-400">AI Runway Application</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {loading && <p className="text-xs text-gray-500">Loading...</p>}
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => setActiveProject(project.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              activeProjectId === project.id
                ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <span className="block truncate">{project.name}</span>
            {project.last_activity && (
              <span className="block text-xs text-gray-500 mt-0.5">
                {new Date(project.last_activity).toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-700">
        <button className="text-xs text-gray-400 hover:text-gray-300">
          ⚙ Settings
        </button>
      </div>
    </div>
  );
}
