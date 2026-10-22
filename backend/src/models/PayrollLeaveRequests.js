/**
 * Payroll leave requests — employee-owned, Pending until Team Calendar approval (future).
 * Partition key leaveRequestId (String).
 * GSI_EmployeeCode: employeeCode (HASH).
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { GSI_NAMES } from '../config/dynamodbIndexes.js';
import { isGsiMissingError, warnGsiFallback } from '../utils/dynamoGsi.js';
import { queryAllPages } from '../utils/dynamoPagination.js';
import log from '../utils/logger.js';

const TABLE_NAME = TABLES.PAYROLL_LEAVE_REQUESTS;

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

export function toLeaveRequestDto(row) {
  if (!row || row.is_deleted) return null;
  return {
    leaveRequestId: String(row.leaveRequestId || '').trim(),
    employeeCode: String(row.employeeCode || '').trim(),
    employeeName: String(row.employeeName || '').trim(),
    leaveType: String(row.leaveType || '').trim(),
    startDate: String(row.startDate || '').trim(),
    endDate: String(row.endDate || '').trim(),
    halfDayPeriod: row.halfDayPeriod ? String(row.halfDayPeriod).trim() : null,
    reason: String(row.reason || '').trim(),
    durationDays: Number(row.durationDays) || 0,
    status: String(row.status || 'Pending').trim(),
    advanceNoticeAcknowledged: Boolean(row.advanceNoticeAcknowledged),
    createdBy: String(row.createdBy || '').trim(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    approvedBy: row.approvedBy ? String(row.approvedBy).trim() : null,
    approvedAt: row.approvedAt || null,
    rejectedBy: row.rejectedBy ? String(row.rejectedBy).trim() : null,
    rejectedAt: row.rejectedAt || null,
    rejectionReason: row.rejectionReason ? String(row.rejectionReason).trim() : null,
  };
}

async function scanForEmployeeFallback(employeeCode) {
  let items = [];
  let lastKey;
  do {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression:
        'employeeCode = :emp AND (attribute_not_exists(is_deleted) OR is_deleted = :f)',
      ExpressionAttributeValues: { ':emp': employeeCode, ':f': false },
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    };
    const result = await dynamoDB.scan(params).promise();
    items = items.concat(result.Items || []);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items.map(toLeaveRequestDto).filter(Boolean);
}

export async function listLeaveRequestsForEmployee(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) return [];

  try {
    try {
      const rows = await queryAllPages(dynamoDB, {
        TableName: TABLE_NAME,
        IndexName: GSI_NAMES.PAYROLL_LEAVE_EMPLOYEE_CODE,
        KeyConditionExpression: 'employeeCode = :emp',
        FilterExpression: 'attribute_not_exists(is_deleted) OR is_deleted = :f',
        ExpressionAttributeValues: { ':emp': code, ':f': false },
      });
      return rows.map(toLeaveRequestDto).filter(Boolean);
    } catch (err) {
      if (!isGsiMissingError(err)) throw err;
      warnGsiFallback('PayrollLeaveRequests.listLeaveRequestsForEmployee', err);
      return scanForEmployeeFallback(code);
    }
  } catch (err) {
    if (isTableMissingError(err)) {
      warnTableMissing('PayrollLeaveRequests.listLeaveRequestsForEmployee', err);
      return [];
    }
    throw err;
  }
}

export async function getLeaveRequestById(leaveRequestId) {
  const id = String(leaveRequestId || '').trim();
  if (!id) return null;
  try {
    const result = await dynamoDB
      .get({ TableName: TABLE_NAME, Key: { leaveRequestId: id } })
      .promise();
    return toLeaveRequestDto(result.Item);
  } catch (err) {
    if (isTableMissingError(err)) {
      warnTableMissing('PayrollLeaveRequests.getLeaveRequestById', err);
      return null;
    }
    throw err;
  }
}

export async function findDuplicatePending(payload) {
  const code = String(payload.employeeCode || '').trim();
  const leaveType = String(payload.leaveType || '').trim();
  const startDate = String(payload.startDate || '').trim();
  const endDate = String(payload.endDate || '').trim();
  const halfDayPeriod = payload.halfDayPeriod
    ? String(payload.halfDayPeriod).trim()
    : null;
  const excludeId = String(payload.excludeLeaveRequestId || '').trim();
  if (!code || !leaveType || !startDate || !endDate) return null;

  const list = await listLeaveRequestsForEmployee(code);
  return (
    list.find(
      (row) =>
        row.status === 'Pending' &&
        row.leaveRequestId !== excludeId &&
        row.leaveType === leaveType &&
        row.startDate === startDate &&
        row.endDate === endDate &&
        (row.halfDayPeriod || null) === halfDayPeriod,
    ) || null
  );
}

export async function updateLeaveRequest(leaveRequestId, patch) {
  const id = String(leaveRequestId || '').trim();
  if (!id) {
    const err = new Error('leaveRequestId is required');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const updates = { ...patch, updatedAt: now };
  const entries = Object.entries(updates).filter(
    ([key, value]) => key !== 'leaveRequestId' && value !== undefined,
  );
  if (entries.length === 0) return getLeaveRequestById(id);

  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  const setExpressions = [];

  entries.forEach(([key, value], index) => {
    const keyToken = `#k${index}`;
    const valueToken = `:v${index}`;
    expressionAttributeNames[keyToken] = key;
    expressionAttributeValues[valueToken] = value;
    setExpressions.push(`${keyToken} = ${valueToken}`);
  });

  try {
    const result = await dynamoDB
      .update({
        TableName: TABLE_NAME,
        Key: { leaveRequestId: id },
        UpdateExpression: `SET ${setExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
      .promise();
    return toLeaveRequestDto(result.Attributes);
  } catch (err) {
    if (isTableMissingError(err)) {
      const missing = new Error(
        'Payroll leave storage is not provisioned. Run: node scripts/ensure-payroll-tables.js',
      );
      missing.statusCode = 503;
      throw missing;
    }
    throw err;
  }
}

/**
 * Soft-delete a leave request by primary key.
 * When employeeCode is provided, requires ownership + Pending status atomically
 * so an approval between validate and delete cannot succeed silently.
 */
