/**
 * PurchaseLineItems Model
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { GSI_NAMES } from '../config/dynamodbIndexes.js';
import { isGsiMissingError, warnGsiFallback } from '../utils/dynamoGsi.js';
import { queryAllPages } from '../utils/dynamoPagination.js';

const TABLE_NAME = TABLES.PURCHASE_LINE_ITEMS;

export const getLineItemById = async (lineItemId) => {
  const result = await dynamoDB
    .get({
      TableName: TABLE_NAME,
      Key: { purchaseLineItemId: lineItemId },
    })
    .promise();

  return result.Item || null;
};

/**
 * Line items for a purchase header via GSI_PurchaseHeader.
 */
export const getLineItemsByPurchaseHeaderId = async (purchaseHeaderId) => {
  const headerId = String(purchaseHeaderId ?? '').trim();
  if (!headerId) return [];

  try {
    return await queryAllPages(dynamoDB, {
      TableName: TABLE_NAME,
      IndexName: GSI_NAMES.PURCHASE_HEADER,
      KeyConditionExpression: 'purchaseHeaderId = :purchaseHeaderId',
      ExpressionAttributeValues: { ':purchaseHeaderId': headerId },
    });
  } catch (err) {
    if (!isGsiMissingError(err)) throw err;
    warnGsiFallback('PurchaseLineItems.getLineItemsByPurchaseHeaderId', err);
  }

  const result = await dynamoDB
    .scan({
      TableName: TABLE_NAME,
      FilterExpression: '#purchaseHeaderId = :purchaseHeaderId',
      ExpressionAttributeNames: { '#purchaseHeaderId': 'purchaseHeaderId' },
      ExpressionAttributeValues: { ':purchaseHeaderId': headerId },
    })
    .promise();

  return result.Items || [];
};

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

  await dynamoDB.put(params).promise();
  return params.Item;
};

export const updateLineItem = async (lineItemId, updateData) => {
  // TODO: Implement DynamoDB updateItem operation
};

export const deleteLineItem = async (lineItemId) => {
  // TODO: Implement DynamoDB deleteItem operation
};

export const batchCreateLineItems = async (lineItems) => {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return [];
  }

  const createdItems = [];
  for (const lineItem of lineItems) {
    const created = await createLineItem(lineItem);
    createdItems.push(created);
  }

  return createdItems;
};

export const createLineItems = batchCreateLineItems;
