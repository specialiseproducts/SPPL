/**
 * EmployeeMaster Model
 * 
 * Data access layer for EmployeeMaster DynamoDB table.
 * Contains helper methods for CRUD operations on employee records.
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = TABLES.EMPLOYEE_MASTER;

/**
 * Get employee by ID
 * @param {string} employeeId - Employee ID (primary key)
 * @returns {Promise<Object>} Employee record
 */
export const getEmployeeById = async (employeeId) => {
  const result = await dynamoDB.get({
    TableName: TABLE_NAME,
    Key: { employeeId },
  }).promise();

  if (result.Item?.is_deleted) return null;
  return result.Item || null;
};

/**
 * Get employee by employeeCode
 * @param {string} employeeCode
 * @returns {Promise<Object|null>}
 */
export const getEmployeeByCode = async (employeeCode) => {
  const result = await dynamoDB.scan({
    TableName: TABLE_NAME,
    FilterExpression: '#employeeCode = :employeeCode',
    ExpressionAttributeNames: {
      '#employeeCode': 'employeeCode',
    },
    ExpressionAttributeValues: {
      ':employeeCode': employeeCode,
    },
  }).promise();

  const item = (result.Items || []).find((row) => !row?.is_deleted);
  return item || null;
};

/**
 * Get all employees
 * @param {Object} options - Query options (limit, lastKey, etc.)
 * @returns {Promise<Object>} List of employees
 */
export const getAllEmployees = async (options = {}) => {
  const params = {
    TableName: TABLE_NAME,
  };

  if (options?.limit) {
    params.Limit = options.limit;
  }

  if (options?.lastKey) {
    params.ExclusiveStartKey = { employeeId: options.lastKey };
  }

  const result = await dynamoDB.scan(params).promise();

  return {
    items: (result.Items || []).filter((row) => !row?.is_deleted),
    lastKey: result.LastEvaluatedKey?.employeeId || null,
  };
};

/**
 * Create new employee
 * @param {Object} employeeData - Employee data object
 * @returns {Promise<Object>} Created employee record
 */
export const createEmployee = async (employeeData) => {
  const timestamp = new Date().toISOString();
  const employee = {
    employeeId: `EMP#${uuidv4()}`,
    ...employeeData,
    createdAt: timestamp,
    updatedAt: timestamp,
    is_deleted: false,
    approval_status: employeeData.approval_status || 'Pending',
    approved_by: employeeData.approved_by || '',
    approved_at: employeeData.approved_at || '',
    rejected_by: employeeData.rejected_by || '',
    rejected_at: employeeData.rejected_at || '',
    approval_comments: employeeData.approval_comments || '',
  };

  await dynamoDB.put({
    TableName: TABLE_NAME,
    Item: employee,
  }).promise();

  return employee;
};

/**
 * Update employee
 * @param {string} employeeId - Employee ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Updated employee record
 */
export const updateEmployee = async (employeeId, updateData) => {
  const timestamp = new Date().toISOString();
  const payload = {
    ...updateData,
    updatedAt: timestamp,
  };

  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return await getEmployeeById(employeeId);
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

  const result = await dynamoDB.update({
    TableName: TABLE_NAME,
    Key: { employeeId },
    UpdateExpression: `SET ${setExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  }).promise();

  return result.Attributes;
};

/**
 * Delete employee
 * @param {string} employeeId - Employee ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteEmployee = async (employeeId) => {
  return updateEmployee(employeeId, { is_deleted: true, deleted_at: new Date().toISOString() });
};


