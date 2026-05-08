/**
 * SalesForecasts Model
 *
 * Data access layer for SalesForecasts DynamoDB table.
 * Handles sales forecasting data operations.
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';

const TABLE_NAME = TABLES.SALES_FORECASTS;

/**
 * Create new sales forecast
 * @param {Object} data - Sales forecast data
 * @returns {Promise<Object>} Created sales forecast record
 */
export const createSalesForecast = async (data) => {
  const unitPrice = Number(data.unitPrice);
  const qty = Number(data.qty);
  const totalPrice = unitPrice * qty;
  const timestamp = new Date().toISOString();

  const item = {
    forecastId: `SF#${uuidv4()}`,
    quotationRef: data.quotationRef,
    quotationDate: data.quotationDate,
    endCustomer: data.endCustomer,
    principal: data.principal || '',
    quotedItemModel: data.quotedItemModel,
    currency: data.currency || 'INR',
    unitPrice,
    qty,
    totalPrice,
    conversionToINR: totalPrice,
    probability: Number(data.probability || 0),
    employeeName: data.employeeName || '',
    created_by_employee_code: data.created_by_employee_code || '',
    created_by_name: data.created_by_name || '',
    created_by_role: data.created_by_role || '',
    created_by_user_id: data.created_by_user_id || '',
    created_by_first_name: data.created_by_first_name || '',
    created_by_last_name: data.created_by_last_name || '',
    created_by: data.created_by || '',
    created_at: data.created_at || timestamp,
    updated_at: data.updated_at || timestamp,
    createdAt: data.createdAt || timestamp,
    updatedAt: data.updatedAt || timestamp,
    is_deleted: false,
    approval_status: data.approval_status || 'Pending',
    approved_by: data.approved_by || '',
    approved_at: data.approved_at || '',
    rejected_by: data.rejected_by || '',
    rejected_at: data.rejected_at || '',
    approval_comments: data.approval_comments || '',
  };

  await dynamoDB.put({
    TableName: TABLE_NAME,
    Item: item,
  }).promise();

  return item;
};

/**
 * Get all sales forecasts
 * @returns {Promise<Array>} List of sales forecasts
 */
export const getAllSalesForecasts = async () => {
  const result = await dynamoDB.scan({
    TableName: TABLE_NAME,
  }).promise();

  return (result.Items || []).filter((row) => !row?.is_deleted);
};

/**
 * Update sales forecast
 * @param {string} forecastId - Forecast ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Updated sales forecast record
 */
export const updateSalesForecast = async (forecastId, updateData) => {
  const payload = {
    ...updateData,
  };

  const hasUnitPrice = payload.unitPrice !== undefined;
  const hasQty = payload.qty !== undefined;

  if (hasUnitPrice) {
    payload.unitPrice = Number(payload.unitPrice);
  }
  if (hasQty) {
    payload.qty = Number(payload.qty);
  }

  if (hasUnitPrice || hasQty) {
    const current = await dynamoDB.get({
      TableName: TABLE_NAME,
      Key: { forecastId },
    }).promise();

    const currentItem = current.Item || {};
    const nextUnitPrice = hasUnitPrice ? payload.unitPrice : Number(currentItem.unitPrice || 0);
    const nextQty = hasQty ? payload.qty : Number(currentItem.qty || 0);
    const nextTotal = nextUnitPrice * nextQty;

    payload.totalPrice = nextTotal;
    payload.conversionToINR = nextTotal;
  }

  payload.updatedAt = new Date().toISOString();

  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
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

  const result = await dynamoDB.update({
    TableName: TABLE_NAME,
    Key: { forecastId },
    UpdateExpression: `SET ${setExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  }).promise();

  return result.Attributes;
};

/**
 * Delete sales forecast
 * @param {string} forecastId - Forecast ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteSalesForecast = async (forecastId) => {
  return updateSalesForecast(forecastId, { is_deleted: true, deleted_at: new Date().toISOString() });
};


