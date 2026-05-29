/**
 * Global Secondary Index definitions for DynamoDB tables.
 * Run `node scripts/ensure-dynamodb-gsis.js` once per environment to create indexes.
 */

export const ENTITY_TYPE_OPPORTUNITY = 'OPPORTUNITY';
export const ENTITY_TYPE_EXPENSE = 'EXPENSE';
export const ENTITY_TYPE_EMPLOYEE = 'EMPLOYEE';

export const GSI_NAMES = {
  EMPLOYEE_CODE: 'GSI_EmployeeCode',
  EMPLOYEE_ENTITY_CREATED: 'GSI_EntityCreated',
  SALES_OWNER_UPDATED: 'GSI_OwnerUpdated',
  SALES_ENTITY_UPDATED: 'GSI_EntityUpdated',
  PURCHASE_HEADER: 'GSI_PurchaseHeader',
  EXPENSE_EMPLOYEE_UPDATED: 'GSI_EmployeeUpdated',
};

/** Index definitions passed to UpdateTable */
export const TABLE_GSI_DEFINITIONS = {
  EmployeeMaster: {
    tableEnv: 'DYNAMODB_TABLE_EMPLOYEE_MASTER',
    defaultName: 'EmployeeMaster',
    attributeDefinitions: [
      { AttributeName: 'employeeId', AttributeType: 'S' },
      { AttributeName: 'employeeCode', AttributeType: 'S' },
      { AttributeName: 'entityType', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: GSI_NAMES.EMPLOYEE_CODE,
        KeySchema: [{ AttributeName: 'employeeCode', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: GSI_NAMES.EMPLOYEE_ENTITY_CREATED,
        KeySchema: [
          { AttributeName: 'entityType', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  SalesForecasts: {
    tableEnv: 'DYNAMODB_TABLE_SALES_FORECASTS',
    defaultName: 'SalesForecasts',
    attributeDefinitions: [
      { AttributeName: 'forecastId', AttributeType: 'S' },
      { AttributeName: 'ownerEmployeeCode', AttributeType: 'S' },
      { AttributeName: 'updatedAt', AttributeType: 'S' },
      { AttributeName: 'entityType', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: GSI_NAMES.SALES_OWNER_UPDATED,
        KeySchema: [
          { AttributeName: 'ownerEmployeeCode', KeyType: 'HASH' },
          { AttributeName: 'updatedAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: GSI_NAMES.SALES_ENTITY_UPDATED,
        KeySchema: [
          { AttributeName: 'entityType', KeyType: 'HASH' },
          { AttributeName: 'updatedAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  PurchaseLineItems: {
    tableEnv: 'DYNAMODB_TABLE_PURCHASE_LINE_ITEMS',
    defaultName: 'PurchaseLineItems',
    attributeDefinitions: [
      { AttributeName: 'purchaseLineItemId', AttributeType: 'S' },
      { AttributeName: 'purchaseHeaderId', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: GSI_NAMES.PURCHASE_HEADER,
        KeySchema: [
          { AttributeName: 'purchaseHeaderId', KeyType: 'HASH' },
          { AttributeName: 'purchaseLineItemId', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  Expenses: {
    tableEnv: 'DYNAMODB_TABLE_EXPENSES',
    defaultName: 'Expenses',
    attributeDefinitions: [
      { AttributeName: 'expenseId', AttributeType: 'S' },
      { AttributeName: 'created_by_employee_code', AttributeType: 'S' },
      { AttributeName: 'updatedAt', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: GSI_NAMES.EXPENSE_EMPLOYEE_UPDATED,
        KeySchema: [
          { AttributeName: 'created_by_employee_code', KeyType: 'HASH' },
          { AttributeName: 'updatedAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
};
