/**
 * Daily Planner planning scores — PK planningRecordId, GSI employeeCode + recordKey.
 * recordKey: DAY#YYYY-MM-DD (daily log) | MONTH#YYYY-MM (monthly summary) | SNAPSHOT#YYYY-MM (immutable)
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { GSI_NAMES } from '../config/dynamodbIndexes.js';
import { isGsiMissingError, warnGsiFallback } from '../utils/dynamoGsi.js';
import { queryAllPages } from '../utils/dynamoPagination.js';
import log from '../utils/logger.js';
import {
  aggregateDailyLogMetrics,
  calculatePlannerBadge,
  calculatePlannerRating,
  calculatePlanningPercentage,
  calculatePlanningScore,
  countDaysPlannedAhead,
  countWorkingDaysCompletedInMonth,
  countWorkingDaysInMonth,
  MAX_SCORE_PER_WORKING_DAY,
  yearMonthKey,
} from '../utils/planningRecognition.js';

const TABLE_NAME = TABLES.DAILY_PLANNER_PLANNING;

function isTableMissingError(err) {
  if (!err) return false;
  if (err.code === 'ResourceNotFoundException') {
    const msg = String(err.message || '');
    return !/specified index|Index not found|does not have the specified index/i.test(msg);
  }
  const msg = String(err.message || '');
  return (
    msg.includes('Requested resource not found') ||
    msg.includes('Cannot do operations on a non-existent table')
  );
}

function warnTableMissing(context, err) {
  log.warn(`[DynamoDB] ${context}: table unavailable, returning empty:`, err?.message || err);
}

function dayRecordKey(dateKey) {
  return `DAY#${String(dateKey || '').trim()}`;
}

function monthRecordKey(year, month) {
  return `MONTH#${yearMonthKey(year, month)}`;
}

function planningRecordId(employeeCode, recordKey) {
  return `${String(employeeCode || '').trim()}#${String(recordKey || '').trim()}`;
}

function toDailyDto(row) {
  if (!row || row.is_deleted) return null;
  return {
    employeeCode: String(row.employeeCode || '').trim(),
    logDate: String(row.logDate || '').trim(),
    morningAwarded: Boolean(row.morningAwarded),
    eveningAwarded: Boolean(row.eveningAwarded),
    plannedAhead: Boolean(row.plannedAhead),
    sameDayOnly: Boolean(row.sameDayOnly),
    dayScore: Number(row.dayScore) || 0,
    updatedAt: row.updatedAt,
  };
}

function toMonthlyDto(row) {
  if (!row || row.is_deleted) return null;
  const planningScore = Number(row.planningScore ?? row.normalizedScore) || 0;
  const planningAheadPercent = Number(row.planningAheadPercent) || 0;
  const ratingStars = Number(row.ratingStars) || 0;
  const ratingLabel = String(row.ratingLabel || row.rating || '').trim();
  return {
    employeeCode: String(row.employeeCode || '').trim(),
    year: Number(row.year) || 0,
    month: Number(row.month) || 0,
    yearMonth: String(row.yearMonth || '').trim(),
    rawScore: Number(row.rawScore) || 0,
    maxScore: Number(row.maxScore) || 0,
    normalizedScore: planningScore,
    planningScore,
    planningAheadPercent,
    daysPlannedAhead: Number(row.daysPlannedAhead) || 0,
    regularTaskCount: Number(row.regularTaskCount) || 0,
    urgentTaskCount: Number(row.urgentTaskCount) || 0,
    latePlanningCount: Number(row.latePlanningCount) || 0,
    badge: String(row.badge || '').trim(),
    badgeEmoji: String(row.badgeEmoji || '').trim(),
    rating: ratingLabel,
    ratingLabel,
    ratingStars,
    workingDays: Number(row.workingDays) || 0,
    workingDaysCompleted: Number(row.workingDaysCompleted) || 0,
    sameDayPlanningCount: Number(row.sameDayPlanningCount) || 0,
    workingDaysMissed: Number(row.workingDaysMissed) || 0,
    rescheduledCount: Number(row.rescheduledCount) || 0,
    terminatedCount: Number(row.terminatedCount) || 0,
    currentMonthlyTotal: Number(row.currentMonthlyTotal ?? row.rawScore) || 0,
    monthlyRank: row.monthlyRank != null ? Number(row.monthlyRank) : null,
    lastCalculatedAt: row.lastCalculatedAt || null,
    computedAt: row.computedAt,
    updatedAt: row.updatedAt,
  };
}

async function getByEmployeeRecordKey(employeeCode, recordKey) {
  const code = String(employeeCode || '').trim();
  const key = String(recordKey || '').trim();
  if (!code || !key) return null;

  try {
    try {
      const rows = await queryAllPages(dynamoDB, {
        TableName: TABLE_NAME,
        IndexName: GSI_NAMES.DAILY_PLANNER_EMPLOYEE_PLANNING,
        KeyConditionExpression: 'employeeCode = :emp AND recordKey = :rk',
        FilterExpression: 'attribute_not_exists(is_deleted) OR is_deleted = :f',
        ExpressionAttributeValues: { ':emp': code, ':rk': key, ':f': false },
      });
      return rows[0] || null;
    } catch (err) {
      if (!isGsiMissingError(err)) throw err;
      warnGsiFallback('DailyPlannerPlanning.getByEmployeeRecordKey', err);
    }

    const result = await dynamoDB
      .get({
        TableName: TABLE_NAME,
        Key: { planningRecordId: planningRecordId(code, key) },
      })
      .promise();
    return result.Item || null;
  } catch (err) {
    if (isTableMissingError(err)) {
      warnTableMissing('DailyPlannerPlanning.getByEmployeeRecordKey', err);
      return null;
    }
    throw err;
  }
}

export async function getDailyLog(employeeCode, logDate) {
  const row = await getByEmployeeRecordKey(employeeCode, dayRecordKey(logDate));
  return toDailyDto(row);
}

export async function upsertDailyLog(employeeCode, logDate, patch) {
  const code = String(employeeCode || '').trim();
  const date = String(logDate || '').trim();
  if (!code || !date) {
    const err = new Error('employeeCode and logDate are required');
    err.statusCode = 400;
    throw err;
  }

  const rk = dayRecordKey(date);
  const existingRow = await getByEmployeeRecordKey(code, rk);
  const existing = toDailyDto(existingRow) || {
    employeeCode: code,
    logDate: date,
    morningAwarded: false,
    eveningAwarded: false,
    plannedAhead: false,
    sameDayOnly: false,
    dayScore: 0,
  };

  const now = new Date().toISOString();
  const item = {
    planningRecordId: planningRecordId(code, rk),
    employeeCode: code,
    recordKey: rk,
    recordType: 'daily',
    logDate: date,
    morningAwarded: patch.morningAwarded ?? existing.morningAwarded,
    eveningAwarded: patch.eveningAwarded ?? existing.eveningAwarded,
    plannedAhead: patch.plannedAhead ?? existing.plannedAhead,
    sameDayOnly: patch.sameDayOnly ?? existing.sameDayOnly,
    dayScore: patch.dayScore ?? existing.dayScore,
    updatedAt: now,
    is_deleted: false,
  };

  try {
    await dynamoDB.put({ TableName: TABLE_NAME, Item: item }).promise();
  } catch (err) {
    if (isTableMissingError(err)) {
      const missing = new Error(
        'Daily Planner planning storage is not provisioned. Run: node scripts/ensure-daily-planner-tables.js',
      );
      missing.statusCode = 503;
      throw missing;
    }
    throw err;
  }
  return toDailyDto(item);
}

async function queryEmployeeRecords(employeeCode, recordKeyPrefix) {
  const code = String(employeeCode || '').trim();
  if (!code) return [];

  try {
    try {
      return await queryAllPages(dynamoDB, {
        TableName: TABLE_NAME,
        IndexName: GSI_NAMES.DAILY_PLANNER_EMPLOYEE_PLANNING,
        KeyConditionExpression: 'employeeCode = :emp AND begins_with(recordKey, :prefix)',
        FilterExpression: 'attribute_not_exists(is_deleted) OR is_deleted = :f',
        ExpressionAttributeValues: {
          ':emp': code,
          ':prefix': recordKeyPrefix,
          ':f': false,
        },
      });
    } catch (err) {
      if (!isGsiMissingError(err)) throw err;
      warnGsiFallback('DailyPlannerPlanning.queryEmployeeRecords', err);
      return [];
    }
  } catch (err) {
    if (isTableMissingError(err)) {
      warnTableMissing('DailyPlannerPlanning.queryEmployeeRecords', err);
      return [];
    }
    throw err;
  }
}

export async function listDailyLogsForMonth(employeeCode, year, month) {
  if (!employeeCode || !year || !month) return [];
  const rows = await queryEmployeeRecords(employeeCode, `DAY#${yearMonthKey(year, month)}`);
  return rows.map(toDailyDto).filter(Boolean);
}

export async function getMonthlyRecord(employeeCode, year, month) {
  const row = await getByEmployeeRecordKey(employeeCode, monthRecordKey(year, month));
  return toMonthlyDto(row);
}

export async function saveMonthlyRecord(employeeCode, year, month, payload) {
  const code = String(employeeCode || '').trim();
  if (!code || !year || !month) {
    const err = new Error('employeeCode, year, and month are required');
    err.statusCode = 400;
    throw err;
  }

  const location = payload.employeeLocation || undefined;
  const workingDays =
    payload.workingDays ?? countWorkingDaysInMonth(year, month, location);
  const dailyLogs = payload.dailyLogs ?? [];
  const asOfDateKey = payload.asOfDateKey
    ? String(payload.asOfDateKey).trim().slice(0, 10)
    : '';
  const isPartialMonth =
    asOfDateKey && yearMonthKey(year, month) === asOfDateKey.slice(0, 7);
  const workingDaysCompleted = isPartialMonth
    ? countWorkingDaysCompletedInMonth(year, month, asOfDateKey, location)
    : workingDays;
  const planningAheadDenominator = isPartialMonth ? workingDaysCompleted : workingDays;
  const daysPlannedAhead =
    payload.daysPlannedAhead ??
    countDaysPlannedAhead(dailyLogs, asOfDateKey || undefined, location);
  const planningAheadPercent = calculatePlanningPercentage(
    daysPlannedAhead,
    planningAheadDenominator,
  );
  const logMetrics = aggregateDailyLogMetrics(dailyLogs, asOfDateKey || undefined, location);
  const latePlanningCount = Math.max(0, Number(payload.latePlanningCount) || 0);
  const urgentTaskCount = Math.max(0, Number(payload.urgentTaskCount) || 0);
  const regularTaskCount = Math.max(0, Number(payload.regularTaskCount) || 0);
  const rawScore = Number(payload.rawScore) || 0;
  const planningScore = calculatePlanningScore({
    latePlanningCount,
    urgentTaskCount,
    rawScore,
    workingDays: planningAheadDenominator || workingDays,
  });
  const badgeInfo = calculatePlannerBadge(planningAheadPercent);
  const ratingInfo = calculatePlannerRating(planningScore);
  const maxScore = workingDays * MAX_SCORE_PER_WORKING_DAY;
  const now = new Date().toISOString();
  const rk = monthRecordKey(year, month);

  const existingRow = await getByEmployeeRecordKey(code, rk);
  const existingMonthly = toMonthlyDto(existingRow);

  const item = {
    planningRecordId: planningRecordId(code, rk),
    employeeCode: code,
    recordKey: rk,
    recordType: 'monthly',
    year,
    month,
    yearMonth: yearMonthKey(year, month),
    rawScore,
    maxScore,
    normalizedScore: planningScore,
    planningScore,
    planningAheadPercent,
    daysPlannedAhead,
    regularTaskCount,
    urgentTaskCount,
    latePlanningCount,
    badge: badgeInfo.badge,
    badgeEmoji: badgeInfo.emoji,
    rating: ratingInfo.label,
    ratingLabel: ratingInfo.label,
    ratingStars: ratingInfo.stars,
    workingDays,
    workingDaysCompleted,
    sameDayPlanningCount:
      payload.sameDayPlanningCount ?? logMetrics.sameDayPlanningCount,
    workingDaysMissed: payload.workingDaysMissed ?? logMetrics.workingDaysMissed,
    rescheduledCount:
      payload.rescheduledCount ?? existingMonthly?.rescheduledCount ?? 0,
    terminatedCount: payload.terminatedCount ?? existingMonthly?.terminatedCount ?? 0,
    currentMonthlyTotal: rawScore,
    monthlyRank:
      payload.monthlyRank !== undefined
        ? payload.monthlyRank
        : (existingMonthly?.monthlyRank ?? null),
    lastCalculatedAt: payload.lastCalculatedAt || now,
    computedAt: payload.computedAt || now,
    updatedAt: now,
    is_deleted: false,
  };

  try {
    await dynamoDB.put({ TableName: TABLE_NAME, Item: item }).promise();
  } catch (err) {
    if (isTableMissingError(err)) {
      const missing = new Error(
        'Daily Planner planning storage is not provisioned. Run: node scripts/ensure-daily-planner-tables.js',
      );
      missing.statusCode = 503;
      throw missing;
    }
    throw err;
  }
  return toMonthlyDto(item);
}

export async function listMonthlyHistory(employeeCode, limit = 24) {
  const rows = await queryEmployeeRecords(employeeCode, 'MONTH#');
  return rows
    .map(toMonthlyDto)
    .filter(Boolean)
    .sort((a, b) => String(b.yearMonth).localeCompare(String(a.yearMonth)))
    .slice(0, limit);
}

function snapshotRecordKey(year, month) {
  return `SNAPSHOT#${yearMonthKey(year, month)}`;
}

function teamSnapshotRecordKey(year, month) {
  return `TEAM_SNAPSHOT#${yearMonthKey(year, month)}`;
}

function toSnapshotDto(row) {
  if (!row || row.is_deleted) return null;
  return {
    employeeCode: String(row.employeeCode || '').trim(),
    employeeName: String(row.employeeName || '').trim(),
    managerCode: String(row.managerCode || '').trim(),
    year: Number(row.year) || 0,
    month: Number(row.month) || 0,
    yearMonth: String(row.yearMonth || '').trim(),
    planningScore: Number(row.planningScore) || 0,
    planningAheadPercent: Number(row.planningAheadPercent) || 0,
    daysPlannedAhead: Number(row.daysPlannedAhead) || 0,
    workingDays: Number(row.workingDays) || 0,
    regularTaskCount: Number(row.regularTaskCount) || 0,
    urgentTaskCount: Number(row.urgentTaskCount) || 0,
    latePlanningCount: Number(row.latePlanningCount) || 0,
    badge: String(row.badge || '').trim(),
    badgeEmoji: String(row.badgeEmoji || '').trim(),
    rating: String(row.ratingLabel || row.rating || '').trim(),
    ratingLabel: String(row.ratingLabel || row.rating || '').trim(),
    ratingStars: Number(row.ratingStars) || 0,
    monthlyRank: row.monthlyRank != null ? Number(row.monthlyRank) : null,
    snapshotCreatedAt: row.snapshotCreatedAt,
  };
}

function toTeamSnapshotDto(row) {
  if (!row || row.is_deleted) return null;
  return {
    managerCode: String(row.managerCode || row.employeeCode || '').trim(),
    year: Number(row.year) || 0,
    month: Number(row.month) || 0,
    yearMonth: String(row.yearMonth || '').trim(),
    summary: row.summary || {},
    badgeDistribution: row.badgeDistribution || [],
    topPlanner: row.topPlanner || null,
    averageTeamScore: Number(row.averageTeamScore) || 0,
    averagePlanningAheadPercent: Number(row.averagePlanningAheadPercent) || 0,
    teamSize: Number(row.teamSize) || 0,
    snapshotCreatedAt: row.snapshotCreatedAt,
  };
}

export async function getMonthlySnapshot(employeeCode, year, month) {
  const row = await getByEmployeeRecordKey(employeeCode, snapshotRecordKey(year, month));
  return toSnapshotDto(row);
}

export async function saveMonthlySnapshotIfAbsent(employeeCode, payload) {
  const code = String(employeeCode || '').trim();
  const year = Number(payload.year);
  const month = Number(payload.month);
  if (!code || !year || !month) {
    const err = new Error('employeeCode, year, and month are required');
    err.statusCode = 400;
    throw err;
  }

  const rk = snapshotRecordKey(year, month);
  const id = planningRecordId(code, rk);
  const now = new Date().toISOString();
  const item = {
    planningRecordId: id,
    employeeCode: code,
    recordKey: rk,
    recordType: 'snapshot',
    employeeName: String(payload.employeeName || '').trim(),
    managerCode: String(payload.managerCode || '').trim(),
    year,
    month,
    yearMonth: yearMonthKey(year, month),
    planningScore: Number(payload.planningScore) || 0,
    planningAheadPercent: Number(payload.planningAheadPercent) || 0,
    daysPlannedAhead: Number(payload.daysPlannedAhead) || 0,
    workingDays: Number(payload.workingDays) || 0,
    regularTaskCount: Number(payload.regularTaskCount) || 0,
    urgentTaskCount: Number(payload.urgentTaskCount) || 0,
    latePlanningCount: Number(payload.latePlanningCount) || 0,
    badge: String(payload.badge || 'No Badge').trim(),
    badgeEmoji: String(payload.badgeEmoji || '').trim(),
    rating: String(payload.ratingLabel || payload.rating || '').trim(),
    ratingLabel: String(payload.ratingLabel || payload.rating || '').trim(),
    ratingStars: Number(payload.ratingStars) || 0,
    monthlyRank: payload.monthlyRank != null ? Number(payload.monthlyRank) : null,
    snapshotCreatedAt: now,
    is_deleted: false,
  };

  try {
    await dynamoDB
      .put({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(planningRecordId)',
      })
      .promise();
    return toSnapshotDto(item);
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      return getMonthlySnapshot(code, year, month);
    }
    if (isTableMissingError(err)) {
      const missing = new Error(
        'Daily Planner planning storage is not provisioned. Run: node scripts/ensure-daily-planner-tables.js',
      );
      missing.statusCode = 503;
      throw missing;
    }
    throw err;
  }
}

export async function listMonthlySnapshots(employeeCode, limit = 12) {
  const rows = await queryEmployeeRecords(employeeCode, 'SNAPSHOT#');
  return rows
    .map(toSnapshotDto)
    .filter(Boolean)
    .sort((a, b) => String(b.yearMonth).localeCompare(String(a.yearMonth)))
    .slice(0, limit);
}

export async function getTeamMonthlySnapshot(managerCode, year, month) {
  const code = String(managerCode || '').trim();
  const row = await getByEmployeeRecordKey(code, teamSnapshotRecordKey(year, month));
  return toTeamSnapshotDto(row);
}

export async function saveTeamMonthlySnapshotIfAbsent(managerCode, payload) {
  const code = String(managerCode || '').trim();
  const year = Number(payload.year);
  const month = Number(payload.month);
  if (!code || !year || !month) {
    const err = new Error('managerCode, year, and month are required');
    err.statusCode = 400;
    throw err;
  }

  const rk = teamSnapshotRecordKey(year, month);
  const id = planningRecordId(code, rk);
  const now = new Date().toISOString();
  const item = {
    planningRecordId: id,
    employeeCode: code,
    managerCode: code,
    recordKey: rk,
    recordType: 'team_snapshot',
    year,
    month,
    yearMonth: yearMonthKey(year, month),
    summary: payload.summary || {},
    badgeDistribution: payload.badgeDistribution || [],
    topPlanner: payload.topPlanner || null,
    averageTeamScore: Number(payload.averageTeamScore) || 0,
    averagePlanningAheadPercent: Number(payload.averagePlanningAheadPercent) || 0,
    teamSize: Number(payload.teamSize) || 0,
    snapshotCreatedAt: now,
    is_deleted: false,
  };

  try {
    await dynamoDB
      .put({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(planningRecordId)',
      })
      .promise();
    return toTeamSnapshotDto(item);
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      return getTeamMonthlySnapshot(code, year, month);
    }
    if (isTableMissingError(err)) {
      const missing = new Error(
        'Daily Planner planning storage is not provisioned. Run: node scripts/ensure-daily-planner-tables.js',
      );
      missing.statusCode = 503;
      throw missing;
    }
    throw err;
  }
}

export async function listTeamMonthlySnapshots(managerCode, limit = 12) {
  const code = String(managerCode || '').trim();
  const rows = await queryEmployeeRecords(code, 'TEAM_SNAPSHOT#');
  return rows
    .map(toTeamSnapshotDto)
    .filter(Boolean)
    .sort((a, b) => String(b.yearMonth).localeCompare(String(a.yearMonth)))
    .slice(0, limit);
}
