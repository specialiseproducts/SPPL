/**
 * Planning Recognition System — IST-based windows, scoring, and badges.
 * Reusable by future leaderboard / analytics phases.
 */

import {
  addCalendarDays,
  dateKeyFromDate,
  parseDateKey,
  todayIstDateKey,
} from './salesQuotationDates.js';
import {
  assertRegularPlanningAllowedOnDate,
  getPreviousWorkingDayDateKey,
  isCompanyWorkingDayDateKey,
} from './companyWorkingDays.js';

export const PLANNING_TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const MORNING_START_HOUR = 8;
export const MORNING_START_MINUTE = 0;
export const MORNING_END_HOUR = 11;
export const MORNING_END_MINUTE = 0;

export const EVENING_START_HOUR = 17;
export const EVENING_START_MINUTE = 30;
export const EVENING_END_HOUR = 20;
export const EVENING_END_MINUTE = 0;

/** @deprecated Legacy window caps — retained for config API compatibility. */
export const MORNING_PLANNING_SCORE = 0.5;
export const EVENING_PLANNING_SCORE = 1;
export const DAILY_PLANNING_SCORE_CAP = 30;

/** Ideal day: 10 tasks × (+1 plan + +2 complete). */
export const MIN_PLANNED_TASKS_PER_WORKING_DAY = 10;
export const TASK_PLANNING_SCORE_PREVIOUS_DAY = 1;
export const TASK_PLANNING_SCORE_MORNING = 0.5;
export const TASK_COMPLETION_SCORE_COMPLETED = 2;
export const TASK_COMPLETION_SCORE_NOT_COMPLETED = -1;
export const MAX_SCORE_PER_WORKING_DAY =
  MIN_PLANNED_TASKS_PER_WORKING_DAY *
  (TASK_PLANNING_SCORE_PREVIOUS_DAY + TASK_COMPLETION_SCORE_COMPLETED);

export const BASE_PLANNING_SCORE = 100;
export const LATE_PLANNING_PENALTY = 5;
export const URGENT_TASK_PENALTY = 2;

export const PLANNING_CATEGORY_REGULAR = 'Regular';
export const PLANNING_CATEGORY_URGENT = 'Urgent';

export const PLANNING_WINDOW_MORNING = 'Morning';
export const PLANNING_WINDOW_EVENING = 'Evening';
export const PLANNING_WINDOW_OUTSIDE = 'Outside';
export const PLANNING_SOURCE_MANUAL = 'MANUAL';
export const PLANNING_SOURCE_IMPORTED = 'SALES_FORECASTING';
export const PLANNING_SOURCE_RESCHEDULED = 'RESCHEDULED';

export const REGULAR_TASK_BLOCKED_MESSAGE =
  'Regular tasks can only be planned during the planning windows.\n\n' +
  'Today: 08:00 AM – 11:00 AM\n' +
  'Tomorrow: 05:30 PM – 08:00 PM\n\n' +
  'If this work is urgent, please create it as an Urgent Task.';

export const URGENT_REASON_REQUIRED_MESSAGE = 'Urgent Task Reason is required.';

export function toIstDate(reference = new Date()) {
  return new Date(reference.getTime() + IST_OFFSET_MS);
}

