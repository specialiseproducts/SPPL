/**
 * Immutable monthly planning snapshots — frozen at month close.
 */

import * as DailyPlannerPlanningModel from '../models/DailyPlannerPlanning.js';
import * as DailyPlannerTeamMappingsModel from '../models/DailyPlannerTeamMappings.js';
import {
  calculatePlannerRating,
  calculatePlanningScore,
  countWorkingDaysInMonth,
  yearMonthKey,
} from '../utils/planningRecognition.js';
import { todayIstDateKey } from '../utils/salesQuotationDates.js';
import * as TeamPerformanceService from './teamPerformance.service.js';

export function isMonthClosed(year, month, reference = new Date()) {
  const target = yearMonthKey(year, month);
  const current = todayIstDateKey(reference).slice(0, 7);
  return target < current;
}

function defaultMonthStats(employeeCode, employeeName, year, month) {
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
    employeeName: employeeName || employeeCode,
    year,
    month,
    yearMonth: yearMonthKey(year, month),
    planningScore,
    planningAheadPercent: 0,
    daysPlannedAhead: 0,
    workingDays,
    regularTaskCount: 0,
    urgentTaskCount: 0,
    latePlanningCount: 0,
    badge: 'No Badge',
    badgeEmoji: '',
    rating: ratingInfo.label,
    ratingLabel: ratingInfo.label,
    ratingStars: ratingInfo.stars,
  };
}

function monthlyRecordToStats(record, employeeCode, employeeName) {
  if (!record) return defaultMonthStats(employeeCode, employeeName, 0, 0);
  const planningScore = record.planningScore ?? record.normalizedScore ?? 0;
  return {
    employeeCode,
    employeeName: employeeName || employeeCode,
    year: record.year,
    month: record.month,
    yearMonth: record.yearMonth,
    planningScore,
    planningAheadPercent: record.planningAheadPercent ?? 0,
    daysPlannedAhead: record.daysPlannedAhead ?? 0,
    workingDays: record.workingDays ?? 0,
    regularTaskCount: record.regularTaskCount ?? 0,
    urgentTaskCount: record.urgentTaskCount ?? 0,
    latePlanningCount: record.latePlanningCount ?? 0,
    badge: record.badge || 'No Badge',
    badgeEmoji: record.badgeEmoji || '',
    rating: record.ratingLabel || record.rating || '',
    ratingLabel: record.ratingLabel || record.rating || '',
    ratingStars: record.ratingStars ?? 0,
    monthlyRank: record.monthlyRank ?? null,
  };
}

function snapshotToStats(snapshot) {
  if (!snapshot) return null;
  return {
    employeeCode: snapshot.employeeCode,
    employeeName: snapshot.employeeName || snapshot.employeeCode,
    year: snapshot.year,
    month: snapshot.month,
    yearMonth: snapshot.yearMonth,
    planningScore: snapshot.planningScore,
    planningAheadPercent: snapshot.planningAheadPercent,
    daysPlannedAhead: snapshot.daysPlannedAhead,
    workingDays: snapshot.workingDays,
    regularTaskCount: snapshot.regularTaskCount,
    urgentTaskCount: snapshot.urgentTaskCount,
    latePlanningCount: snapshot.latePlanningCount,
    badge: snapshot.badge,
    badgeEmoji: snapshot.badgeEmoji,
    rating: snapshot.rating,
    ratingLabel: snapshot.ratingLabel || snapshot.rating,
    ratingStars: snapshot.ratingStars,
    monthlyRank: snapshot.monthlyRank ?? null,
    isSnapshot: true,
    snapshotCreatedAt: snapshot.snapshotCreatedAt,
  };
}

export async function ensureEmployeeMonthlySnapshot(
  employeeCode,
  employeeName,
  year,
  month,
  managerCode = '',
) {
  const existing = await DailyPlannerPlanningModel.getMonthlySnapshot(employeeCode, year, month);
  if (existing) return existing;

  const monthly = await DailyPlannerPlanningModel.getMonthlyRecord(employeeCode, year, month);
  const stats = monthly
    ? monthlyRecordToStats(monthly, employeeCode, employeeName)
    : defaultMonthStats(employeeCode, employeeName, year, month);

  return DailyPlannerPlanningModel.saveMonthlySnapshotIfAbsent(employeeCode, {
    ...stats,
    employeeName: stats.employeeName,
    managerCode,
  });
}

export async function resolveEmployeeMonthStats({
  employeeCode,
  employeeName,
  year,
  month,
  managerCode = '',
  reference = new Date(),
}) {
  if (isMonthClosed(year, month, reference)) {
    const snapshot = await ensureEmployeeMonthlySnapshot(
      employeeCode,
      employeeName,
      year,
      month,
      managerCode,
    );
    return snapshotToStats(snapshot);
  }

  const monthly = await DailyPlannerPlanningModel.getMonthlyRecord(employeeCode, year, month);
  if (!monthly) {
    return defaultMonthStats(employeeCode, employeeName, year, month);
  }
  return monthlyRecordToStats(monthly, employeeCode, employeeName);
}

export async function getEmployeeMonthlySnapshots(employeeCode, limit = 12) {
  const snapshots = await DailyPlannerPlanningModel.listMonthlySnapshots(employeeCode, limit);
  return snapshots.map(snapshotToStats).filter(Boolean);
}

export async function ensureTeamMonthlySnapshotForManager(
  managerCode,
  authUser,
  effectiveRole,
  year,
  month,
) {
  const code = String(managerCode || '').trim();
  const existing = await DailyPlannerPlanningModel.getTeamMonthlySnapshot(code, year, month);
  if (existing) return existing;

  const teamData = await TeamPerformanceService.getTeamPerformance(authUser, effectiveRole, {
    year,
    month,
  });

  return DailyPlannerPlanningModel.saveTeamMonthlySnapshotIfAbsent(code, {
    year,
    month,
    summary: teamData.summary,
    badgeDistribution: teamData.badgeDistribution,
    topPlanner: teamData.summary.topPlanner,
    averageTeamScore: teamData.summary.averageTeamScore,
    averagePlanningAheadPercent: teamData.summary.averagePlanningAheadPercent,
    teamSize: teamData.summary.teamSize,
  });
}

export async function getTeamMonthlySnapshots(managerCode, limit = 12) {
  return DailyPlannerPlanningModel.listTeamMonthlySnapshots(managerCode, limit);
}

export async function getManagerRankAmongPeers(employeeCode, year, month, reference = new Date()) {
  const mapping = await DailyPlannerTeamMappingsModel.findActiveManagerForEmployee(employeeCode);
  if (!mapping) return { rank: null, teamSize: 0 };

  const peers = await DailyPlannerTeamMappingsModel.listEmployeesForManager(mapping.managerCode);
  const stats = await Promise.all(
    peers.map((peer) =>
      resolveEmployeeMonthStats({
        employeeCode: peer.employeeCode,
        employeeName: peer.employeeName,
        year,
        month,
        managerCode: mapping.managerCode,
        reference,
      }),
    ),
  );

  const sorted = [...stats].sort((a, b) => {
    const scoreDiff = (b.planningScore || 0) - (a.planningScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.planningAheadPercent || 0) - (a.planningAheadPercent || 0);
  });

  const rank = sorted.findIndex((row) => row.employeeCode === employeeCode) + 1;
  return { rank: rank > 0 ? rank : null, teamSize: peers.length };
}
