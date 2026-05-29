/**
 * Expenses Model
 * 
 * Data access layer for Expenses DynamoDB table.
 * Handles expense record operations.
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { ENTITY_TYPE_EXPENSE, GSI_NAMES } from '../config/dynamodbIndexes.js';
import { isGsiMissingError, warnGsiFallback } from '../utils/dynamoGsi.js';
import {
  runQueryPage,
  queryAllPages,
  parsePaginationOptions,
  paginateSortedSlice,
} from '../utils/dynamoPagination.js';
import { sortExpensesDesc } from '../utils/dynamoSort.js';
import { v4 as uuidv4 } from 'uuid';
import log from '../utils/logger.js';

const TABLE_NAME = TABLES.EXPENSES;

async function getExpenseByIdSingleKey(key) {
  const result = await dynamoDB
    .get({
      TableName: TABLE_NAME,
      Key: { expenseId: key },
    })
    .promise();

  if (result.Item?.is_deleted) return null;
  return result.Item || null;
}

/**
 * Get expense by ID (supports legacy EXPENSE#… vs current EXP#… partition keys).
 * @param {string} expenseId - Expense ID
 * @returns {Promise<Object>} Expense record
 */
export const getExpenseById = async (expenseId) => {
  const id = String(expenseId ?? '').trim();
  if (!id) return null;

  let item = await getExpenseByIdSingleKey(id);
  if (item) return item;

  const alternates = [];
  if (id.startsWith('EXP#')) alternates.push(id.replace(/^EXP#/, 'EXPENSE#'));
  if (id.startsWith('EXPENSE#')) alternates.push(id.replace(/^EXPENSE#/, 'EXP#'));

  for (const alt of alternates) {
    if (!alt || alt === id) continue;
    item = await getExpenseByIdSingleKey(alt);
    if (item) {
      log.info('Expense lookup resolved with alternate pk', {
        requestedRouteId: id,
        dynamoExpenseId: item.expenseId,
      });
      return item;
    }
  }

  return null;
};

/**
 * Get expenses by employee ID
 * @param {string} employeeId - Employee ID
 * @param {Object} options - Query options (date range, status, etc.)
 * @returns {Promise<Array>} Array of expenses
 */
const notDeletedFilter = (row) => !row?.is_deleted;

/** Ensures GSI key attributes for create (full item) or update (partial). */
export function applyExpenseGsiKeys(item, { partial = false } = {}) {
  const out = { ...item, entityType: ENTITY_TYPE_EXPENSE };

  if (!partial) {
    out.createdAt = item.createdAt || item.created_at || new Date().toISOString();
    const code = String(item.created_by_employee_code || '').trim();
    if (code) out.created_by_employee_code = code;
  }

  return out;
}

function employeeExpenseQuery(employeeCode) {
  return {
    TableName: TABLE_NAME,
    IndexName: GSI_NAMES.EXPENSE_EMPLOYEE_UPDATED,
    KeyConditionExpression: 'created_by_employee_code = :code',
    ExpressionAttributeValues: { ':code': String(employeeCode).trim() },
    ScanIndexForward: false,
  };
}

async function scanExpensesFallback(employeeCode = null) {
  const params = { TableName: TABLE_NAME };
  if (employeeCode) {
    params.FilterExpression = 'created_by_employee_code = :code';
    params.ExpressionAttributeValues = { ':code': String(employeeCode).trim() };
  }

  let items = [];
  let startKey;
  do {
    const result = await dynamoDB.scan({ ...params, ExclusiveStartKey: startKey }).promise();
    items = items.concat(result.Items || []);
    startKey = result.LastEvaluatedKey;
  } while (startKey);

  return sortExpensesDesc(items.filter(notDeletedFilter));
}

export const queryExpensesByEmployeeCode = async (employeeCode, options = {}) => {
  const code = String(employeeCode ?? '').trim();
  if (!code) return [];

  const pagination = parsePaginationOptions(options);
  if (pagination.paginated) {
    const page = await queryExpensesByEmployeeCodePage(code, pagination);
    return page.items;
  }

  try {
    return await queryAllPages(dynamoDB, employeeExpenseQuery(code), notDeletedFilter);
  } catch (err) {
    if (!isGsiMissingError(err)) throw err;
    warnGsiFallback('Expenses.queryExpensesByEmployeeCode', err);
    return scanExpensesFallback(code);
  }
};

export const queryExpensesByEmployeeCodePage = async (employeeCode, pagination = {}) => {
  const code = String(employeeCode ?? '').trim();
  if (!code) return { items: [], lastEvaluatedKey: null };

  try {
    return runQueryPage(dynamoDB, employeeExpenseQuery(code), pagination, notDeletedFilter);
  } catch (err) {
    if (!isGsiMissingError(err)) throw err;
    warnGsiFallback('Expenses.queryExpensesByEmployeeCodePage', err);
    const sorted = await scanExpensesFallback(code);
    return paginateSortedSlice(sorted, parsePaginationOptions(pagination));
  }
};

/** @deprecated Prefer queryExpensesByEmployeeCode */
export const getExpensesByEmployeeId = queryExpensesByEmployeeCode;

/**
 * Admin / full-table list (scan — sort in memory before pagination).
 */
export const getAllExpenses = async (filters = {}, options = {}) => {
  const pagination = parsePaginationOptions(options);
  const sorted = await scanExpensesFallback(null);
  if (pagination.paginated) {
    return paginateSortedSlice(sorted, pagination);
  }
  return sorted;
};

/**
 * Create new expense
 * @param {Object} expenseData - Expense data
 * @returns {Promise<Object>} Created expense record
 */
export const createExpense = async (expenseData) => {
  const timestamp = new Date().toISOString();
  const monthYear = expenseData.monthYear || (() => {
    const dateObj = new Date(expenseData.date);
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getUTCFullYear());
    return `${month}-${year}`;
  })();

  const documents = Array.isArray(expenseData.documents)
    ? expenseData.documents
        .filter((document) => document?.fileName && document?.fileUrl)
        .map((document) => ({
          fileName: document.fileName,
          fileUrl: document.fileUrl,
        }))
    : [];

  const subCategoryTrimmed =
    expenseData.subCategory != null && String(expenseData.subCategory).trim() !== ''
      ? String(expenseData.subCategory).trim()
      : undefined;

  const item = applyExpenseGsiKeys({
    expenseId: `EXP#${uuidv4()}`,
    expenseHead: expenseData.expenseHead,
    ...(subCategoryTrimmed ? { subCategory: subCategoryTrimmed } : {}),
    ...(expenseData.supportingDocument
      ? { supportingDocument: String(expenseData.supportingDocument) }
      : {}),
    location: expenseData.location || '',
    purpose: expenseData.purpose || '',
    serviceProvider: expenseData.serviceProvider,
    billNumber: expenseData.billNumber,
    date: expenseData.date,
    amount: Number(expenseData.amount),
    employeeId: expenseData.employeeId || expenseData.created_by_employee_code || '',
    employeeName: expenseData.employeeName,
    employeeEmail: expenseData.employeeEmail || '',
    monthYear,
    documents,
    created_by_employee_code: expenseData.created_by_employee_code || '',
    created_by_name: expenseData.created_by_name || '',
    created_by_role: expenseData.created_by_role || '',
    created_by_user_id: expenseData.created_by_user_id || '',
    created_by_first_name: expenseData.created_by_first_name || '',
    created_by_last_name: expenseData.created_by_last_name || '',
    created_by: expenseData.created_by || '',
    created_at: expenseData.created_at || timestamp,
    updated_at: expenseData.updated_at || timestamp,
    createdAt: expenseData.createdAt || timestamp,
    updatedAt: expenseData.updatedAt || timestamp,
    is_deleted: false,
    approval_status: expenseData.approval_status || 'Pending',
    approved_by: expenseData.approved_by || '',
    approved_at: expenseData.approved_at || '',
    rejected_by: expenseData.rejected_by || '',
    rejected_at: expenseData.rejected_at || '',
    approval_comments: expenseData.approval_comments || '',
  });

  if (expenseData.fromLocation) {
    item.fromLocation = expenseData.fromLocation;
  }
  if (expenseData.toLocation) {
    item.toLocation = expenseData.toLocation;
  }
  if (expenseData.returnType) {
    item.returnType = expenseData.returnType;
  }
  if (
    expenseData.kilometers !== undefined &&
    expenseData.kilometers !== null &&
    String(expenseData.kilometers).trim() !== '' &&
    !Number.isNaN(Number(expenseData.kilometers))
  ) {
    item.kilometers = Number(expenseData.kilometers);
  }
  if (expenseData.fuelType != null && String(expenseData.fuelType).trim() !== '') {
    item.fuelType = String(expenseData.fuelType).trim();
  }
  if (expenseData.stayDateFrom) {
    item.stayDateFrom = expenseData.stayDateFrom;
  }
  if (expenseData.stayDateTo) {
    item.stayDateTo = expenseData.stayDateTo;
  }

  await dynamoDB.put({
    TableName: TABLE_NAME,
    Item: item,
  }).promise();

  return item;
};

/**
 * Update expense
 * @param {string} expenseId - Expense ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Updated expense record
 */
export const updateExpense = async (expenseId, updateData) => {
  const payload = {
    ...updateData,
  };

  if (payload.amount !== undefined) {
    payload.amount = Number(payload.amount);
  }

  if (payload.date) {
    const dateObj = new Date(payload.date);
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getUTCFullYear());
    payload.monthYear = `${month}-${year}`;
  }

  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );

  cleanPayload.entityType = ENTITY_TYPE_EXPENSE;

  let updateExpression = 'set ';
  const ExpressionAttributeNames = {};
  const ExpressionAttributeValues = {};

  const keys = Object.keys(cleanPayload);

  keys.forEach((key, index) => {
    updateExpression += `#${key} = :${key}`;
    if (index < keys.length - 1) updateExpression += ', ';

    ExpressionAttributeNames[`#${key}`] = key;
    ExpressionAttributeValues[`:${key}`] = cleanPayload[key];
  });

  // always update timestamp
  updateExpression += `${keys.length > 0 ? ', ' : ''}#updatedAt = :updatedAt`;
  ExpressionAttributeNames['#updatedAt'] = 'updatedAt';
  ExpressionAttributeValues[':updatedAt'] = new Date().toISOString();

  const result = await dynamoDB.update({
    TableName: TABLES.EXPENSES,
    Key: { expenseId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  }).promise();

  return result.Attributes;
};

/**
 * Delete expense
 * @param {string} expenseId - Expense ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteExpense = async (expenseId) => {
  return updateExpense(expenseId, { is_deleted: true, deleted_at: new Date().toISOString() });
};


