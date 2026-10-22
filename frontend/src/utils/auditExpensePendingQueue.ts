import type { QueryClient } from '@tanstack/react-query';
import type { ExpenseRecord } from '../types/expenses';
import {
  fetchAuditExpensesFiltered,
  type AuditExpenseFilters,
} from '../hooks/expenses/expensesApi';
import { expensesQueryKeys } from '../hooks/expenses/expensesQueryKeys';
import {
  appendAuditCachePage,
  buildAuditCacheKey,
  getAuditCacheEntry,
  isAuditExpensePending,
  setAuditCacheEntry,
  sortAuditExpensesPendingFirst,
  type AuditExpenseCacheEntry,
} from './auditExpenseCache';
import { applyRecentAuditDecisions } from './auditExpenseRecentDecisions';

function readCachedEntry(
  queryClient: QueryClient,
  filters: AuditExpenseFilters,
): AuditExpenseCacheEntry | null {
  const fromRq = queryClient.getQueryData<AuditExpenseCacheEntry>(
    expensesQueryKeys.auditFiltered(filters),
  );
  if (fromRq && Array.isArray(fromRq.pages)) {
    return {
      pages: applyRecentAuditDecisions(fromRq.pages),
      nextCursor: fromRq.nextCursor ?? null,
    };
  }
  const mapKey = buildAuditCacheKey(filters);
  const fromMap = getAuditCacheEntry(mapKey);
  if (fromMap) {
    return {
      pages: applyRecentAuditDecisions(fromMap.pages),
      nextCursor: fromMap.nextCursor ?? null,
    };
  }
  return null;
}

function writeCachedEntry(
  queryClient: QueryClient,
  filters: AuditExpenseFilters,
  entry: AuditExpenseCacheEntry,
): void {
  const pages = sortAuditExpensesPendingFirst(applyRecentAuditDecisions(entry.pages));
  const next: AuditExpenseCacheEntry = { pages, nextCursor: entry.nextCursor };
  setAuditCacheEntry(buildAuditCacheKey(filters), next);
  queryClient.setQueryData(expensesQueryKeys.auditFiltered(filters), next);
}

/**
 * Resolve the next pending expense in the current Audit Expenses filter scope.
 * Uses loaded pages first; fetches additional cursor pages only when needed.
 */
export async function findNextPendingAuditExpenseId(
  queryClient: QueryClient,
  filters: AuditExpenseFilters,
  currentExpenseId: string,
): Promise<{ nextId: string | null; exhausted: boolean }> {
  const currentId = String(currentExpenseId || '').trim();
  let entry = readCachedEntry(queryClient, filters);

  if (!entry) {
    const page = await fetchAuditExpensesFiltered(filters);
    entry = {
      pages: applyRecentAuditDecisions(page.data),
      nextCursor: page.nextCursor,
    };
    writeCachedEntry(queryClient, filters, entry);
  }

  const pickNext = (pages: ExpenseRecord[]): string | null => {
    const pending = sortAuditExpensesPendingFirst(pages).filter(isAuditExpensePending);
    const afterCurrent = pending.find((row) => String(row.expenseId).trim() !== currentId);
    return afterCurrent ? String(afterCurrent.expenseId).trim() : null;
  };

  let nextId = pickNext(entry.pages);
  if (nextId) return { nextId, exhausted: false };

  let guard = 0;
  while (entry.nextCursor && guard < 50) {
    guard += 1;
    const page = await fetchAuditExpensesFiltered(filters, entry.nextCursor);
    appendAuditCachePage(buildAuditCacheKey(filters), page.data, page.nextCursor);
    const cached = getAuditCacheEntry(buildAuditCacheKey(filters));
    entry = cached ?? {
      pages: [...entry.pages, ...page.data],
      nextCursor: page.nextCursor,
    };
    entry = {
      pages: applyRecentAuditDecisions(entry.pages),
      nextCursor: entry.nextCursor,
    };
    writeCachedEntry(queryClient, filters, entry);
    nextId = pickNext(entry.pages);
    if (nextId) return { nextId, exhausted: false };
  }

  return { nextId: null, exhausted: true };
}
