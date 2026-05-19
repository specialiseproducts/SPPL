import type { SalesOpportunity } from '../types/salesForecast';
import { isQuotationLocked } from './salesForecastCalculations';

export type DeadlineStatusKind = 'NONE' | 'CLOSED' | 'ON_TRACK' | 'DUE_TODAY' | 'OVERDUE';

export type DeadlineBadgeVariant = 'none' | 'closed' | 'on_track' | 'due_today' | 'overdue';

export interface DeadlineStatusResult {
  status: DeadlineStatusKind;
  label: string;
  overdueDays: number | null;
  activeDeadline: string | null;
  rowClassName: string;
  stickyCellClassName: string;
  badgeClassName: string;
  badgeVariant: DeadlineBadgeVariant;
  showWarningIcon: boolean;
}

type DeadlineQuotation = Pick<
  SalesOpportunity,
  'workflowStatus' | 'quotationRef' | 'decisionExpectedBy' | 'nextActionDate'
>;

const BADGE_BASE = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium';

const EMPTY_RESULT: DeadlineStatusResult = {
  status: 'NONE',
  label: '—',
  overdueDays: null,
  activeDeadline: null,
  rowClassName: '',
  stickyCellClassName: 'bg-white group-hover:bg-gray-50/90',
  badgeClassName: '',
  badgeVariant: 'none',
  showWarningIcon: false,
};

/** Local calendar date at midnight (no time component). */
export function parseDateOnly(value: string | null | undefined): Date | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const iso = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const parsed = new Date(year, month, day);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) {
      return null;
    }
    return parsed;
  }

  const fallback = new Date(raw);
  if (Number.isNaN(fallback.getTime())) return null;
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

export function todayDateOnly(reference: Date = new Date()): Date {
  return new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
}

/** Calendar days from `from` to `to` (positive when `to` is after `from`). */
export function calendarDayDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function formatOverdueLabel(days: number): string {
  return days === 1 ? 'Overdue by 1 day' : `Overdue by ${days} days`;
}

function isTrackingDisabled(quotation: DeadlineQuotation): boolean {
  if (quotation.workflowStatus === 'approved') return true;
  return isQuotationLocked(quotation);
}

/**
 * Computes deadline tracking for open quotations.
 * Active deadline: nextActionDate if set, otherwise decisionExpectedBy.
 */
export function getDeadlineStatus(
  quotation: DeadlineQuotation,
  asOf: Date = todayDateOnly(),
): DeadlineStatusResult {
  if (isTrackingDisabled(quotation)) {
    return {
      status: 'CLOSED',
      label: 'Closed',
      overdueDays: null,
      activeDeadline: null,
      rowClassName: '',
      stickyCellClassName: 'bg-white group-hover:bg-gray-50/90',
      badgeClassName: `${BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-800`,
      badgeVariant: 'closed',
      showWarningIcon: false,
    };
  }

  const nextAction = parseDateOnly(quotation.nextActionDate);
  const decisionExpected = parseDateOnly(quotation.decisionExpectedBy);
  const activeDate = nextAction ?? decisionExpected;
  const activeDeadline =
    (nextAction ? String(quotation.nextActionDate || '').trim() : '') ||
    (decisionExpected ? String(quotation.decisionExpectedBy || '').trim() : '') ||
    null;

  if (!activeDate || !activeDeadline) {
    return { ...EMPTY_RESULT };
  }

  const daysFromDeadline = calendarDayDiff(activeDate, asOf);

  if (daysFromDeadline < 0) {
    return {
      status: 'ON_TRACK',
      label: 'On Track',
      overdueDays: null,
      activeDeadline,
      rowClassName: '',
      stickyCellClassName: 'bg-white group-hover:bg-gray-50/90',
      badgeClassName: `${BADGE_BASE} border-slate-200 bg-slate-50 text-slate-700`,
      badgeVariant: 'on_track',
      showWarningIcon: false,
    };
  }

  if (daysFromDeadline === 0) {
    return {
      status: 'DUE_TODAY',
      label: 'Due Today',
      overdueDays: 0,
      activeDeadline,
      rowClassName: '',
      stickyCellClassName: 'bg-white group-hover:bg-gray-50/90',
      badgeClassName: `${BADGE_BASE} border-yellow-300 bg-yellow-100 text-yellow-800`,
      badgeVariant: 'due_today',
      showWarningIcon: true,
    };
  }

  const overdueDays = daysFromDeadline;
  return {
    status: 'OVERDUE',
    label: formatOverdueLabel(overdueDays),
    overdueDays,
    activeDeadline,
    rowClassName: 'bg-red-50/70 hover:bg-red-50/90',
    stickyCellClassName: 'bg-red-50/70 group-hover:bg-red-50/90',
    badgeClassName: `${BADGE_BASE} border-red-200 bg-red-100 text-red-900`,
    badgeVariant: 'overdue',
    showWarningIcon: true,
  };
}
