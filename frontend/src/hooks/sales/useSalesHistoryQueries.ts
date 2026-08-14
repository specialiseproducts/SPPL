import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryDefaults } from '../queryDefaults';
import { salesQueryKeys } from './salesQueryKeys';
import {
  createSalesHistoryRecord,
  deleteSalesHistoryRecord,
  fetchSalesHistory,
  updateSalesHistoryRecord,
} from './salesHistoryApi';
import type { SalesHistoryInput, SalesHistoryListParams } from '../../types/salesHistory';

export function useSalesHistoryQuery(params: SalesHistoryListParams, enabled = true) {
  return useQuery({
    queryKey: salesQueryKeys.salesHistory(params as Record<string, string | undefined>),
    queryFn: () => fetchSalesHistory({ ...params, limit: params.limit ?? 100 }),
    enabled,
    ...queryDefaults.list,
    staleTime: 30 * 1000,
  });
}

export function useSalesHistoryMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [...salesQueryKeys.all, 'sales-history'] });
  };

  const create = useMutation({
    mutationFn: (body: SalesHistoryInput) => createSalesHistoryRecord(body),
    onSuccess: () => invalidate(),
  });

  const update = useMutation({
    mutationFn: ({ recordId, body }: { recordId: string; body: Partial<SalesHistoryInput> }) =>
      updateSalesHistoryRecord(recordId, body),
    onSuccess: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: (recordId: string) => deleteSalesHistoryRecord(recordId),
    onSuccess: () => invalidate(),
  });

  return { create, update, remove };
}
