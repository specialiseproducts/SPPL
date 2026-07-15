import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { ExpenseRecord } from '../../types/expenses';

export const EXPENSE_DETAILS_DIALOG_CLASS =
  '!flex !h-[90vh] !max-h-[90vh] !w-[90vw] !max-w-[1600px] !flex-col gap-0 overflow-hidden !p-0 sm:!max-w-[1600px]';

export const EXPENSE_DETAILS_DIALOG_STYLE = {
  width: '90vw',
  height: '90vh',
  maxWidth: '1600px',
  maxHeight: '90vh',
} as const;

function disp(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function ExpenseReadField({ label, value }: { label: string; value: unknown }) {
  const s = disp(value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input readOnly tabIndex={-1} className="bg-muted text-sm" value={s || '—'} />
    </div>
  );
}

export function ExpenseDetailsViewFields({ expense }: { expense: ExpenseRecord }) {
  return (
    <>
      <ExpenseReadField label="Employee Name" value={expense.employeeName} />
      <ExpenseReadField label="Date" value={expense.date} />
      <ExpenseReadField label="Bill Number" value={expense.billNumber} />
      <ExpenseReadField label="Amount" value={expense.amount} />
      <ExpenseReadField label="Supporting Doc." value={expense.supportingDocument} />
      <ExpenseReadField label="Month-Year" value={expense.monthYear} />
    </>
  );
}
