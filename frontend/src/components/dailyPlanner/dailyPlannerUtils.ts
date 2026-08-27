import type { CSSProperties } from 'react';
import type { DailyPlannerTask, DailyPlannerStatus } from '../../types/dailyPlanner';
import { getCompanyHolidayInfo } from '../../utils/companyWorkingDays';
import { parseIsoDateOnly, toIsoDateOnly } from '../sales/planner/plannerUtils';

/** Solid event-card colours — same structure as Sales Planner PLANNER_STATUS_COLORS. */
export const DAILY_TASK_COLORS = {
  High: { bg: '#DC2626', text: '#FFFFFF', border: '#B91C1C' },
  Medium: { bg: '#F59E0B', text: '#FFFFFF', border: '#D97706' },
  Low: { bg: '#22C55E', text: '#FFFFFF', border: '#16A34A' },
  'Sales Visit': { bg: '#8B5CF6', text: '#FFFFFF', border: '#7C3AED' },
  Completed: { bg: '#22C55E', text: '#FFFFFF', border: '#16A34A' },
  'Verified Complete': { bg: '#22C55E', text: '#FFFFFF', border: '#16A34A' },
  'Awaiting Verification': { bg: '#F97316', text: '#FFFFFF', border: '#EA580C' },
  'Not Completed': { bg: '#EF4444', text: '#FFFFFF', border: '#DC2626' },
  'Needs Revision': { bg: '#EF4444', text: '#FFFFFF', border: '#DC2626' },
  Pending: { bg: '#EAB308', text: '#FFFFFF', border: '#CA8A04' },
  Approved: { bg: '#3B82F6', text: '#FFFFFF', border: '#2563EB' },
  Rejected: { bg: '#EF4444', text: '#FFFFFF', border: '#DC2626' },
} as const;

export type DailyTaskVisualKey = keyof typeof DAILY_TASK_COLORS;

export const DAILY_STATUS_DOT_COLORS: Record<string, string> = {
  Pending: DAILY_TASK_COLORS.Pending.bg,
  Approved: DAILY_TASK_COLORS.Approved.bg,
  Completed: DAILY_TASK_COLORS.Completed.bg,
  'Verified Complete': DAILY_TASK_COLORS['Verified Complete'].bg,
  'Awaiting Verification': DAILY_TASK_COLORS['Awaiting Verification'].bg,
  'Not Completed': DAILY_TASK_COLORS['Not Completed'].bg,
  'Needs Revision': DAILY_TASK_COLORS['Needs Revision'].bg,
  Rejected: DAILY_TASK_COLORS.Rejected.bg,
  'Sales Visit': DAILY_TASK_COLORS['Sales Visit'].bg,
  High: DAILY_TASK_COLORS.High.bg,
  Medium: DAILY_TASK_COLORS.Medium.bg,
  Low: DAILY_TASK_COLORS.Low.bg,
};

export const DAILY_STATUS_LEGEND = [
  { status: 'Sales Forecasting Event', color: DAILY_TASK_COLORS['Sales Visit'].bg },
  { status: 'Pending Approval', color: DAILY_TASK_COLORS.Pending.bg },
  { status: 'Approved', color: DAILY_TASK_COLORS.Approved.bg },
  { status: 'Awaiting Completion Verification', color: DAILY_TASK_COLORS['Awaiting Verification'].bg },
  { status: 'Verified Completed', color: DAILY_TASK_COLORS['Verified Complete'].bg },
  { status: 'Marked Not Completed', color: DAILY_TASK_COLORS['Not Completed'].bg },
  { status: 'Needs Revision', color: '#6B7280' },
  { status: 'Rescheduled Task', color: '#06B6D4' },
  { status: 'Terminated / Closed Task', color: '#111827' },
] as const;

export type DailyCalendarDayCell = {
  date: Date;
  iso: string;
  inMonth: boolean;
  isCompanyHoliday: boolean;
  holidayName: string | null;
  tasks: DailyPlannerTask[];
};

