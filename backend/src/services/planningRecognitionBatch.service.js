/**
 * Scheduled Planning Recognition — daily (8 PM IST) and monthly (1st 12:05 AM IST) batch jobs.
 * Persists monthly summaries so UI reads stored values without task scans on page load.
 */

import * as DailyPlannerPlanningModel from '../models/DailyPlannerPlanning.js';
import * as DailyPlannerTasksModel from '../models/DailyPlannerTasks.js';
import * as DailyPlannerTeamMappingsModel from '../models/DailyPlannerTeamMappings.js';
import * as PlanningRecognitionService from './planningRecognition.service.js';
import * as PlanningSnapshotService from './planningSnapshot.service.js';
import {
  computeWorkingDayPlanningScore,
  derivePlanningDayFlags,
  listWorkingDayDateKeysInMonth,
  parseYearMonthFromDateKey,
  yearMonthKey,
  isWorkingDayPlannedAhead,
  isWorkingDaySameDayOnly,
  computeTaskPlanningContribution,
  computeTaskCompletionContribution,
  isTaskEligibleForPlanningScore,
  countPlannedTasksForDate,
  countPendingEveningReviewTasks,
  MIN_PLANNED_TASKS_PER_WORKING_DAY,
} from '../utils/planningRecognition.js';
import { parseDateKey, todayIstDateKey } from '../utils/salesQuotationDates.js';
import { getEmployeeLocation } from '../utils/employeeLocation.js';
import { isCompanyWorkingDayDateKey } from '../utils/companyWorkingDays.js';
import * as PlannerNotificationEmitters from './notificationEmitters.js';

function monthBounds(year, month) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

export async function listAllPlannerEmployees() {
  const mappings = await DailyPlannerTeamMappingsModel.listAllMappings();
  const byCode = new Map();
  for (const mapping of mappings) {
    if (mapping.status !== 'Active' || !mapping.employeeCode) continue;
    byCode.set(mapping.employeeCode, {
      employeeCode: mapping.employeeCode,
      employeeName: mapping.employeeName || mapping.employeeCode,
      managerCode: mapping.managerCode || '',
    });
  }
  return [...byCode.values()];
}

async function countMonthlyTaskOutcomes(employeeCode, year, month) {
  const { startDate, endDate } = monthBounds(year, month);
  const tasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
    employeeCode,
    startDate,
    endDate,
  );
  let rescheduledCount = 0;
  let terminatedCount = 0;
  for (const task of tasks) {
    if (task.status === 'Rescheduled') rescheduledCount += 1;
    if (task.status === 'Terminated') terminatedCount += 1;
  }
  return { rescheduledCount, terminatedCount };
}

async function recomputeWorkingDaysFromTasks(employeeCode, year, month, asOfDateKey, location) {
  const workingDays = listWorkingDayDateKeysInMonth(year, month, asOfDateKey, location);
  if (workingDays.length === 0) return;

  const { startDate, endDate } = monthBounds(year, month);
  const allTasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
    employeeCode,
    startDate,
    endDate,
  );

  // Refresh stored task score fields from current status / timestamps
  await Promise.all(
    allTasks
      .filter((task) => isTaskEligibleForPlanningScore(task))
      .map(async (task) => {
        const planningScore = computeTaskPlanningContribution(
          task.date,
          task.planningTimestamp || task.createdAt,
          location,
        );
        const completionScore = computeTaskCompletionContribution(task.status);
        const finalScore = planningScore + completionScore;
        if (
          Number(task.planningScore) !== planningScore ||
          Number(task.completionScore) !== completionScore ||
          Number(task.finalScore) !== finalScore
        ) {
          await DailyPlannerTasksModel.updateTask(task.plannerTaskId, {
            planningScore,
            completionScore,
            finalScore,
          });
          task.planningScore = planningScore;
          task.completionScore = completionScore;
          task.finalScore = finalScore;
        }
      }),
  );

  await Promise.all(
    workingDays.map(async (dateKey) => {
      const dayTasks = allTasks.filter((task) => task.date === dateKey);
      const dayScore = computeWorkingDayPlanningScore(dateKey, dayTasks, location);
      const flags = derivePlanningDayFlags(dayScore, dayTasks, dateKey, location);
      await DailyPlannerPlanningModel.upsertDailyLog(employeeCode, dateKey, {
        dayScore,
        ...flags,
        plannedAhead: isWorkingDayPlannedAhead(dateKey, dayTasks, location),
        sameDayOnly: isWorkingDaySameDayOnly(dateKey, dayTasks, location),
      });
    }),
  );
}

