/**
 * Planning analytics — dashboard widgets, reports, trends, export payloads.
 */

import * as DailyPlannerTeamMappingsModel from '../models/DailyPlannerTeamMappings.js';
import { canAccessAllRecords } from '../utils/accessControl.js';
import { yearMonthKey } from '../utils/planningRecognition.js';
import { todayIstDateKey } from '../utils/salesQuotationDates.js';
import * as PlanningSnapshotService from './planningSnapshot.service.js';
import * as TeamPerformanceService from './teamPerformance.service.js';
import { derivePerformanceStatus } from './teamPerformance.service.js';

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

function trendDirection(current, previous) {
  const diff = (Number(current) || 0) - (Number(previous) || 0);
  if (diff > 0) return { direction: 'up', delta: diff, label: `↑ +${diff}` };
  if (diff < 0) return { direction: 'down', delta: diff, label: `↓ ${diff}` };
  return { direction: 'stable', delta: 0, label: '→ Stable' };
}

function badgeRank(badge) {
  const order = ['No Badge', 'Bronze Planner', 'Silver Planner', 'Gold Planner', 'Platinum Planner'];
  return order.indexOf(badge);
}

function badgeTrend(currentBadge, previousBadge) {
  const current = badgeRank(currentBadge);
  const previous = badgeRank(previousBadge);
  if (current > previous) return { direction: 'up', label: `↑ ${previousBadge} → ${currentBadge}` };
  if (current < previous) return { direction: 'down', label: `↓ ${previousBadge} → ${currentBadge}` };
  return { direction: 'stable', label: `→ ${currentBadge}` };
}

export function generateMonthlyComment(planningScore, planningAheadPercent, urgentTaskCount) {
  const score = Number(planningScore) || 0;
  const pct = Number(planningAheadPercent) || 0;
  const urgent = Number(urgentTaskCount) || 0;
  if (score >= 90 && pct >= 85) return 'Excellent proactive planning throughout the month.';
  if (score >= 75 && pct >= 70) return 'Strong planning habits with consistent follow-through.';
  if (urgent >= 5) return 'High urgent task volume suggests planning consistency needs improvement.';
  if (score >= 55) return 'Planning consistency is improving but can be strengthened further.';
  return 'Planning consistency needs improvement.';
}

export function buildPerformanceBreakdown(planningScore) {
  const score = Number(planningScore) || 0;
  return {
    excellent: score >= 90,
    good: score >= 75 && score < 90,
    average: score >= 55 && score < 75,
    needsImprovement: score < 55,
    status: derivePerformanceStatus(score),
  };
}

