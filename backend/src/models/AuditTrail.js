/**
 * AuditTrail DynamoDB model — append-only business audit history.
 * Modules must use AuditTrailService.log() — never write here directly from features.
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { GSI_NAMES } from '../config/dynamodbIndexes.js';
import { buildEntityKey } from '../constants/auditTrail.js';
import {
  encodeCursor,
  parsePaginationOptions,
  runQueryPage,
  toPaginatedResponse,
} from '../utils/dynamoPagination.js';

const TABLE_NAME = TABLES.AUDIT_TRAIL;

export function toPublicAuditEntry(item) {
  if (!item) return null;
  return {
    auditId: item.auditId,
    employeeCode: item.employeeCode || '',
    employeeName: item.employeeName || '',
    module: item.module || '',
    entityType: item.entityType || '',
    entityId: item.entityId || '',
    entityKey: item.entityKey || '',
    action: item.action || '',
    description: item.description || '',
    oldValues: item.oldValues ?? null,
    newValues: item.newValues ?? null,
    status: item.status || 'SUCCESS',
    performedBy: item.performedBy || '',
    performedByRole: item.performedByRole || '',
    performedAt: item.performedAt || '',
    metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {},
    reference: item.reference || '',
    ipAddress: item.ipAddress ?? null,
    deviceInfo: item.deviceInfo ?? null,
    browser: item.browser ?? null,
    sessionId: item.sessionId ?? null,
  };
}

export async function createAuditTrailEntry(data = {}) {
  const performedAt = data.performedAt || new Date().toISOString();
  const entityType = String(data.entityType || '').trim();
  const entityId = String(data.entityId || '').trim();
  const entityKey = data.entityKey || buildEntityKey(entityType, entityId);
  const employeeCode = String(data.employeeCode || data.performedBy || '').trim();
  const module = String(data.module || '').trim();

  const item = {
    auditId: data.auditId || `AUDIT#${uuidv4()}`,
    employeeCode,
    employeeName: String(data.employeeName || '').trim(),
    module,
    entityType,
    entityId,
    action: String(data.action || 'CUSTOM').trim().toUpperCase() || 'CUSTOM',
    description: String(data.description || '').trim(),
    oldValues: data.oldValues ?? null,
    newValues: data.newValues ?? null,
    status: String(data.status || 'SUCCESS').trim() || 'SUCCESS',
    performedBy: String(data.performedBy || employeeCode).trim(),
    performedByRole: String(data.performedByRole || '').trim(),
    performedAt,
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
    reference: String(data.reference || data.metadata?.reference || '').trim(),
    ipAddress: data.ipAddress ?? null,
    deviceInfo: data.deviceInfo ?? null,
    browser: data.browser ?? null,
    sessionId: data.sessionId ?? null,
  };

  // Sparse GSI: only set entityKey when both sides exist (avoid empty HASH keys).
  if (entityKey) {
    item.entityKey = entityKey;
  }

  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(auditId)',
    })
    .promise();

  return item;
}

async function queryByIndex(indexName, hashKey, hashValue, options = {}) {
  const pagination = parsePaginationOptions(options);
  const newestFirst = String(options.sort || 'newest').toLowerCase() !== 'oldest';

  const page = await runQueryPage(
    dynamoDB,
    {
      TableName: TABLE_NAME,
      IndexName: indexName,
      KeyConditionExpression: '#hk = :hv',
      ExpressionAttributeNames: { '#hk': hashKey },
      ExpressionAttributeValues: { ':hv': hashValue },
      ScanIndexForward: !newestFirst,
    },
    pagination,
  );

  return toPaginatedResponse(page.items, page.lastEvaluatedKey);
}

export async function listByEntityKey(entityKey, options = {}) {
  const key = String(entityKey || '').trim();
  if (!key) return { data: [], nextCursor: null };
  return queryByIndex(GSI_NAMES.AUDIT_ENTITY_PERFORMED, 'entityKey', key, options);
}

export async function listByModule(module, options = {}) {
  const mod = String(module || '').trim();
  if (!mod) return { data: [], nextCursor: null };
  return queryByIndex(GSI_NAMES.AUDIT_MODULE_PERFORMED, 'module', mod, options);
}

export async function listByEmployeeCode(employeeCode, options = {}) {
  const code = String(employeeCode || '').trim();
  if (!code) return { data: [], nextCursor: null };
  return queryByIndex(GSI_NAMES.AUDIT_EMPLOYEE_PERFORMED, 'employeeCode', code, options);
}

/**
 * Best-effort filtered list: picks the most selective index, then filters in memory.
 */
export async function listFiltered(filters = {}, options = {}) {
  const entityType = String(filters.entityType || '').trim();
  const entityId = String(filters.entityId || '').trim();
  const module = String(filters.module || '').trim();
  const employeeCode = String(filters.employeeCode || '').trim();
  const action = String(filters.action || '').trim().toUpperCase();
  const status = String(filters.status || '').trim().toUpperCase();
  const reference = String(filters.reference || '').trim().toLowerCase();
  const from = String(filters.from || filters.dateFrom || '').trim();
  const to = String(filters.to || filters.dateTo || '').trim();

  let page;
  if (entityType && entityId) {
    page = await listByEntityKey(buildEntityKey(entityType, entityId), options);
  } else if (employeeCode) {
    page = await listByEmployeeCode(employeeCode, options);
  } else if (module) {
    page = await listByModule(module, options);
  } else {
    // Avoid unconstrained scans — require at least one dimension.
    return { data: [], nextCursor: null };
  }

  let items = (page.data || []).map(toPublicAuditEntry).filter(Boolean);

  if (module) items = items.filter((i) => i.module === module);
  if (action) items = items.filter((i) => String(i.action).toUpperCase() === action);
  if (status) items = items.filter((i) => String(i.status).toUpperCase() === status);
  if (reference) {
    items = items.filter(
      (i) =>
        String(i.reference || '').toLowerCase().includes(reference) ||
        String(i.entityId || '').toLowerCase().includes(reference) ||
        String(i.description || '').toLowerCase().includes(reference),
    );
  }
  if (from) items = items.filter((i) => String(i.performedAt || '') >= from);
  if (to) items = items.filter((i) => String(i.performedAt || '') <= to);

  return {
    data: items,
    nextCursor: page.nextCursor || null,
  };
}

export { encodeCursor, buildEntityKey };
