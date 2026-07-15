/**
 * Team Performance — manager analytics dashboard (Phase 2).
 * Reuses Phase 1 monthly planning records; no planner task scans.
 */

import * as DailyPlannerPlanningModel from '../models/DailyPlannerPlanning.js';
import * as DailyPlannerTeamMappingsModel from '../models/DailyPlannerTeamMappings.js';
import { canAccessAllRecords } from '../utils/accessControl.js';
import {
  calculatePlannerRating,
  calculatePlanningScore,
  countWorkingDaysInMonth,
  yearMonthKey,
} from '../utils/planningRecognition.js';
import { todayIstDateKey } from '../utils/salesQuotationDates.js';

const BADGE_ORDER = [
  'Platinum Planner',
  'Gold Planner',
  'Silver Planner',
  'Bronze Planner',
  'No Badge',
];

function employeeCodeOf(authUser) {
  return String(authUser?.employeeCode || authUser?.id || '').trim();
}

function parseMonthQuery(year, month, reference = new Date()) {
  const y = Number.parseInt(String(year ?? '').trim(), 10);
  const m = Number.parseInt(String(month ?? '').trim(), 10);
  if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
    return { year: y, month: m };
  }
  const today = todayIstDateKey(reference);
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(today);
  if (!match) {
    const now = new Date(reference);
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

function defaultEmployeeStats(employeeCode, employeeName, year, month) {
  const workingDays = countWorkingDaysInMonth(year, month);
  const planningScore = calculatePlanningScore({
    latePlanningCount: 0,
    urgentTaskCount: 0,
    rawScore: 0,
    workingDays,
  });
  const ratingInfo = calculatePlannerRating(planningScore);
  return {
    employeeCode,
    employeeName,
    year,
    month,
    yearMonth: yearMonthKey(year, month),
    planningScore,
    normalizedScore: planningScore,
    planningAheadPercent: 0,
    daysPlannedAhead: 0,
    workingDays,
    regularTaskCount: 0,
    urgentTaskCount: 0,
    badge: 'No Badge',
    badgeEmoji: '',
    rating: ratingInfo.label,
    ratingLabel: ratingInfo.label,
    ratingStars: ratingInfo.stars,
    status: derivePerformanceStatus(planningScore),
  };
}

export function derivePerformanceStatus(planningScore) {
  const score = Number(planningScore) || 0;
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 55) return 'Average';
  return 'Needs Improvement';
}

async function resolveTeamMembers(managerCode, effectiveRole) {
  if (canAccessAllRecords(effectiveRole)) {
    const mappings = await DailyPlannerTeamMappingsModel.listAllMappings();
    const active = mappings.filter((m) => m.status === 'Active');
    const byCode = new Map();
    for (const mapping of active) {
      if (!mapping.employeeCode) continue;
      byCode.set(mapping.employeeCode, {
        employeeCode: mapping.employeeCode,
        employeeName: mapping.employeeName || mapping.employeeCode,
      });
    }
    return [...byCode.values()];
  }

  const team = await DailyPlannerTeamMappingsModel.listEmployeesForManager(managerCode);
  return team.map((m) => ({
    employeeCode: m.employeeCode,
    employeeName: m.employeeName || m.employeeCode,
  }));
}

export async function assertCanManageTeam(authUser, effectiveRole) {
  const managerCode = employeeCodeOf(authUser);
  if (!managerCode) {
    const err = new Error('Employee code is required');
    err.statusCode = 400;
    throw err;
  }
  if (canAccessAllRecords(effectiveRole)) return managerCode;

  const team = await DailyPlannerTeamMappingsModel.listEmployeesForManager(managerCode);
  if (team.length === 0) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return managerCode;
}

async function loadEmployeeMonthlyStats(employeeCode, employeeName, year, month) {
  const record = await DailyPlannerPlanningModel.getMonthlyRecord(employeeCode, year, month);
  if (!record) {
    return defaultEmployeeStats(employeeCode, employeeName, year, month);
  }
  const planningScore = record.planningScore ?? record.normalizedScore ?? 0;
  return {
    employeeCode,
    employeeName,
    year: record.year,
    month: record.month,
    yearMonth: record.yearMonth,
    planningScore,
    normalizedScore: planningScore,
    planningAheadPercent: record.planningAheadPercent ?? 0,
    daysPlannedAhead: record.daysPlannedAhead ?? 0,
    workingDays: record.workingDays ?? countWorkingDaysInMonth(year, month),
    regularTaskCount: record.regularTaskCount ?? 0,
    urgentTaskCount: record.urgentTaskCount ?? 0,
    badge: record.badge || 'No Badge',
    badgeEmoji: record.badgeEmoji || '',
    rating: record.ratingLabel || record.rating || '',
    ratingLabel: record.ratingLabel || record.rating || '',
    ratingStars: record.ratingStars ?? 0,
    status: derivePerformanceStatus(planningScore),
  };
}

function sortByPerformance(a, b) {
  const scoreDiff = (b.planningScore || 0) - (a.planningScore || 0);
  if (scoreDiff !== 0) return scoreDiff;
  return (b.planningAheadPercent || 0) - (a.planningAheadPercent || 0);
}

