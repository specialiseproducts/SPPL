/**
 * Idempotent SalesHistory DynamoDB table provisioning (PK only, no GSIs).
 */

import AWS from 'aws-sdk';

const TABLE_ENV = 'DYNAMODB_TABLE_SALES_HISTORY';
const DEFAULT_NAME = 'SalesHistory';
const MAX_WAIT_ITERATIONS = 720;
const POLL_INTERVAL_MS = 5000;

function createDynamoClient() {
  const region = process.env.AWS_REGION || 'us-east-1';
  return new AWS.DynamoDB({
    region,
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : {}),
  });
}

function resolveTableName() {
  return process.env[TABLE_ENV] || DEFAULT_NAME;
}

async function tableExists(dynamodb, tableName) {
  try {
    await dynamodb.describeTable({ TableName: tableName }).promise();
    return true;
  } catch (err) {
    if (err.code === 'ResourceNotFoundException') return false;
    throw err;
  }
}

async function waitForTableActive(dynamodb, tableName, info) {
  for (let i = 0; i < MAX_WAIT_ITERATIONS; i++) {
    const desc = await dynamodb.describeTable({ TableName: tableName }).promise();
    if (desc.Table.TableStatus === 'ACTIVE') return desc;
    info(`[${tableName}] TableStatus=${desc.Table.TableStatus} (poll ${i + 1})…`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Timeout waiting for ${tableName} to become ACTIVE`);
}

export async function ensureSalesHistoryStorage({ log = console.log } = {}) {
  const dynamodb = createDynamoClient();
  const info = (message) => log(message);
  const tableName = resolveTableName();

  info('SalesHistory DynamoDB provisioning check');
  if (await tableExists(dynamodb, tableName)) {
    info(`[ok] ${tableName} already exists — will not recreate`);
    return;
  }

  info(`[create] ${tableName}…`);
  await dynamodb
    .createTable({
      TableName: tableName,
      KeySchema: [{ AttributeName: 'recordId', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'recordId', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    })
    .promise();
  await waitForTableActive(dynamodb, tableName, info);
  info(`[ok] ${tableName} is ACTIVE (no GSIs)`);
}
