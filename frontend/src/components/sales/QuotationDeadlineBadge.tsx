import { AlertTriangle } from 'lucide-react';
import type { DeadlineStatusResult } from '../../utils/salesDeadlineStatus';
import { cn } from '../ui/utils';

interface QuotationDeadlineBadgeProps {
  deadline: DeadlineStatusResult;
  className?: string;
}

export default function QuotationDeadlineBadge({ deadline, className }: QuotationDeadlineBadgeProps) {
  if (deadline.status === 'NONE') {
    return <span className={cn('text-sm text-gray-400', className)}>—</span>;
  }

  const title =
    deadline.activeDeadline && deadline.status !== 'CLOSED'
      ? `Active deadline: ${deadline.activeDeadline}`
      : deadline.status === 'CLOSED'
        ? 'Quotation finalized'
        : undefined;

  const warningIconClass =
    deadline.badgeVariant === 'due_today'
      ? 'text-yellow-600'
      : deadline.badgeVariant === 'overdue'
        ? 'text-red-700'
        : 'text-current opacity-90';

  return (
    <span className={cn(deadline.badgeClassName, className)} title={title}>
      {deadline.showWarningIcon ? (
        <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0', warningIconClass)} aria-hidden />
      ) : null}
      <span>{deadline.label}</span>
    </span>
  );
}
