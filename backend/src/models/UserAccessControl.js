/**
 * UserAccessControl Model
 *
 * Data access layer for UserAccessControl DynamoDB table.
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';

const TABLE_NAME = TABLES.USER_ACCESS_CONTROL;

export const getByEmployeeCode = async (employeeCode) => {
  const result = await dynamoDB.get({
    TableName: TABLE_NAME,
    Key: { employeeCode },
  }).promise();

  return result.Item || null;
};

export const getAll = async () => {
  const result = await dynamoDB.scan({
    TableName: TABLE_NAME,
  }).promise();
  return result.Items || [];
};

export const createOrUpdateAccessControl = async (data) => {
  const timestamp = new Date().toISOString();
  const existing = await getByEmployeeCode(data.employeeCode);
  const payload = {
    employeeCode: data.employeeCode,
    employeeName: data.employeeName || existing?.employeeName || '',
    globalRole: data.globalRole || 'User',
    moduleOverrides: data.moduleOverrides || {},
    updatedBy: data.updatedBy || 'system',
    updatedByName: data.updatedByName || '',
    updatedAt: timestamp,
    createdAt: existing?.createdAt || timestamp,
  };

  await dynamoDB.put({
    TableName: TABLE_NAME,
    Item: payload,
  }).promise();

  return payload;
};

export const deleteByEmployeeCode = async (employeeCode) => {
  await dynamoDB.delete({
    TableName: TABLE_NAME,
    Key: { employeeCode },
  }).promise();
  return { employeeCode };
};

