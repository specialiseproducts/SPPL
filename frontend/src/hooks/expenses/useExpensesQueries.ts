import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryDefaults } from '../queryDefaults';
import { measureAsync } from '../../lib/observability/performance';
import { fetchExpensesPage, fetchExpenseTravelRates } from './expensesApi';
import { expensesQueryKeys } from './expensesQueryKeys';

export function useExpensesInfiniteQuery() {
  return useInfiniteQuery({
    queryKey: expensesQueryKeys.listInfinite(),
    queryFn: ({ pageParam }) =>
      measureAsync('pagination', 'expenses-page', () =>
        fetchExpensesPage(pageParam as string | undefined),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    ...queryDefaults.list,
  });
}

/** Flattened rows from paginated expense query. */
export function useExpensesListRows() {
  const query = useExpensesInfiniteQuery();
  const expenses = query.data?.pages.flatMap((p) => p.data) ?? [];
  return { ...query, expenses };
}

/** @deprecated Prefer useExpensesInfiniteQuery */
export function useExpensesListQuery() {
  return useExpensesListRows();
}

export function useExpenseTravelRatesQuery(enabled: boolean) {
  return useQuery({
    queryKey: expensesQueryKeys.travelRates(),
    queryFn: fetchExpenseTravelRates,
    enabled,
    ...queryDefaults.reference,
  });
}

export function useInvalidateExpensesList() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: expensesQueryKeys.all });
}

export function useInvalidateExpenseTravelRates() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: expensesQueryKeys.travelRates() });
}
