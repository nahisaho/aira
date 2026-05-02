import { useState } from 'react';
import { useProjectStore } from '../../stores/project';
import { usePreferencesStore } from '../../stores/preferences';
import { useT } from '../../useT';

export function DeleteProjectDialog({
  projectId,
  projectName,
  onClose,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const { deleteProject } = useProjectStore();
  const theme = usePreferencesStore((s) => s.theme);
  const t = useT();
  const light = theme === 'light';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProject(projectId);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`rounded-lg p-6 w-96 ${light ? 'bg-white' : 'bg-gray-800'}`}>
        <h2 className={`text-lg font-semibold mb-2 ${light ? 'text-gray-900' : 'text-white'}`}>
          {t('project.deleteTitle')}
        </h2>
        <p className={`text-sm mb-4 ${light ? 'text-gray-600' : 'text-gray-400'}`}>
          <strong className={light ? 'text-gray-900' : 'text-white'}>{projectName}</strong>
          {t('project.deleteConfirm')}
        </p>

        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className={`px-3 py-1.5 text-sm ${light ? 'text-gray-500 hover:text-gray-700' : 'text-gray-400 hover:text-gray-200'}`}
            disabled={deleting}
          >
            {t('project.cancel')}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 rounded text-white disabled:opacity-50"
            disabled={deleting}
          >
            {deleting ? '...' : t('project.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
