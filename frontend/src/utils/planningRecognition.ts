/**
 * Planning Recognition — client helpers (IST windows use server time from API config).
 */

import {
  COMPANY_HOLIDAY_TASK_CREATE_MESSAGE,
  isCompanyHoliday,
} from './companyWorkingDays';

export const PLANNING_CATEGORY_REGULAR = 'Regular' as const;
export const PLANNING_CATEGORY_URGENT = 'Urgent' as const;

export type PlanningCategory =
  | typeof PLANNING_CATEGORY_REGULAR
  | typeof PLANNING_CATEGORY_URGENT;

export const REGULAR_TASK_BLOCKED_MESSAGE =
  'Regular tasks can only be planned during the planning windows.\n\n' +
  'Today: 12:00 AM – 11:00 AM\n' +
  'Tomorrow: 05:30 PM – 08:00 PM\n\n' +
  'If this work is urgent, please create it as an Urgent Task.';

export const REGULAR_TASK_TODAY_BLOCKED_MESSAGE =
  'A Regular Task for today can only be created before 11:00 AM.';

export const REGULAR_TASK_TOMORROW_BLOCKED_MESSAGE =
  'A Regular Task for tomorrow can only be created between 5:30 PM and 8:00 PM today.';

export const URGENT_TASK_TODAY_BLOCKED_MESSAGE =
  'Urgent Tasks for today can only be created between 11:00 AM and 5:30 PM.';

export const TASK_CREATE_DATE_BLOCKED_MESSAGE =
  'You can only create tasks for today or tomorrow according to the allowed task creation schedule.';

export const PLANNING_WINDOW_CLOSED_MESSAGE =
  'The planning window is currently closed.\n\n' +
  "Today's Regular Tasks are allowed from 12:00 AM–11:00 AM.\n\n" +
  "Today's Urgent Tasks are allowed from 11:00 AM–5:30 PM.\n\n" +
  "Tomorrow's Regular Tasks are allowed from 5:30 PM–8:00 PM.\n\n" +
  "If this is genuinely urgent and within the Urgent window, please use the 'Create Urgent Task' option.";

export const TASK_UPDATES_READONLY_MESSAGE =
  'Task updates are only allowed during the planning windows (08:00–11:00 AM and 05:30–08:00 PM).';

export type PlanningWindowUiState = 'morning' | 'closed' | 'evening' | 'urgent-only';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MORNING_END_MINUTES = 11 * 60;
const EVENING_START_MINUTES = 17 * 60 + 30;
const EVENING_END_MINUTES = 20 * 60;

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

export type MyDailyPlannerCreateEligibility =
  | { allowed: true; mode: 'regular' | 'urgent' }
  | { allowed: false; message: string };

export function getPlanningReference(config: PlanningConfig): Date {
  return new Date(config.serverTimeIso);
}

