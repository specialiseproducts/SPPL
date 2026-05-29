/**
 * EmployeeMaster Model
 *
 * Data access layer for EmployeeMaster DynamoDB table.
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { ENTITY_TYPE_EMPLOYEE, GSI_NAMES } from '../config/dynamodbIndexes.js';
import { isGsiMissingError, warnGsiFallback } from '../utils/dynamoGsi.js';
import {
  parsePaginationOptions,
  runQueryPage,
  queryAllPages,
  paginateSortedSlice,
  toPaginatedResponse,
} from '../utils/dynamoPagination.js';
import { sortEmployeesDesc } from '../utils/dynamoSort.js';
import { toEmployeeListDto } from '../utils/listDtos.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = TABLES.EMPLOYEE_MASTER;

export const getEmployeeById = async (employeeId) => {
  const result = await dynamoDB
    .get({
      TableName: TABLE_NAME,
      Key: { employeeId },
    })
    .promise();

  if (result.Item?.is_deleted) return null;
  return result.Item || null;
};

/**
 * Lookup by employeeCode via GSI_EmployeeCode (auth hot path).
 */
export const getEmployeeByCode = async (employeeCode) => {
  const code = String(employeeCode ?? '').trim();
  if (!code) return null;

  try {
    const page = await runQueryPage(
      dynamoDB,
      {
        TableName: TABLE_NAME,
        IndexName: GSI_NAMES.EMPLOYEE_CODE,
        KeyConditionExpression: '#employeeCode = :employeeCode',
        ExpressionAttributeNames: { '#employeeCode': 'employeeCode' },
        ExpressionAttributeValues: { ':employeeCode': code },
        Limit: 5,
      },
      {}
    );
    const item = (page.items || []).find((row) => !row?.is_deleted);
    if (item) return item;
  } catch (err) {
    if (!isGsiMissingError(err)) throw err;
    warnGsiFallback('EmployeeMaster.getEmployeeByCode', err);
  }

  const result = await dynamoDB
    .scan({
      TableName: TABLE_NAME,
      FilterExpression: '#employeeCode = :employeeCode',
      ExpressionAttributeNames: { '#employeeCode': 'employeeCode' },
      ExpressionAttributeValues: { ':employeeCode': code },
      Limit: 25,
    })
    .promise();

  return (result.Items || []).find((row) => !row?.is_deleted) || null;
};

function entityEmployeeQuery() {
  return {
    TableName: TABLE_NAME,
    IndexName: GSI_NAMES.EMPLOYEE_ENTITY_CREATED,
    KeyConditionExpression: 'entityType = :et',
    ExpressionAttributeValues: { ':et': ENTITY_TYPE_EMPLOYEE },
    ScanIndexForward: false,
  };
}

async function scanEmployeesFallback() {
  let items = [];
  let startKey;
  do {
    const result = await dynamoDB.scan({ TableName: TABLE_NAME, ExclusiveStartKey: startKey }).promise();
    items = items.concat(result.Items || []);
    startKey = result.LastEvaluatedKey;
  } while (startKey);

  return sortEmployeesDesc(
    items.filter((row) => !row?.is_deleted).map((row) => toEmployeeListDto(row))
  );
}

export const getAllEmployees = async (options = {}) => {
  const pagination = parsePaginationOptions(options);

  try {
    if (pagination.paginated) {
      const page = await runQueryPage(
        dynamoDB,
        entityEmployeeQuery(),
        pagination,
        (row) => !row?.is_deleted
      );
      return toPaginatedResponse(
        (page.items || []).map((row) => toEmployeeListDto(row)),
        page.lastEvaluatedKey
      );
    }

    const rows = await queryAllPages(dynamoDB, entityEmployeeQuery(), (row) => !row?.is_deleted);
    return toPaginatedResponse(
      rows.map((row) => toEmployeeListDto(row)),
      null
    );
  } catch (err) {
    if (!isGsiMissingError(err)) throw err;
    warnGsiFallback('EmployeeMaster.getAllEmployees', err);
  }

  const sorted = await scanEmployeesFallback();
  if (pagination.paginated) {
    const page = paginateSortedSlice(sorted, pagination);
    return toPaginatedResponse(page.items, page.lastEvaluatedKey);
  }
  return toPaginatedResponse(sorted, null);
};

export const createEmployee = async (employeeData) => {
  const timestamp = new Date().toISOString();
  const employee = {
    employeeId: `EMP#${uuidv4()}`,
    ...employeeData,
    employeeCode: String(employeeData.employeeCode ?? '').trim(),
    entityType: ENTITY_TYPE_EMPLOYEE,
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

  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: employee,
    })
    .promise();

  return employee;
};

export const updateEmployee = async (employeeId, updateData) => {
  const timestamp = new Date().toISOString();
  const payload = {
    ...updateData,
    entityType: ENTITY_TYPE_EMPLOYEE,
    updatedAt: timestamp,
  };

  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return getEmployeeById(employeeId);
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
      Key: { employeeId },
      UpdateExpression: `SET ${setExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
    .promise();

  return result.Attributes;
};

export const deleteEmployee = async (employeeId) => {
  return updateEmployee(employeeId, { is_deleted: true, deleted_at: new Date().toISOString() });
};
