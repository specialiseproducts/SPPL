import { apiFetch } from '../../services/api';
import type { AuditTrailEntry, AuditTrailListParams } from '../../types/auditTrail';

function toQuery(params: AuditTrailListParams = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function fetchAuditTrail(params: AuditTrailListParams = {}) {
  const payload = (await apiFetch(`/api/audit-trail${toQuery(params)}`)) as {
    data?: AuditTrailEntry[];
    nextCursor?: string;
  };
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    nextCursor: payload?.nextCursor || null,
  };
}

export async function fetchEntityAuditTrail(
  entityType: string,
  entityId: string,
  params: Omit<AuditTrailListParams, 'entityType' | 'entityId'> = {},
) {
  const path = `/api/audit-trail/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`;
  const payload = (await apiFetch(`${path}${toQuery(params)}`)) as {
    data?: AuditTrailEntry[];
    nextCursor?: string;
  };
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    nextCursor: payload?.nextCursor || null,
  };
}
