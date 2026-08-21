/**
 * PasswordResetOtps Model
 * Isolated OTP / verified-reset state for forgot-password flow.
 * PK: employeeCode (one active reset cycle per employee).
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import log from '../utils/logger.js';

const TABLE_NAME = TABLES.PASSWORD_RESET_OTPS;

export async function getByEmployeeCode(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) return null;
  try {
    const result = await dynamoDB
      .get({
        TableName: TABLE_NAME,
        Key: { employeeCode: code },
      })
      .promise();
    return result.Item || null;
  } catch (error) {
    log.error('PasswordResetOtps getByEmployeeCode error:', error);
    throw error;
  }
}

/**
 * Upsert the active password-reset cycle for an employee (invalidates prior OTP).
 */
export async function putResetRecord(record) {
  const item = {
    ...record,
    employeeCode: String(record.employeeCode || '').trim(),
    updatedAt: new Date().toISOString(),
  };
  if (!item.employeeCode) {
    throw new Error('employeeCode is required');
  }
  try {
    await dynamoDB
      .put({
        TableName: TABLE_NAME,
        Item: item,
      })
      .promise();
    return item;
  } catch (error) {
    log.error('PasswordResetOtps putResetRecord error:', error);
    throw error;
  }
}

export async function updateResetRecord(employeeCode, updates) {
  const code = String(employeeCode || '').trim();
  if (!code) {
    throw new Error('employeeCode is required');
  }
  const keys = Object.keys(updates || {}).filter((k) => k !== 'employeeCode');
  if (keys.length === 0) {
    return getByEmployeeCode(code);
  }

  const ExpressionAttributeNames = {};
  const ExpressionAttributeValues = {};
  const parts = [];
  keys.forEach((key, index) => {
    const nameKey = `#k${index}`;
    const valueKey = `:v${index}`;
    ExpressionAttributeNames[nameKey] = key;
    ExpressionAttributeValues[valueKey] = updates[key];
    parts.push(`${nameKey} = ${valueKey}`);
  });
  ExpressionAttributeNames['#updatedAt'] = 'updatedAt';
  ExpressionAttributeValues[':updatedAt'] = new Date().toISOString();
  parts.push('#updatedAt = :updatedAt');

  try {
    const result = await dynamoDB
      .update({
        TableName: TABLE_NAME,
        Key: { employeeCode: code },
        UpdateExpression: `SET ${parts.join(', ')}`,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
      .promise();
    return result.Attributes || null;
  } catch (error) {
    log.error('PasswordResetOtps updateResetRecord error:', error);
    throw error;
  }
}

export async function deleteByEmployeeCode(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) return;
  try {
    await dynamoDB
      .delete({
        TableName: TABLE_NAME,
        Key: { employeeCode: code },
      })
      .promise();
  } catch (error) {
    log.error('PasswordResetOtps deleteByEmployeeCode error:', error);
    throw error;
  }
}
