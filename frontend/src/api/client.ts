const API_BASE = '/api';

let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/csrf-token`);
  const data = await res.json();
  csrfToken = data.token as string;
  return csrfToken!;
}

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  return fetchCsrfToken();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Add CSRF token for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const token = await getCsrfToken();
    headers['X-AIRA-Token'] = token;
  }

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, error.error ?? 'Unknown error', error);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ─── Projects ───

export interface Project {
  id: string;
  name: string;
  description: string | null;
  last_activity: string | null;
  created_at: string;
  updated_at: string;
}

export const projectsApi = {
  list: () => request<Project[]>('/projects'),
  create: (name: string, description?: string) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),
  update: (id: string, data: { name?: string; description?: string }) =>
    request<Project>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),
};

// ─── Messages ───

export interface Message {
  id: string;
  project_id: string;
  run_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export const messagesApi = {
  list: (projectId: string, limit = 100, offset = 0) =>
    request<Message[]>(`/projects/${projectId}/messages?limit=${limit}&offset=${offset}`),
  send: (projectId: string, content: string) =>
    request<Message>(`/projects/${projectId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  clear: (projectId: string) =>
    request<void>(`/projects/${projectId}/messages`, { method: 'DELETE' }),
  since: (projectId: string, since: string) =>
    request<Message[]>(`/projects/${projectId}/messages?since=${encodeURIComponent(since)}`),
};

// ─── Runs ───

export interface Run {
  id: string;
  project_id: string;
  status: string;
  error_type: string | null;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  created_at: string;
}

export const runsApi = {
  list: (projectId: string, limit = 20) =>
    request<Run[]>(`/projects/${projectId}/runs?limit=${limit}`),
  current: (projectId: string) =>
    request<Run | { status: 'idle' }>(`/projects/${projectId}/runs/current`),
  stop: (projectId: string) =>
    request<{ status: string }>(`/projects/${projectId}/runs/current/stop`, { method: 'POST' }),
};

// ─── Files ───

export interface FileInfo {
  id: string;
  project_id: string;
  file_path: string;
  size_bytes: number;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

export const filesApi = {
  list: (projectId: string) =>
    request<FileInfo[]>(`/projects/${projectId}/files`),
  view: (projectId: string, fileId: string) =>
    request<{ content: string; path: string }>(`/projects/${projectId}/files/${fileId}/view`),
  open: (projectId: string, fileId: string) =>
    request<{ status: string }>(`/projects/${projectId}/files/${fileId}/open`, { method: 'POST' }),
  delete: (projectId: string, fileId: string) =>
    request<void>(`/projects/${projectId}/files/${fileId}`, { method: 'DELETE' }),
  downloadUrl: (projectId: string, fileId: string) =>
    `${API_BASE}/projects/${projectId}/files/${fileId}/download`,
};

// ─── Settings ───

export const settingsApi = {
  getToken: () => request<{ token: { configured: boolean; source: string } }>('/settings'),
  setToken: (token: string) =>
    request<void>('/settings/token', {
      method: 'PUT',
      body: JSON.stringify({ token }),
    }),
  deleteToken: () =>
    request<void>('/settings/token', { method: 'DELETE' }),
  validateToken: () =>
    request<{ valid: boolean; login?: string; scopes?: string[] }>('/settings/validate-token', { method: 'POST' }),
};

// ─── Skills ───

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  source_url: string | null;
  skill_path: string;
  status: string;
  builtin: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export const skillsApi = {
  listAll: () => request<Skill[]>('/skills'),
  import: (name: string, repo_url: string) =>
    request<Skill>('/skills/import', {
      method: 'POST',
      body: JSON.stringify({ name, repo_url }),
    }),
  delete: (skillId: string) =>
    request<void>(`/skills/${skillId}`, { method: 'DELETE' }),
  listProject: (projectId: string) =>
    request<Skill[]>(`/projects/${projectId}/skills`),
  assign: (projectId: string, skillId: string) =>
    request<{ status: string }>(`/projects/${projectId}/skills/${skillId}`, { method: 'POST' }),
  unassign: (projectId: string, skillId: string) =>
    request<void>(`/projects/${projectId}/skills/${skillId}`, { method: 'DELETE' }),
};

// ─── MCP ───

export interface McpConfig {
  id: string;
  project_id: string;
  name: string;
  type: 'stdio' | 'sse';
  config: Record<string, unknown>;
  enabled: boolean;
  builtin: number;
  preset_id: string | null;
  created_at: string;
}

export const mcpApi = {
  list: (projectId: string) =>
    request<McpConfig[]>(`/projects/${projectId}/mcp`),
  create: (projectId: string, name: string, type: 'stdio' | 'sse', config: Record<string, unknown>) =>
    request<McpConfig>(`/projects/${projectId}/mcp`, {
      method: 'POST',
      body: JSON.stringify({ name, type, config }),
    }),
  update: (projectId: string, configId: string, data: Record<string, unknown>) =>
    request<McpConfig>(`/projects/${projectId}/mcp/${configId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  toggle: (projectId: string, configId: string, enabled: boolean) =>
    request<{ status: string }>(`/projects/${projectId}/mcp/${configId}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),
  delete: (projectId: string, configId: string) =>
    request<void>(`/projects/${projectId}/mcp/${configId}`, { method: 'DELETE' }),
};

// ─── Health ───

export const healthApi = {
  check: () => request<{ status: string }>('/health'),
};
