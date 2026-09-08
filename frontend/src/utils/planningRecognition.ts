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
  'Tasks can only be planned during the planning window.\n\n' +
  'Planning window: 5:30 PM – 11:00 AM next day (IST)\n\n' +
  'Future working days may be planned during this window.';

export const REGULAR_TASK_TODAY_BLOCKED_MESSAGE =
  'Tasks for today can only be created before 11:00 AM during the planning window.';

export const REGULAR_TASK_TOMORROW_BLOCKED_MESSAGE =
  'Future working-day planning is only allowed between 5:30 PM and 11:00 AM next day (IST).';

export const URGENT_TASK_TODAY_BLOCKED_MESSAGE =
  'Task creation outside the planning window is not allowed.';

export const TASK_CREATE_DATE_BLOCKED_MESSAGE =
  'You can only create tasks for today or future working days during the planning window.';

export const EMPLOYEE_EVENING_PLAN_ONLY_MESSAGE =
  'Task planning is only allowed between 5:30 PM and 11:00 AM next day (IST) for today and future working days.';

export const EMPLOYEE_EXACT_SEVEN_HOURS_MESSAGE =
  'Your minimum total hours planning is not completed. Please plan the required hours for your location.';

export const USER_URGENT_FORBIDDEN_MESSAGE =
  'You do not have permission to create tasks with Urgent priority outside the allowed workflow.';

export const PLANNING_WINDOW_CLOSED_MESSAGE =
  'The planning window is currently closed.\n\n' +
  'Employee planning is allowed from 5:30 PM until 11:00 AM the next day (IST).\n\n' +
  'Manager review runs from 8:00 PM until 9:30 AM the next day.';

export const TASK_UPDATES_READONLY_MESSAGE =
  'Task updates are only allowed during the planning windows (before 11:00 AM and from 5:30 PM onward).';

/** @deprecated Prefer getMinPlannedHours(config). Factory fallback. */
export const MIN_PLANNED_HOURS_PER_WORKING_DAY = 7;
export const MIN_PLANNED_HOURS_FACTORY = 7;
export const MIN_PLANNED_HOURS_OFFICE = 7.5;

export type PlanningWindowUiState = 'morning' | 'closed' | 'evening' | 'urgent-only';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MORNING_END_MINUTES = 11 * 60;
const EVENING_START_MINUTES = 17 * 60 + 30;

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

/** Location / config-based daily minimum planned hours (Office 7.5, Factory 7). */
export function getMinPlannedHours(config?: PlanningConfig | null, location?: string | null): number {
  if (
    config?.minPlannedHoursPerWorkingDay != null &&
    Number.isFinite(Number(config.minPlannedHoursPerWorkingDay))
  ) {
    return Number(config.minPlannedHoursPerWorkingDay);
  }
  const loc = String(location || config?.employeeLocation || '').trim();
  return loc === 'Factory' ? MIN_PLANNED_HOURS_FACTORY : MIN_PLANNED_HOURS_OFFICE;
}

export function buildMinimumHoursRequirementMessage(
  config?: PlanningConfig | null,
  location?: string | null,
): string {
  const min = getMinPlannedHours(config, location);
  if (min === MIN_PLANNED_HOURS_OFFICE) {
    return 'Your minimum total hours planning is not completed. Please plan 7 Hours 30 Minutes.';
  }
  return 'Your minimum total hours planning is not completed. Please plan 7 Hours.';
}

/** Convert decimal hours to { hours, minutes } without losing minute precision. */
export function decimalHoursToParts(decimalHours: number | null | undefined): {
  hours: number;
  minutes: number;
} {
  const totalMinutes = Math.round((Number(decimalHours) || 0) * 60);
  const safe = Math.max(0, totalMinutes);
  return {
    hours: Math.floor(safe / 60),
    minutes: safe % 60,
  };
}

/** Convert hours + minutes (0–59) to decimal hours (2 d.p.). */
export function partsToDecimalHours(hoursPart: number | string, minutesPart: number | string): number {
  const h = Math.max(0, Math.floor(Number(hoursPart) || 0));
  let m = Number(minutesPart);
  if (!Number.isFinite(m)) m = 0;
  m = Math.max(0, Math.min(59, Math.round(m)));
  return Math.round((h + m / 60) * 100) / 100;
}

export function formatDurationLabel(decimalHours: number | null | undefined): string {
  const { hours, minutes } = decimalHoursToParts(decimalHours);
  const hLabel = hours === 1 ? '1 Hour' : `${hours} Hours`;
  if (minutes <= 0) return hLabel;
  const mLabel = minutes === 1 ? '1 Minute' : `${minutes} Minutes`;
  if (hours <= 0) return mLabel;
  return `${hLabel} ${mLabel}`;
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
  if ((target === 'tomorrow' || target === 'other') && config.windows.evening.active) {
    const normalized = String(taskDateIso || '').trim().slice(0, 10);
    if (normalized > config.todayIst) return true;
  }
  return false;
}