export async function softDeleteLeaveRequest(leaveRequestId, options = {}) {
  const id = String(leaveRequestId || '').trim();
  if (!id) {
    const err = new Error('leaveRequestId is required');
    err.statusCode = 400;
    throw err;
  }
  const employeeCode = String(options.employeeCode || '').trim();
  // Soft-delete must succeed even though toLeaveRequestDto hides is_deleted rows.
  const now = new Date().toISOString();
  const expressionAttributeNames = { '#status': 'status' };
  const expressionAttributeValues = {
    ':status': 'Deleted',
    ':deleted': true,
    ':updatedAt': now,
  };
  let conditionExpression = 'attribute_exists(leaveRequestId)';
  if (employeeCode) {
    expressionAttributeValues[':pending'] = 'Pending';
    expressionAttributeValues[':emp'] = employeeCode;
    conditionExpression =
      'attribute_exists(leaveRequestId) AND #status = :pending AND employeeCode = :emp';
  }

  try {
    await dynamoDB
      .update({
        TableName: TABLE_NAME,
        Key: { leaveRequestId: id },
        UpdateExpression:
          'SET #status = :status, is_deleted = :deleted, updatedAt = :updatedAt',
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: conditionExpression,
        ReturnValues: 'NONE',
      })
      .promise();
    return { leaveRequestId: id, status: 'Deleted' };
  } catch (err) {
    if (err?.code === 'ConditionalCheckFailedException') {
      const conflict = new Error(
        employeeCode
          ? 'Leave request is no longer Pending or does not belong to you'
          : 'Leave request not found',
      );
      conflict.statusCode = employeeCode ? 409 : 404;
      conflict.code = employeeCode ? 'LEAVE_NOT_EDITABLE' : undefined;
      throw conflict;
    }
    if (isTableMissingError(err)) {
      const missing = new Error(
        'Payroll leave storage is not provisioned. Run: node scripts/ensure-payroll-tables.js',
      );
      missing.statusCode = 503;
      throw missing;
    }
    throw err;
  }
}

export async function createLeaveRequest(payload) {
  const employeeCode = String(payload.employeeCode || '').trim();
  const leaveType = String(payload.leaveType || '').trim();
  const startDate = String(payload.startDate || '').trim();
  const endDate = String(payload.endDate || '').trim();
  if (!employeeCode || !leaveType || !startDate || !endDate) {
    const err = new Error('employeeCode, leaveType, startDate, and endDate are required');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const item = {
    leaveRequestId: uuidv4(),
    employeeCode,
    employeeName: String(payload.employeeName || '').trim(),
    leaveType,
    startDate,
    endDate,
    halfDayPeriod: payload.halfDayPeriod
      ? String(payload.halfDayPeriod).trim()
      : null,
    reason: String(payload.reason || '').trim(),
    durationDays: Number(payload.durationDays) || 0,
    status: 'Pending',
    advanceNoticeAcknowledged: Boolean(payload.advanceNoticeAcknowledged),
    createdBy: String(payload.createdBy || employeeCode).trim(),
    createdAt: now,
    updatedAt: now,
    is_deleted: false,
  };

  try {
    await dynamoDB.put({ TableName: TABLE_NAME, Item: item }).promise();
  } catch (err) {
    if (isTableMissingError(err)) {
      const missing = new Error(
        'Payroll leave storage is not provisioned. Run: node scripts/ensure-payroll-tables.js',
      );
      missing.statusCode = 503;
      throw missing;
    }
    throw err;
  }
  return toLeaveRequestDto(item);
}
