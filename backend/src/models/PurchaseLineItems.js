/**
 * PurchaseLineItems Model
 * 
 * Data access layer for PurchaseLineItems DynamoDB table.
 * Handles purchase order line item operations.
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';

const TABLE_NAME = TABLES.PURCHASE_LINE_ITEMS;

/**
 * Get line item by ID
 * @param {string} lineItemId - Line item ID
 * @returns {Promise<Object>} Line item record
 */
export const getLineItemById = async (lineItemId) => {
  const result = await dynamoDB.get({
    TableName: TABLE_NAME,
    Key: { purchaseLineItemId: lineItemId },
  }).promise();

  return result.Item || null;
};

/**
 * Get line items by purchase header ID
 * @param {string} purchaseHeaderId - Purchase header ID
 * @returns {Promise<Array>} Array of line items
 */
export const getLineItemsByPurchaseHeaderId = async (purchaseHeaderId) => {
  const result = await dynamoDB.scan({
    TableName: TABLE_NAME,
    FilterExpression: '#purchaseHeaderId = :purchaseHeaderId',
    ExpressionAttributeNames: {
      '#purchaseHeaderId': 'purchaseHeaderId',
    },
    ExpressionAttributeValues: {
      ':purchaseHeaderId': purchaseHeaderId,
    },
  }).promise();

  return result.Items || [];
};

/**
 * Create new line item
 * @param {Object} lineItemData - Line item data
 * @returns {Promise<Object>} Created line item record
 */
export const createLineItem = async (lineItemData) => {
  const timestamp = new Date().toISOString();
  const resolvedLineItemId = lineItemData.id || lineItemData.purchaseLineItemId || lineItemData.lineItemId;
  if (!resolvedLineItemId) {
    throw new Error('Missing item id');
  }
  const item = {
    ...lineItemData,
    id: lineItemData.id || resolvedLineItemId,
    lineItemId: lineItemData.lineItemId || resolvedLineItemId,
    purchaseLineItemId: resolvedLineItemId,
    purchaseHeaderId: lineItemData.purchaseHeaderId || lineItemData.po_number || resolvedLineItemId,
    itemDetails: lineItemData.itemDetails || '',
    partNumber: lineItemData.partNumber || '',
    unitPrice: Number(lineItemData.unitPrice || 0),
    quantity: Number(lineItemData.quantity || 0),
    freightCharges: Number(lineItemData.freightCharges || 0),
    gst: Number(lineItemData.gst || 0),
    totalLandedPrice: Number(lineItemData.totalLandedPrice || 0),
    priceToSPPL: Number(lineItemData.priceToSPPL || 0),
    gmPercentage: Number(lineItemData.gmPercentage || 0),
    margin: Number(lineItemData.margin || 0),
    createdAt: lineItemData.createdAt || timestamp,
    updatedAt: timestamp,
  };

  const params = {
    TableName: TABLES.PURCHASE_LINE_ITEMS,
    Item: {
      purchaseLineItemId: String(item.id),
      purchaseHeaderId: String(item.purchaseHeaderId || item.po_number || item.id),
      ...item,
    },
  };

  console.log('Saving to DynamoDB:', params);

  await dynamoDB.put(params).promise();

  return params.Item;
};

/**
 * Update line item
 * @param {string} lineItemId - Line item ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Updated line item record
 */
export const updateLineItem = async (lineItemId, updateData) => {
  // TODO: Implement DynamoDB updateItem operation
};

/**
 * Delete line item
 * @param {string} lineItemId - Line item ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteLineItem = async (lineItemId) => {
  // TODO: Implement DynamoDB deleteItem operation
};

/**
 * Batch create line items
 * @param {Array} lineItems - Array of line item data
 * @returns {Promise<Object>} Batch write result
 */
export const batchCreateLineItems = async (lineItems) => {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return [];
  }

  const createdItems = [];
  for (const lineItem of lineItems) {
    const timestamp = new Date().toISOString();
    const resolvedLineItemId = lineItem.id || lineItem.purchaseLineItemId || lineItem.lineItemId;
    if (!resolvedLineItemId) {
      throw new Error('Missing item id');
    }
    const normalized = {
      ...lineItem,
      id: lineItem.id || resolvedLineItemId,
      lineItemId: lineItem.lineItemId || resolvedLineItemId,
      purchaseLineItemId: resolvedLineItemId,
      purchaseHeaderId: lineItem.purchaseHeaderId || lineItem.po_number || resolvedLineItemId,
      itemDetails: lineItem.itemDetails || '',
      partNumber: lineItem.partNumber || '',
      unitPrice: Number(lineItem.unitPrice || 0),
      quantity: Number(lineItem.quantity || 0),
      freightCharges: Number(lineItem.freightCharges || 0),
      gst: Number(lineItem.gst || 0),
      totalLandedPrice: Number(lineItem.totalLandedPrice || 0),
      priceToSPPL: Number(lineItem.priceToSPPL || 0),
      gmPercentage: Number(lineItem.gmPercentage || 0),
      margin: Number(lineItem.margin || 0),
      createdAt: lineItem.createdAt || timestamp,
      updatedAt: timestamp,
    };
    const params = {
      TableName: TABLES.PURCHASE_LINE_ITEMS,
      Item: {
        purchaseLineItemId: String(normalized.id),
        purchaseHeaderId: String(normalized.purchaseHeaderId || normalized.po_number || normalized.id),
        ...normalized,
      },
    };

    console.log('Saving to DynamoDB:', params);
    await dynamoDB.put(params).promise();
    createdItems.push(params.Item);
  }

  return createdItems;
};

export const createLineItems = batchCreateLineItems;