export function getIstMinutesSinceMidnight(reference = new Date()) {
  const ist = toIstDate(reference);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

function minutesFrom(hour, minute) {
  return hour * 60 + minute;
}

export function isMorningPlanningWindow(reference = new Date()) {
  const mins = getIstMinutesSinceMidnight(reference);
  const start = minutesFrom(MORNING_START_HOUR, MORNING_START_MINUTE);
  const end = minutesFrom(MORNING_END_HOUR, MORNING_END_MINUTE);
  return mins >= start && mins < end;
}

export function isEveningPlanningWindow(reference = new Date()) {
  const mins = getIstMinutesSinceMidnight(reference);
  const start = minutesFrom(EVENING_START_HOUR, EVENING_START_MINUTE);
  const end = minutesFrom(EVENING_END_HOUR, EVENING_END_MINUTE);
  return mins >= start && mins < end;
}

export function tomorrowIstDateKey(reference = new Date()) {
  const today = parseDateKey(todayIstDateKey(reference));
  if (!today) return '';
  return dateKeyFromDate(addCalendarDays(today, 1));
}

export function getPlanningTargetDateMode(taskDateIso, reference = new Date()) {
  const normalized = String(taskDateIso || '').trim().slice(0, 10);
  const today = todayIstDateKey(reference);
  const tomorrow = tomorrowIstDateKey(reference);
  if (normalized === today) return 'today';
  if (normalized === tomorrow) return 'tomorrow';
  if (normalized < today) return 'past';
  return 'other';
}

export function isUrgentTask(planningCategory) {
  return String(planningCategory || '').trim() === PLANNING_CATEGORY_URGENT;
}

export function isRegularTask(planningCategory) {
  const value = String(planningCategory || PLANNING_CATEGORY_REGULAR).trim();
  return value === PLANNING_CATEGORY_REGULAR || value === '';
}

export function resolveActivePlanningWindow(reference = new Date()) {
  if (isMorningPlanningWindow(reference)) return PLANNING_WINDOW_MORNING;
  if (isEveningPlanningWindow(reference)) return PLANNING_WINDOW_EVENING;
  return PLANNING_WINDOW_OUTSIDE;
}

export function isRegularTaskAllowed(taskDateIso, reference = new Date()) {
  const target = getPlanningTargetDateMode(taskDateIso, reference);
  if (target === 'today' && isMorningPlanningWindow(reference)) return true;
  if (target === 'tomorrow' && isEveningPlanningWindow(reference)) return true;
  return false;
}

export function assertRegularTaskAllowed(taskDateIso, reference = new Date(), location) {
  assertRegularPlanningAllowedOnDate(taskDateIso, location);
  if (isRegularTaskAllowed(taskDateIso, reference)) {
    return resolvePlanningWindowForRegularTask(taskDateIso, reference);
  }
  const err = new Error(REGULAR_TASK_BLOCKED_MESSAGE);
  err.statusCode = 400;
  throw err;
}

export function resolvePlanningWindowForRegularTask(taskDateIso, reference = new Date()) {
  const target = getPlanningTargetDateMode(taskDateIso, reference);
  if (target === 'today' && isMorningPlanningWindow(reference)) return PLANNING_WINDOW_MORNING;
  if (target === 'tomorrow' && isEveningPlanningWindow(reference)) return PLANNING_WINDOW_EVENING;
  return PLANNING_WINDOW_OUTSIDE;
}

export function isWorkingDayDateKey(dateKey, location) {
  return isCompanyWorkingDayDateKey(dateKey, location);
}

export function countWorkingDaysInMonth(year, month, location) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (isWorkingDayDateKey(key, location)) count += 1;
  }
  return count;
}

export function yearMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseYearMonthFromDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(dateKey || '').trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function istDateKeyFromIso(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return todayIstDateKey(d);
}

export function isTaskEligibleForPlanningScore(task) {
  if (!task) return false;
  const category = String(task.planningCategory || PLANNING_CATEGORY_REGULAR).trim();
  if (category !== PLANNING_CATEGORY_REGULAR) return false;

  const source = String(task.source || PLANNING_SOURCE_MANUAL).trim();
  if (source !== PLANNING_SOURCE_MANUAL) return false;

  const status = String(task.status || '').trim();
  if (status === 'Rescheduled') return false;

  return true;
}

/** Tasks that count toward the minimum planned-task requirement for a day. */
export function isTaskCountedTowardDailyMinimum(task) {
  if (!task) return false;
  const status = String(task.status || '').trim();
  if (status === 'Rescheduled') return false;
  return true;
}

export function countPlannedTasksForDate(tasks, dateKey) {
  const target = String(dateKey || '').trim().slice(0, 10);
  return (tasks || []).filter(
    (task) =>
      String(task.date || '').trim().slice(0, 10) === target &&
      isTaskCountedTowardDailyMinimum(task),
  ).length;
}

export function countPendingEveningReviewTasks(tasks, dateKey) {
  const target = String(dateKey || '').trim().slice(0, 10);
  return (tasks || []).filter((task) => {
    if (String(task.date || '').trim().slice(0, 10) !== target) return false;
    if (!isTaskCountedTowardDailyMinimum(task)) return false;
    const status = String(task.status || '').trim();
    return status !== 'Completed' && status !== 'Terminated' && status !== 'Not Completed';
  }).length;
}

function taskCreatedOnDateKey(task) {
  return istDateKeyFromIso(task.planningTimestamp || task.createdAt);
}

/**
 * Planning contribution for a single task (+1 previous day, +0.5 morning, else 0).
 */
