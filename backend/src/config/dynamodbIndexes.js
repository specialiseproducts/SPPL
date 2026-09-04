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
  DAILY_PLANNER_EMPLOYEE_DATE: 'GSI_EmployeeDate',
  DAILY_PLANNER_MANAGER_CODE: 'GSI_ManagerCode',
  DAILY_PLANNER_EMPLOYEE_PLANNING: 'GSI_EmployeePlanning',
  NOTIFICATION_RECIPIENT_CREATED: 'GSI_RecipientCreated',
  AUDIT_ENTITY_PERFORMED: 'GSI_EntityPerformedAt',
  AUDIT_MODULE_PERFORMED: 'GSI_ModulePerformedAt',
  AUDIT_EMPLOYEE_PERFORMED: 'GSI_EmployeePerformedAt',
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
  DailyPlannerTasks: {
    tableEnv: 'DYNAMODB_TABLE_DAILY_PLANNER_TASKS',
    defaultName: 'DailyPlannerTasks',
    attributeDefinitions: [
      { AttributeName: 'plannerTaskId', AttributeType: 'S' },
      { AttributeName: 'employeeCode', AttributeType: 'S' },
      { AttributeName: 'date', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: GSI_NAMES.DAILY_PLANNER_EMPLOYEE_DATE,
        KeySchema: [
          { AttributeName: 'employeeCode', KeyType: 'HASH' },
          { AttributeName: 'date', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  DailyPlannerTeamMappings: {
    tableEnv: 'DYNAMODB_TABLE_DAILY_PLANNER_TEAM_MAPPINGS',
    defaultName: 'DailyPlannerTeamMappings',
    attributeDefinitions: [
      { AttributeName: 'mappingId', AttributeType: 'S' },
      { AttributeName: 'managerCode', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: GSI_NAMES.DAILY_PLANNER_MANAGER_CODE,
        KeySchema: [{ AttributeName: 'managerCode', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  DailyPlannerPlanning: {
    tableEnv: 'DYNAMODB_TABLE_DAILY_PLANNER_PLANNING',
    defaultName: 'DailyPlannerPlanning',
    attributeDefinitions: [
      { AttributeName: 'planningRecordId', AttributeType: 'S' },
      { AttributeName: 'employeeCode', AttributeType: 'S' },
      { AttributeName: 'recordKey', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: GSI_NAMES.DAILY_PLANNER_EMPLOYEE_PLANNING,
        KeySchema: [
          { AttributeName: 'employeeCode', KeyType: 'HASH' },
          { AttributeName: 'recordKey', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  DailyPlannerProjects: {
    tableEnv: 'DYNAMODB_TABLE_DAILY_PLANNER_PROJECTS',
    defaultName: 'DailyPlannerProjects',
    attributeDefinitions: [{ AttributeName: 'projectKey', AttributeType: 'S' }],
    globalSecondaryIndexes: [],
  },
  Notifications: {
    tableEnv: 'DYNAMODB_TABLE_NOTIFICATIONS',
    defaultName: 'Notifications',
    attributeDefinitions: [
      { AttributeName: 'notificationId', AttributeType: 'S' },
      { AttributeName: 'recipientEmployeeCode', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: GSI_NAMES.NOTIFICATION_RECIPIENT_CREATED,
        KeySchema: [
          { AttributeName: 'recipientEmployeeCode', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  AuditTrail: {
    tableEnv: 'DYNAMODB_TABLE_AUDIT_TRAIL',
    defaultName: 'AuditTrail',
    attributeDefinitions: [
      { AttributeName: 'auditId', AttributeType: 'S' },
      { AttributeName: 'entityKey', AttributeType: 'S' },
      { AttributeName: 'module', AttributeType: 'S' },
      { AttributeName: 'employeeCode', AttributeType: 'S' },
      { AttributeName: 'performedAt', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: GSI_NAMES.AUDIT_ENTITY_PERFORMED,
        KeySchema: [
          { AttributeName: 'entityKey', KeyType: 'HASH' },
          { AttributeName: 'performedAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: GSI_NAMES.AUDIT_MODULE_PERFORMED,
        KeySchema: [
          { AttributeName: 'module', KeyType: 'HASH' },
          { AttributeName: 'performedAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: GSI_NAMES.AUDIT_EMPLOYEE_PERFORMED,
        KeySchema: [
          { AttributeName: 'employeeCode', KeyType: 'HASH' },
          { AttributeName: 'performedAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
};
