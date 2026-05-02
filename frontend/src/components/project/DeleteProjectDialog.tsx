import { useState } from 'react';
import { useProjectStore } from '../../stores/project';

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
      <div className="bg-gray-800 rounded-lg p-6 w-96">
        <h2 className="text-lg font-semibold text-white mb-2">Delete Project</h2>
        <p className="text-sm text-gray-400 mb-4">
          Are you sure you want to delete <strong className="text-white">{projectName}</strong>?
          This will permanently delete all workspace files, messages, and run history.
        </p>

        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 rounded text-white disabled:opacity-50"
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