export function isUrgentTaskAllowed(taskDateIso: string, config: PlanningConfig): boolean {
  const target = getPlanningTargetDateMode(taskDateIso, config);
  return target === 'today' && isUrgentTodayCreationWindow(config);
}

/**
 * Central eligibility for My Daily Planner create entry points (before opening the form).
 * Holiday always takes priority.
 * Employees: any today/future working day during 5:30 PM → 11:00 AM window; always Regular mode.
 * Elevated (Admin/Manager/Developer): prior today morning / urgent / tomorrow evening rules.
 */
export function evaluateMyDailyPlannerCreateEligibility(
  taskDateIso: string,
  config: PlanningConfig,
  options?: { elevated?: boolean; nextWorkingDayIst?: string },
): MyDailyPlannerCreateEligibility {
  if (isCompanyHoliday(taskDateIso, config.employeeLocation)) {
    return { allowed: false, message: COMPANY_HOLIDAY_TASK_CREATE_MESSAGE };
  }

  const elevated = Boolean(options?.elevated);
  const normalized = String(taskDateIso || '').trim().slice(0, 10);
  const mins = getIstMinutesFromServerTime(config.serverTimeIso);

  if (!elevated) {
    // Backend sets evening.active true for the full 5:30 PM → 11:00 AM span.
    if (!config.windows.evening.active) {
      return { allowed: false, message: EMPLOYEE_EVENING_PLAN_ONLY_MESSAGE };
    }
    if (!normalized || normalized < config.todayIst) {
      return { allowed: false, message: TASK_CREATE_DATE_BLOCKED_MESSAGE };
    }
    if (normalized === config.todayIst) {
      // Today only during morning portion (< 11:00).
      if (mins >= MORNING_END_MINUTES) {
        return { allowed: false, message: EMPLOYEE_EVENING_PLAN_ONLY_MESSAGE };
      }
      return { allowed: true, mode: 'regular' };
    }
    // Future working day during active planning window.
    return { allowed: true, mode: 'regular' };
  }

  const target = getPlanningTargetDateMode(taskDateIso, config);
  if (target === 'past') {
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

  // Future working days during evening/active planning window for elevated own planning
  if (config.windows.evening.active) {
    return { allowed: true, mode: 'regular' };
  }
  return { allowed: false, message: REGULAR_TASK_TOMORROW_BLOCKED_MESSAGE };
}

export function assertCanCreateRegularTask(
  taskDateIso: string,
  config: PlanningConfig,
  options?: { elevated?: boolean; nextWorkingDayIst?: string },
): void {
  if (isCompanyHoliday(taskDateIso, config.employeeLocation)) {
    throw new Error(COMPANY_HOLIDAY_TASK_CREATE_MESSAGE);
  }
  if (!options?.elevated) {
    const eligibility = evaluateMyDailyPlannerCreateEligibility(taskDateIso, config, options);
    if (!eligibility.allowed) throw new Error(eligibility.message);
    return;
  }
  const target = getPlanningTargetDateMode(taskDateIso, config);
  if (target === 'past') {
    throw new Error(TASK_CREATE_DATE_BLOCKED_MESSAGE);
  }
  if (isRegularTaskAllowed(taskDateIso, config)) return;
  if (target === 'today') {
    throw new Error(REGULAR_TASK_TODAY_BLOCKED_MESSAGE);
  }
  throw new Error(REGULAR_TASK_TOMORROW_BLOCKED_MESSAGE);
}

export function assertCanCreateUrgentTask(
  taskDateIso: string,
  config: PlanningConfig,
  options?: { elevated?: boolean },
): void {
  if (!options?.elevated) {
    throw new Error(USER_URGENT_FORBIDDEN_MESSAGE);
  }
  if (isCompanyHoliday(taskDateIso, config.employeeLocation)) {
    throw new Error(COMPANY_HOLIDAY_TASK_CREATE_MESSAGE);
  }
  const target = getPlanningTargetDateMode(taskDateIso, config);
  if (target === 'past') {
    throw new Error(TASK_CREATE_DATE_BLOCKED_MESSAGE);
  }
  // Urgent is now a priority; creation still requires planning window eligibility.
  if (config.windows.evening.active || isRegularTodayCreationWindow(config)) return;
  if (isUrgentTaskAllowed(taskDateIso, config)) return;
  throw new Error(URGENT_TASK_TODAY_BLOCKED_MESSAGE);
}

export function isUrgentTask(category: PlanningCategory | string | undefined): boolean {
  return String(category || '').trim() === PLANNING_CATEGORY_URGENT;
}

/**
 * UI states for create chrome.
 * Morning: before 11:00; evening: from 5:30 PM (spans past midnight via config);
 * closed: 11:00–17:30.
 */
export function getPlanningWindowUiState(
  config: PlanningConfig | null | undefined,
): PlanningWindowUiState {
  if (!config) return 'closed';

  const minutes = getIstMinutesFromServerTime(config.serverTimeIso);
  if (minutes < MORNING_END_MINUTES) return 'morning';
  if (minutes < EVENING_START_MINUTES) return 'closed';
  return 'evening';
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
 * Uses morning.active or evening.active (evening spans midnight through 11:00 AM).
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
