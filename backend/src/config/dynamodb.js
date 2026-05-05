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

// Create and export DynamoDB client instance
export const dynamoDB = new AWS.DynamoDB.DocumentClient(dynamoDBConfig);

// Export table names from environment variables
export const TABLES = {
  EMPLOYEE_MASTER: process.env.DYNAMODB_TABLE_EMPLOYEE_MASTER || 'EmployeeMaster',
  USERS_AUTH: process.env.DYNAMODB_TABLE_USERS_AUTH || 'UsersAuth',
  ACCESS_RULES: process.env.DYNAMODB_TABLE_ACCESS_RULES || 'AccessRules',
  EXPENSES: process.env.DYNAMODB_TABLE_EXPENSES || 'Expenses',
  EXPENSE_DOCUMENTS: process.env.DYNAMODB_TABLE_EXPENSE_DOCUMENTS || 'ExpenseDocuments',
  PURCHASE_HEADERS: process.env.DYNAMODB_TABLE_PURCHASE_HEADERS || 'PurchaseHeaders',
  PURCHASE_LINE_ITEMS: process.env.DYNAMODB_TABLE_PURCHASE_LINE_ITEMS || 'PurchaseLineItems',
  SALES_FORECASTS: process.env.DYNAMODB_TABLE_SALES_FORECASTS || 'SalesForecasts',
  CURRENCY_RATES: process.env.DYNAMODB_TABLE_CURRENCY_RATES || 'CurrencyRates',
  AUDIT_LOGS: process.env.DYNAMODB_TABLE_AUDIT_LOGS || 'AuditLogs',
};


