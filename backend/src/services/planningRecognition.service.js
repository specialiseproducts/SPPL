/**
 * Planning Recognition — score awards, penalties, and monthly aggregation.
 */

import * as DailyPlannerPlanningModel from '../models/DailyPlannerPlanning.js';
import * as DailyPlannerTasksModel from '../models/DailyPlannerTasks.js';
import {
  computeWorkingDayPlanningScore,
  countWorkingDaysInMonth,
  derivePlanningDayFlags,
  isLatePlanningWindow,
  isWorkingDayPlannedAhead,
  isWorkingDaySameDayOnly,
  parseYearMonthFromDateKey,
  PLANNING_CATEGORY_REGULAR,
  PLANNING_CATEGORY_URGENT,
  resolvePlanningWindowForRegularTask,
  assertRegularTaskAllowed,
  getPlanningTargetDateMode,
  calculatePlanningScore,
  calculatePlannerBadge,
  calculatePlanningPercentage,
  calculatePlannerRating,
  countDaysPlannedAhead,
  tomorrowIstDateKey,
  yearMonthKey,
  getPlanningConfig as buildPlanningConfig,
  computeTaskPlanningContribution,
  computeTaskCompletionContribution,
} from '../utils/planningRecognition.js';
import {
  assertRegularPlanningAllowedOnDate,
  isCompanyWorkingDayDateKey,
} from '../utils/companyWorkingDays.js';
import { todayIstDateKey } from '../utils/salesQuotationDates.js';
import { getEmployeeLocation } from '../utils/employeeLocation.js';
import * as AuditTrailService from './auditTrail.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../constants/auditTrail.js';

export async function getPlanningConfig(reference = new Date(), employeeCode) {
  const location = employeeCode ? await getEmployeeLocation(employeeCode) : undefined;
  return buildPlanningConfig(reference, location);
}

export {
  calculatePlanningScore,
  calculatePlannerBadge,
  calculatePlanningPercentage,
  calculatePlannerRating,
} from '../utils/planningRecognition.js';

export { computeTaskPlanningContribution, computeTaskCompletionContribution };

async function loadMonthlyCounters(employeeCode, year, month) {
  const existing = await DailyPlannerPlanningModel.getMonthlyRecord(employeeCode, year, month);
  return {
    regularTaskCount: Number(existing?.regularTaskCount) || 0,
    urgentTaskCount: Number(existing?.urgentTaskCount) || 0,
    latePlanningCount: Number(existing?.latePlanningCount) || 0,
    rawScore: Number(existing?.rawScore) || 0,
    rescheduledCount: Number(existing?.rescheduledCount) || 0,
    terminatedCount: Number(existing?.terminatedCount) || 0,
  };
}

export const loadMonthlyCountersForEmployee = loadMonthlyCounters;

export async function recomputeMonthlyPlanningScore(
  employeeCode,
  year,
  month,
  counterPatch = {},
  location,
) {
  const resolvedLocation = location ?? (await getEmployeeLocation(employeeCode));
  const previous = await DailyPlannerPlanningModel.getMonthlyRecord(employeeCode, year, month);
  const [dailyLogs, counters] = await Promise.all([
    DailyPlannerPlanningModel.listDailyLogsForMonth(employeeCode, year, month),
    loadMonthlyCounters(employeeCode, year, month),
  ]);
  const merged = {
    ...counters,
    ...counterPatch,
  };
  const rawScore = dailyLogs.reduce((sum, row) => sum + (Number(row.dayScore) || 0), 0);
  const today = todayIstDateKey();
  const asOfDateKey = yearMonthKey(year, month) === today.slice(0, 7) ? today : undefined;
  const saved = await DailyPlannerPlanningModel.saveMonthlyRecord(employeeCode, year, month, {
    ...merged,
    rawScore,
    dailyLogs,
    asOfDateKey,
    employeeLocation: resolvedLocation,
    lastCalculatedAt: new Date().toISOString(),
  });

  const prevScore = Number(previous?.planningScore ?? previous?.normalizedScore);
  const nextScore = Number(saved?.planningScore ?? saved?.normalizedScore);
  const prevBadge = String(previous?.badge || '');
  const nextBadge = String(saved?.badge || '');
  const entityId = `${employeeCode}#${year}-${String(month).padStart(2, '0')}`;

  if (Number.isFinite(prevScore) && Number.isFinite(nextScore) && prevScore !== nextScore) {
    void AuditTrailService.log({
      module: AUDIT_MODULES.DAILY_PLANNER,
      entityType: 'planningRecord',
      entityId,
      action: AUDIT_ACTIONS.UPDATE,
      description: 'Planning Score Updated',
      performedBy: employeeCode,
      employeeCode,
      oldValues: { planningScore: prevScore },
      newValues: { planningScore: nextScore },
      metadata: { ownerEmployeeCode: employeeCode, year, month },
    });
  }
  if (nextBadge && nextBadge !== prevBadge) {
    void AuditTrailService.log({
      module: AUDIT_MODULES.DAILY_PLANNER,
      entityType: 'planningRecord',
      entityId,
      action: AUDIT_ACTIONS.CUSTOM,
      description: 'Badge Earned',
      performedBy: employeeCode,
      employeeCode,
      oldValues: prevBadge ? { badge: prevBadge } : null,
      newValues: { badge: nextBadge },
      metadata: { ownerEmployeeCode: employeeCode, year, month },
    });
  }

  return saved;
}

