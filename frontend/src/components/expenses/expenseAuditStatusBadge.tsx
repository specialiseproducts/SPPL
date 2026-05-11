import { cn } from '../ui/utils';

export type ExpenseAuditStatusKind = 'Pending' | 'Checked' | 'Verified' | 'Approved' | 'Rejected';

const styles: Record<ExpenseAuditStatusKind, string> = {
  Pending: 'bg-amber-50 text-amber-900 border-amber-200',
  Checked: 'bg-sky-50 text-sky-900 border-sky-200',
  Verified: 'bg-violet-50 text-violet-900 border-violet-200',
  Approved: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  Rejected: 'bg-red-50 text-red-900 border-red-200',
};

export function ExpenseAuditStatusBadge({
  label,
  className,
}: {
  label: ExpenseAuditStatusKind;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        styles[label],
        className
      )}
    >
      {label}
    </span>
  );
}
