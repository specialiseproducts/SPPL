/**
 * Planning Recognition — client helpers (IST windows use server time from API config).
 */

import { assertRegularPlanningAllowedOnDate } from './companyWorkingDays';

export const PLANNING_CATEGORY_REGULAR = 'Regular' as const;
export const PLANNING_CATEGORY_URGENT = 'Urgent' as const;

export type PlanningCategory =
  | typeof PLANNING_CATEGORY_REGULAR
  | typeof PLANNING_CATEGORY_URGENT;

export const REGULAR_TASK_BLOCKED_MESSAGE =
  'Regular tasks can only be planned during the planning windows.\n\n' +
  'Today: 08:00 AM – 11:00 AM\n' +
  'Tomorrow: 05:30 PM – 08:00 PM\n\n' +
  'If this work is urgent, please create it as an Urgent Task.';

export const PLANNING_WINDOW_CLOSED_MESSAGE =
  'The planning window is currently closed.\n\n' +
  "Today's planning is allowed from 8:00 AM–11:00 AM.\n\n" +
  "Tomorrow's planning is allowed from 5:30 PM–8:00 PM.\n\n" +
  "If this is genuinely urgent, please use the 'Create Urgent Task' option.";

export const TASK_UPDATES_READONLY_MESSAGE =
  'Task updates are only allowed during the planning windows (08:00–11:00 AM and 05:30–08:00 PM).';

export type PlanningWindowUiState = 'morning' | 'closed' | 'evening' | 'urgent-only';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const CLOSED_WINDOW_START_MINUTES = 11 * 60;
const CLOSED_WINDOW_END_MINUTES = 17 * 60 + 30;

export interface PlanningConfig {
  timezone: string;
  serverTimeIso: string;
  todayIst: string;
  tomorrowIst: string;
  employeeLocation?: string;
  minPlannedHoursPerWorkingDay?: number;
  minPlannedTasksPerWorkingDay?: number;
  windows: {
    morning: { start: string; end: string; active: boolean };
    evening: { start: string; end: string; active: boolean };
  };
  scores: {
    morning: number;
    evening: number;
    dailyCap: number;
    maxPerWorkingDay: number;
    base?: number;
    latePenalty?: number;
    urgentPenalty?: number;
    taskPreviousDay?: number;
    taskMorning?: number;
    taskCompleted?: number;
    taskNotCompleted?: number;
  };
  regularTaskBlockedMessage: string;
}

export interface PlanningMonthlyRecord {
  employeeCode: string;
  year: number;
  month: number;
  yearMonth: string;
  rawScore: number;
  maxScore: number;
  normalizedScore: number;
  planningScore: number;
  planningAheadPercent: number;
  daysPlannedAhead: number;
  regularTaskCount: number;
  urgentTaskCount: number;
  latePlanningCount?: number;
  badge: string;
  badgeEmoji: string;
  rating: string;
  ratingLabel?: string;
  ratingStars: number;
  workingDays: number;
  computedAt?: string;
  updatedAt?: string;
}

export interface PlanningProfile {
  currentMonth: PlanningMonthlyRecord | null;
  history: PlanningMonthlyRecord[];
  todayIst: string;
}

export function getPlanningReference(config: PlanningConfig): Date {
  return new Date(config.serverTimeIso);
}

export function getPlanningTargetDateMode(
  taskDateIso: string,
  config: PlanningConfig,
): 'past' | 'today' | 'tomorrow' | 'other' {
  const normalized = String(taskDateIso || '').trim().slice(0, 10);
  if (normalized < config.todayIst) return 'past';
  if (normalized === config.todayIst) return 'today';
  if (normalized === config.tomorrowIst) return 'tomorrow';
  return 'other';
}

export function isRegularTaskAllowed(taskDateIso: string, config: PlanningConfig): boolean {
  const target = getPlanningTargetDateMode(taskDateIso, config);
  if (target === 'today' && config.windows.morning.active) return true;
  if (target === 'tomorrow' && config.windows.evening.active) return true;
  return false;
}

export function assertCanCreateRegularTask(taskDateIso: string, config: PlanningConfig): void {
  if (getPlanningTargetDateMode(taskDateIso, config) === 'past') {
    throw new Error('Cannot create tasks for past dates.');
  }
  assertRegularPlanningAllowedOnDate(taskDateIso, config.employeeLocation);
  if (!isRegularTaskAllowed(taskDateIso, config)) {
    throw new Error(config.regularTaskBlockedMessage || REGULAR_TASK_BLOCKED_MESSAGE);
  }
}

export function assertCanCreateUrgentTask(taskDateIso: string, config: PlanningConfig): void {
  if (getPlanningTargetDateMode(taskDateIso, config) === 'past') {
    throw new Error('Cannot create tasks for past dates.');
  }
}