export async function recomputePlanningScoreForWorkingDay({
  employeeCode,
  workingDayDateKey,
}) {
  const code = String(employeeCode || '').trim();
  const targetDate = String(workingDayDateKey || '').trim().slice(0, 10);
  if (!code || !targetDate) return { dayScore: 0, pointsAwarded: 0, monthlyRecord: null };

  const ym = parseYearMonthFromDateKey(targetDate);
  if (!ym) return { dayScore: 0, pointsAwarded: 0, monthlyRecord: null };

  const location = await getEmployeeLocation(code);
  const tasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(code, targetDate, targetDate);
  const previousScore =
    Number((await DailyPlannerPlanningModel.getDailyLog(code, targetDate))?.dayScore) || 0;
  const dayScore = computeWorkingDayPlanningScore(targetDate, tasks, location);
  const flags = derivePlanningDayFlags(dayScore, tasks, targetDate, location);
  const plannedAhead = isWorkingDayPlannedAhead(targetDate, tasks, location);
  const sameDayOnly = isWorkingDaySameDayOnly(targetDate, tasks, location);

  await DailyPlannerPlanningModel.upsertDailyLog(code, targetDate, {
    dayScore,
    ...flags,
    plannedAhead,
    sameDayOnly,
  });

  const monthlyRecord = await recomputeMonthlyPlanningScore(
    code,
    ym.year,
    ym.month,
    {},
    location,
  );
  return {
    dayScore,
    pointsAwarded: dayScore - previousScore,
    monthlyRecord,
  };
}

export async function awardPlanningScoreForRegularTask({
  employeeCode,
  taskDateIso,
}) {
  const code = String(employeeCode || '').trim();
  const targetDate = String(taskDateIso || '').trim().slice(0, 10);
  const result = await recomputePlanningScoreForWorkingDay({
    employeeCode: code,
    workingDayDateKey: targetDate,
  });

  const ym = parseYearMonthFromDateKey(targetDate);
  if (!ym) return result;

  const counters = await loadMonthlyCounters(code, ym.year, ym.month);
  const monthlyRecord = await recomputeMonthlyPlanningScore(code, ym.year, ym.month, {
    regularTaskCount: counters.regularTaskCount + 1,
  });
  return { ...result, monthlyRecord };
}

export async function validateRescheduleTargetDate(newDateIso, reference = new Date(), location) {
  const newDate = String(newDateIso || '').trim().slice(0, 10);
  const today = todayIstDateKey(reference);
  if (!newDate) {
    const err = new Error('New date is required');
    err.statusCode = 400;
    throw err;
  }
  if (newDate < today) {
    const err = new Error('Past dates are not allowed');
    err.statusCode = 400;
    throw err;
  }
  assertRegularPlanningAllowedOnDate(newDate, location);
  if (!isCompanyWorkingDayDateKey(newDate, location)) {
    const err = new Error('Selected date must be a working day');
    err.statusCode = 400;
    throw err;
  }

  const tomorrow = tomorrowIstDateKey(reference);
  if (newDate === today || newDate === tomorrow) {
    assertRegularTaskAllowed(newDate, reference, location);
    return newDate;
  }

  return newDate;
}

export async function recordPlanningImpactForUrgentTask({
  employeeCode,
  reference = new Date(),
}) {
  const planningDate = todayIstDateKey(reference);
  const ym = parseYearMonthFromDateKey(planningDate);
  if (!ym) return { monthlyRecord: null };

  const counters = await loadMonthlyCounters(employeeCode, ym.year, ym.month);
  counters.urgentTaskCount += 1;
  if (isLatePlanningWindow(reference)) {
    counters.latePlanningCount += 1;
  }

  const dailyLogs = await DailyPlannerPlanningModel.listDailyLogsForMonth(
    employeeCode,
    ym.year,
    ym.month,
  );
  const monthlyRecord = await recomputeMonthlyPlanningScore(employeeCode, ym.year, ym.month, {
    urgentTaskCount: counters.urgentTaskCount,
    latePlanningCount: counters.latePlanningCount,
  });
  return { monthlyRecord };
}

