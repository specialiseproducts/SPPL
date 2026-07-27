import type { ExpenseRecord } from '../types/expenses';

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
  cache.set(key, entry);
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