export function getAverageTeamScore(employees) {
  if (!employees?.length) return 0;
  const total = employees.reduce((sum, row) => sum + (Number(row.planningScore) || 0), 0);
  return Math.round(total / employees.length);
}

export function getAveragePlanningPercentage(employees) {
  if (!employees?.length) return 0;
  const total = employees.reduce((sum, row) => sum + (Number(row.planningAheadPercent) || 0), 0);
  return Math.round(total / employees.length);
}

export function getTopPlanner(employees) {
  if (!employees?.length) return null;
  return [...employees].sort(sortByPerformance)[0];
}

export function getTeamLeaderboard(employees, limit = 10) {
  return [...(employees || [])].sort(sortByPerformance).slice(0, limit);
}

export function getBadgeDistribution(employees) {
  const counts = Object.fromEntries(BADGE_ORDER.map((badge) => [badge, 0]));
  for (const row of employees || []) {
    const badge = BADGE_ORDER.includes(row.badge) ? row.badge : 'No Badge';
    counts[badge] = (counts[badge] || 0) + 1;
  }
  const teamSize = employees?.length || 0;
  return BADGE_ORDER.map((badge) => ({
    badge,
    emoji:
      badge === 'Platinum Planner'
        ? '🥇'
        : badge === 'Gold Planner'
          ? '🥈'
          : badge === 'Silver Planner'
            ? '🥉'
            : badge === 'Bronze Planner'
              ? '🏅'
              : '',
    count: counts[badge] || 0,
    percent: teamSize > 0 ? Math.round(((counts[badge] || 0) / teamSize) * 100) : 0,
  }));
}

export function getPlanningInsights(employees) {
  const rows = employees || [];
  const teamSize = rows.length;
  if (teamSize === 0) {
    return {
      highestPlanningScore: 0,
      lowestPlanningScore: 0,
      averagePlanningScore: 0,
      averagePlanningPercent: 0,
      totalUrgentTasks: 0,
      totalRegularTasks: 0,
      averageUrgentTasksPerEmployee: 0,
      bestPlanner: null,
      needsMostImprovement: null,
    };
  }

  const sorted = [...rows].sort(sortByPerformance);
  const scores = rows.map((r) => Number(r.planningScore) || 0);
  const totalUrgent = rows.reduce((sum, r) => sum + (Number(r.urgentTaskCount) || 0), 0);
  const totalRegular = rows.reduce((sum, r) => sum + (Number(r.regularTaskCount) || 0), 0);

  return {
    highestPlanningScore: Math.max(...scores),
    lowestPlanningScore: Math.min(...scores),
    averagePlanningScore: getAverageTeamScore(rows),
    averagePlanningPercent: getAveragePlanningPercentage(rows),
    totalUrgentTasks: totalUrgent,
    totalRegularTasks: totalRegular,
    averageUrgentTasksPerEmployee: Math.round((totalUrgent / teamSize) * 10) / 10,
    bestPlanner: sorted[0]
      ? {
          employeeCode: sorted[0].employeeCode,
          employeeName: sorted[0].employeeName,
          planningScore: sorted[0].planningScore,
          badge: sorted[0].badge,
          badgeEmoji: sorted[0].badgeEmoji,
        }
      : null,
    needsMostImprovement: sorted[teamSize - 1]
      ? {
          employeeCode: sorted[teamSize - 1].employeeCode,
          employeeName: sorted[teamSize - 1].employeeName,
          planningScore: sorted[teamSize - 1].planningScore,
          badge: sorted[teamSize - 1].badge,
          badgeEmoji: sorted[teamSize - 1].badgeEmoji,
        }
      : null,
  };
}

export async function getTeamPerformance(authUser, effectiveRole, query = {}) {
  const managerCode = await assertCanManageTeam(authUser, effectiveRole);
  const { year, month } = parseMonthQuery(query.year, query.month);
  const teamMembers = await resolveTeamMembers(managerCode, effectiveRole);

  const employees = await Promise.all(
    teamMembers.map((member) =>
      loadEmployeeMonthlyStats(member.employeeCode, member.employeeName, year, month),
    ),
  );

  const sorted = [...employees].sort(sortByPerformance);
  const topPlanner = getTopPlanner(sorted);

  return {
    year,
    month,
    yearMonth: yearMonthKey(year, month),
    summary: {
      averageTeamScore: getAverageTeamScore(sorted),
      topPlanner: topPlanner
        ? {
            employeeCode: topPlanner.employeeCode,
            employeeName: topPlanner.employeeName,
            planningScore: topPlanner.planningScore,
            badge: topPlanner.badge,
            badgeEmoji: topPlanner.badgeEmoji,
          }
        : null,
      averagePlanningAheadPercent: getAveragePlanningPercentage(sorted),
      teamSize: sorted.length,
    },
    leaderboard: getTeamLeaderboard(sorted, 10).map((row, index) => ({
      rank: index + 1,
      ...row,
    })),
    employees: sorted,
    badgeDistribution: getBadgeDistribution(sorted),
    insights: getPlanningInsights(sorted),
  };
}
