import { apiFetch } from '../../services/api';
import type { ExpenseRecord } from '../../types/expenses';
import { normalizeExpenseRow } from '../../utils/expenseRowNormalize';
import type { ExpenseTravelRateSettings } from '../../components/ExpenseRateSettingsModal';
import { parseTravelRatesApiData } from '../../utils/expenseTravelRatesFromApi';

export async function fetchExpensesList(): Promise<ExpenseRecord[]> {
  const payload = await apiFetch('/api/expenses');
  if (!payload.success) {
    throw new Error('Failed to fetch expenses');
  }
  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows.map((row: Record<string, unknown>) => normalizeExpenseRow(row));
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
