/**
 * PurchaseHeaders Model
 * 
 * Data access layer for PurchaseHeaders DynamoDB table.
 * Handles purchase order header/main record operations.
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { parsePaginationOptions, encodeCursor } from '../utils/dynamoPagination.js';

const TABLE_NAME = TABLES.PURCHASE_HEADERS;

/**
 * Get purchase header by ID
 * @param {string} purchaseHeaderId - Purchase header ID
 * @returns {Promise<Object>} Purchase header record
 */
export const getPurchaseHeaderById = async (purchaseHeaderId) => {
  const result = await dynamoDB.get({
    TableName: TABLE_NAME,
    Key: { purchaseHeaderId },
  }).promise();

  if (result.Item?.is_deleted) return null;
  return result.Item || null;
};

/**
 * Get purchase headers by filters
 * @param {Object} filters - Filter criteria (supplier, date range, status, etc.)
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} List of purchase headers
 */
export const getPurchaseHeaders = async (filters = {}, options = {}) => {
  const pagination = parsePaginationOptions(options);
  const params = { TableName: TABLE_NAME };
  if (pagination.limit) params.Limit = pagination.limit;
  if (pagination.exclusiveStartKey) params.ExclusiveStartKey = pagination.exclusiveStartKey;

  const result = await dynamoDB.scan(params).promise();
  const items = (result.Items || []).filter((row) => !row?.is_deleted);

  return {
    items,
    lastKey: result.LastEvaluatedKey?.purchaseHeaderId || null,
    lastEvaluatedKey: result.LastEvaluatedKey || null,
    nextCursor: encodeCursor(result.LastEvaluatedKey),
  };
};

/**
 * Create new purchase header
 * @param {Object} purchaseData - Purchase header data
 * @returns {Promise<Object>} Created purchase header record
 */
export const createPurchaseHeader = async (purchaseData) => {
  const timestamp = new Date().toISOString();
  const resolvedHeaderId = purchaseData.id || purchaseData.purchaseHeaderId;
  if (!resolvedHeaderId) {
    throw new Error('Missing header id');
  }

  const header = {
    ...purchaseData,
    id: purchaseData.id || String(resolvedHeaderId),
    purchaseHeaderId: String(resolvedHeaderId),
    recordType: purchaseData.recordType || '',
    poNumber: purchaseData.poNumber || '',
    date: purchaseData.date || '',
    principal: purchaseData.principal || '',
    invoiceNumber: purchaseData.invoiceNumber || '',
    invoiceDate: purchaseData.invoiceDate || '',
    boeNumber: purchaseData.boeNumber || '',
    boeDate: purchaseData.boeDate || '',
    createdAt: purchaseData.createdAt || timestamp,
    updatedAt: timestamp,
    is_deleted: false,
    approval_status: purchaseData.approval_status || 'Pending',
    approved_by: purchaseData.approved_by || '',
    approved_at: purchaseData.approved_at || '',
    rejected_by: purchaseData.rejected_by || '',
    rejected_at: purchaseData.rejected_at || '',
    approval_comments: purchaseData.approval_comments || '',
  };

  const params = {
    TableName: TABLES.PURCHASE_HEADERS,
    Item: {
      purchaseHeaderId: String(header.id),
      ...header,
    },
  };

  console.log('Saving to DynamoDB:', params);

  await dynamoDB.put(params).promise();

  return params.Item;
};

/**
 * Update purchase header
 * @param {string} purchaseHeaderId - Purchase header ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Updated purchase header record
 */
export const updatePurchaseHeader = async (purchaseHeaderId, updateData) => {
  // TODO: Implement DynamoDB updateItem operation
};

/**
 * Delete purchase header
 * @param {string} purchaseHeaderId - Purchase header ID
 * @returns {Promise<Object>} Deletion result
 */
export const deletePurchaseHeader = async (purchaseHeaderId) => {
  // TODO: Implement DynamoDB deleteItem operation
  // Consider cascade delete of line items
};

export const createHeader = createPurchaseHeader;
export const getAllHeaders = async () => {
  const result = await getPurchaseHeaders();
  return result.items;
};
export const getHeaderById = getPurchaseHeaderById;


