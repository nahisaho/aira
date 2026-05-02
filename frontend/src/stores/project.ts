import { create } from 'zustand';
import { projectsApi, type Project } from '../api/client';
import { wsClient } from '../api/ws';

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  createProject: (name: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  setActiveProject: (id: string | null) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  activeProjectId: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await projectsApi.list();
      set({ projects, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createProject: async (name: string) => {
    const project = await projectsApi.create(name);
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  deleteProject: async (id: string) => {
    await projectsApi.delete(id);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    }));
  },

  renameProject: async (id: string, name: string) => {
    const updated = await projectsApi.update(id, { name });
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? updated : p)),
    }));
  },

  setActiveProject: (id: string | null) => {
    set({ activeProjectId: id });
    if (id) {
      wsClient.connect(id);
    } else {
      wsClient.disconnect();
    }
  },
}));
