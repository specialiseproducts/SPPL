/**
 * ActivityLogs Model
 *
 * Data access layer for ActivityLogs DynamoDB table.
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = TABLES.ACTIVITY_LOGS;

/**
 * Create audit log entry
 * @param {Object} logData - Audit log data (userId, action, resource, details, etc.)
 * @returns {Promise<Object>} Created audit log record
 */
export const createAuditLog = async (logData) => {
  const item = {
    activityLogId: `ACT#${uuidv4()}`,
    actorEmployeeCode: logData.actorEmployeeCode || '',
    actorName: logData.actorName || '',
    actorRole: logData.actorRole || '',
    module: logData.module || '',
    actionType: logData.actionType || '',
    targetEntity: logData.targetEntity || '',
    targetId: logData.targetId || '',
    oldValue: logData.oldValue || null,
    newValue: logData.newValue || null,
    metadata: logData.metadata || {},
    createdAt: new Date().toISOString(),
  };

  await dynamoDB.put({
    TableName: TABLE_NAME,
    Item: item,
  }).promise();

  return item;
};

/**
 * Get audit logs by user ID
 * @param {string} userId - User ID
 * @param {Object} options - Query options (date range, limit, etc.)
 * @returns {Promise<Array>} Array of audit log records
 */
export const getAuditLogsByUserId = async (userId, options = {}) => {
  const result = await dynamoDB.scan({
    TableName: TABLE_NAME,
    FilterExpression: '#actorEmployeeCode = :userId',
    ExpressionAttributeNames: {
      '#actorEmployeeCode': 'actorEmployeeCode',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
    },
  }).promise();
  return result.Items || [];
};

/**
 * Get audit logs by resource
 * @param {string} resourceType - Resource type (e.g., 'expense', 'purchase')
 * @param {string} resourceId - Resource ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of audit log records
 */
export const getAuditLogsByResource = async (resourceType, resourceId, options = {}) => {
  const result = await dynamoDB.scan({
    TableName: TABLE_NAME,
    FilterExpression: '#targetEntity = :resourceType AND #targetId = :resourceId',
    ExpressionAttributeNames: {
      '#targetEntity': 'targetEntity',
      '#targetId': 'targetId',
    },
    ExpressionAttributeValues: {
      ':resourceType': resourceType,
      ':resourceId': resourceId,
    },
  }).promise();
  return result.Items || [];
};

/**
 * Get audit logs with filters
 * @param {Object} filters - Filter criteria
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} List of audit logs with pagination
 */
export const getAuditLogs = async (filters = {}, options = {}) => {
  const result = await dynamoDB.scan({
    TableName: TABLE_NAME,
    Limit: options?.limit || 200,
  }).promise();
  return {
    items: result.Items || [],
    lastKey: result.LastEvaluatedKey?.activityLogId || null,
  };
};


