import { apiFetch } from '../../services/api';
import type {
  SalesHistoryInput,
  SalesHistoryListParams,
  SalesHistoryRecord,
} from '../../types/salesHistory';

function toQuery(params: SalesHistoryListParams = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || String(v).trim() === '') continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function fetchSalesHistory(params: SalesHistoryListParams = {}) {
  const res = (await apiFetch(`/api/sales-forecasts/sales-history${toQuery(params)}`)) as {
    data?: SalesHistoryRecord[];
    nextCursor?: string;
  };
  return {
    data: Array.isArray(res?.data) ? res.data : [],
    nextCursor: res?.nextCursor || null,
  };
}

export async function createSalesHistoryRecord(body: SalesHistoryInput) {
  const res = (await apiFetch('/api/sales-forecasts/sales-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })) as { success?: boolean; data?: SalesHistoryRecord; message?: string };
  if (!res?.success || !res.data) throw new Error(res?.message || 'Failed to save record');
  return res.data;
}

export async function updateSalesHistoryRecord(recordId: string, body: Partial<SalesHistoryInput>) {
  const res = (await apiFetch(`/api/sales-forecasts/sales-history/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })) as { success?: boolean; data?: SalesHistoryRecord; message?: string };
  if (!res?.success || !res.data) throw new Error(res?.message || 'Failed to update record');
  return res.data;
}

export async function deleteSalesHistoryRecord(recordId: string) {
  await apiFetch(`/api/sales-forecasts/sales-history/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
  });
}