export function validateTaskPlanningPayload(body, reference = new Date(), location) {
  const planningCategory = String(body.planningCategory || PLANNING_CATEGORY_REGULAR).trim();
  const taskDate = String(body.date || '').trim().slice(0, 10);
  const urgentReason = String(body.urgentReason || '').trim();

  if (getPlanningTargetDateMode(taskDate, reference) === 'past') {
    const err = new Error('Cannot create tasks for past dates');
    err.statusCode = 400;
    throw err;
  }

  if (planningCategory === PLANNING_CATEGORY_URGENT) {
    if (!urgentReason) {
      const err = new Error('Urgent Task Reason is required');
      err.statusCode = 400;
      throw err;
    }
    return {
      planningCategory: PLANNING_CATEGORY_URGENT,
      urgentReason,
      planningWindowUsed: null,
      planningTimestamp: reference.toISOString(),
    };
  }

  assertRegularTaskAllowed(taskDate, reference, location);
  const planningWindowUsed = resolvePlanningWindowForRegularTask(taskDate, reference);

  return {
    planningCategory: PLANNING_CATEGORY_REGULAR,
    urgentReason: '',
    planningWindowUsed,
    planningTimestamp: reference.toISOString(),
  };
}

function buildDefaultMonthlyRecord(employeeCode, year, month, location) {
  const workingDays = countWorkingDaysInMonth(year, month, location);
  const planningScore = calculatePlanningScore({
    latePlanningCount: 0,
    urgentTaskCount: 0,
    rawScore: 0,
    workingDays,
  });
  const badgeInfo = calculatePlannerBadge(0);
  const ratingInfo = calculatePlannerRating(planningScore);
  return {
    employeeCode,
    year,
    month,
    yearMonth: `${year}-${String(month).padStart(2, '0')}`,
    rawScore: 0,
    maxScore: workingDays * 30,
    normalizedScore: planningScore,
    planningScore,
    planningAheadPercent: 0,
    daysPlannedAhead: 0,
    regularTaskCount: 0,
    urgentTaskCount: 0,
    latePlanningCount: 0,
    badge: badgeInfo.badge,
    badgeEmoji: badgeInfo.emoji,
    rating: ratingInfo.label,
    ratingLabel: ratingInfo.label,
    ratingStars: ratingInfo.stars,
    workingDays,
  };
}

export async function getEmployeePlanningStats(employeeCode, reference = new Date()) {
  const today = todayIstDateKey(reference);
  const ym = parseYearMonthFromDateKey(today);
  if (!ym) {
    return {
      currentMonth: null,
      history: [],
      todayIst: today,
    };
  }

  let currentMonth = await DailyPlannerPlanningModel.getMonthlyRecord(
    employeeCode,
    ym.year,
    ym.month,
  );

  if (!currentMonth) {
    const location = await getEmployeeLocation(employeeCode);
    currentMonth = buildDefaultMonthlyRecord(employeeCode, ym.year, ym.month, location);
  }

  const history = await DailyPlannerPlanningModel.listMonthlySnapshots(employeeCode);
  const historyFromSnapshots = history.map((row) => ({
    employeeCode: row.employeeCode,
    year: row.year,
    month: row.month,
    yearMonth: row.yearMonth,
    rawScore: 0,
    maxScore: (row.workingDays || 0) * 10,
    normalizedScore: row.planningScore,
    planningScore: row.planningScore,
    planningAheadPercent: row.planningAheadPercent,
    daysPlannedAhead: row.daysPlannedAhead,
    regularTaskCount: row.regularTaskCount,
    urgentTaskCount: row.urgentTaskCount,
    latePlanningCount: row.latePlanningCount,
    badge: row.badge,
    badgeEmoji: row.badgeEmoji,
    rating: row.ratingLabel || row.rating,
    ratingLabel: row.ratingLabel || row.rating,
    ratingStars: row.ratingStars,
    workingDays: row.workingDays,
    monthlyRank: null,
    lastCalculatedAt: row.snapshotCreatedAt,
  }));

  const liveHistory = await DailyPlannerPlanningModel.listMonthlyHistory(employeeCode);
  const closedMonths = new Set(historyFromSnapshots.map((h) => h.yearMonth));
  const mergedHistory = [
    ...historyFromSnapshots,
    ...liveHistory.filter((row) => !closedMonths.has(row.yearMonth)),
  ].sort((a, b) => String(b.yearMonth).localeCompare(String(a.yearMonth)));

  return {
    currentMonth: currentMonth || buildDefaultMonthlyRecord(employeeCode, ym.year, ym.month),
    history: mergedHistory,
    todayIst: today,
  };
}

export async function getEmployeePlanningProfile(employeeCode, reference = new Date()) {
  return getEmployeePlanningStats(employeeCode, reference);
}