export function calculatePlanningTrends(history) {
  const rows = [...(history || [])].sort((a, b) =>
    String(a.yearMonth).localeCompare(String(b.yearMonth)),
  );
  if (rows.length === 0) {
    return {
      highestEverScore: 0,
      averageScore: 0,
      bestMonth: null,
      worstMonth: null,
      mostImprovedMonth: null,
      longestPlatinumStreak: 0,
      badgeProgression: [],
      planningGrowthPercent: 0,
    };
  }

  const scores = rows.map((r) => Number(r.planningScore) || 0);
  const highestEverScore = Math.max(...scores);
  const averageScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const bestMonth = rows.reduce((best, row) =>
    (row.planningScore || 0) > (best?.planningScore || 0) ? row : best,
  rows[0]);
  const worstMonth = rows.reduce((worst, row) =>
    (row.planningScore || 0) < (worst?.planningScore || 0) ? row : worst,
  rows[0]);

  let mostImprovedMonth = null;
  let maxImprovement = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const improvement = (rows[i].planningScore || 0) - (rows[i - 1].planningScore || 0);
    if (improvement > maxImprovement) {
      maxImprovement = improvement;
      mostImprovedMonth = { ...rows[i], improvement };
    }
  }

  let longestPlatinumStreak = 0;
  let currentStreak = 0;
  for (const row of rows) {
    if (row.badge === 'Platinum Planner') {
      currentStreak += 1;
      longestPlatinumStreak = Math.max(longestPlatinumStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  const badgeProgression = rows.map((row) => ({
    yearMonth: row.yearMonth,
    badge: row.badge,
    badgeEmoji: row.badgeEmoji,
  }));

  const first = rows[0];
  const last = rows[rows.length - 1];
  const planningGrowthPercent =
    first.planningAheadPercent > 0
      ? Math.round(
          (((last.planningAheadPercent || 0) - (first.planningAheadPercent || 0)) /
            first.planningAheadPercent) *
            100,
        )
      : 0;

  return {
    highestEverScore,
    averageScore,
    bestMonth,
    worstMonth,
    mostImprovedMonth,
    longestPlatinumStreak,
    badgeProgression,
    planningGrowthPercent,
  };
}

async function assertEmployeeAccess(requesterCode, targetCode, effectiveRole) {
  if (targetCode === requesterCode) return;
  if (canAccessAllRecords(effectiveRole)) return;
  const mapping = await DailyPlannerTeamMappingsModel.findActiveManagerForEmployee(targetCode);
  if (!mapping || mapping.managerCode !== requesterCode) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

async function resolveTargetEmployee(authUser, effectiveRole, employeeCode) {
  const requester = employeeCodeOf(authUser);
  const target = String(employeeCode || requester).trim();
  if (!target) {
    const err = new Error('employeeCode is required');
    err.statusCode = 400;
    throw err;
  }
  await assertEmployeeAccess(requester, target, effectiveRole);
  const mapping = await DailyPlannerTeamMappingsModel.findActiveManagerForEmployee(target);
  const employeeName =
    mapping?.employeeName ||
    String(authUser?.fullName || `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim());
  return {
    employeeCode: target,
    employeeName,
    managerCode: mapping?.managerCode || '',
  };
}

export async function getPlanningDashboard(authUser, effectiveRole, reference = new Date()) {
  const code = employeeCodeOf(authUser);
  const { year, month } = parseMonthQuery(null, null, reference);
  const stats = await PlanningSnapshotService.resolveEmployeeMonthStats({
    employeeCode: code,
    employeeName: String(
      authUser?.fullName || `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim(),
    ),
    year,
    month,
    reference,
  });
  const rankInfo = await PlanningSnapshotService.getManagerRankAmongPeers(
    code,
    year,
    month,
    reference,
  );

  return {
    year,
    month,
    yearMonth: yearMonthKey(year, month),
    planningScore: stats.planningScore,
    badge: stats.badge,
    badgeEmoji: stats.badgeEmoji,
    planningAheadPercent: stats.planningAheadPercent,
    rating: stats.rating,
    ratingLabel: stats.ratingLabel,
    ratingStars: stats.ratingStars,
    managerRank: rankInfo.rank,
    managerTeamSize: rankInfo.teamSize,
    progressPercent: stats.planningScore,
  };
}

export async function getPlanningHistory(
  authUser,
  effectiveRole,
  { employeeCode, limit = 12 } = {},
  reference = new Date(),
) {
  const target = await resolveTargetEmployee(authUser, effectiveRole, employeeCode);
  const { year, month } = parseMonthQuery(null, null, reference);

  const months = [];
  let y = year;
  let m = month;
  for (let i = 0; i < limit; i += 1) {
    months.push({ year: y, month: m });
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }

  const history = await Promise.all(
    months.map(({ year: histYear, month: histMonth }) =>
      PlanningSnapshotService.resolveEmployeeMonthStats({
        employeeCode: target.employeeCode,
        employeeName: target.employeeName,
        year: histYear,
        month: histMonth,
        managerCode: target.managerCode,
        reference,
      }),
    ),
  );

  const sortedHistory = [...history].sort((a, b) =>
    String(b.yearMonth).localeCompare(String(a.yearMonth)),
  );

  return {
    employeeCode: target.employeeCode,
    employeeName: target.employeeName,
    history: sortedHistory,
    trends: calculatePlanningTrends(sortedHistory),
  };
}

export async function getPlanningReport(
  authUser,
  effectiveRole,
  query = {},
  reference = new Date(),
) {
  const { year, month } = parseMonthQuery(query.year, query.month, reference);
  const target = await resolveTargetEmployee(authUser, effectiveRole, query.employeeCode);
  const stats = await PlanningSnapshotService.resolveEmployeeMonthStats({
    employeeCode: target.employeeCode,
    employeeName: target.employeeName,
    year,
    month,
    managerCode: target.managerCode,
    reference,
  });

  const historyResult = await getPlanningHistory(
    authUser,
    effectiveRole,
    { employeeCode: target.employeeCode, limit: 12 },
    reference,
  );
  const history = [...historyResult.history].sort((a, b) =>
    String(a.yearMonth).localeCompare(String(b.yearMonth)),
  );
  const previous = history.filter((row) => row.yearMonth < stats.yearMonth).pop() || null;

  const scoreTrend = trendDirection(stats.planningScore, previous?.planningScore);
  const percentTrend = trendDirection(stats.planningAheadPercent, previous?.planningAheadPercent);
  const badgeTrendInfo = previous
    ? badgeTrend(stats.badge, previous.badge)
    : { direction: 'stable', label: `→ ${stats.badge}` };

  return {
    year,
    month,
    yearMonth: stats.yearMonth,
    employeeCode: target.employeeCode,
    employeeName: target.employeeName,
    summary: {
      planningScore: stats.planningScore,
      badge: stats.badge,
      badgeEmoji: stats.badgeEmoji,
      planningAheadPercent: stats.planningAheadPercent,
      workingDays: stats.workingDays,
      daysPlannedAhead: stats.daysPlannedAhead,
      regularTaskCount: stats.regularTaskCount,
      urgentTaskCount: stats.urgentTaskCount,
      latePlanningDays: stats.latePlanningCount,
      rating: stats.rating,
      ratingLabel: stats.ratingLabel,
      ratingStars: stats.ratingStars,
    },
    performanceBreakdown: buildPerformanceBreakdown(stats.planningScore),
    monthlyComment: generateMonthlyComment(
      stats.planningScore,
      stats.planningAheadPercent,
      stats.urgentTaskCount,
    ),
    indicators: {
      planningScore: scoreTrend,
      planningAheadPercent: percentTrend,
      badge: badgeTrendInfo,
    },
    history,
    chartSeries: {
      planningScoreByMonth: history.map((row) => ({
        yearMonth: row.yearMonth,
        value: row.planningScore,
      })),
      planningAheadPercentByMonth: history.map((row) => ({
        yearMonth: row.yearMonth,
        value: row.planningAheadPercent,
      })),
      urgentTaskCountByMonth: history.map((row) => ({
        yearMonth: row.yearMonth,
        value: row.urgentTaskCount,
      })),
      regularTaskCountByMonth: history.map((row) => ({
        yearMonth: row.yearMonth,
        value: row.regularTaskCount,
      })),
      badgeHistory: history.map((row) => ({
        yearMonth: row.yearMonth,
        badge: row.badge,
        badgeEmoji: row.badgeEmoji,
      })),
    },
    trends: calculatePlanningTrends(history),
  };
}

export async function getTeamPlanningHistory(authUser, effectiveRole, { limit = 12 } = {}) {
  const managerCode = await TeamPerformanceService.assertCanManageTeam(authUser, effectiveRole);
  const snapshots = await PlanningSnapshotService.getTeamMonthlySnapshots(managerCode, limit);

  const now = parseMonthQuery(null, null);
  const currentYm = yearMonthKey(now.year, now.month);
  let history = snapshots;

  if (!snapshots.some((row) => row.yearMonth === currentYm)) {
    const current = await TeamPerformanceService.getTeamPerformance(authUser, effectiveRole, now);
    history = [
      {
        year: current.year,
        month: current.month,
        yearMonth: current.yearMonth,
        averageTeamScore: current.summary.averageTeamScore,
        averagePlanningAheadPercent: current.summary.averagePlanningAheadPercent,
        teamSize: current.summary.teamSize,
        topPlanner: current.summary.topPlanner,
        badgeDistribution: current.badgeDistribution,
        summary: current.summary,
      },
      ...snapshots,
    ].slice(0, limit);
  }

  history = [...history].sort((a, b) => String(b.yearMonth).localeCompare(String(a.yearMonth)));

  for (const row of history) {
    if (PlanningSnapshotService.isMonthClosed(row.year, row.month)) {
      await PlanningSnapshotService.ensureTeamMonthlySnapshotForManager(
        managerCode,
        authUser,
        effectiveRole,
        row.year,
        row.month,
      );
    }
  }

  const chronological = [...history].sort((a, b) =>
    String(a.yearMonth).localeCompare(String(b.yearMonth)),
  );

  return {
    managerCode,
    history: chronological,
    chartSeries: {
      averageTeamScoreByMonth: chronological.map((row) => ({
        yearMonth: row.yearMonth,
        value: row.averageTeamScore ?? row.summary?.averageTeamScore ?? 0,
      })),
      planningAheadPercentByMonth: chronological.map((row) => ({
        yearMonth: row.yearMonth,
        value: row.averagePlanningAheadPercent ?? row.summary?.averagePlanningAheadPercent ?? 0,
      })),
      topPlannerByMonth: chronological.map((row) => ({
        yearMonth: row.yearMonth,
        employeeName: row.topPlanner?.employeeName || row.summary?.topPlanner?.employeeName || '—',
        planningScore:
          row.topPlanner?.planningScore ?? row.summary?.topPlanner?.planningScore ?? 0,
      })),
      badgeDistributionByMonth: chronological.map((row) => ({
        yearMonth: row.yearMonth,
        distribution: row.badgeDistribution || [],
      })),
    },
  };
}

export async function getManagerPlanningDashboard(authUser, effectiveRole, reference = new Date()) {
  const managerCode = await TeamPerformanceService.assertCanManageTeam(authUser, effectiveRole);
  const { year, month } = parseMonthQuery(null, null, reference);
  const teamData = await TeamPerformanceService.getTeamPerformance(authUser, effectiveRole, {
    year,
    month,
  });

  const employees = teamData.employees || [];
  const sorted = [...employees].sort((a, b) => (b.planningScore || 0) - (a.planningScore || 0));
  const lowest = sorted.length ? sorted[sorted.length - 1] : null;

  const platinumCount =
    teamData.badgeDistribution.find((row) => row.badge === 'Platinum Planner')?.count || 0;
  const goldCount = teamData.badgeDistribution.find((row) => row.badge === 'Gold Planner')?.count || 0;
  const needsImprovementCount = employees.filter((row) => row.status === 'Needs Improvement').length;

  return {
    year,
    month,
    yearMonth: teamData.yearMonth,
    averageTeamScore: teamData.summary.averageTeamScore,
    bestPlanner: teamData.summary.topPlanner,
    lowestPlanner: lowest
      ? {
          employeeCode: lowest.employeeCode,
          employeeName: lowest.employeeName,
          planningScore: lowest.planningScore,
        }
      : null,
    platinumEmployees: platinumCount,
    goldEmployees: goldCount,
    employeesNeedingImprovement: needsImprovementCount,
    planningAheadPercent: teamData.summary.averagePlanningAheadPercent,
    teamSize: teamData.summary.teamSize,
    managerCode,
  };
}

export async function getPlanningExportPayload(
  authUser,
  effectiveRole,
  query = {},
  reference = new Date(),
) {
  const scope = String(query.scope || 'self').trim();
  if (scope === 'team') {
    const managerCode = await TeamPerformanceService.assertCanManageTeam(authUser, effectiveRole);
    const { year, month } = parseMonthQuery(query.year, query.month, reference);
    const teamData = await TeamPerformanceService.getTeamPerformance(authUser, effectiveRole, {
      year,
      month,
    });
    return {
      scope: 'team',
      managerCode,
      year,
      month,
      yearMonth: teamData.yearMonth,
      rows: teamData.employees,
      summary: teamData.summary,
    };
  }

  const report = await getPlanningReport(authUser, effectiveRole, query, reference);
  return {
    scope: 'self',
    ...report,
    rows: [report.summary],
  };
}
