const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface ApiError {
  error: string;
  status: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const err: ApiError = { error: body.error ?? res.statusText, status: res.status };
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export async function getAuthStatus(): Promise<{ registrationOpen: boolean }> {
  return api.get('/api/auth/status');
}

export async function login(username: string, password: string) {
  return api.post<{ token: string; user: { id: string; username: string } }>('/api/auth/login', { username, password });
}

export async function register(username: string, password: string) {
  return api.post<{ token: string; user: { id: string; username: string } }>('/api/auth/register', { username, password });
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export async function getConversations(): Promise<ConversationSummary[]> {
  return api.get('/api/conversations');
}

export async function createConversation(title?: string): Promise<ConversationSummary> {
  return api.post('/api/conversations', { title });
}

export async function deleteConversation(id: string): Promise<void> {
  return api.delete(`/api/conversations/${id}`);
}

export async function updateConversation(id: string, title: string): Promise<ConversationSummary> {
  return api.patch(`/api/conversations/${id}`, { title });
}

export interface MessageDto {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export async function getMessages(conversationId: string): Promise<MessageDto[]> {
  return api.get(`/api/conversations/${conversationId}/messages`);
}
