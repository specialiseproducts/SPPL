import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryDefaults } from '../queryDefaults';
import { measureAsync } from '../../lib/observability/performance';
import type { ExpenseRecord } from '../../types/expenses';
import {
  fetchAuditApprovedTotal,
  fetchAuditEmployeeDirectory,
  fetchAuditExpensesFiltered,
  fetchCompanyOverview,
  fetchDashboardEmployees,
  fetchExpenseHeadAnalysis,
  fetchExpenseLocationMasters,
  fetchExpenseServiceProviderMasters,
  fetchExpenseSubcategoryAnalysis,
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
  currentPages: ExpenseRecord[] = [],
) {
  const cacheKey = buildAuditCacheKey(filters);
  const existing = getAuditCacheEntry(cacheKey);
  if (!existing && currentPages.length > 0) {
    setAuditCacheEntry(cacheKey, { pages: currentPages, nextCursor: cursor });
  }
  const page = await fetchAuditExpensesFiltered(filters, cursor);
  appendAuditCachePage(cacheKey, page.data, page.nextCursor);
  const cached = getAuditCacheEntry(cacheKey);
  if (!cached) {
    return { pages: [...currentPages, ...page.data], nextCursor: page.nextCursor };
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

export function useAuditApprovedTotalQuery(
  filters: AuditExpenseFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: expensesQueryKeys.auditApprovedTotal(filters),
    queryFn: () => fetchAuditApprovedTotal(filters),
    enabled,
    ...queryDefaults.list,
  });
}

export function useExpenseServiceProviderMastersQuery(enabled = true) {
  return useQuery({
    queryKey: expensesQueryKeys.serviceProviderMasters(),
    queryFn: fetchExpenseServiceProviderMasters,
    enabled,
    ...queryDefaults.reference,
  });
}

export function useExpenseLocationMastersQuery(enabled = true) {
  return useQuery({
    queryKey: expensesQueryKeys.locationMasters(),
    queryFn: fetchExpenseLocationMasters,
    enabled,
    ...queryDefaults.reference,
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

/** Super Admin — Company Overview analytics for a selected From/To month range. */
export function useCompanyOverviewQuery(
  range: { from: string; to: string; employeeCode?: string; location?: string } | null,
  enabled = true,
) {
  const from = range?.from ?? '';
  const to = range?.to ?? '';
  const employeeCode = String(range?.employeeCode ?? '').trim();
  const location = String(range?.location ?? '').trim();
  return useQuery({
    queryKey: expensesQueryKeys.companyOverview({ from, to, employeeCode, location }),
    queryFn: () =>
      measureAsync('pagination', 'expenses-company-overview', () =>
        fetchCompanyOverview({
          from,
          to,
          employeeCode: employeeCode || undefined,
          location: location || undefined,
        }),
      ),
    enabled: enabled && Boolean(from && to),
    ...queryDefaults.list,
  });
}

/** Super Admin — Phase 2D employees with non-deleted expense records. */
export function useDashboardEmployeesQuery(enabled = true) {
  return useQuery({
    queryKey: expensesQueryKeys.dashboardEmployees(),
    queryFn: () =>
      measureAsync('pagination', 'expenses-dashboard-employees', () =>
        fetchDashboardEmployees(),
      ),
    enabled,
    ...queryDefaults.reference,
  });
}

/** Super Admin — Phase 2B Month + Expense Head analytics. */
export function useExpenseHeadAnalysisQuery(
  params: {
    from: string;
    to: string;
    expenseHead: string;
    employeeCode?: string;
    location?: string;
  } | null,
  enabled = true,
) {
  const from = params?.from ?? '';
  const to = params?.to ?? '';
  const expenseHead = params?.expenseHead ?? '';
  const employeeCode = String(params?.employeeCode ?? '').trim();
  const location = String(params?.location ?? '').trim();
  return useQuery({
    queryKey: expensesQueryKeys.expenseHeadAnalysis({
      from,
      to,
      expenseHead,
      employeeCode,
      location,
    }),
    queryFn: () =>
      measureAsync('pagination', 'expenses-expense-head-analysis', () =>
        fetchExpenseHeadAnalysis({
          from,
          to,
          expenseHead,
          employeeCode: employeeCode || undefined,
          location: location || undefined,
        }),
      ),
    enabled: enabled && Boolean(from && to && expenseHead),
    ...queryDefaults.list,
  });
}

/** Super Admin — Phase 2C Month + Expense Head + Subcategory transactions. */
export function useExpenseSubcategoryAnalysisQuery(
  params: {
    from: string;
    to: string;
    expenseHead: string;
    subCategory: string;
    employeeCode?: string;
    location?: string;
  } | null,
  enabled = true,
) {
  const from = params?.from ?? '';
  const to = params?.to ?? '';
  const expenseHead = params?.expenseHead ?? '';
  const subCategory = params?.subCategory ?? '';
  const employeeCode = String(params?.employeeCode ?? '').trim();
  const location = String(params?.location ?? '').trim();
  return useQuery({
    queryKey: expensesQueryKeys.expenseSubcategoryAnalysis({
      from,
      to,
      expenseHead,
      subCategory,
      employeeCode,
      location,
    }),
    queryFn: () =>
      measureAsync('pagination', 'expenses-expense-subcategory-analysis', () =>
        fetchExpenseSubcategoryAnalysis({
          from,
          to,
          expenseHead,
          subCategory,
          employeeCode: employeeCode || undefined,
          location: location || undefined,
        }),
      ),
    enabled: enabled && Boolean(from && to && expenseHead && subCategory),
    ...queryDefaults.list,
  });
}

export function useInvalidateExpensesList() {
  const queryClient = useQueryClient();
  return () => {
    clearAuditExpenseCache();
    void queryClient.invalidateQueries({ queryKey: expensesQueryKeys.all });
    void queryClient.refetchQueries({ queryKey: expensesQueryKeys.all, type: 'all' });
  };
}

export function useInvalidateExpenseTravelRates() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: expensesQueryKeys.travelRates() });
    void queryClient.refetchQueries({ queryKey: expensesQueryKeys.travelRates(), type: 'all' });
  };
}
