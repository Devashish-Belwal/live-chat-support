import { User, Conversation, Analytics, AdminAgent, SupervisorAgent } from './types';
export type { SupervisorAgent } from './types';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
let accessToken: string | null = null;
export function setAccessToken(token: string | null) { accessToken = token; }
export function getAccessToken() { return accessToken; }

let refreshPromise: Promise<{ accessToken: string }> | null = null;

function performRefresh(): Promise<{ accessToken: string }> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (r) => {
      if (!r.ok) throw new Error('Refresh failed');
      return r.json();
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}
async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${url}`, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...opts?.headers,
    },
  });
  if (res.status === 401) {
    try {
      const refreshData = await performRefresh();
      accessToken = refreshData.accessToken;
      // retry original
      const retry = await fetch(`${API_URL}${url}`, {
        ...opts,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...opts?.headers,
        },
      });
      const retryBody = await retry.json().catch(() => ({}));
      if (!retry.ok) throw new Error(retryBody.error || `HTTP ${retry.status}`);
      return retryBody as T;
    } catch {
      accessToken = null;
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      return body as T;
    }
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body as T;
}
export const api = {
  me: () => req<{ user: User }>('/auth/me'),
  login: (email: string, password: string) => req<{ accessToken: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: (email: string, password: string, name: string) => req<{ accessToken: string; user: User }>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  refresh: () => performRefresh().then((data) => { setAccessToken(data.accessToken); return data; }),
  logout: () => fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }),
  getConversations: () => req<{ conversations: Conversation[] }>('/conversations').then(r => r.conversations),
  getConversation: (id: string) => req<{ conversation: Conversation }>(`/conversations/${id}`).then(r => r.conversation),
  createConversation: () => req<{ conversation: Conversation }>('/conversations', { method: 'POST', body: JSON.stringify({}) }).then(r => r.conversation),
  getAnalytics: () => req<Analytics>('/admin/analytics'),
  assignConversation: (conversationId: number, agentId: number) => req<{ conversation: Conversation }>(`/conversations/${conversationId}/assign`, { method: 'POST', body: JSON.stringify({ agentId }) }).then(r => r.conversation),
  assignAgentToSupervisor: (agentId: number, supervisorId: number | null) => req<{ agent: AdminAgent }>(`/admin/agents/${agentId}/supervisor`, { method: 'PATCH', body: JSON.stringify({ supervisorId }) }),
  getSupervisorAgents: () => req<{ agents: SupervisorAgent[] }>(`/supervisor/agents`).then(r => r.agents),
};
