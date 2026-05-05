import { create } from 'zustand';
import { projectsApi, skillsApi, type Project, type Skill } from '../api/client';
import { wsClient } from '../api/ws';

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;
  error: string | null;
  projectSkills: Record<string, Skill[]>;

  fetchProjects: () => Promise<void>;
  fetchProjectSkills: (projectId: string) => Promise<void>;
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
  projectSkills: {},

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await projectsApi.list();
      set({ projects, loading: false });
      // Fetch skills for all projects in parallel
      const skillEntries = await Promise.all(
        projects.map(async (p) => {
          try {
            const skills = await skillsApi.listProject(p.id);
            return [p.id, skills] as const;
          } catch {
            return [p.id, []] as const;
          }
        }),
      );
      set({ projectSkills: Object.fromEntries(skillEntries) });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchProjectSkills: async (projectId: string) => {
    try {
      const skills = await skillsApi.listProject(projectId);
      set((s) => ({ projectSkills: { ...s.projectSkills, [projectId]: skills } }));
    } catch {
      // ignore
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
    // Reset per-project UI state when switching projects
    import('./pipeline').then(({ usePipelineStore }) => usePipelineStore.getState().reset());
    import('./chat').then(({ useChatStore }) => useChatStore.getState().reset());
    if (id) {
      wsClient.connect(id);
    } else {
      wsClient.disconnect();
    }
  },
}));
