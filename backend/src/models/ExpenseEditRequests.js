import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { GSI_NAMES } from '../config/dynamodbIndexes.js';
import { isGsiMissingError, warnGsiFallback } from '../utils/dynamoGsi.js';
import { queryAllPages } from '../utils/dynamoPagination.js';

const TABLE_NAME = TABLES.SALES_FORECASTS;
const ENTITY_TYPE_EXPENSE_EDIT_REQUEST = 'EXPENSE_EDIT_REQUEST';

const notDeletedFilter = (row) => !row?.is_deleted;

function buildRequestId() {
  return `EER#${uuidv4()}`;
}

function baseEntityQuery() {
  return {
    TableName: TABLE_NAME,
    IndexName: GSI_NAMES.SALES_ENTITY_UPDATED,
    KeyConditionExpression: 'entityType = :et',
    FilterExpression: '(attribute_not_exists(is_deleted) OR is_deleted = :f)',
    ExpressionAttributeValues: {
      ':et': ENTITY_TYPE_EXPENSE_EDIT_REQUEST,
      ':f': false,
    },
    ScanIndexForward: false,
  };
}

async function scanFallback() {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression:
      'entityType = :et AND (attribute_not_exists(is_deleted) OR is_deleted = :f)',
    ExpressionAttributeValues: {
      ':et': ENTITY_TYPE_EXPENSE_EDIT_REQUEST,
      ':f': false,
    },
  };
  let items = [];
  let startKey;
  do {
    const result = await dynamoDB.scan({ ...params, ExclusiveStartKey: startKey }).promise();
    items = items.concat(result.Items || []);
    startKey = result.LastEvaluatedKey;
  } while (startKey);
  return items.filter(notDeletedFilter);
}

export async function createExpenseEditRequest(data) {
  const now = new Date().toISOString();
  const requestId = buildRequestId();
  const item = {
    forecastId: requestId,
    requestId,
    entityType: ENTITY_TYPE_EXPENSE_EDIT_REQUEST,
    expenseId: data.expenseId,
    expenseRef: data.expenseRef || data.expenseId || '',
    revisionNumber: Number(data.revisionNumber || 0),
    employeeCode: data.employeeCode || '',
    employeeName: data.employeeName || '',
    employeeOfficialEmail: data.employeeOfficialEmail || '',
    requestType: data.requestType || '',
    oldValues: data.oldValues || {},
    requestedValues: data.requestedValues || {},
    status: 'Pending',
    adminRemark: '',
    requestedAt: now,
    reviewedAt: '',
    reviewedBy: '',
    reviewedByEmployeeCode: '',
    createdAt: now,
    updatedAt: now,
    is_deleted: false,
  };

  await dynamoDB.put({ TableName: TABLE_NAME, Item: item }).promise();
  return item;
}

export async function getExpenseEditRequestById(requestId) {
  const id = String(requestId || '').trim();
  if (!id) return null;
  const result = await dynamoDB.get({ TableName: TABLE_NAME, Key: { forecastId: id } }).promise();
  const item = result.Item;
  if (!item || item.is_deleted === true) return null;
  if (item.entityType !== ENTITY_TYPE_EXPENSE_EDIT_REQUEST) return null;
  return item;
}

export async function updateExpenseEditRequest(requestId, patch) {
  const existing = await getExpenseEditRequestById(requestId);
  if (!existing) return null;
  const now = new Date().toISOString();

  let updateExpression = 'SET #updatedAt = :updatedAt';
  const ExpressionAttributeNames = { '#updatedAt': 'updatedAt' };
  const ExpressionAttributeValues = { ':updatedAt': now };
  for (const [key, value] of Object.entries(patch || {})) {
    if (key === 'updatedAt' || key === 'forecastId' || key === 'entityType') continue;
    updateExpression += `, #${key} = :${key}`;
    ExpressionAttributeNames[`#${key}`] = key;
    ExpressionAttributeValues[`:${key}`] = value;
  }

  const result = await dynamoDB
    .update({
      TableName: TABLE_NAME,
      Key: { forecastId: requestId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
    .promise();
  return result.Attributes;
}

export async function listAllExpenseEditRequests() {
  try {
    return await queryAllPages(dynamoDB, baseEntityQuery(), notDeletedFilter);
  } catch (err) {
    if (!isGsiMissingError(err)) throw err;
    warnGsiFallback('ExpenseEditRequests.listAllExpenseEditRequests', err);
    return scanFallback();
  }
}

export async function listExpenseEditRequestsByExpenseId(expenseId) {
  const id = String(expenseId || '').trim();
  if (!id) return [];
  const rows = await listAllExpenseEditRequests();
  return rows
    .filter((row) => String(row.expenseId || '').trim() === id)
    .sort((a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')));
}

export async function findPendingExpenseEditRequest(expenseId) {
  const rows = await listExpenseEditRequestsByExpenseId(expenseId);
  return rows.find((row) => String(row.status || '').trim() === 'Pending') || null;
}

export async function listPendingExpenseEditRequests() {
  const rows = await listAllExpenseEditRequests();
  return rows
    .filter((row) => String(row.status || '').trim() === 'Pending')
    .sort((a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')));
}
