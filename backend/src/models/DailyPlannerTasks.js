/**
 * Daily Planner tasks — partition key plannerTaskId (String).
 * GSI_EmployeeDate: employeeCode (HASH) + date (RANGE) — same pattern as Expenses GSI.
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { GSI_NAMES } from '../config/dynamodbIndexes.js';
import { isGsiMissingError, warnGsiFallback } from '../utils/dynamoGsi.js';
import { queryAllPages } from '../utils/dynamoPagination.js';
import log from '../utils/logger.js';

const TABLE_NAME = TABLES.DAILY_PLANNER_TASKS;

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

function toDateOnly(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toDailyPlannerTaskDto(row) {
  if (!row || row.is_deleted) return null;
  const currentPriority = String(row.currentPriority || row.priority || 'Medium').trim();
  const originalPriority = String(row.originalPriority || row.priority || currentPriority).trim();
  const replacement =
    row.replacementTask && typeof row.replacementTask === 'object'
      ? {
          taskName: String(row.replacementTask.taskName || '').trim(),
          description: String(row.replacementTask.description || '').trim(),
          priority: String(row.replacementTask.priority || 'Medium').trim(),
          hoursRequired:
            row.replacementTask.hoursRequired === undefined ||
            row.replacementTask.hoursRequired === null ||
            row.replacementTask.hoursRequired === ''
              ? null
              : Number(row.replacementTask.hoursRequired),
          expectedOutcome: String(row.replacementTask.expectedOutcome || '').trim(),
        }
      : null;
  return {
    plannerTaskId: String(row.plannerTaskId || '').trim(),
    employeeCode: String(row.employeeCode || '').trim(),
    employeeName: String(row.employeeName || '').trim(),
    date: toDateOnly(row.date),
    taskName: String(row.taskName || '').trim(),
    description: String(row.description || '').trim(),
    priority: currentPriority,
    originalPriority,
    currentPriority,
    priorityEdited: Boolean(row.priorityEdited),
    priorityEditedBy: String(row.priorityEditedBy || '').trim(),
    priorityEditedByName: String(row.priorityEditedByName || '').trim(),
    priorityEditedAt: row.priorityEditedAt || null,
    hoursRequired:
      row.hoursRequired === undefined || row.hoursRequired === null || row.hoursRequired === ''
        ? null
        : Number(row.hoursRequired),
    originalHoursRequired:
      row.originalHoursRequired === undefined ||
      row.originalHoursRequired === null ||
      row.originalHoursRequired === ''
        ? null
        : Number(row.originalHoursRequired),
    hoursRequiredEdited: Boolean(row.hoursRequiredEdited),
    hoursRequiredEditedBy: String(row.hoursRequiredEditedBy || '').trim(),
    hoursRequiredEditedByName: String(row.hoursRequiredEditedByName || '').trim(),
    hoursRequiredEditedAt: row.hoursRequiredEditedAt || null,
    status: String(row.status || 'Pending').trim(),
    reason: String(row.reason || '').trim(),
    taskType: String(row.taskType || 'Manual').trim(),
    source: String(row.source || 'MANUAL').trim(),
    salesPlannerId: row.salesPlannerId ? String(row.salesPlannerId).trim() : null,
    approved: Boolean(row.approved),
    approvalStatus: String(row.approvalStatus || (row.approved ? 'APPROVED' : '')).trim(),
    approvedBy: String(row.approvedBy || '').trim(),
    approvedByName: String(row.approvedByName || '').trim(),
    approvedDate: row.approvedDate || row.approvedAt || null,
    approvedAt: row.approvedAt || row.approvedDate || null,
    managerComments: String(row.managerComments || '').trim(),
    managerInstructions: String(row.managerInstructions || '').trim(),
    isProjectBased: Boolean(row.isProjectBased),
    projectName: String(row.projectName || '').trim(),
    planFinalizedAt: row.planFinalizedAt || null,
    planFinalizedBy: String(row.planFinalizedBy || '').trim(),
    createdByRole: String(row.createdByRole || '').trim(),
    dayCompletionSubmittedAt: row.dayCompletionSubmittedAt || null,
    dayCompletionSubmittedBy: String(row.dayCompletionSubmittedBy || '').trim(),
    completionManagerReviewedAt: row.completionManagerReviewedAt || null,
    completionManagerReviewedBy: String(row.completionManagerReviewedBy || '').trim(),
    dayCompletionReviewSubmittedAt: row.dayCompletionReviewSubmittedAt || null,
    dayCompletionReviewSubmittedBy: String(row.dayCompletionReviewSubmittedBy || '').trim(),
    verifiedBy: String(row.verifiedBy || '').trim(),
    verifiedByName: String(row.verifiedByName || '').trim(),
    verifiedAt: row.verifiedAt || null,
    verificationStatus: String(row.verificationStatus || '').trim(),
    revisionReason: String(row.revisionReason || '').trim(),
    revisionRequestedBy: String(row.revisionRequestedBy || '').trim(),
    revisionRequestedByName: String(row.revisionRequestedByName || '').trim(),
    revisionRequestedAt: row.revisionRequestedAt || null,
    revisionOutcome: String(row.revisionOutcome || '').trim(),
    revisionHandledAt: row.revisionHandledAt || null,
    revisedTaskId: row.revisedTaskId ? String(row.revisedTaskId).trim() : null,
    replacementTask: replacement,
    planningCategory: String(row.planningCategory || 'Regular').trim(),
    urgentReason: String(row.urgentReason || '').trim(),
    planningWindowUsed: row.planningWindowUsed ? String(row.planningWindowUsed).trim() : null,
    planningTimestamp: row.planningTimestamp || null,
    originalDate: row.originalDate ? toDateOnly(row.originalDate) : null,
    rescheduledFrom: row.rescheduledFrom ? toDateOnly(row.rescheduledFrom) : null,
    rescheduledToDate: row.rescheduledToDate ? toDateOnly(row.rescheduledToDate) : null,
    rescheduledFromDate: row.rescheduledFromDate ? toDateOnly(row.rescheduledFromDate) : null,
    rescheduledBy: String(row.rescheduledBy || '').trim(),
    rescheduledByName: String(row.rescheduledByName || '').trim(),
    rescheduledAt: row.rescheduledAt || null,
    terminatedBy: String(row.terminatedBy || '').trim(),
    terminatedByName: String(row.terminatedByName || '').trim(),
    terminatedAt: row.terminatedAt || null,
    parentTaskId: row.parentTaskId ? String(row.parentTaskId).trim() : null,
    planningScore: Number(row.planningScore) || 0,
    completionScore: Number(row.completionScore) || 0,
    finalScore: Number(row.finalScore) || 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function inDateRange(row, startDate, endDate) {
  if (!row?.date) return false;
  if (startDate && row.date < startDate) return false;
  if (endDate && row.date > endDate) return false;
  return true;
}

function employeeDateQuery(employeeCode, startDate, endDate) {
  const values = { ':emp': String(employeeCode).trim(), ':f': false };
  let keyCondition = 'employeeCode = :emp';
  if (startDate && endDate) {
    keyCondition += ' AND #d BETWEEN :start AND :end';
    values[':start'] = startDate;
    values[':end'] = endDate;
  } else if (startDate) {
    keyCondition += ' AND #d >= :start';
    values[':start'] = startDate;
  } else if (endDate) {
    keyCondition += ' AND #d <= :end';
    values[':end'] = endDate;
  }

  const params = {
    TableName: TABLE_NAME,
    IndexName: GSI_NAMES.DAILY_PLANNER_EMPLOYEE_DATE,
    KeyConditionExpression: keyCondition,
    FilterExpression: 'attribute_not_exists(is_deleted) OR is_deleted = :f',
    ExpressionAttributeValues: values,
  };
  if (startDate || endDate) {
    params.ExpressionAttributeNames = { '#d': 'date' };
  }
  return params;
}

async function scanEmployeeMonthFallback(employeeCode, startDate, endDate) {
  const code = String(employeeCode || '').trim();
  let items = [];
  let lastKey;
  do {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression:
        '(attribute_not_exists(is_deleted) OR is_deleted = :f) AND employeeCode = :emp',
      ExpressionAttributeValues: {
        ':f': false,
        ':emp': code,
      },
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    };
    const result = await dynamoDB.scan(params).promise();
    items = items.concat(result.Items || []);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items
    .map(toDailyPlannerTaskDto)
    .filter(Boolean)
    .filter((row) => inDateRange(row, startDate, endDate));
}

export async function getTaskById(plannerTaskId) {
  const id = String(plannerTaskId || '').trim();
  if (!id) return null;
  try {
    const result = await dynamoDB.get({ TableName: TABLE_NAME, Key: { plannerTaskId: id } }).promise();
    return toDailyPlannerTaskDto(result.Item);
  } catch (err) {
    if (isTableMissingError(err)) {
      warnTableMissing('DailyPlannerTasks.getTaskById', err);
      return null;
    }
    throw err;
  }
}

export async function listTasksForEmployeeMonth(employeeCode, startDate, endDate) {
  const code = String(employeeCode || '').trim();
  if (!code) return [];

  try {
    try {
      const rows = await queryAllPages(dynamoDB, employeeDateQuery(code, startDate, endDate));
      return rows.map(toDailyPlannerTaskDto).filter(Boolean);
    } catch (err) {
      if (!isGsiMissingError(err)) throw err;
      warnGsiFallback('DailyPlannerTasks.listTasksForEmployeeMonth', err);
      return scanEmployeeMonthFallback(code, startDate, endDate);
    }
  } catch (err) {
    if (isTableMissingError(err)) {
      warnTableMissing('DailyPlannerTasks.listTasksForEmployeeMonth', err);
      return [];
    }
    throw err;
  }
}

export async function listTasksForEmployees(employeeCodes, startDate, endDate) {
  const codes = [...new Set(employeeCodes.map((c) => String(c || '').trim()).filter(Boolean))];
  if (codes.length === 0) return [];

  const batches = await Promise.all(
    codes.map((code) => listTasksForEmployeeMonth(code, startDate, endDate)),
  );
  return batches.flat();
}

export async function createTask(payload) {
  const employeeCode = String(payload.employeeCode || '').trim();
  const date = toDateOnly(payload.date);
  if (!employeeCode || !date) {
    const err = new Error('employeeCode and date are required');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const priority = String(payload.priority || 'Medium').trim();
  const hoursRequired =
    payload.hoursRequired === undefined || payload.hoursRequired === null || payload.hoursRequired === ''
      ? null
      : Number(payload.hoursRequired);
  const originalHoursRequired =
    payload.originalHoursRequired === undefined ||
    payload.originalHoursRequired === null ||
    payload.originalHoursRequired === ''
      ? hoursRequired
      : Number(payload.originalHoursRequired);
  const item = {
    plannerTaskId: uuidv4(),
    employeeCode,
    employeeName: String(payload.employeeName || '').trim(),
    date,
    taskName: String(payload.taskName || '').trim(),
    description: String(payload.description || '').trim(),
    priority,
    originalPriority: String(payload.originalPriority || priority).trim(),
    currentPriority: String(payload.currentPriority || priority).trim(),
    priorityEdited: Boolean(payload.priorityEdited),
    hoursRequired: Number.isFinite(hoursRequired) ? hoursRequired : null,
    originalHoursRequired: Number.isFinite(originalHoursRequired) ? originalHoursRequired : null,
    hoursRequiredEdited: Boolean(payload.hoursRequiredEdited),
    hoursRequiredEditedBy: String(payload.hoursRequiredEditedBy || '').trim(),
    hoursRequiredEditedByName: String(payload.hoursRequiredEditedByName || '').trim(),
    hoursRequiredEditedAt: payload.hoursRequiredEditedAt || null,
    status: String(payload.status || 'Pending').trim(),
    reason: String(payload.reason || '').trim(),
    taskType: String(payload.taskType || 'Manual').trim(),
    source: String(payload.source || 'MANUAL').trim(),
    salesPlannerId: payload.salesPlannerId ? String(payload.salesPlannerId).trim() : null,
    approved: Boolean(payload.approved),
    approvalStatus: String(payload.approvalStatus || (payload.approved ? 'APPROVED' : '')).trim(),
    approvedBy: String(payload.approvedBy || '').trim(),
    approvedByName: String(payload.approvedByName || '').trim(),
    approvedDate: payload.approvedDate || payload.approvedAt || null,
    approvedAt: payload.approvedAt || payload.approvedDate || null,
    managerComments: String(payload.managerComments || '').trim(),
    managerInstructions: String(payload.managerInstructions || '').trim(),
    isProjectBased: Boolean(payload.isProjectBased),
    projectName: String(payload.projectName || '').trim(),
    planFinalizedAt: payload.planFinalizedAt || null,
    planFinalizedBy: String(payload.planFinalizedBy || '').trim(),
    createdByRole: String(payload.createdByRole || '').trim(),
    dayCompletionSubmittedAt: payload.dayCompletionSubmittedAt || null,
    dayCompletionSubmittedBy: String(payload.dayCompletionSubmittedBy || '').trim(),
    completionManagerReviewedAt: payload.completionManagerReviewedAt || null,
    completionManagerReviewedBy: String(payload.completionManagerReviewedBy || '').trim(),
    dayCompletionReviewSubmittedAt: payload.dayCompletionReviewSubmittedAt || null,
    dayCompletionReviewSubmittedBy: String(payload.dayCompletionReviewSubmittedBy || '').trim(),
    planningCategory: String(payload.planningCategory || 'Regular').trim(),
    urgentReason: String(payload.urgentReason || '').trim(),
    planningWindowUsed: payload.planningWindowUsed ? String(payload.planningWindowUsed).trim() : null,
    planningTimestamp: payload.planningTimestamp || null,
    originalDate: payload.originalDate ? toDateOnly(payload.originalDate) : null,
    rescheduledFrom: payload.rescheduledFrom ? toDateOnly(payload.rescheduledFrom) : null,
    rescheduledToDate: payload.rescheduledToDate ? toDateOnly(payload.rescheduledToDate) : null,
    rescheduledFromDate: payload.rescheduledFromDate ? toDateOnly(payload.rescheduledFromDate) : null,
    rescheduledBy: String(payload.rescheduledBy || '').trim(),
    rescheduledByName: String(payload.rescheduledByName || '').trim(),
    rescheduledAt: payload.rescheduledAt || null,
    terminatedBy: String(payload.terminatedBy || '').trim(),
    terminatedByName: String(payload.terminatedByName || '').trim(),
    terminatedAt: payload.terminatedAt || null,
    parentTaskId: payload.parentTaskId ? String(payload.parentTaskId).trim() : null,
    planningScore: Number(payload.planningScore) || 0,
    completionScore: Number(payload.completionScore) || 0,
    finalScore: Number(payload.finalScore) || 0,
    createdAt: now,
    updatedAt: now,
    is_deleted: false,
  };

  try {
    await dynamoDB.put({ TableName: TABLE_NAME, Item: item }).promise();
  } catch (err) {
    if (isTableMissingError(err)) {
      const missing = new Error(
        'Daily Planner storage is not provisioned. Run: node scripts/ensure-daily-planner-tables.js',
      );
      missing.statusCode = 503;
      throw missing;
    }
    throw err;
  }
  return toDailyPlannerTaskDto(item);
}

export async function updateTask(plannerTaskId, patch, options = {}) {
  const id = String(plannerTaskId || '').trim();
  if (!id) {
    const err = new Error('plannerTaskId is required');
    err.statusCode = 400;
    throw err;
  }

  const existing = await getTaskById(id);
  if (!existing) {
    const err = new Error('Daily planner task not found');
    err.statusCode = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const updates = { ...patch, updatedAt: now };
  if (patch.date !== undefined) updates.date = toDateOnly(patch.date);

  const entries = Object.entries(updates).filter(
    ([key, value]) => key !== 'plannerTaskId' && value !== undefined,
  );
  if (entries.length === 0) return existing;

  const expressionAttributeNames = { ...(options.expressionAttributeNames || {}) };
  const expressionAttributeValues = { ...(options.expressionAttributeValues || {}) };
  const setExpressions = [];

  entries.forEach(([key, value], index) => {
    const keyToken = `#k${index}`;
    const valueToken = `:v${index}`;
    expressionAttributeNames[keyToken] = key;
    expressionAttributeValues[valueToken] = value;
    setExpressions.push(`${keyToken} = ${valueToken}`);
  });

  try {
    const params = {
      TableName: TABLE_NAME,
      Key: { plannerTaskId: id },
      UpdateExpression: `SET ${setExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    };
    if (options.conditionExpression) {
      params.ConditionExpression = options.conditionExpression;
    }
    const result = await dynamoDB.update(params).promise();
    return toDailyPlannerTaskDto(result.Attributes);
  } catch (err) {
    if (err?.code === 'ConditionalCheckFailedException') {
      const conflict = new Error('This revision request has already been processed');
      conflict.statusCode = 409;
      throw conflict;
    }
    if (isTableMissingError(err)) {
      const missing = new Error(
        'Daily Planner storage is not provisioned. Run: node scripts/ensure-daily-planner-tables.js',
      );
      missing.statusCode = 503;
      throw missing;
    }
    throw err;
  }
}

export async function softDeleteTask(plannerTaskId) {
  return updateTask(plannerTaskId, { is_deleted: true });
}