export function isUrgentTask(category: PlanningCategory | string | undefined): boolean {
  return String(category || '').trim() === PLANNING_CATEGORY_URGENT;
}

function getIstMinutesFromServerTime(serverTimeIso: string): number {
  const ref = new Date(serverTimeIso);
  if (Number.isNaN(ref.getTime())) return 0;
  const ist = new Date(ref.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/** Four UI states driven by server IST time. */
export function getPlanningWindowUiState(
  config: PlanningConfig | null | undefined,
): PlanningWindowUiState {
  if (!config) return 'closed';
  if (config.windows.morning.active) return 'morning';
  if (config.windows.evening.active) return 'evening';

  const minutes = getIstMinutesFromServerTime(config.serverTimeIso);
  if (minutes >= CLOSED_WINDOW_START_MINUTES && minutes < CLOSED_WINDOW_END_MINUTES) {
    return 'closed';
  }
  return 'urgent-only';
}

/** Task type from server IST planning windows (optional manual urgent during closed window). */
export function resolveAutoPlanningCategory(
  config: PlanningConfig | null | undefined,
  manualUrgent = false,
): PlanningCategory {
  const state = getPlanningWindowUiState(config);
  if (state === 'urgent-only' || manualUrgent) return PLANNING_CATEGORY_URGENT;
  return PLANNING_CATEGORY_REGULAR;
}

export function isAutoUrgentMode(config: PlanningConfig | null | undefined): boolean {
  return getPlanningWindowUiState(config) === 'urgent-only';
}

export function isPlanningWindowClosed(config: PlanningConfig | null | undefined): boolean {
  return getPlanningWindowUiState(config) === 'closed';
}

/** Whether today's tasks can be updated (complete, edit, delete) in the current window. */
export function canUpdateTasksOnDate(
  taskDateIso: string,
  config: PlanningConfig | null | undefined,
): boolean {
  if (!config) return false;
  if (getPlanningTargetDateMode(taskDateIso, config) !== 'today') return false;
  const state = getPlanningWindowUiState(config);
  return state === 'morning' || state === 'evening';
}

export function assertCanUpdateTasksOnDate(
  taskDateIso: string,
  config: PlanningConfig | null | undefined,
): void {
  if (!config) {
    throw new Error(TASK_UPDATES_READONLY_MESSAGE);
  }
  if (getPlanningTargetDateMode(taskDateIso, config) === 'past') {
    throw new Error('Cannot update tasks for past dates.');
  }
  if (!canUpdateTasksOnDate(taskDateIso, config)) {
    throw new Error(TASK_UPDATES_READONLY_MESSAGE);
  }
}

export function formatPlanningScoreLabel(record: PlanningMonthlyRecord | null | undefined): string {
  if (!record) return '—';
  const score = record.planningScore ?? record.normalizedScore;
  return `${score} / 100`;
}

export function formatPlanningBadge(record: PlanningMonthlyRecord | null | undefined): string {
  if (!record) return '—';
  if (record.badge === 'No Badge' || !record.badgeEmoji) {
    return record.badge || 'No Badge';
  }
  return `${record.badgeEmoji} ${record.badge}`.trim();
}

export function formatPlannerRating(record: PlanningMonthlyRecord | null | undefined): string {
  if (!record) return '—';
  const stars = '★'.repeat(Math.max(0, Math.min(5, record.ratingStars || 0)));
  const empty = '☆'.repeat(Math.max(0, 5 - (record.ratingStars || 0)));
  const label = record.ratingLabel || record.rating || '';
  return `${stars}${empty} ${label}`.trim();
}

export function formatPlanningAheadPercent(
  record: PlanningMonthlyRecord | null | undefined,
): string {
  if (!record) return '—';
  return `${record.planningAheadPercent ?? 0}%`;
}

export function formatDaysPlannedAhead(record: PlanningMonthlyRecord | null | undefined): string {
  if (!record) return '—';
  return `${record.daysPlannedAhead ?? 0} / ${record.workingDays ?? 0} Days`;
}

export function formatPlanningMonthLabel(record: PlanningMonthlyRecord | null | undefined): string {
  if (!record?.yearMonth) return '—';
  const [year, month] = record.yearMonth.split('-').map(Number);
  if (!year || !month) return record.yearMonth;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Platinum Planner': { bg: '#F3E8FF', text: '#6B21A8', border: '#D8B4FE' },
  'Gold Planner': { bg: '#FEF9C3', text: '#854D0E', border: '#FDE047' },
  'Silver Planner': { bg: '#F1F5F9', text: '#334155', border: '#CBD5E1' },
  'Bronze Planner': { bg: '#FFEDD5', text: '#9A3412', border: '#FDBA74' },
  'No Badge': { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
};

export function getPlanningBadgeStyle(badge: string) {
  return BADGE_STYLES[badge] || BADGE_STYLES['No Badge'];
}
