/**
 * Frontend performance marks + optional backend flush (batched).
 */

import { getApiBaseUrl } from '../../config/apiBase';
import { getToken } from '../../services/authService';

export type PerformanceEventType =
  | 'module_render'
  | 'sales_bootstrap'
  | 'query_fetch'
  | 'pagination'
  | 'virtual_scroll'
  | 'cache_hit';

export interface PerformanceEvent {
  type: PerformanceEventType;
  name: string;
  durationMs: number;
  meta?: Record<string, unknown>;
  at?: string;
}

const buffer: PerformanceEvent[] = [];
const MAX_BUFFER = 40;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function recordPerformance(event: Omit<PerformanceEvent, 'at'>) {
  const entry: PerformanceEvent = { ...event, at: new Date().toISOString() };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  if (import.meta.env.DEV) {
    console.debug(`[perf] ${entry.type}:${entry.name} ${entry.durationMs}ms`, entry.meta || '');
  }

  scheduleFlush();
}

export function measureSync<T>(type: PerformanceEventType, name: string, fn: () => T, meta?: Record<string, unknown>): T {
  const start = performance.now();
  try {
    return fn();
  } finally {
    recordPerformance({ type, name, durationMs: Math.round(performance.now() - start), meta });
  }
}

export async function measureAsync<T>(
  type: PerformanceEventType,
  name: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>,
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    recordPerformance({ type, name, durationMs: Math.round(performance.now() - start), meta });
  }
}

function scheduleFlush() {
  if (!import.meta.env.PROD) return;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPerformanceEvents();
  }, 8000);
}

export async function flushPerformanceEvents() {
  if (!buffer.length) return;
  const token = getToken();
  if (!token) return;

  const events = buffer.splice(0, buffer.length);
  try {
    await fetch(`${getApiBaseUrl()}/metrics/frontend-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events }),
    });
  } catch {
    buffer.unshift(...events);
  }
}

/** React Query cache observer helper */
export function recordQueryTiming(queryKey: unknown[], durationMs: number, fromCache: boolean) {
  recordPerformance({
    type: fromCache ? 'cache_hit' : 'query_fetch',
    name: JSON.stringify(queryKey.slice(0, 3)),
    durationMs,
    meta: { fromCache },
  });
}