export function computeTaskPlanningContribution(taskDateIso, planningTimestamp, location, reference) {
  const target = String(taskDateIso || '').trim().slice(0, 10);
  if (!target || !isWorkingDayDateKey(target, location)) return 0;

  const ref = reference
    ? new Date(reference)
    : planningTimestamp
      ? new Date(planningTimestamp)
      : new Date();
  if (Number.isNaN(ref.getTime())) return 0;

  const createdKey = todayIstDateKey(ref);
  const previousWorkingDay = getPreviousWorkingDayDateKey(target, location);

  if (previousWorkingDay && createdKey === previousWorkingDay) {
    return TASK_PLANNING_SCORE_PREVIOUS_DAY;
  }
  if (createdKey === target && isMorningPlanningWindow(ref)) {
    return TASK_PLANNING_SCORE_MORNING;
  }
  return 0;
}

export function computeTaskCompletionContribution(status) {
  const value = String(status || '').trim();
  if (value === 'Completed') return TASK_COMPLETION_SCORE_COMPLETED;
  if (value === 'Terminated' || value === 'Not Completed') {
    return TASK_COMPLETION_SCORE_NOT_COMPLETED;
  }
  return 0;
}

export function computeTaskScoreFields(task, location) {
  const planningScore = Number.isFinite(Number(task?.planningScore))
    ? Number(task.planningScore)
    : computeTaskPlanningContribution(
        task?.date,
        task?.planningTimestamp || task?.createdAt,
        location,
      );
  const completionScore = Number.isFinite(Number(task?.completionScore))
    ? Number(task.completionScore)
    : computeTaskCompletionContribution(task?.status);
  const finalScore = Number.isFinite(Number(task?.finalScore))
    ? Number(task.finalScore)
    : planningScore + completionScore;
  return { planningScore, completionScore, finalScore };
}

/**
 * Day score = sum of eligible task finalScores for that working day.
 */
export function computeWorkingDayPlanningScore(targetDateKey, tasks, location) {
  const target = String(targetDateKey || '').trim().slice(0, 10);
  if (!target || !isWorkingDayDateKey(target, location)) return 0;

  const eligible = (tasks || []).filter(
    (task) =>
      String(task.date || '').trim().slice(0, 10) === target && isTaskEligibleForPlanningScore(task),
  );

  return eligible.reduce((sum, task) => {
    const { finalScore } = computeTaskScoreFields(task, location);
    return sum + finalScore;
  }, 0);
}

/** Flags for daily log — based on whether planning was mostly prior-day vs morning. */
export function derivePlanningDayFlags(dayScore, tasks, targetDateKey, location) {
  void dayScore;
  const target = String(targetDateKey || '').trim().slice(0, 10);
  const eligible = (tasks || []).filter(
    (task) =>
      String(task.date || '').trim().slice(0, 10) === target && isTaskEligibleForPlanningScore(task),
  );
  if (eligible.length === 0) {
    return { morningAwarded: false, eveningAwarded: false };
  }

  const previousWorkingDay = getPreviousWorkingDayDateKey(target, location);
  let previous = 0;
  let morning = 0;
  for (const task of eligible) {
    const createdKey = taskCreatedOnDateKey(task);
    if (previousWorkingDay && createdKey === previousWorkingDay) previous += 1;
    else if (createdKey === target) morning += 1;
  }

  return {
    morningAwarded: morning > 0,
    eveningAwarded: previous > 0 && previous === eligible.length,
  };
}

/**
 * A working day counts as "planned ahead" when ≥10 eligible tasks and all were planned previous day.
 */
export function isWorkingDayPlannedAhead(targetDateKey, tasks, location) {
  const target = String(targetDateKey || '').trim().slice(0, 10);
  if (!target || !isWorkingDayDateKey(target, location)) return false;

  const eligible = (tasks || []).filter(
    (task) =>
      String(task.date || '').trim().slice(0, 10) === target && isTaskEligibleForPlanningScore(task),
  );
  if (eligible.length < MIN_PLANNED_TASKS_PER_WORKING_DAY) return false;

  const previousWorkingDay = getPreviousWorkingDayDateKey(target, location);
  if (!previousWorkingDay) return false;

  return eligible.every((task) => taskCreatedOnDateKey(task) === previousWorkingDay);
}

