/**
 * Daily Planner team mappings — manager ↔ employee.
 * Partition key mappingId (String).
 * GSI_ManagerCode: managerCode (HASH).
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { GSI_NAMES } from '../config/dynamodbIndexes.js';
import { isGsiMissingError, warnGsiFallback } from '../utils/dynamoGsi.js';
import { queryAllPages } from '../utils/dynamoPagination.js';
import log from '../utils/logger.js';

const TABLE_NAME = TABLES.DAILY_PLANNER_TEAM_MAPPINGS;

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

export function toMappingDto(row) {
  if (!row || row.is_deleted) return null;
  return {
    mappingId: String(row.mappingId || '').trim(),
    managerCode: String(row.managerCode || '').trim(),
    managerName: String(row.managerName || '').trim(),
    employeeCode: String(row.employeeCode || '').trim(),
    employeeName: String(row.employeeName || '').trim(),
    status: String(row.status || 'Active').trim(),
    createdBy: String(row.createdBy || '').trim(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function scanAllMappingsFallback() {
  let items = [];
  let lastKey;
  do {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'attribute_not_exists(is_deleted) OR is_deleted = :f',
      ExpressionAttributeValues: { ':f': false },
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    };
    const result = await dynamoDB.scan(params).promise();
    items = items.concat(result.Items || []);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items.map(toMappingDto).filter(Boolean);
}

export async function listAllMappings() {
  try {
    return await scanAllMappingsFallback();
  } catch (err) {
    if (isTableMissingError(err)) {
      warnTableMissing('DailyPlannerTeamMappings.listAllMappings', err);
      return [];
    }
    throw err;
  }
}

export async function listEmployeesForManager(managerCode) {
  const code = String(managerCode || '').trim();
  if (!code) return [];

  try {
    try {
      const rows = await queryAllPages(dynamoDB, {
        TableName: TABLE_NAME,
        IndexName: GSI_NAMES.DAILY_PLANNER_MANAGER_CODE,
        KeyConditionExpression: 'managerCode = :mgr',
        FilterExpression: 'attribute_not_exists(is_deleted) OR is_deleted = :f',
        ExpressionAttributeValues: { ':mgr': code, ':f': false },
      });
      return rows
        .map(toMappingDto)
        .filter(Boolean)
        .filter((m) => m.status === 'Active');
    } catch (err) {
      if (!isGsiMissingError(err)) throw err;
      warnGsiFallback('DailyPlannerTeamMappings.listEmployeesForManager', err);
      const all = await scanAllMappingsFallback();
      return all.filter((m) => m.managerCode === code && m.status === 'Active');
    }
  } catch (err) {
    if (isTableMissingError(err)) {
      warnTableMissing('DailyPlannerTeamMappings.listEmployeesForManager', err);
      return [];
    }
    throw err;
  }
}

export async function findMapping(managerCode, employeeCode) {
  const mgr = String(managerCode || '').trim();
  const emp = String(employeeCode || '').trim();
  if (!mgr || !emp) return null;

  const team = await listEmployeesForManager(mgr);
  return team.find((m) => m.employeeCode === emp) || null;
}

export async function createMapping(payload) {
  const managerCode = String(payload.managerCode || '').trim();
  const employeeCode = String(payload.employeeCode || '').trim();
  if (!managerCode || !employeeCode) {
    const err = new Error('managerCode and employeeCode are required');
    err.statusCode = 400;
    throw err;
  }

  const existing = await findMapping(managerCode, employeeCode);
  if (existing) return existing;

  const now = new Date().toISOString();
  const item = {
    mappingId: uuidv4(),
    managerCode,
    managerName: String(payload.managerName || '').trim(),
    employeeCode,
    employeeName: String(payload.employeeName || '').trim(),
    status: 'Active',
    createdBy: String(payload.createdBy || '').trim(),
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
  return toMappingDto(item);
}

export async function updateMapping(mappingId, patch) {
  const id = String(mappingId || '').trim();
  if (!id) {
    const err = new Error('mappingId is required');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const updates = { ...patch, updatedAt: now };
  const entries = Object.entries(updates).filter(
    ([key, value]) => key !== 'mappingId' && value !== undefined,
  );
  if (entries.length === 0) return null;

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
        Key: { mappingId: id },
        UpdateExpression: `SET ${setExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
      .promise();
    return toMappingDto(result.Attributes);
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
}

export async function findActiveManagerForEmployee(employeeCode) {
  const emp = String(employeeCode || '').trim();
  if (!emp) return null;
  const all = await listAllMappings();
  return all.find((m) => m.employeeCode === emp && m.status === 'Active') || null;
}

export async function softDeleteMapping(mappingId) {
  return updateMapping(mappingId, { is_deleted: true, status: 'Removed' });
}
