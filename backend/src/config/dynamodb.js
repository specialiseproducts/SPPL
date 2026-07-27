/**
 * DynamoDB Configuration
 * 
 * This file sets up and exports a shared DynamoDB client instance.
 * The client is configured to use AWS credentials from environment variables
 * or IAM roles (when deployed to AWS).
 * 
 * Best Practice: Use IAM roles in production instead of access keys.
 */

import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import { instrumentDocumentClient } from '../utils/dynamoInstrument.js';

dotenv.config();

// Configure AWS SDK
const dynamoDBConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
};

// If credentials are provided in env (for local development), use them
// In production, AWS SDK will automatically use IAM roles
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  dynamoDBConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

// Create and export instrumented DynamoDB client instance
const baseClient = new AWS.DynamoDB.DocumentClient(dynamoDBConfig);
export const dynamoDB = instrumentDocumentClient(baseClient);

// Export table names from environment variables
export const TABLES = {
  EMPLOYEE_MASTER: process.env.DYNAMODB_TABLE_EMPLOYEE_MASTER || 'EmployeeMaster',
  USERS_AUTH: process.env.DYNAMODB_TABLE_USERS_AUTH || 'UsersAuth',
  ACCESS_RULES: process.env.DYNAMODB_TABLE_ACCESS_RULES || 'AccessRules',
  USER_ACCESS_CONTROL: process.env.DYNAMODB_TABLE_USER_ACCESS_CONTROL || 'UserAccessControl',
  ACTIVITY_LOGS: process.env.DYNAMODB_TABLE_ACTIVITY_LOGS || 'ActivityLogs',
  NOTIFICATIONS: process.env.DYNAMODB_TABLE_NOTIFICATIONS || 'Notifications',
  EXPENSES: process.env.DYNAMODB_TABLE_EXPENSES || 'Expenses',
  EXPENSE_DOCUMENTS: process.env.DYNAMODB_TABLE_EXPENSE_DOCUMENTS || 'ExpenseDocuments',
  PURCHASE_HEADERS: process.env.DYNAMODB_TABLE_PURCHASE_HEADERS || 'PurchaseHeaders',
  PURCHASE_LINE_ITEMS: process.env.DYNAMODB_TABLE_PURCHASE_LINE_ITEMS || 'PurchaseLineItems',
  SALES_FORECASTS: process.env.DYNAMODB_TABLE_SALES_FORECASTS || 'SalesForecasts',
  SALES_MASTER_DATA: process.env.DYNAMODB_TABLE_SALES_MASTER_DATA || 'SalesMasterData',
  SALES_PLANNER_EVENTS:
    process.env.DYNAMODB_TABLE_SALES_PLANNER_EVENTS ||
    process.env.DYNAMODB_TABLE_PLANNER_EVENTS ||
    'planner_events',
  CURRENCY_RATES: process.env.DYNAMODB_TABLE_CURRENCY_RATES || 'CurrencyRates',
  EXPENSE_TRAVEL_RATE_SETTINGS:
    process.env.DYNAMODB_TABLE_EXPENSE_TRAVEL_RATE_SETTINGS || 'ExpenseTravelRateSettings',
  DAILY_PLANNER_TASKS:
    process.env.DYNAMODB_TABLE_DAILY_PLANNER_TASKS || 'DailyPlannerTasks',
  DAILY_PLANNER_TEAM_MAPPINGS:
    process.env.DYNAMODB_TABLE_DAILY_PLANNER_TEAM_MAPPINGS || 'DailyPlannerTeamMappings',
  DAILY_PLANNER_PLANNING:
    process.env.DYNAMODB_TABLE_DAILY_PLANNER_PLANNING || 'DailyPlannerPlanning',
  AUDIT_LOGS: process.env.DYNAMODB_TABLE_AUDIT_LOGS || 'AuditLogs',
  ORDER_PROCESSING: process.env.DYNAMODB_TABLE_ORDER_PROCESSING || 'OrderProcessing',
};


