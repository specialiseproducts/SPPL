import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import type { ExpenseRecord } from '../types/expenses';

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

function formatMonthLabel(monthYear: string): string {
  const [mm, yyyy] = String(monthYear || '').split('-');
  const monthIndex = Number.parseInt(mm, 10) - 1;
  const name = MONTH_NAMES[monthIndex] || mm || '—';
  return yyyy ? `${name} ${yyyy}` : name;
}

function formatAmount(amount: number): string {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

interface PendingPreviousExpensesModalProps {
  isOpen: boolean;
  expenses: ExpenseRecord[];
  isSubmitting?: boolean;
  onIncludeSelected: (selected: ExpenseRecord[]) => void | Promise<void>;
  onSkipSelected: (selected: ExpenseRecord[]) => void | Promise<void>;
  onCancel: () => void;
}

export default function PendingPreviousExpensesModal({
  isOpen,
  expenses,
  isSubmitting = false,
  onIncludeSelected,
  onSkipSelected,
  onCancel,
}: PendingPreviousExpensesModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(new Set(expenses.map((e) => e.expenseId).filter(Boolean)));
  }, [isOpen, expenses]);

  const totalPendingAmount = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) =>
          sum + (Number.isFinite(Number(expense.amount)) ? Number(expense.amount) : 0),
        0,
      ),
    [expenses],
  );

  const selectedExpenses = useMemo(
    () => expenses.filter((e) => selectedIds.has(e.expenseId)),
    [expenses, selectedIds],
  );

  const selectedAmount = useMemo(
    () =>
      selectedExpenses.reduce(
        (sum, expense) =>
          sum + (Number.isFinite(Number(expense.amount)) ? Number(expense.amount) : 0),
        0,
      ),
    [selectedExpenses],
  );

  const allSelected = expenses.length > 0 && selectedIds.size === expenses.length;

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(expenses.map((e) => e.expenseId).filter(Boolean)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleOne = (expenseId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(expenseId);
      else next.delete(expenseId);
      return next;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onCancel()}>
      {/*
        Override DialogContent default sm:max-w-lg so the table has room.
        Modal shell stays fixed; only the table body scrolls.
      */}
      <DialogContent
        className="flex w-[min(100%-1.5rem,960px)] max-h-[min(90vh,720px)] min-h-0 max-w-[960px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[960px]"
      >
        <DialogHeader className="shrink-0 space-y-2 px-6 pt-6 pb-4 pr-12 text-left sm:text-left">
          <DialogTitle>Pending Previous Expenses</DialogTitle>
          <DialogDescription className="leading-relaxed">
            You have {expenses.length} approved expense{expenses.length === 1 ? '' : 's'} from
            previous months that have never been exported.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-2">
          <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border px-4 py-3">
              <div className="text-sm text-muted-foreground">Total Pending Amount</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {formatAmount(totalPendingAmount)}
              </div>
            </div>
            <div className="rounded-md border px-4 py-3">
              <div className="text-sm text-muted-foreground">Selected</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {selectedExpenses.length}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  · {formatAmount(selectedAmount)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => toggleAll(v === true)}
                disabled={isSubmitting || expenses.length === 0}
              />
              Select All
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border">
            <Table className="table-fixed w-full min-w-[720px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-14 whitespace-nowrap px-3">Include</TableHead>
                  <TableHead className="w-[120px] whitespace-nowrap px-3">Expense Date</TableHead>
                  <TableHead className="w-[140px] whitespace-nowrap px-3">Expense Head</TableHead>
                  <TableHead className="min-w-[180px] px-3">Purpose</TableHead>
                  <TableHead className="w-[120px] whitespace-nowrap px-3 text-right">
                    Amount
                  </TableHead>
                  <TableHead className="w-[140px] whitespace-nowrap px-3">Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.expenseId}>
                    <TableCell className="w-14 px-3">
                      <Checkbox
                        checked={selectedIds.has(expense.expenseId)}
                        onCheckedChange={(v) => toggleOne(expense.expenseId, v === true)}
                        disabled={isSubmitting}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3">
                      {formatDateCell(expense.date)}
                    </TableCell>
                    <TableCell className="px-3">
                      <span className="block truncate" title={expense.expenseHead || undefined}>
                        {expense.expenseHead || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3">
                      <span className="block truncate" title={expense.purpose || undefined}>
                        {expense.purpose || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 text-right tabular-nums">
                      {formatAmount(expense.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3">
                      {formatMonthLabel(expense.monthYear)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-3 border-t bg-background px-6 py-4 sm:justify-end sm:gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="warning"
            disabled={isSubmitting || selectedExpenses.length === 0}
            onClick={() => void onSkipSelected(selectedExpenses)}
          >
            Skip Selected
          </Button>
          <Button
            type="button"
            className="bg-[#007BFF] hover:bg-[#0056b3]"
            disabled={isSubmitting || selectedExpenses.length === 0}
            onClick={() => void onIncludeSelected(selectedExpenses)}
          >
            Include Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
