import type { CSSProperties } from 'react';
import type { PlannerEvent } from '../../../types/planner';
import { isCompanyHoliday } from '../../../utils/companyWorkingDays';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Precompiled CSS lacks arbitrary Tailwind classes — use inline status colors. */
export const PLANNER_STATUS_COLORS = {
  Planned: { bg: '#3B82F6', text: '#FFFFFF', border: '#2563EB' },
  'Update Pending': { bg: '#F59E0B', text: '#FFFFFF', border: '#D97706' },
  'Update Pending Overdue': { bg: '#DC2626', text: '#FFFFFF', border: '#B91C1C' },
  Visited: { bg: '#22C55E', text: '#FFFFFF', border: '#16A34A' },
  'Not Visited': { bg: '#EF4444', text: '#FFFFFF', border: '#DC2626' },
  'Quotation Created': { bg: '#22C55E', text: '#FFFFFF', border: '#16A34A' },
  Rescheduled: { bg: '#8B5CF6', text: '#FFFFFF', border: '#7C3AED' },
} as const;

export type PlannerReminderState = 'none' | 'pending' | 'overdue';

export function getPlannerDisplayLabel(event: PlannerEvent | Record<string, unknown>): string {
  const e = event as Record<string, unknown>;
  const contactTitle = String(e.contactTitle ?? e.title ?? '').trim();
  const contactFullName = String(e.contactFullName ?? e.fullName ?? '').trim();
  const organizationName = String(e.organizationName ?? e.customerOrganization ?? '').trim();
  const organizationId = String(e.organizationId ?? '').trim();

  const candidates = [
    [contactTitle, contactFullName].filter(Boolean).join(' ').trim(),
    contactFullName,
    contactTitle,
    organizationName,
    organizationId,
    String(e.fullName ?? '').trim(),
    String(e.contactPerson ?? '').trim(),
    String(e.name ?? '').trim(),
    'Unnamed Event',
  ];

  const label = candidates.find((v) => v && String(v).trim());
  return String(label || 'Unnamed Event').trim();
}

export function getPlannerOwnerLabel(
  event: PlannerEvent | Record<string, unknown>,
  ownerNameByCode?: Record<string, string>,
): string {
  const e = event as Record<string, unknown>;
  const name = String(e.ownerEmployeeName ?? '').trim();
  if (name) return name;
  const code = String(e.ownerEmployeeCode ?? '').trim();
  if (code && ownerNameByCode?.[code]) return ownerNameByCode[code];
  return code;
}

/** @deprecated Use getPlannerDisplayLabel */
export function formatPlannerEventLabel(event: PlannerEvent): string {
  return getPlannerDisplayLabel(event);
}

export function parseIsoDateOnly(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIsoDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getPlannerReminderState(event: PlannerEvent, now = new Date()): PlannerReminderState {
  if (event.status !== 'Planned') return 'none';
  const visit = parseIsoDateOnly(event.visitDate);
  if (!visit) return 'none';
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (today.getTime() < visit.getTime()) return 'none';
  const fiveDaysLater = new Date(visit);
  fiveDaysLater.setUTCDate(fiveDaysLater.getUTCDate() + 5);
  if (today.getTime() <= fiveDaysLater.getTime()) return 'pending';
  return 'overdue';
}

export function getPlannerVisualStatus(event: PlannerEvent, now = new Date()): string {
  const reminder = getPlannerReminderState(event, now);
  if (reminder === 'pending' || reminder === 'overdue') return 'Update Pending';
  return event.status || 'Planned';
}

export function getPlannerChipStyleKey(
  visualStatus: string,
  reminderState: PlannerReminderState,
): keyof typeof PLANNER_STATUS_COLORS {
  if (visualStatus === 'Update Pending' && reminderState === 'overdue') {
    return 'Update Pending Overdue';
  }
  if (visualStatus === 'Visited') {
    return 'Quotation Created';
  }
  if (visualStatus in PLANNER_STATUS_COLORS) {
    return visualStatus as keyof typeof PLANNER_STATUS_COLORS;
  }
  return 'Planned';
}

export function getPlannerChipStyle(
  visualStatus: string,
  reminderState: PlannerReminderState = 'none',
): CSSProperties {
  const key = getPlannerChipStyleKey(visualStatus, reminderState);
  const colors = PLANNER_STATUS_COLORS[key];
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    minHeight: 22,
    padding: '2px 6px',
    borderRadius: 6,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.bg,
    color: colors.text,
    fontSize: 12,
    fontWeight: 500,
    lineHeight: '16px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
    boxSizing: 'border-box',
  };
}

export type CalendarDayCell = {
  date: Date;
  iso: string;
  inMonth: boolean;
  isCompanyHoliday: boolean;
  events: PlannerEvent[];
};

export function buildMonthGrid(year: number, month: number, events: PlannerEvent[]): CalendarDayCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = first.getUTCDay();
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - startOffset);

  const byDate = new Map<string, PlannerEvent[]>();
  for (const ev of events) {
    const parsed = parseIsoDateOnly(ev.visitDate);
    if (!parsed) continue;
    const key = toIsoDateOnly(parsed);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(ev);
  }

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    const iso = toIsoDateOnly(d);
    cells.push({
      date: d,
      iso,
      inMonth: d.getUTCMonth() === month - 1,
      isCompanyHoliday: isCompanyHoliday(iso),
      events: byDate.get(iso) ?? [],
    });
  }
  return cells;
}

export function formatMonthYear(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export { WEEKDAY_LABELS };

export const PLANNER_STATUS_LEGEND: Array<{ status: string; color: string }> = [
  { status: 'Planned', color: PLANNER_STATUS_COLORS.Planned.bg },
  { status: 'Update Pending', color: PLANNER_STATUS_COLORS['Update Pending'].bg },
  { status: 'Quotation Created', color: PLANNER_STATUS_COLORS['Quotation Created'].bg },
  { status: 'Not Visited', color: PLANNER_STATUS_COLORS['Not Visited'].bg },
  { status: 'Rescheduled', color: PLANNER_STATUS_COLORS.Rescheduled.bg },
];
