import { getToken, removeToken } from './authService';
import { getApiBaseUrl } from '../config/apiBase';
import { recordPerformance } from '../lib/observability/performance';
import { reportError } from '../lib/observability/errorReporter';

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
  const fetchStart = performance.now();

  const response = await fetch(url, {
    ...rest,
    headers: finalHeaders,
  });

  const durationMs = Math.round(performance.now() - fetchStart);
  recordPerformance({
    type: 'query_fetch',
    name: `${rest.method || 'GET'} ${path}`,
    durationMs,
    meta: { status: response.status },
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  let payload: Record<string, unknown> | null = null;
  let rawText = '';
  if (isJson) {
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = null;
    }
  } else {
    try {
      rawText = await response.text();
    } catch {
      rawText = '';
    }
  }

  if (response.status === 401) {
    removeToken();
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  if (!response.ok) {
    const fromPayload =
      (typeof payload?.message === 'string' && payload.message.trim()) ||
      (typeof payload?.error === 'string' && payload.error.trim()) ||
      (Array.isArray(payload?.errors) && payload.errors.map(String).join('; ')) ||
      '';
    const fromText = rawText && rawText.length < 500 ? rawText.trim() : '';
    const message =
      fromPayload ||
      fromText ||
      `Request failed (${response.status})`;
    const error = new Error(message);
    (error as { status?: number; payload?: unknown }).status = response.status;
    (error as { status?: number; payload?: unknown }).payload = payload;
    reportError(error, {
      source: 'api',
      path,
      status: response.status,
    });
    throw error;
  }

  return payload;
}

