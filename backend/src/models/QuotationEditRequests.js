/**
 * Quotation edit-permission requests — stored in SalesForecasts table
 * with PK forecastId = QER#… and entityType = QUOTATION_EDIT_REQUEST.
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { GSI_NAMES } from '../config/dynamodbIndexes.js';
import { isGsiMissingError, warnGsiFallback } from '../utils/dynamoGsi.js';
import { queryAllPages } from '../utils/dynamoPagination.js';

const TABLE_NAME = TABLES.SALES_FORECASTS;
export const ENTITY_TYPE_EDIT_REQUEST = 'QUOTATION_EDIT_REQUEST';

const notDeletedFilter = (row) => !row?.is_deleted;

function buildRequestId() {
  return `QER#${uuidv4()}`;
}

function baseEntityQuery() {
  return {
    TableName: TABLE_NAME,
    IndexName: GSI_NAMES.SALES_ENTITY_UPDATED,
    KeyConditionExpression: 'entityType = :et',
    FilterExpression: '(attribute_not_exists(is_deleted) OR is_deleted = :f)',
    ExpressionAttributeValues: {
      ':et': ENTITY_TYPE_EDIT_REQUEST,
      ':f': false,
    },
    ScanIndexForward: false,
  };
}

async function scanEditRequestsFallback() {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression:
      'entityType = :et AND (attribute_not_exists(is_deleted) OR is_deleted = :f)',
    ExpressionAttributeValues: {
      ':et': ENTITY_TYPE_EDIT_REQUEST,
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

export async function createEditRequest(data) {
  const now = new Date().toISOString();
  const forecastId = buildRequestId();
  const item = {
    forecastId,
    requestId: forecastId,
    entityType: ENTITY_TYPE_EDIT_REQUEST,
    quotationId: data.quotationId,
    quotationRef: data.quotationRef || '',
    revisionNumber: data.revisionNumber ?? 0,
    employeeCode: data.employeeCode || '',
    employeeName: data.employeeName || '',
    employeeOfficialEmail: data.employeeOfficialEmail || '',
    customerOrganization: data.customerOrganization || '',
    principal: data.principal || '',
    requestType: data.requestType,
    oldValues: data.oldValues || {},
    requestedValues: data.requestedValues || {},
    status: 'Pending',
    adminRemark: '',
    requestedAt: now,
    reviewedAt: '',
    reviewedBy: '',
    reviewedByEmployeeCode: '',
    updatedAt: now,
    createdAt: now,
    is_deleted: false,
  };

  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: item,
    })
    .promise();

  return item;
}

export async function getEditRequestById(requestId) {
  const id = String(requestId || '').trim();
  if (!id) return null;
  const result = await dynamoDB
    .get({
      TableName: TABLE_NAME,
      Key: { forecastId: id },
    })
    .promise();
  const item = result.Item;
  if (!item || item.is_deleted === true) return null;
  if (item.entityType !== ENTITY_TYPE_EDIT_REQUEST) return null;
  return item;
}

export async function updateEditRequest(requestId, patch) {
  const existing = await getEditRequestById(requestId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const next = {
    ...existing,
    ...patch,
    updatedAt: now,
    entityType: ENTITY_TYPE_EDIT_REQUEST,
  };

  const keys = Object.keys(patch);
  if (keys.length === 0) return existing;

  let updateExpression = 'SET #updatedAt = :updatedAt';
  const ExpressionAttributeNames = { '#updatedAt': 'updatedAt' };
  const ExpressionAttributeValues = { ':updatedAt': now };

  keys.forEach((key) => {
    if (key === 'updatedAt' || key === 'forecastId' || key === 'entityType') return;
    updateExpression += `, #${key} = :${key}`;
    ExpressionAttributeNames[`#${key}`] = key;
    ExpressionAttributeValues[`:${key}`] = next[key];
  });

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

export async function listAllEditRequests() {
  try {
    return await queryAllPages(dynamoDB, baseEntityQuery(), notDeletedFilter);
  } catch (err) {
    if (!isGsiMissingError(err)) throw err;
    warnGsiFallback('QuotationEditRequests.listAllEditRequests', err);
    return scanEditRequestsFallback();
  }
}

export async function listEditRequestsByQuotationId(quotationId) {
  const qid = String(quotationId || '').trim();
  if (!qid) return [];
  const all = await listAllEditRequests();
  return all
    .filter((r) => String(r.quotationId || '').trim() === qid)
    .sort((a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')));
}

export async function findPendingEditRequestForQuotation(quotationId) {
  const rows = await listEditRequestsByQuotationId(quotationId);
  return rows.find((r) => String(r.status || '').trim() === 'Pending') || null;
}

export async function listPendingEditRequests() {
  const all = await listAllEditRequests();
  return all
    .filter((r) => String(r.status || '').trim() === 'Pending')
    .sort((a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')));
}
