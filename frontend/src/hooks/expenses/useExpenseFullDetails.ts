import { useEffect, useState } from 'react';
import type { ExpenseDocument, ExpenseRecord } from '../../types/expenses';
import { fetchExpenseFullDetails } from './expensesApi';

export function useExpenseFullDetails(
  expense: ExpenseRecord | null,
  enabled: boolean,
): {
  detailExpense: ExpenseRecord | null;
  documents: ExpenseDocument[];
  loading: boolean;
} {
  const [detailExpense, setDetailExpense] = useState<ExpenseRecord | null>(null);
  const [documents, setDocuments] = useState<ExpenseDocument[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !expense) {
      setDetailExpense(null);
      setDocuments([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setDetailExpense(null);
      setDocuments([]);

      try {
        const { expense: full, documents: docs } = await fetchExpenseFullDetails(expense.expenseId);
        if (!cancelled) {
          setDetailExpense(full);
          setDocuments(docs);
        }
      } catch (loadErr) {
        console.error('Expense full details load failed:', loadErr);
        if (!cancelled) {
          setDetailExpense(expense);
          setDocuments(expense.documents ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, expense]);

  return { detailExpense, documents, loading };
}
