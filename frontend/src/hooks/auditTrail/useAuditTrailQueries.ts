import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { queryDefaults } from '../queryDefaults';
import { fetchAuditTrail, fetchEntityAuditTrail } from './auditTrailApi';
import type { AuditTrailListParams } from '../../types/auditTrail';

export const auditTrailQueryKeys = {
  all: ['audit-trail'] as const,
  list: (params: AuditTrailListParams) => [...auditTrailQueryKeys.all, 'list', params] as const,
  entity: (entityType: string, entityId: string) =>
    [...auditTrailQueryKeys.all, 'entity', entityType, entityId] as const,
};

export function useAuditTrailQuery(params: AuditTrailListParams, enabled = true) {
  return useQuery({
    queryKey: auditTrailQueryKeys.list(params),
    queryFn: () => fetchAuditTrail({ ...params, limit: params.limit ?? 50 }),
    enabled,
    ...queryDefaults.list,
    staleTime: 20 * 1000,
  });
}

export function useEntityAuditTrailInfinite(
  entityType: string,
  entityId: string,
  enabled = true,
  module?: string,
) {
  return useInfiniteQuery({
    queryKey: [...auditTrailQueryKeys.entity(entityType, entityId), module || ''] as const,
    queryFn: ({ pageParam }) =>
      fetchEntityAuditTrail(entityType, entityId, {
        module,
        limit: 40,
        cursor: pageParam || undefined,
        sort: 'newest',
      }),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor || undefined,
    enabled: enabled && Boolean(entityType && entityId),
    ...queryDefaults.list,
    staleTime: 15 * 1000,
  });
}
