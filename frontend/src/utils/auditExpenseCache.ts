import type { QueryClient } from '@tanstack/react-query';
import type { ExpenseAuditDecision, ExpenseRecord } from '../types/expenses';
import { expensesQueryKeys } from '../hooks/expenses/expensesQueryKeys';
import {
  applyRecentAuditDecisions,
  reconcileRecentAuditDecisions,
} from './auditExpenseRecentDecisions';

export type AuditExpenseFilters = {
  employeeId: string;
  month: string;
  year: string;
};

export type AuditExpenseCacheEntry = {
  pages: ExpenseRecord[];
  nextCursor: string | null;
};

const cache = new Map<string, AuditExpenseCacheEntry>();

export function buildAuditCacheKey(filters: AuditExpenseFilters): string {
  return `${filters.employeeId}_${filters.month}_${filters.year}`;
}

export function getAuditCacheEntry(key: string): AuditExpenseCacheEntry | undefined {
  return cache.get(key);
}

export function setAuditCacheEntry(key: string, entry: AuditExpenseCacheEntry): void {
  const pages = applyRecentAuditDecisions(entry.pages);
  reconcileRecentAuditDecisions(pages);
  cache.set(key, { ...entry, pages });
}

export function appendAuditCachePage(
  key: string,
  newRows: ExpenseRecord[],
  nextCursor: string | null,
): void {
  const existing = cache.get(key);
  if (!existing) {
    setAuditCacheEntry(key, { pages: newRows, nextCursor });
    return;
  }
  const merged = [...existing.pages, ...newRows];
  const deduped: ExpenseRecord[] = [];
  const seen = new Set<string>();
  for (const row of merged) {
    const id = String(row?.expenseId || '').trim();
    if (!id) {
      deduped.push(row);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push(row);
  }
  setAuditCacheEntry(key, {
    pages: deduped,
    nextCursor,
  });
}

export function clearAuditExpenseCache(): void {
  cache.clear();
}

function patchExpenseRow(
  row: ExpenseRecord,
  expenseId: string,
  decision: Exclude<ExpenseAuditDecision, 'Pending'>,
): ExpenseRecord {
  if (String(row.expenseId || '').trim() !== expenseId) return row;
  return { ...row, auditStatus: decision };
}

/** Immediately update Map + React Query so Approved/Rejected leave the pending UI. */
export function patchAuditExpenseDecisionInCaches(
  queryClient: QueryClient,
  expenseId: string,
  decision: Exclude<ExpenseAuditDecision, 'Pending'>,
): void {
  const id = String(expenseId || '').trim();
  if (!id) return;

  for (const [key, entry] of cache.entries()) {
    cache.set(key, {
      ...entry,
      pages: entry.pages.map((row) => patchExpenseRow(row, id, decision)),
    });
  }

  queryClient.setQueriesData(
    { queryKey: [...expensesQueryKeys.all, 'audit', 'filtered'] },
    (old: AuditExpenseCacheEntry | undefined) => {
      if (!old || !Array.isArray(old.pages)) return old;
      return {
        ...old,
        pages: old.pages.map((row) => patchExpenseRow(row, id, decision)),
      };
    },
  );
}

/** Pending-first, preserving relative newest-first order within each group. */
export function sortAuditExpensesPendingFirst(rows: ExpenseRecord[]): ExpenseRecord[] {
  const pending: ExpenseRecord[] = [];
  const other: ExpenseRecord[] = [];
  for (const row of rows) {
    if ((row.auditStatus ?? 'Pending') === 'Pending') pending.push(row);
    else other.push(row);
  }
  return [...pending, ...other];
}

export function isAuditExpensePending(row: ExpenseRecord | null | undefined): boolean {
  return (row?.auditStatus ?? 'Pending') === 'Pending';
}
