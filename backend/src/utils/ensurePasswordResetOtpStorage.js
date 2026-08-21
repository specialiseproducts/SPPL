/**
 * Idempotent PasswordResetOtps DynamoDB provisioning (table + TTL).
 */

import AWS from 'aws-sdk';

const MAX_WAIT_ITERATIONS = 120;
const POLL_INTERVAL_MS = 2500;

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
  return process.env.DYNAMODB_TABLE_PASSWORD_RESET_OTPS || 'PasswordResetOtps';
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

async function ensureTtl(dynamodb, tableName, info) {
  try {
    const ttl = await dynamodb.describeTimeToLive({ TableName: tableName }).promise();
    const status = String(ttl?.TimeToLiveDescription?.TimeToLiveStatus || '');
    if (status === 'ENABLED' || status === 'ENABLING') {
      info(`[ok] ${tableName} TTL already ${status}`);
      return;
    }
  } catch (err) {
    info(`[warn] ${tableName} describeTimeToLive: ${err?.message || err}`);
  }

  try {
    await dynamodb
      .updateTimeToLive({
        TableName: tableName,
        TimeToLiveSpecification: {
          Enabled: true,
          AttributeName: 'ttl',
        },
      })
      .promise();
    info(`[ok] ${tableName} TTL enabled on attribute "ttl"`);
  } catch (err) {
    // Non-fatal — application still enforces expiry independently.
    info(`[warn] ${tableName} TTL enable skipped: ${err?.message || err}`);
  }
}

async function createTableIfMissing(dynamodb, info) {
  const tableName = resolveTableName();
  if (await tableExists(dynamodb, tableName)) {
    info(`[ok] ${tableName} already exists — will not recreate`);
    await waitForTableActive(dynamodb, tableName, info);
    await ensureTtl(dynamodb, tableName, info);
    return tableName;
  }

  info(`[create] ${tableName}…`);
  await dynamodb
    .createTable({
      TableName: tableName,
      AttributeDefinitions: [{ AttributeName: 'employeeCode', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'employeeCode', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    })
    .promise();

  await waitForTableActive(dynamodb, tableName, info);
  await ensureTtl(dynamodb, tableName, info);
  info(`[ok] ${tableName} created`);
  return tableName;
}

/**
 * Ensure PasswordResetOtps storage exists.
 * Safe to call on every server startup.
 */
export async function ensurePasswordResetOtpStorage({ log = console.log } = {}) {
  const dynamodb = createDynamoClient();
  const info = (message) => log(message);
  info('Password reset OTP DynamoDB provisioning check');
  await createTableIfMissing(dynamodb, info);
  info('Password reset OTP DynamoDB storage is ready');
}
