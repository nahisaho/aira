import { useEffect, useRef } from 'react';
import { useProjectStore } from '../stores/project';
import { useChatStore } from '../stores/chat';
import { useFilesStore } from '../stores/files';

/**
 * Auto-refresh data when the browser tab regains focus.
 * Debounced to avoid rapid re-fetches when switching tabs quickly.
 */
export function useAutoRefresh() {
  const lastRefresh = useRef(0);
  const DEBOUNCE_MS = 3_000;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      const now = Date.now();
      if (now - lastRefresh.current < DEBOUNCE_MS) return;
      lastRefresh.current = now;

      const projectId = useProjectStore.getState().activeProjectId;

      // Always refresh project list
      useProjectStore.getState().fetchProjects();

      if (projectId) {
        useChatStore.getState().fetchMessages(projectId);
        useFilesStore.getState().fetchFiles(projectId);
        useFilesStore.getState().fetchRunHistory(projectId);
        useFilesStore.getState().fetchCurrentRun(projectId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}
