/**
 * SalesForecasts model — opportunities / quotations (full field persistence).
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';

const TABLE_NAME = TABLES.SALES_FORECASTS;

const notDeletedExpr = '(attribute_not_exists(is_deleted) OR is_deleted = :f)';

export const getSalesForecastById = async (forecastId) => {
  const result = await dynamoDB
    .get({
      TableName: TABLE_NAME,
      Key: { forecastId },
    })
    .promise();

  const item = result.Item;
  if (!item || item.is_deleted === true) return null;
  return item;
};

/**
 * @param {string|null} ownerEmployeeCode — if set, filter to owner
 */
export const scanSalesForecasts = async (ownerEmployeeCode = null) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: notDeletedExpr,
    ExpressionAttributeValues: {
      ':f': false,
    },
  };

  if (ownerEmployeeCode) {
    params.FilterExpression = `${notDeletedExpr} AND ownerEmployeeCode = :own`;
    params.ExpressionAttributeValues[':own'] = String(ownerEmployeeCode).trim();
  }

  let items = [];
  let startKey;
  do {
    const result = await dynamoDB
      .scan({
        ...params,
        ExclusiveStartKey: startKey,
      })
      .promise();

    items = items.concat(result.Items || []);
    startKey = result.LastEvaluatedKey;
  } while (startKey);

  return items;
};

export const createSalesForecast = async (item) => {
  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: item,
    })
    .promise();

  return item;
};

export const updateSalesForecast = async (forecastId, updateData) => {
  const payload = { ...updateData };
  delete payload.forecastId;

  payload.updatedAt = new Date().toISOString();

  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return getSalesForecastById(forecastId);
  }

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

  const result = await dynamoDB
    .update({
      TableName: TABLE_NAME,
      Key: { forecastId },
      UpdateExpression: `SET ${setExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
    .promise();

  return result.Attributes;
};

export const buildNewForecastId = () => `SF#${uuidv4()}`;
