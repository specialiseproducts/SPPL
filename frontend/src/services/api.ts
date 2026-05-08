import { getToken, removeToken } from './authService';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

type ApiOptions = RequestInit & {
  skipAuth?: boolean;
};

export async function apiFetch(path: string, options: ApiOptions = {}) {
  const { skipAuth, headers, ...rest } = options;
  const token = getToken();
  const finalHeaders = new Headers(headers || {});

  if (!skipAuth && token && !finalHeaders.has('Authorization')) {
    finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (response.status === 401) {
    removeToken();
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  if (!response.ok) {
    const message = payload?.message || 'Request failed';
    const error = new Error(message);
    (error as any).status = response.status;
    (error as any).payload = payload;
    throw error;
  }

  return payload;
}

