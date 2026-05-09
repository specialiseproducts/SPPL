import { getToken, removeToken } from './authService';
import { getApiBaseUrl } from '../config/apiBase';

/**
 * Callers use paths like `/api/expenses`. Base URL already ends with `/api`,
 * so the `/api` prefix is stripped to avoid `/api/api/...`.
 */
function resolveApiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith('/api/')) {
    return normalized.slice(4);
  }
  if (normalized === '/api') {
    return '';
  }
  return normalized;
}

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

  const url = `${getApiBaseUrl()}${resolveApiPath(path)}`;

  const response = await fetch(url, {
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

