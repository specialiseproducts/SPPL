import { fetchPaginatedList } from '../../utils/paginatedFetch';
import type { PaginatedResponse } from '../paginationTypes';
import type { ExpenseRecord } from '../../types/expenses';
import { normalizeExpenseRow } from '../../utils/expenseRowNormalize';
import type { ExpenseTravelRateSettings } from '../../components/ExpenseRateSettingsModal';
import { parseTravelRatesApiData } from '../../utils/expenseTravelRatesFromApi';
import { apiFetch } from '../../services/api';

export async function fetchExpensesPage(cursor?: string): Promise<PaginatedResponse<ExpenseRecord>> {
  const page = await fetchPaginatedList<Record<string, unknown>>('/api/expenses', cursor);
  return {
    data: page.data.map((row) => normalizeExpenseRow(row)),
    nextCursor: page.nextCursor,
  };
}

/** @deprecated Use fetchExpensesPage + infinite query */
export async function fetchExpensesList(): Promise<ExpenseRecord[]> {
  const all: ExpenseRecord[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchExpensesPage(cursor);
    all.push(...page.data);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

export async function fetchExpenseTravelRates(): Promise<ExpenseTravelRateSettings> {
  const res = (await apiFetch('/api/expenses/settings/travel-rates')) as {
    success?: boolean;
    message?: string;
    data?: unknown;
  };
  if (!res?.success) {
    throw new Error(
      typeof res?.message === 'string' && res.message.trim()
        ? res.message
        : 'Failed to load travel rates',
    );
  }
  const parsed = parseTravelRatesApiData(res.data);
  if (!parsed) {
    throw new Error('Invalid travel rates response from server');
  }
  return parsed;
}