export async function refreshEmployeeMonthlySummary(
  employeeCode,
  year,
  month,
  options = {},
) {
  const code = String(employeeCode || '').trim();
  if (!code || !year || !month) return null;

  const asOfDateKey = options.asOfDateKey
    ? String(options.asOfDateKey).trim().slice(0, 10)
    : '';
  const includeTaskCounts = Boolean(options.includeTaskCounts);
  const location = options.location || (await getEmployeeLocation(code));

  if (options.recomputeWorkingDays && asOfDateKey) {
    await recomputeWorkingDaysFromTasks(code, year, month, asOfDateKey, location);
  }

  const [dailyLogs, counters] = await Promise.all([
    DailyPlannerPlanningModel.listDailyLogsForMonth(code, year, month),
    PlanningRecognitionService.loadMonthlyCountersForEmployee(code, year, month),
  ]);

  let taskOutcomeCounts = {};
  if (includeTaskCounts) {
    taskOutcomeCounts = await countMonthlyTaskOutcomes(code, year, month);
  }

  const rawScore = dailyLogs.reduce((sum, row) => sum + (Number(row.dayScore) || 0), 0);
  const now = new Date().toISOString();

  return DailyPlannerPlanningModel.saveMonthlyRecord(code, year, month, {
    ...counters,
    ...taskOutcomeCounts,
    rawScore,
    dailyLogs,
    asOfDateKey: asOfDateKey || undefined,
    employeeLocation: location,
    lastCalculatedAt: now,
    monthlyRank: options.monthlyRank,
  });
}

function getPreviousCalendarMonth(reference = new Date()) {
  const today = parseDateKey(todayIstDateKey(reference));
  if (!today) return null;
  const prev = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return { year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 };
}

async function persistMonthlyRank(employeeCode, year, month, rank) {
  const existing = await DailyPlannerPlanningModel.getMonthlyRecord(employeeCode, year, month);
  if (!existing) return;

  const dailyLogs = await DailyPlannerPlanningModel.listDailyLogsForMonth(
    employeeCode,
    year,
    month,
  );
  const { endDate } = monthBounds(year, month);

  await DailyPlannerPlanningModel.saveMonthlyRecord(employeeCode, year, month, {
    regularTaskCount: existing.regularTaskCount,
    urgentTaskCount: existing.urgentTaskCount,
    latePlanningCount: existing.latePlanningCount,
    rescheduledCount: existing.rescheduledCount,
    terminatedCount: existing.terminatedCount,
    rawScore: existing.rawScore,
    dailyLogs,
    asOfDateKey: endDate,
    monthlyRank: rank,
    lastCalculatedAt: new Date().toISOString(),
  });
}