function getIstMinutesFromServerTime(serverTimeIso: string): number {
  const ref = new Date(serverTimeIso);
  if (Number.isNaN(ref.getTime())) return 0;
  const ist = new Date(ref.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
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

export function isRegularTodayCreationWindow(config: PlanningConfig): boolean {
  return getIstMinutesFromServerTime(config.serverTimeIso) < MORNING_END_MINUTES;
}

export function isUrgentTodayCreationWindow(config: PlanningConfig): boolean {
  const minutes = getIstMinutesFromServerTime(config.serverTimeIso);
  return minutes >= MORNING_END_MINUTES && minutes < EVENING_START_MINUTES;
}

export function isRegularTaskAllowed(taskDateIso: string, config: PlanningConfig): boolean {
  const target = getPlanningTargetDateMode(taskDateIso, config);
  if (target === 'today' && isRegularTodayCreationWindow(config)) return true;
  if (target === 'tomorrow' && config.windows.evening.active) return true;
  return false;
}

export function isUrgentTaskAllowed(taskDateIso: string, config: PlanningConfig): boolean {
  const target = getPlanningTargetDateMode(taskDateIso, config);
  return target === 'today' && isUrgentTodayCreationWindow(config);
}

/**
 * Central eligibility for My Daily Planner create entry points (before opening the form).
 * Holiday always takes priority.
 */
export function evaluateMyDailyPlannerCreateEligibility(
  taskDateIso: string,
  config: PlanningConfig,
): MyDailyPlannerCreateEligibility {
  if (isCompanyHoliday(taskDateIso, config.employeeLocation)) {
    return { allowed: false, message: COMPANY_HOLIDAY_TASK_CREATE_MESSAGE };
  }

  const target = getPlanningTargetDateMode(taskDateIso, config);
  if (target === 'past' || target === 'other') {
    return { allowed: false, message: TASK_CREATE_DATE_BLOCKED_MESSAGE };
  }

  if (target === 'today') {
    if (isRegularTodayCreationWindow(config)) {
      return { allowed: true, mode: 'regular' };
    }
    if (isUrgentTodayCreationWindow(config)) {
      return { allowed: true, mode: 'urgent' };
    }
    return { allowed: false, message: URGENT_TASK_TODAY_BLOCKED_MESSAGE };
  }

  // tomorrow
  if (config.windows.evening.active) {
    return { allowed: true, mode: 'regular' };
  }
  return { allowed: false, message: REGULAR_TASK_TOMORROW_BLOCKED_MESSAGE };
}

export function assertCanCreateRegularTask(taskDateIso: string, config: PlanningConfig): void {
  if (isCompanyHoliday(taskDateIso, config.employeeLocation)) {
    throw new Error(COMPANY_HOLIDAY_TASK_CREATE_MESSAGE);
  }
  const target = getPlanningTargetDateMode(taskDateIso, config);
  if (target === 'past' || target === 'other') {
    throw new Error(TASK_CREATE_DATE_BLOCKED_MESSAGE);
  }
  if (isRegularTaskAllowed(taskDateIso, config)) return;
  if (target === 'today') {
    throw new Error(REGULAR_TASK_TODAY_BLOCKED_MESSAGE);
  }
  if (target === 'tomorrow') {
    throw new Error(REGULAR_TASK_TOMORROW_BLOCKED_MESSAGE);
  }
  throw new Error(config.regularTaskBlockedMessage || REGULAR_TASK_BLOCKED_MESSAGE);
}

export function assertCanCreateUrgentTask(taskDateIso: string, config: PlanningConfig): void {
  if (isCompanyHoliday(taskDateIso, config.employeeLocation)) {
    throw new Error(COMPANY_HOLIDAY_TASK_CREATE_MESSAGE);
  }
  const target = getPlanningTargetDateMode(taskDateIso, config);
  if (target === 'past' || target === 'other' || target === 'tomorrow') {
    throw new Error(TASK_CREATE_DATE_BLOCKED_MESSAGE);
  }
  if (isUrgentTaskAllowed(taskDateIso, config)) return;
  throw new Error(URGENT_TASK_TODAY_BLOCKED_MESSAGE);
}

export function isUrgentTask(category: PlanningCategory | string | undefined): boolean {
  return String(category || '').trim() === PLANNING_CATEGORY_URGENT;
}

/**
 * UI states for create chrome.
 * Creation windows: Regular today until 11:00; Urgent 11:00–17:30; Regular tomorrow 17:30–20:00.
 * After 20:00 there is no urgent-only create path.
 */
export function getPlanningWindowUiState(
  config: PlanningConfig | null | undefined,
): PlanningWindowUiState {
  if (!config) return 'closed';

  const minutes = getIstMinutesFromServerTime(config.serverTimeIso);
  if (minutes < MORNING_END_MINUTES) return 'morning';
  if (minutes < EVENING_START_MINUTES) return 'closed';
  if (minutes < EVENING_END_MINUTES) return 'evening';
  return 'closed';
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

/**
 * Whether today's tasks can be updated (complete, edit, delete) in the current window.
 * Preserves scoring-window update times: morning (config API) or evening.
 */
export function canUpdateTasksOnDate(
  taskDateIso: string,
  config: PlanningConfig | null | undefined,
): boolean {
  if (!config) return false;
  if (getPlanningTargetDateMode(taskDateIso, config) !== 'today') return false;
  return Boolean(config.windows.morning.active || config.windows.evening.active);
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
