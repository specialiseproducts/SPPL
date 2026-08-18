import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryDefaults } from '../queryDefaults';
import { salesQueryKeys } from './salesQueryKeys';
import {
  createSalesHistoryRecord,
  deleteSalesHistoryRecord,
  fetchSalesHistory,
  updateSalesHistoryRecord,
} from './salesHistoryApi';
import type {
  SalesHistoryInput,
  SalesHistoryListParams,
  SalesHistoryRecord,
} from '../../types/salesHistory';

type SalesHistoryListCache = {
  data: SalesHistoryRecord[];
  nextCursor: string | null;
};

const salesHistoryQueryKey = [...salesQueryKeys.all, 'sales-history'] as const;

export function useSalesHistoryQuery(params: SalesHistoryListParams, enabled = true) {
  return useQuery({
    queryKey: salesQueryKeys.salesHistory(params as Record<string, string | undefined>),
    queryFn: () => fetchSalesHistory(params),
    enabled,
    ...queryDefaults.list,
    staleTime: 30 * 1000,
  });
}

export function useSalesHistoryMutations() {
  const queryClient = useQueryClient();
  const refreshList = async () => {
    await queryClient.invalidateQueries({ queryKey: salesHistoryQueryKey });
    await queryClient.refetchQueries({ queryKey: salesHistoryQueryKey, type: 'all' });
  };

  const replaceRowInCache = (updated: SalesHistoryRecord) => {
    queryClient.setQueriesData(
      { queryKey: salesHistoryQueryKey },
      (old: SalesHistoryListCache | undefined) => {
        if (!old || !Array.isArray(old.data) || !updated?.recordId) return old;
        return {
          ...old,
          data: old.data.map((row) =>
            row.recordId === updated.recordId ? { ...row, ...updated } : row,
          ),
        };
      },
    );
  };

  const create = useMutation({
    mutationFn: (body: SalesHistoryInput) => createSalesHistoryRecord(body),
    onSuccess: () => refreshList(),
  });

  const update = useMutation({
    mutationFn: ({ recordId, body }: { recordId: string; body: Partial<SalesHistoryInput> }) =>
      updateSalesHistoryRecord(recordId, body),
    onSuccess: async (updated) => {
      await refreshList();
      replaceRowInCache(updated);
    },
  });

  const remove = useMutation({
    mutationFn: (recordId: string) => deleteSalesHistoryRecord(recordId),
    onSuccess: () => refreshList(),
  });

  return { create, update, remove };
}
