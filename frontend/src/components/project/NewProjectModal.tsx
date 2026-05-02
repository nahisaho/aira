import { useState } from 'react';
import { useProjectStore } from '../../stores/project';
import { usePreferencesStore } from '../../stores/preferences';
import { useT } from '../../useT';

export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { createProject, setActiveProject, projects } = useProjectStore();
  const theme = usePreferencesStore((s) => s.theme);
  const t = useT();
  const light = theme === 'light';

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    if (projects.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('A project with this name already exists');
      return;
    }

    try {
      const project = await createProject(name.trim());
      setActiveProject(project.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`rounded-lg p-6 w-96 ${light ? 'bg-white' : 'bg-gray-800'}`}>
        <h2 className={`text-lg font-semibold mb-4 ${light ? 'text-gray-900' : 'text-white'}`}>
          {t('project.newTitle')}
        </h2>

        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder={t('project.namePlaceholder')}
          className={`w-full rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            light ? 'bg-gray-100 text-gray-900' : 'bg-gray-700 text-gray-100'
          }`}
          autoFocus
        />

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className={`px-3 py-1.5 text-sm ${light ? 'text-gray-500 hover:text-gray-700' : 'text-gray-400 hover:text-gray-200'}`}>
            {t('project.cancel')}
          </button>
          <button onClick={handleCreate} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded text-white">
            {t('project.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
