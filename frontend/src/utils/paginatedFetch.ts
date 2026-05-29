import { apiFetch } from '../services/api';
import type { PaginatedResponse } from '../hooks/paginationTypes';
import { DEFAULT_PAGE_SIZE } from '../hooks/paginationTypes';

export function buildListQuery(limit = DEFAULT_PAGE_SIZE, cursor?: string): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

export async function fetchPaginatedList<T>(
  path: string,
  cursor?: string,
  limit = DEFAULT_PAGE_SIZE,
): Promise<PaginatedResponse<T>> {
  const qs = buildListQuery(limit, cursor);
  const payload = await apiFetch(`${path}?${qs}`);
  if (!payload?.success) {
    throw new Error(`Failed to fetch ${path}`);
  }
  if (payload.data && typeof payload.data === 'object' && Array.isArray(payload.data.data)) {
    return {
      data: payload.data.data as T[],
      nextCursor: payload.data.nextCursor ?? payload.nextCursor ?? null,
    };
  }
  const data = Array.isArray(payload.data) ? (payload.data as T[]) : [];
  return {
    data,
    nextCursor: (payload.nextCursor as string | null | undefined) ?? null,
  };
}
