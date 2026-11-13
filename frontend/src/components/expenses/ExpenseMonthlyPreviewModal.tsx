import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import type { ExpenseRecord } from '../../types/expenses';
import { fetchExpensesForExport } from '../../hooks/expenses/expensesApi';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatDateCell(iso: string | undefined): string {
  if (!iso || String(iso).trim() === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB');
}

function displayCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

function formatAmount(amount: number, currency?: string): string {
  const formatted = Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (currency === 'USD') return `$ ${formatted}`;
  if (currency === 'GBP') return `£ ${formatted}`;
  if (currency === 'EUR') return `€ ${formatted}`;
  return `₹${formatted}`;
}

function sortByDateAscending(rows: ExpenseRecord[]): ExpenseRecord[] {
  return [...rows].sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
    const tb = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
    const safeA = Number.isNaN(ta) ? Number.POSITIVE_INFINITY : ta;
    const safeB = Number.isNaN(tb) ? Number.POSITIVE_INFINITY : tb;
    if (safeA !== safeB) return safeA - safeB;
    return String(a.expenseId || '').localeCompare(String(b.expenseId || ''));
  });
}

interface ExpenseMonthlyPreviewModalProps {
  isOpen: boolean;
  month: string;
  year: string;
  employeeCode: string;
  onClose: () => void;
}

export default function ExpenseMonthlyPreviewModal({
  isOpen,
  month,
  year,
  employeeCode,
  onClose,
}: ExpenseMonthlyPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ExpenseRecord[]>([]);

  const monthLabel = useMemo(() => {
    const idx = Number.parseInt(month, 10) - 1;
    return MONTH_NAMES[idx] || month;
  }, [month]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setRows([]);
      try {
        const data = await fetchExpensesForExport({
          month,
          year,
          employeeCode,
        });
        if (cancelled) return;
        setRows(sortByDateAscending(data));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error && err.message ? err.message : 'Failed to load preview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, month, year, employeeCode]);

  const totalAmount = useMemo(
    () =>
      rows.reduce(
        (sum, expense) =>
          sum + (Number.isFinite(Number(expense.amount)) ? Number(expense.amount) : 0),
        0,
      ),
    [rows],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Expense Preview</DialogTitle>
          <DialogDescription>
            Read-only view of all expenses for {monthLabel} {year}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto min-h-0 flex-1 pr-1">
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm text-gray-600">Total Amount</p>
            <p className="text-lg font-semibold text-[#212529] tabular-nums">
              {loading
                ? '…'
                : `₹${totalAmount.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500 py-8 text-center">Loading expense records…</p>
          ) : error ? (
            <p className="text-sm text-red-600 py-8 text-center">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No expense records found for {monthLabel} {year}.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[960px]">
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="whitespace-nowrap">Sr. #</TableHead>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Expense Head</TableHead>
                      <TableHead className="whitespace-nowrap">Sub Category</TableHead>
                      <TableHead className="whitespace-nowrap">City</TableHead>
                      <TableHead className="whitespace-nowrap">Purpose</TableHead>
                      <TableHead className="whitespace-nowrap">From</TableHead>
                      <TableHead className="whitespace-nowrap">To</TableHead>
                      <TableHead className="whitespace-nowrap">Bill Number</TableHead>
                      <TableHead className="whitespace-nowrap">Company GSTIN</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((expense, index) => (
                      <TableRow
                        key={expense.expenseId || `${expense.date}-${index}`}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <TableCell className="whitespace-nowrap">{index + 1}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateCell(expense.date)}
                        </TableCell>
                        <TableCell>{displayCell(expense.expenseHead)}</TableCell>
                        <TableCell>{displayCell(expense.subCategory)}</TableCell>
                        <TableCell>{displayCell(expense.location)}</TableCell>
                        <TableCell className="max-w-[12rem]">
                          <div className="truncate" title={expense.purpose || undefined}>
                            {displayCell(expense.purpose)}
                          </div>
                        </TableCell>
                        <TableCell>{displayCell(expense.fromLocation)}</TableCell>
                        <TableCell>{displayCell(expense.toLocation)}</TableCell>
                        <TableCell>{displayCell(expense.billNumber)}</TableCell>
                        <TableCell>{displayCell(expense.companyGstIn)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                          {formatAmount(expense.amount, expense.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
