/**
 * Notifications model — centralized ERP notification store.
 * PK: notificationId
 * GSI_RecipientCreated: recipientEmployeeCode + createdAt (query newest first).
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { GSI_NAMES } from '../config/dynamodbIndexes.js';
import { isGsiMissingError, warnGsiFallback } from '../utils/dynamoGsi.js';
import {
  encodeCursor,
  decodeCursor,
  toPaginatedResponse,
} from '../utils/dynamoPagination.js';
import {
  NOTIFICATION_STATUS,
  prioritySortValue,
} from '../constants/notifications.js';

const TABLE_NAME = TABLES.NOTIFICATIONS;

function buildId() {
  return `NOTIF#${uuidv4()}`;
}

function normalizeStatus(item) {
  if (!item) return NOTIFICATION_STATUS.UNREAD;
  const s = String(item.status || '').trim();
  if (s === NOTIFICATION_STATUS.READ || s === NOTIFICATION_STATUS.ARCHIVED || s === NOTIFICATION_STATUS.UNREAD) {
    return s;
  }
  if (item.isRead === true) return NOTIFICATION_STATUS.READ;
  return NOTIFICATION_STATUS.UNREAD;
}

export function toPublicNotification(item) {
  if (!item) return null;
  const status = normalizeStatus(item);
  return {
    notificationId: item.notificationId,
    recipientEmployeeCode: item.recipientEmployeeCode || item.employeeCode || '',
    recipientRole: item.recipientRole || '',
    recipientEmail: item.recipientEmail || '',
    module: item.module || 'system',
    category: item.category || 'System',
    title: item.title || '',
    message: item.message || '',
    priority: item.priority || 'Normal',
    status,
    isRead: status !== NOTIFICATION_STATUS.UNREAD,
    section: item.section || 'activity',
    actionType: item.actionType || '',
    actionId: item.actionId || '',
    actionUrl: item.actionUrl || '',
    metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {},
    createdBy: item.createdBy || '',
    createdAt: item.createdAt || '',
    readAt: item.readAt || '',
    archivedAt: item.archivedAt || '',
    prioritySort: item.prioritySort ?? prioritySortValue(item.priority),
  };
}

export async function createNotification(data) {
  const now = new Date().toISOString();
  const recipientEmployeeCode = String(data.recipientEmployeeCode || data.employeeCode || '').trim();
  if (!recipientEmployeeCode) {
    const err = new Error('recipientEmployeeCode is required');
    err.statusCode = 400;
    throw err;
  }

  const status = data.status || NOTIFICATION_STATUS.UNREAD;
  const priority = data.priority || 'Normal';
  const item = {
    notificationId: data.notificationId || buildId(),
    // Legacy field kept in sync for older readers / future dual GSI usage
    employeeCode: recipientEmployeeCode,
    recipientEmployeeCode,
    recipientRole: data.recipientRole || '',
    recipientEmail: data.recipientEmail || '',
    module: data.module || 'system',
    category: data.category || 'System',
    title: data.title || '',
    message: data.message || data.description || '',
    priority,
    prioritySort: prioritySortValue(priority),
    status,
    isRead: status !== NOTIFICATION_STATUS.UNREAD,
    section: data.section || 'activity',
    actionType: data.actionType || '',
    actionId: data.actionId || '',
    actionUrl: data.actionUrl || '',
    metadata: data.metadata || {},
    createdBy: data.createdBy || 'system',
    createdAt: now,
    updatedAt: now,
    readAt: '',
    archivedAt: '',
    // Legacy type field for older Daily Planner consumers
    type: data.type || 'INFO',
  };

  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: item,
    })
    .promise();

  return item;
}

export async function getNotificationById(notificationId) {
  const id = String(notificationId || '').trim();
  if (!id) return null;
  const result = await dynamoDB
    .get({
      TableName: TABLE_NAME,
      Key: { notificationId: id },
    })
    .promise();
  return result.Item || null;
}

export async function updateNotification(notificationId, patch = {}) {
  const existing = await getNotificationById(notificationId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const keys = Object.keys(patch).filter((k) => k !== 'notificationId');
  if (keys.length === 0) return existing;

  let updateExpression = 'SET #updatedAt = :updatedAt';
  const ExpressionAttributeNames = { '#updatedAt': 'updatedAt' };
  const ExpressionAttributeValues = { ':updatedAt': now };

  for (const key of keys) {
    updateExpression += `, #${key} = :${key}`;
    ExpressionAttributeNames[`#${key}`] = key;
    ExpressionAttributeValues[`:${key}`] = patch[key];
  }

  const result = await dynamoDB
    .update({
      TableName: TABLE_NAME,
      Key: { notificationId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
    .promise();

  return result.Attributes;
}

/**
 * Query notifications for a recipient (newest first). Prefer GSI; fall back to scan.
 */
export async function listByRecipientPage(recipientEmployeeCode, { limit = 50, cursor } = {}) {
  const code = String(recipientEmployeeCode || '').trim();
  if (!code) return { items: [], lastEvaluatedKey: null };

  const ExclusiveStartKey = decodeCursor(cursor);
  const pageLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  try {
    const result = await dynamoDB
      .query({
        TableName: TABLE_NAME,
        IndexName: GSI_NAMES.NOTIFICATION_RECIPIENT_CREATED,
        KeyConditionExpression: 'recipientEmployeeCode = :code',
        ExpressionAttributeValues: { ':code': code },
        ScanIndexForward: false,
        Limit: pageLimit,
        ExclusiveStartKey,
      })
      .promise();
    return {
      items: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey || null,
    };
  } catch (err) {
    if (!isGsiMissingError(err)) throw err;
    warnGsiFallback('Notifications.listByRecipientPage', err);
  }

  // Legacy: also match employeeCode for rows created before schema expansion
  const scanResult = await dynamoDB
    .scan({
      TableName: TABLE_NAME,
      FilterExpression:
        'recipientEmployeeCode = :code OR employeeCode = :code',
      ExpressionAttributeValues: { ':code': code },
      ExclusiveStartKey,
      Limit: pageLimit * 3,
    })
    .promise();

  const items = (scanResult.Items || []).sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
  );
  return {
    items: items.slice(0, pageLimit),
    lastEvaluatedKey: scanResult.LastEvaluatedKey || null,
  };
}

export async function countUnreadByRecipient(recipientEmployeeCode) {
  const code = String(recipientEmployeeCode || '').trim();
  if (!code) return 0;

  let count = 0;
  let cursor;
  do {
    const page = await listByRecipientPage(code, { limit: 100, cursor });
    for (const row of page.items) {
      if (normalizeStatus(row) === NOTIFICATION_STATUS.UNREAD) count += 1;
    }
    cursor = page.lastEvaluatedKey ? encodeCursor(page.lastEvaluatedKey) : undefined;
    // Cap unread count walk to protect performance
    if (count >= 99) return 99;
  } while (cursor);

  return count;
}

export { toPaginatedResponse, encodeCursor };
