/**
 * Idempotent Daily Planner DynamoDB provisioning (tables + missing GSIs).
 */

import AWS from 'aws-sdk';
import { TABLE_GSI_DEFINITIONS } from '../config/dynamodbIndexes.js';

const MAX_WAIT_ITERATIONS = 720;
const POLL_INTERVAL_MS = 5000;

const DAILY_PLANNER_DEFS = [
  TABLE_GSI_DEFINITIONS.DailyPlannerTasks,
  TABLE_GSI_DEFINITIONS.DailyPlannerTeamMappings,
  TABLE_GSI_DEFINITIONS.DailyPlannerPlanning,
];

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

function resolveTableName(def) {
  return process.env[def.tableEnv] || def.defaultName;
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

async function waitForIndexOperationsIdle(dynamodb, tableName, info) {
  for (let i = 0; i < MAX_WAIT_ITERATIONS; i++) {
    const desc = await dynamodb.describeTable({ TableName: tableName }).promise();
    const busy = (desc.Table.GlobalSecondaryIndexes || []).filter((g) =>
      ['CREATING', 'UPDATING', 'DELETING'].includes(String(g.IndexStatus || '')),
    );
    if (!busy.length) return desc;
    const names = busy.map((g) => `${g.IndexName}(${g.IndexStatus})`).join(', ');
    info(`[${tableName}] Waiting for in-flight GSI: ${names} (poll ${i + 1})…`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Timeout waiting for GSI operations to finish on ${tableName}`);
}

async function waitUntilIndexActive(dynamodb, tableName, indexName, info) {
  for (let i = 0; i < MAX_WAIT_ITERATIONS; i++) {
    const desc = await dynamodb.describeTable({ TableName: tableName }).promise();
    const idx = (desc.Table.GlobalSecondaryIndexes || []).find((g) => g.IndexName === indexName);
    if (!idx) {
      info(`[${tableName}] Index ${indexName} not yet visible (poll ${i + 1})…`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }
    info(`[${tableName}] Index "${indexName}": ${idx.IndexStatus} (poll ${i + 1})`);
    if (idx.IndexStatus === 'ACTIVE') {
      info(`[${tableName}] ✓ "${indexName}" is ACTIVE`);
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Timeout waiting for ${indexName} to become ACTIVE on ${tableName}`);
}

async function createTableIfMissing(dynamodb, def, info) {
  const tableName = resolveTableName(def);
  if (await tableExists(dynamodb, tableName)) {
    info(`[ok] ${tableName} already exists — will not recreate`);
    return tableName;
  }

  info(`[create] ${tableName}…`);
  await dynamodb
    .createTable({
      TableName: tableName,
      KeySchema: [
        {
          AttributeName: def.attributeDefinitions[0].AttributeName,
          KeyType: 'HASH',
        },
      ],
      AttributeDefinitions: def.attributeDefinitions,
      GlobalSecondaryIndexes: def.globalSecondaryIndexes.map((gsi) => ({
        IndexName: gsi.IndexName,
        KeySchema: gsi.KeySchema,
        Projection: gsi.Projection,
      })),
      BillingMode: 'PAY_PER_REQUEST',
    })
    .promise();
  await waitForTableActive(dynamodb, tableName, info);
  info(`[ok] ${tableName} is ACTIVE (created with GSIs)`);
  return tableName;
}

async function ensureMissingGsis(dynamodb, def, info) {
  const tableName = resolveTableName(def);
  let desc = await waitForIndexOperationsIdle(dynamodb, tableName, info);

  const existing = new Set((desc.Table.GlobalSecondaryIndexes || []).map((g) => g.IndexName));
  const missing = def.globalSecondaryIndexes.filter((g) => !existing.has(g.IndexName));

  if (!missing.length) {
    info(`[ok] ${tableName}: all GSIs present (${[...existing].join(', ') || 'none'})`);
    return;
  }

  info(
    `[gsi] ${tableName}: missing ${missing.map((g) => g.IndexName).join(', ')} — adding via UpdateTable`,
  );

  for (const next of missing) {
    desc = await waitForIndexOperationsIdle(dynamodb, tableName, info);

    const attrMap = new Map(
      (desc.Table.AttributeDefinitions || []).map((a) => [a.AttributeName, a.AttributeType]),
    );
    for (const a of def.attributeDefinitions) {
      if (!attrMap.has(a.AttributeName)) attrMap.set(a.AttributeName, a.AttributeType);
    }

    info(`[gsi] ${tableName}: creating "${next.IndexName}"…`);
    await dynamodb
      .updateTable({
        TableName: tableName,
        AttributeDefinitions: [...attrMap.entries()].map(([AttributeName, AttributeType]) => ({
          AttributeName,
          AttributeType,
        })),
        GlobalSecondaryIndexUpdates: [
          {
            Create: {
              IndexName: next.IndexName,
              KeySchema: next.KeySchema,
              Projection: next.Projection,
            },
          },
        ],
      })
      .promise();

    await waitUntilIndexActive(dynamodb, tableName, next.IndexName, info);
  }

  info(`[ok] ${tableName}: all configured GSIs are ACTIVE`);
}

/**
 * Ensure Daily Planner tasks, team mappings, and planning storage exist.
 * Safe to call on every server startup (no-op when already provisioned).
 */
export async function ensureDailyPlannerStorage({ log = console.log } = {}) {
  const dynamodb = createDynamoClient();
  const info = (message) => log(message);

  info('Daily Planner DynamoDB provisioning check (tables + missing GSIs)');

  for (const def of DAILY_PLANNER_DEFS) {
    await createTableIfMissing(dynamodb, def, info);
    await ensureMissingGsis(dynamodb, def, info);
  }

  info('Daily Planner DynamoDB storage is ready');
}