export function buildDailyMonthGrid(
  year: number,
  month: number,
  tasks: DailyPlannerTask[],
  location?: string | null,
): DailyCalendarDayCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = first.getUTCDay();
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - startOffset);

  const byDate = new Map<string, DailyPlannerTask[]>();
  for (const task of tasks) {
    const parsed = parseIsoDateOnly(task.date);
    if (!parsed) continue;
    const key = toIsoDateOnly(parsed);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(task);
  }

  const cells: DailyCalendarDayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    const iso = toIsoDateOnly(d);
    const holidayInfo = getCompanyHolidayInfo(iso, location);
    cells.push({
      date: d,
      iso,
      inMonth: d.getUTCMonth() === month - 1,
      isCompanyHoliday: holidayInfo.isHoliday,
      holidayName:
        holidayInfo.holidayType === 'declared' ? holidayInfo.holidayName : null,
      tasks: byDate.get(iso) ?? [],
    });
  }
  return cells;
}

/** Calendar colour is driven by task status (and Sales Visit type), never priority. */
export function getDailyTaskVisualKey(task: DailyPlannerTask): DailyTaskVisualKey {
  if (task.status === 'Verified Complete' || task.status === 'Completed') return 'Verified Complete';
  if (task.status === 'Awaiting Verification') return 'Awaiting Verification';
  if (task.status === 'Needs Revision') return 'Needs Revision';
  if (task.status === 'Approved') return 'Approved';
  if (
    task.status === 'Not Completed' ||
    task.status === 'Rejected' ||
    task.status === 'Rescheduled' ||
    task.status === 'Terminated'
  ) {
    return 'Not Completed';
  }
  if (task.taskType === 'Sales Visit' || task.source === 'SALES_FORECASTING') return 'Sales Visit';
  return 'Pending';
}

/** User-facing label — Terminated tasks display as Closed. */
export function getDailyTaskStatusLabel(status: DailyPlannerStatus): string {
  if (status === 'Terminated') return 'Closed';
  if (status === 'Pending') return 'Pending Approval';
  return status;
}

export function isPermanentlyClosedTask(task: DailyPlannerTask): boolean {
  return task.status === 'Terminated';
}

/** Original task after Incomplete → Reschedule — not eligible for complete/incomplete actions. */
export function isRescheduledTask(task: DailyPlannerTask): boolean {
  return task.status === 'Rescheduled';
}

/** Original Needs Revision task after Accept Suggestion or Create Own Revised Task. */
export function isHandledRevisionParent(task: DailyPlannerTask): boolean {
  return Boolean(String(task.revisionOutcome || '').trim());
}

export function visibleEmployeePlannerTasks(tasks: DailyPlannerTask[]): DailyPlannerTask[] {
  return tasks.filter((task) => !isHandledRevisionParent(task));
}

export function getDailyTaskDisplayLabel(task: DailyPlannerTask): string {
  const name = String(task.taskName || '').trim();
  return name || 'Unnamed Task';
}

/** Same chip dimensions as Sales Planner getPlannerChipStyle. */
export function getDailyTaskChipStyle(visualKey: DailyTaskVisualKey): CSSProperties {
  const colors = DAILY_TASK_COLORS[visualKey] ?? DAILY_TASK_COLORS.Pending;
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
    gap: 4,
  };
}

/** @deprecated Use getDailyTaskChipStyle */
export function getTaskChipStyle(priority: string, status: DailyPlannerStatus): CSSProperties {
  void priority;
  void status;
  return getDailyTaskChipStyle('Pending');
}

export function tomorrowIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return toIsoDateOnly(d);
}

export function todayIso(): string {
  return toIsoDateOnly(new Date());
}

export function isTodayCell(iso: string, now = new Date()): boolean {
  return iso === toIsoDateOnly(now);
}

export { WEEKDAY_LABELS } from '../sales/planner/plannerUtils';
