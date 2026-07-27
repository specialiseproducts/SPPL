/**
 * OrderProcessing Model
 *
 * Data access layer for OrderProcessing DynamoDB table.
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = TABLES.ORDER_PROCESSING;

const notDeletedFilter = (row) => !row?.is_deleted;

export const getOrderById = async (orderId) => {
  const id = String(orderId ?? '').trim();
  if (!id) return null;
  const result = await dynamoDB
    .get({ TableName: TABLE_NAME, Key: { orderId: id } })
    .promise();
  if (result.Item?.is_deleted) return null;
  return result.Item || null;
};

export const getOrdersByEmployeeCode = async (employeeCode) => {
  const code = String(employeeCode ?? '').trim();
  if (!code) return [];

  const params = {
    TableName: TABLE_NAME,
    FilterExpression:
      'created_by_employee_code = :code AND (attribute_not_exists(is_deleted) OR is_deleted = :notDel)',
    ExpressionAttributeValues: { ':code': code, ':notDel': false },
  };

  let items = [];
  let startKey;
  do {
    const result = await dynamoDB.scan({ ...params, ExclusiveStartKey: startKey }).promise();
    items = items.concat(result.Items || []);
    startKey = result.LastEvaluatedKey;
  } while (startKey);

  return items
    .filter(notDeletedFilter)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
};

export const createOrder = async (data) => {
  const timestamp = new Date().toISOString();
  const item = {
    orderId: `ORD#${uuidv4()}`,
    ...data,
    created_at: data.created_at || timestamp,
    updated_at: data.updated_at || timestamp,
    is_deleted: false,
    status: data.status || 'Draft',
  };

  await dynamoDB.put({ TableName: TABLE_NAME, Item: item }).promise();
  return item;
};

export const updateOrder = async (orderId, updateData) => {
  const cleanPayload = Object.fromEntries(
    Object.entries(updateData).filter(([, v]) => v !== undefined),
  );
  cleanPayload.updated_at = new Date().toISOString();

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

  const result = await dynamoDB
    .update({
      TableName: TABLE_NAME,
      Key: { orderId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
    .promise();

  return result.Attributes;
};

export const deleteOrder = async (orderId) => {
  return updateOrder(orderId, { is_deleted: true, deleted_at: new Date().toISOString() });
};