export function isWorkingDaySameDayOnly(targetDateKey, tasks, location) {
  const target = String(targetDateKey || '').trim().slice(0, 10);
  if (!target || !isWorkingDayDateKey(target, location)) return false;

  const eligible = (tasks || []).filter(
    (task) =>
      String(task.date || '').trim().slice(0, 10) === target && isTaskEligibleForPlanningScore(task),
  );
  if (eligible.length < MIN_PLANNED_TASKS_PER_WORKING_DAY) return false;

  return eligible.every((task) => {
    const createdKey = taskCreatedOnDateKey(task);
    if (createdKey !== target) return false;
    const ref = new Date(task.planningTimestamp || task.createdAt);
    return !Number.isNaN(ref.getTime()) && isMorningPlanningWindow(ref);
  });
}

/**
 * @deprecated Incremental window scoring replaced by task-level scores.
 */
export function calculatePlanningScoreIncrement(dailyLog, taskDateIso, reference = new Date()) {
  void dailyLog;
  void taskDateIso;
  void reference;
  return 0;
}

/** Badge tiers are driven by planning-ahead percentage (not score). */
export function calculatePlannerBadge(planningAheadPercent) {
  const pct = Number(planningAheadPercent) || 0;
  if (pct >= 90) return { badge: 'Platinum Planner', emoji: '🥇' };
  if (pct >= 75) return { badge: 'Gold Planner', emoji: '🥈' };
  if (pct >= 55) return { badge: 'Silver Planner', emoji: '🥉' };
  if (pct >= 35) return { badge: 'Bronze Planner', emoji: '🏅' };
  return { badge: 'No Badge', emoji: '' };
}

/** @deprecated Use calculatePlannerBadge(planningAheadPercent) */
export function calculateMonthlyBadge(normalizedScore) {
  return calculatePlannerBadge(normalizedScore);
}

export function calculatePlannerRating(planningScore) {
  const score = Number(planningScore) || 0;
  if (score >= 90) return { stars: 5, label: 'Excellent Planner' };
  if (score >= 75) return { stars: 4, label: 'Very Good Planner' };
  if (score >= 55) return { stars: 3, label: 'Good Planner' };
  if (score >= 35) return { stars: 2, label: 'Needs Improvement' };
  return { stars: 1, label: 'Poor Planner' };
}

/**
 * Normalized Planning Score (0–100) from task-level rawScore.
 * Optional late/urgent penalties still apply on top of the normalized base.
 */
export function calculatePlanningScore({
  latePlanningCount = 0,
  urgentTaskCount = 0,
  rawScore = 0,
  workingDays = 1,
} = {}) {
  const normalized = normalizeMonthlyPlanningScore(rawScore, workingDays);
  const late = Math.max(0, Number(latePlanningCount) || 0);
  const urgent = Math.max(0, Number(urgentTaskCount) || 0);
  const score = normalized - late * LATE_PLANNING_PENALTY - urgent * URGENT_TASK_PENALTY;
  return Math.max(0, Math.min(BASE_PLANNING_SCORE, score));
}

export function calculatePlanningPercentage(daysPlannedAhead, workingDays) {
  const days = Math.max(0, Number(daysPlannedAhead) || 0);
  const total = Math.max(1, Number(workingDays) || 1);
  return Math.min(100, Math.round((days / total) * 100));
}

/**
 * Count days marked planned-ahead on daily logs (eveningAwarded = all prior-day planning).
 */
export function countDaysPlannedAhead(dailyLogs, asOfDateKey, location) {
  const seen = new Set();
  for (const log of dailyLogs || []) {
    const dateKey = String(log?.logDate || '').trim();
    if (!dateKey || !isWorkingDayDateKey(dateKey, location)) continue;
    if (asOfDateKey && dateKey > String(asOfDateKey).trim().slice(0, 10)) continue;
    if (log.eveningAwarded || log.plannedAhead) {
      seen.add(dateKey);
    }
  }
  return seen.size;
}

/** Working days in month on or before asOfDateKey (inclusive). */
export function countWorkingDaysCompletedInMonth(year, month, asOfDateKey, location) {
  const asOf = String(asOfDateKey || '').trim().slice(0, 10);
  if (!asOf) return countWorkingDaysInMonth(year, month, location);

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (key > asOf) break;
    if (isWorkingDayDateKey(key, location)) count += 1;
  }
  return count;
}

export function listWorkingDayDateKeysInMonth(year, month, asOfDateKey, location) {
  const asOf = asOfDateKey ? String(asOfDateKey).trim().slice(0, 10) : '';
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const keys = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (asOf && key > asOf) break;
    if (isWorkingDayDateKey(key, location)) keys.push(key);
  }
  return keys;
}

