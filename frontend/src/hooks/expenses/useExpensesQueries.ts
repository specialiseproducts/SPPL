import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryDefaults } from '../queryDefaults';
import { measureAsync } from '../../lib/observability/performance';
import {
  fetchAuditEmployeeDirectory,
  fetchAuditExpensesFiltered,
  fetchExpensesPage,
  fetchExpenseTravelRates,
  type AuditExpenseFilters,
} from './expensesApi';
import {
  appendAuditCachePage,
  buildAuditCacheKey,
  clearAuditExpenseCache,
  getAuditCacheEntry,
  setAuditCacheEntry,
} from '../../utils/auditExpenseCache';
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

const ALL_AUDIT_FILTERS: AuditExpenseFilters = {
  employeeId: 'all',
  month: 'all',
  year: 'all',
};

export function useAuditExpensesInfiniteQuery() {
  return useInfiniteQuery({
    queryKey: expensesQueryKeys.auditListInfinite(),
    queryFn: ({ pageParam }) =>
      measureAsync('pagination', 'expenses-audit-page', () =>
        fetchAuditExpensesFiltered(ALL_AUDIT_FILTERS, pageParam as string | undefined),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    ...queryDefaults.list,
  });
}

export function useAuditExpensesListRows() {
  const query = useAuditExpensesInfiniteQuery();
  const expenses = query.data?.pages.flatMap((p) => p.data) ?? [];
  return { ...query, expenses };
}

/** Filter-driven audit fetch — enabled only after user selects filters. */
export function useAuditExpensesFilteredQuery(
  filters: AuditExpenseFilters,
  enabled: boolean,
) {
  return useQuery({
    queryKey: expensesQueryKeys.auditFiltered(filters),
    enabled,
    queryFn: () =>
      measureAsync('pagination', 'expenses-audit-filtered', async () => {
        const cacheKey = buildAuditCacheKey(filters);
        const cached = getAuditCacheEntry(cacheKey);
        if (cached) {
          return cached;
        }

        // Always fetch a single page. Further pages load via "Load more expenses"
        // (fetchNextAuditFilteredPage). Eagerly draining every cursor for large
        // employees blocked the table for minutes/hours.
        const page = await fetchAuditExpensesFiltered(filters);
        const entry = { pages: page.data, nextCursor: page.nextCursor };
        setAuditCacheEntry(cacheKey, entry);
        return entry;
      }),
    ...queryDefaults.list,
  });
}

export async function fetchNextAuditFilteredPage(
  filters: AuditExpenseFilters,
  cursor: string,
) {
  const cacheKey = buildAuditCacheKey(filters);
  const page = await fetchAuditExpensesFiltered(filters, cursor);
  appendAuditCachePage(cacheKey, page.data, page.nextCursor);
  const cached = getAuditCacheEntry(cacheKey);
  if (!cached) {
    return { pages: page.data, nextCursor: page.nextCursor };
  }
  return cached;
}

/** @deprecated Prefer useExpensesInfiniteQuery */
export function useExpensesListQuery() {
  return useExpensesListRows();
}

/** Employee directory for Audit Expenses filter — uses expenses module auth, not User Management. */
export function useAuditExpenseEmployeesQuery() {
  return useQuery({
    queryKey: expensesQueryKeys.auditEmployees(),
    queryFn: fetchAuditEmployeeDirectory,
    ...queryDefaults.employees,
  });
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
  return () => {
    clearAuditExpenseCache();
    void queryClient.invalidateQueries({ queryKey: expensesQueryKeys.all });
  };
}

export function useInvalidateExpenseTravelRates() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: expensesQueryKeys.travelRates() });
}
