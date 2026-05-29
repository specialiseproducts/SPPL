/**
 * SalesForecasts model — opportunities / quotations.
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { ENTITY_TYPE_OPPORTUNITY, GSI_NAMES } from '../config/dynamodbIndexes.js';
import { isGsiMissingError, warnGsiFallback } from '../utils/dynamoGsi.js';
import { runQueryPage, queryAllPages, parsePaginationOptions, paginateSortedSlice } from '../utils/dynamoPagination.js';
import { sortSalesForecastsDesc } from '../utils/dynamoSort.js';

const TABLE_NAME = TABLES.SALES_FORECASTS;

const notDeletedExpr = '(attribute_not_exists(is_deleted) OR is_deleted = :f)';

/** Ensures GSI key attributes for create (full item) or update (partial). */
export function applySalesForecastGsiKeys(item, { partial = false } = {}) {
  const updatedAt = item.updatedAt || new Date().toISOString();
  const out = { ...item, updatedAt, entityType: ENTITY_TYPE_OPPORTUNITY };

  if (!partial) {
    const owner = String(item.ownerEmployeeCode || item.created_by_employee_code || '').trim();
    out.ownerEmployeeCode = owner || item.ownerEmployeeCode || '';
  } else if (item.ownerEmployeeCode !== undefined || item.created_by_employee_code !== undefined) {
    const owner = String(item.ownerEmployeeCode || item.created_by_employee_code || '').trim();
    if (owner) out.ownerEmployeeCode = owner;
  }

  return out;
}

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

const notDeletedFilter = (row) => !row?.is_deleted;

async function scanSalesForecastsFallback(ownerEmployeeCode = null) {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: notDeletedExpr,
    ExpressionAttributeValues: { ':f': false },
  };

  if (ownerEmployeeCode) {
    params.FilterExpression = `${notDeletedExpr} AND ownerEmployeeCode = :own`;
    params.ExpressionAttributeValues[':own'] = String(ownerEmployeeCode).trim();
  }

  let items = [];
  let startKey;
  do {
    const result = await dynamoDB.scan({ ...params, ExclusiveStartKey: startKey }).promise();
    items = items.concat(result.Items || []);
    startKey = result.LastEvaluatedKey;
  } while (startKey);

  return sortSalesForecastsDesc(items);
}

function baseOwnerQuery(ownerEmployeeCode) {
  return {
    TableName: TABLE_NAME,
    IndexName: GSI_NAMES.SALES_OWNER_UPDATED,
    KeyConditionExpression: 'ownerEmployeeCode = :own',
    FilterExpression: notDeletedExpr,
    ExpressionAttributeValues: {
      ':own': String(ownerEmployeeCode).trim(),
      ':f': false,
    },
    ScanIndexForward: false,
  };
}

function baseEntityQuery() {
  return {
    TableName: TABLE_NAME,
    IndexName: GSI_NAMES.SALES_ENTITY_UPDATED,
    KeyConditionExpression: 'entityType = :et',
    FilterExpression: notDeletedExpr,
    ExpressionAttributeValues: {
      ':et': ENTITY_TYPE_OPPORTUNITY,
      ':f': false,
    },
    ScanIndexForward: false,
  };
}

export const querySalesForecastsByOwner = async (ownerEmployeeCode, filterFn = notDeletedFilter) => {
  const code = String(ownerEmployeeCode ?? '').trim();
  if (!code) return [];

  try {
    return await queryAllPages(dynamoDB, baseOwnerQuery(code), filterFn);
  } catch (err) {
    if (!isGsiMissingError(err)) throw err;
    warnGsiFallback('SalesForecasts.querySalesForecastsByOwner', err);
    return scanSalesForecastsFallback(code);
  }
};

export const querySalesForecastsByOwnerPage = async (ownerEmployeeCode, pagination = {}) => {
  const code = String(ownerEmployeeCode ?? '').trim();
  if (!code) return { items: [], lastEvaluatedKey: null };

  try {
    return runQueryPage(dynamoDB, baseOwnerQuery(code), pagination, notDeletedFilter);
  } catch (err) {
    if (!isGsiMissingError(err)) throw err;
    warnGsiFallback('SalesForecasts.querySalesForecastsByOwnerPage', err);
    const sorted = await scanSalesForecastsFallback(code);
    return paginateSortedSlice(sorted, parsePaginationOptions(pagination));
  }
};

export const queryAllSalesForecasts = async (filterFn = notDeletedFilter) => {
  try {
    return await queryAllPages(dynamoDB, baseEntityQuery(), filterFn);
  } catch (err) {
    if (!isGsiMissingError(err)) throw err;
    warnGsiFallback('SalesForecasts.queryAllSalesForecasts', err);
    return scanSalesForecastsFallback(null);
  }
};

export const queryAllSalesForecastsPage = async (pagination = {}) => {
  try {
    return runQueryPage(dynamoDB, baseEntityQuery(), pagination, notDeletedFilter);
  } catch (err) {
    if (!isGsiMissingError(err)) throw err;
    warnGsiFallback('SalesForecasts.queryAllSalesForecastsPage', err);
    const sorted = await scanSalesForecastsFallback(null);
    return paginateSortedSlice(sorted, parsePaginationOptions(pagination));
  }
};

/** @deprecated Use queryAllSalesForecasts / querySalesForecastsByOwner */
export const scanSalesForecasts = async (ownerEmployeeCode = null) => {
  if (ownerEmployeeCode) return querySalesForecastsByOwner(ownerEmployeeCode);
  return queryAllSalesForecasts();
};

export const createSalesForecast = async (item) => {
  const normalized = applySalesForecastGsiKeys(item);
  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: normalized,
    })
    .promise();

  return normalized;
};

export const updateSalesForecast = async (forecastId, updateData) => {
  const payload = applySalesForecastGsiKeys({ ...updateData }, { partial: true });
  delete payload.forecastId;

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