export function aggregateDailyLogMetrics(dailyLogs, asOfDateKey, location) {
  let sameDayPlanningCount = 0;
  let workingDaysMissed = 0;
  const asOf = asOfDateKey ? String(asOfDateKey).trim().slice(0, 10) : '';

  for (const log of dailyLogs || []) {
    const dateKey = String(log?.logDate || '').trim();
    if (!dateKey || !isWorkingDayDateKey(dateKey, location)) continue;
    if (asOf && dateKey > asOf) continue;
    const score = Number(log?.dayScore) || 0;
    if (log.sameDayOnly || (log.morningAwarded && !log.eveningAwarded)) {
      sameDayPlanningCount += 1;
    }
    if (score === 0) workingDaysMissed += 1;
  }

  return { sameDayPlanningCount, workingDaysMissed };
}

/** Urgent tasks outside the urgent-only window count as late planning. */
export function isLatePlanningWindow(reference = new Date()) {
  if (isMorningPlanningWindow(reference)) return true;
  if (isEveningPlanningWindow(reference)) return true;
  const mins = getIstMinutesSinceMidnight(reference);
  const closedStart = minutesFrom(MORNING_END_HOUR, MORNING_END_MINUTE);
  const closedEnd = minutesFrom(EVENING_START_HOUR, EVENING_START_MINUTE);
  return mins >= closedStart && mins < closedEnd;
}

export function normalizeMonthlyPlanningScore(rawScore, workingDays) {
  const days = Math.max(1, Number(workingDays) || 1);
  const maxScore = days * MAX_SCORE_PER_WORKING_DAY;
  const raw = Math.max(0, Number(rawScore) || 0);
  return Math.min(100, Math.round((raw / maxScore) * 100));
}

export function buildMinimumTasksWarningMessage(plannedCount) {
  const count = Math.max(0, Number(plannedCount) || 0);
  const remaining = Math.max(0, MIN_PLANNED_TASKS_PER_WORKING_DAY - count);
  return (
    `You currently have only ${count} planned tasks for today.\n\n` +
    `Company policy requires a minimum of ${MIN_PLANNED_TASKS_PER_WORKING_DAY} planned tasks every working day.\n\n` +
    `Please create the remaining ${remaining} tasks immediately.`
  );
}

export function getPlanningConfig(reference = new Date(), location) {
  return {
    timezone: PLANNING_TIMEZONE,
    serverTimeIso: reference.toISOString(),
    todayIst: todayIstDateKey(reference),
    tomorrowIst: tomorrowIstDateKey(reference),
    employeeLocation: normalizeEmployeeLocationLabel(location),
    minPlannedTasksPerWorkingDay: MIN_PLANNED_TASKS_PER_WORKING_DAY,
    windows: {
      morning: {
        start: `${String(MORNING_START_HOUR).padStart(2, '0')}:${String(MORNING_START_MINUTE).padStart(2, '0')}`,
        end: `${String(MORNING_END_HOUR).padStart(2, '0')}:${String(MORNING_END_MINUTE).padStart(2, '0')}`,
        active: isMorningPlanningWindow(reference),
      },
      evening: {
        start: `${String(EVENING_START_HOUR).padStart(2, '0')}:${String(EVENING_START_MINUTE).padStart(2, '0')}`,
        end: `${String(EVENING_END_HOUR).padStart(2, '0')}:${String(EVENING_END_MINUTE).padStart(2, '0')}`,
        active: isEveningPlanningWindow(reference),
      },
    },
    scores: {
      taskPreviousDay: TASK_PLANNING_SCORE_PREVIOUS_DAY,
      taskMorning: TASK_PLANNING_SCORE_MORNING,
      taskCompleted: TASK_COMPLETION_SCORE_COMPLETED,
      taskNotCompleted: TASK_COMPLETION_SCORE_NOT_COMPLETED,
      morning: MORNING_PLANNING_SCORE,
      evening: EVENING_PLANNING_SCORE,
      dailyCap: DAILY_PLANNING_SCORE_CAP,
      maxPerWorkingDay: MAX_SCORE_PER_WORKING_DAY,
      base: BASE_PLANNING_SCORE,
      latePenalty: LATE_PLANNING_PENALTY,
      urgentPenalty: URGENT_TASK_PENALTY,
    },
    regularTaskBlockedMessage: REGULAR_TASK_BLOCKED_MESSAGE,
  };
}

function normalizeEmployeeLocationLabel(location) {
  const value = String(location || '').trim();
  return value === 'Factory' ? 'Factory' : 'Office';
}
