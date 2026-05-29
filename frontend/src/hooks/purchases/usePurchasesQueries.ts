import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { queryDefaults } from '../queryDefaults';
import { fetchPurchasesPage } from './purchasesApi';
import { purchasesQueryKeys } from './purchasesQueryKeys';

export function usePurchasesInfiniteQuery() {
  return useInfiniteQuery({
    queryKey: purchasesQueryKeys.listInfinite(),
    queryFn: ({ pageParam }) => fetchPurchasesPage(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    ...queryDefaults.list,
  });
}

export function usePurchasesListQuery() {
  const query = usePurchasesInfiniteQuery();
  const purchases = query.data?.pages.flatMap((p) => p.data) ?? [];
  return { ...query, data: purchases };
}

export function useInvalidatePurchasesList() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.all });
}
