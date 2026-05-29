#!/usr/bin/env node
/**
 * Create GSIs defined in src/config/dynamodbIndexes.js (idempotent — skips existing indexes).
 *
 * DynamoDB allows only ONE online GSI creation or deletion at a time **per table**.
 * This script never batches multiple `Create` actions in a single UpdateTable request.
 *
 * It also creates **at most one GSI per script execution** (globally), then exits so you
 * can re-run after the index is ACTIVE (required for tables with multiple GSIs, e.g. SalesForecasts).
 *
 * Usage: node scripts/ensure-dynamodb-gsis.js
 */

import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import { TABLE_GSI_DEFINITIONS } from '../src/config/dynamodbIndexes.js';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const dynamodb = new AWS.DynamoDB({ region });

/** Max wait when polling for CREATING → ACTIVE (large tables can take many minutes). */
const MAX_WAIT_ITERATIONS = 720;
const POLL_INTERVAL_MS = 5000;

function resolveTableName(def) {
  return process.env[def.tableEnv] || def.defaultName;
}

function formatGsiList(gsis) {
  if (!gsis || gsis.length === 0) return '(none)';
  return gsis
    .map((g) => `${g.IndexName}:${g.IndexStatus}`)
    .sort()
    .join(', ');
}

/**
 * @returns {{ name: string, status: string }[]}
 */
function parseGsiStates(desc) {
  return (desc.Table.GlobalSecondaryIndexes || []).map((g) => ({
    name: g.IndexName,
    status: g.IndexStatus,
  }));
}

function logTableGsiStatus(tableName, desc) {
  const states = parseGsiStates(desc);
  console.log(`[${tableName}] Existing GSIs (${states.length}): ${formatGsiList(desc.Table.GlobalSecondaryIndexes || [])}`);

  const creating = states.filter((s) => s.status === 'CREATING');
  const updating = states.filter((s) => s.status === 'UPDATING');
  const pending = [...creating, ...updating];
  if (pending.length) {
    console.log(
      `[${tableName}] In-flight index ops (must finish before another Create on this table): ${pending.map((p) => `${p.name}=${p.status}`).join(', ')}`
    );
  }
}

/**
 * Wait until no GSI on the table is CREATING/UPDATING (or DELETING), or timeout.
 */
async function waitForIndexOperationsIdle(tableName) {
  for (let i = 0; i < MAX_WAIT_ITERATIONS; i++) {
    const desc = await dynamodb.describeTable({ TableName: tableName }).promise();
    const gsis = desc.Table.GlobalSecondaryIndexes || [];
    const busy = gsis.filter((g) =>
      ['CREATING', 'UPDATING', 'DELETING'].includes(String(g.IndexStatus || ''))
    );

    logTableGsiStatus(tableName, desc);

    if (!busy.length) {
      return;
    }

    const names = busy.map((g) => `${g.IndexName}(${g.IndexStatus})`).join(', ');
    console.log(`[${tableName}] Waiting for in-flight GSI: ${names} (poll ${i + 1}/${MAX_WAIT_ITERATIONS})...`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Timeout waiting for GSI operations to finish on ${tableName}`);
}

/**
 * After creating an index, wait until that index reports ACTIVE.
 */
async function waitUntilIndexActive(tableName, indexName) {
  for (let i = 0; i < MAX_WAIT_ITERATIONS; i++) {
    const desc = await dynamodb.describeTable({ TableName: tableName }).promise();
    const gsis = desc.Table.GlobalSecondaryIndexes || [];
    const idx = gsis.find((g) => g.IndexName === indexName);

    if (!idx) {
      console.log(`[${tableName}] Index ${indexName} not yet visible (poll ${i + 1})...`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    const st = idx.IndexStatus;
    console.log(`[${tableName}] Index "${indexName}": ${st} (poll ${i + 1}/${MAX_WAIT_ITERATIONS})`);

    if (st === 'ACTIVE') {
      console.log(`[${tableName}] ✓ "${indexName}" is ACTIVE`);
      return;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Timeout waiting for ${indexName} to become ACTIVE on ${tableName}`);
}

/**
 * Creates at most ONE missing GSI for this table. Caller ensures no other Create is batched.
 */
async function ensureOneGsi(tableName, def) {
  await waitForIndexOperationsIdle(tableName);

  const desc = await dynamodb.describeTable({ TableName: tableName }).promise();
  const existing = new Set((desc.Table.GlobalSecondaryIndexes || []).map((g) => g.IndexName));
  const missing = def.globalSecondaryIndexes.filter((g) => !existing.has(g.IndexName));

  if (!missing.length) {
    console.log(`✓ ${tableName}: all configured GSIs already present`);
    return { created: false, tableName };
  }

  /** First missing index only — order in dynamodbIndexes.js is creation order (SalesForecasts: OwnerUpdated before EntityUpdated). */
  const next = missing[0];

  console.log(`→ ${tableName}: pending to create (in order): ${missing.map((g) => g.IndexName).join(' → ')}`);
  console.log(`→ ${tableName}: creating ONE index this run: "${next.IndexName}"`);

  const attrMap = new Map((desc.Table.AttributeDefinitions || []).map((a) => [a.AttributeName, a.AttributeType]));
  for (const a of def.attributeDefinitions) {
    if (!attrMap.has(a.AttributeName)) attrMap.set(a.AttributeName, a.AttributeType);
  }

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

  console.log(`→ ${tableName}: UpdateTable accepted; waiting until "${next.IndexName}" is ACTIVE...`);
  await waitUntilIndexActive(tableName, next.IndexName);

  const after = await dynamodb.describeTable({ TableName: tableName }).promise();
  const stillMissing = def.globalSecondaryIndexes.filter(
    (g) => !(after.Table.GlobalSecondaryIndexes || []).some((x) => x.IndexName === g.IndexName)
  );

  if (stillMissing.length) {
    console.log(`\n✓ Created "${next.IndexName}" on ${tableName}. Still pending on this table: ${stillMissing.map((g) => g.IndexName).join(', ')}`);
  } else {
    console.log(`\n✓ Created "${next.IndexName}" on ${tableName}. All configured GSIs now exist on this table.`);
  }

  console.log(`\nThis script creates one GSI per run. Re-run: node scripts/ensure-dynamodb-gsis.js\n`);

  return { created: true, tableName, indexName: next.IndexName };
}

async function main() {
  let createdAny = false;

  for (const def of Object.values(TABLE_GSI_DEFINITIONS)) {
    const tableName = resolveTableName(def);

    try {
      const desc = await dynamodb.describeTable({ TableName: tableName }).promise();
      logTableGsiStatus(tableName, desc);

      const existing = new Set((desc.Table.GlobalSecondaryIndexes || []).map((g) => g.IndexName));
      const missing = def.globalSecondaryIndexes.filter((g) => !existing.has(g.IndexName));

      if (!missing.length) {
        console.log(`✓ ${tableName}: all configured GSIs present — nothing to do\n`);
        continue;
      }

      const result = await ensureOneGsi(tableName, def);
      if (result.created) {
        createdAny = true;
      }
      process.exit(0);
    } catch (err) {
      console.error(`✗ ${tableName}:`, err.message);
      process.exit(1);
    }
  }

  if (!createdAny) {
    console.log('All tables: all GSIs present. Nothing to create.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