async function assignMonthlyRanksForTeam(teamMembers, year, month) {
  const records = await Promise.all(
    teamMembers.map(async (member) => ({
      member,
      record: await DailyPlannerPlanningModel.getMonthlyRecord(member.employeeCode, year, month),
    })),
  );

  const sortable = records.filter((row) => row.record);
  sortable.sort((a, b) => {
    const scoreDiff = (Number(b.record.planningScore) || 0) - (Number(a.record.planningScore) || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (Number(b.record.planningAheadPercent) || 0) - (Number(a.record.planningAheadPercent) || 0);
  });

  for (let index = 0; index < sortable.length; index += 1) {
    await persistMonthlyRank(sortable[index].member.employeeCode, year, month, index + 1);
  }
}

/**
 * Daily job — finalize today's planning and refresh current-month summary for every employee.
 */
export async function runDailyPlanningRecognitionJob(reference = new Date()) {
  const today = todayIstDateKey(reference);
  const ym = parseYearMonthFromDateKey(today);
  if (!ym) {
    return { processed: 0, today, skipped: true };
  }

  const employees = await listAllPlannerEmployees();
  let processed = 0;
  const errors = [];

  for (const employee of employees) {
    try {
      await refreshEmployeeMonthlySummary(employee.employeeCode, ym.year, ym.month, {
        asOfDateKey: today,
        recomputeWorkingDays: true,
        includeTaskCounts: true,
      });
      processed += 1;
    } catch (err) {
      errors.push({
        employeeCode: employee.employeeCode,
        error: err?.message || String(err),
      });
    }
  }

  return { processed, total: employees.length, today, year: ym.year, month: ym.month, errors };
}

/**
 * Monthly job — finalize previous month, snapshot employees and teams, assign ranks.
 */
export async function runMonthlyPlanningFinalizationJob(reference = new Date()) {
  const prev = getPreviousCalendarMonth(reference);
  if (!prev) {
    return { processed: 0, skipped: true };
  }

  const { year, month } = prev;
  const { endDate } = monthBounds(year, month);
  const employees = await listAllPlannerEmployees();
  let processed = 0;
  const errors = [];

  for (const employee of employees) {
    try {
      await refreshEmployeeMonthlySummary(employee.employeeCode, year, month, {
        asOfDateKey: endDate,
        recomputeWorkingDays: true,
        includeTaskCounts: true,
      });
      processed += 1;
    } catch (err) {
      errors.push({
        employeeCode: employee.employeeCode,
        error: err?.message || String(err),
      });
    }
  }

  const byManager = new Map();
  for (const employee of employees) {
    const mgr = employee.managerCode || '_unassigned';
    if (!byManager.has(mgr)) byManager.set(mgr, []);
    byManager.get(mgr).push(employee);
  }

  for (const [, team] of byManager) {
    await assignMonthlyRanksForTeam(team, year, month);
  }

  for (const employee of employees) {
    try {
      await PlanningSnapshotService.ensureEmployeeMonthlySnapshot(
        employee.employeeCode,
        employee.employeeName,
        year,
        month,
        employee.managerCode,
      );
    } catch (err) {
      errors.push({
        employeeCode: employee.employeeCode,
        phase: 'snapshot',
        error: err?.message || String(err),
      });
    }
  }

  const managerCodes = [...new Set(employees.map((e) => e.managerCode).filter(Boolean))];
  for (const managerCode of managerCodes) {
    try {
      await PlanningSnapshotService.ensureTeamMonthlySnapshotForManager(
        managerCode,
        { employeeCode: managerCode, role: 'Admin' },
        'Admin',
        year,
        month,
      );
    } catch (err) {
      errors.push({
        managerCode,
        phase: 'team-snapshot',
        error: err?.message || String(err),
      });
    }
  }

  return {
    processed,
    total: employees.length,
    year,
    month,
    yearMonth: yearMonthKey(year, month),
    errors,
  };
}

/**
 * After morning planning slot closes — notify employees below the 10-task minimum.
 */
export async function runMorningMinimumTasksValidationJob(reference = new Date()) {
  const today = todayIstDateKey(reference);
  const employees = await listAllPlannerEmployees();
  let notified = 0;
  const errors = [];

  for (const employee of employees) {
    try {
      const location = await getEmployeeLocation(employee.employeeCode);
      if (!isCompanyWorkingDayDateKey(today, location)) continue;

      const tasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
        employee.employeeCode,
        today,
        today,
      );
      const plannedCount = countPlannedTasksForDate(tasks, today);
      if (plannedCount >= MIN_PLANNED_TASKS_PER_WORKING_DAY) continue;

      await PlannerNotificationEmitters.emitPlanningReminder(employee.employeeCode, {
        plannerDate: today,
        date: today,
        reminderType: 'morning_minimum_tasks',
        plannedCount,
        minRequired: MIN_PLANNED_TASKS_PER_WORKING_DAY,
      });
      notified += 1;
    } catch (err) {
      errors.push({
        employeeCode: employee.employeeCode,
        error: err?.message || String(err),
      });
    }
  }

  return { notified, total: employees.length, today, errors };
}

/**
 * Evening review reminder — notify when planned tasks are still pending completion.
 */
export async function runEveningTaskReviewValidationJob(reference = new Date()) {
  const today = todayIstDateKey(reference);
  const employees = await listAllPlannerEmployees();
  let notified = 0;
  const errors = [];

  for (const employee of employees) {
    try {
      const location = await getEmployeeLocation(employee.employeeCode);
      if (!isCompanyWorkingDayDateKey(today, location)) continue;

      const tasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
        employee.employeeCode,
        today,
        today,
      );
      const pendingCount = countPendingEveningReviewTasks(tasks, today);
      if (pendingCount <= 0) continue;

      await PlannerNotificationEmitters.emitPlanningReminder(employee.employeeCode, {
        plannerDate: today,
        date: today,
        reminderType: 'evening_review',
        pendingCount,
      });
      notified += 1;
    } catch (err) {
      errors.push({
        employeeCode: employee.employeeCode,
        error: err?.message || String(err),
      });
    }
  }

  return { notified, total: employees.length, today, errors };
}
