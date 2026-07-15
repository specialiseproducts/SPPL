#!/usr/bin/env node
/**
 * One-time repair for planner events that were historically marked as:
 *   nextAction = "next_visit" AND status = "Visited"
 * These should be:
 *   status = "Rescheduled"
 *
 * Usage:
 *   node scripts/repair-planner-next-visit-status.js
 */

import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const tableName =
  process.env.DYNAMODB_TABLE_SALES_PLANNER_EVENTS ||
  process.env.DYNAMODB_TABLE_PLANNER_EVENTS ||
  'planner_events';

const doc = new AWS.DynamoDB.DocumentClient({ region });

const stats = {
  scanned: 0,
  matchedBefore: 0,
  repaired: 0,
  failed: 0,
  matchedAfter: 0,
};

function isLegacyRescheduleRow(item) {
  return (
    String(item?.nextAction || '').trim() === 'next_visit' &&
    String(item?.status || '').trim() === 'Visited' &&
    !item?.is_deleted
  );
}

async function scanAll() {
  let items = [];
  let startKey;
  do {
    const page = await doc
      .scan({
        TableName: tableName,
        ExclusiveStartKey: startKey,
      })
      .promise();
    items = items.concat(page.Items || []);
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return items;
}

async function repairOne(item) {
  const eventId = String(item.eventId || '').trim();
  if (!eventId) return false;
  const now = new Date().toISOString();
  await doc
    .update({
      TableName: tableName,
      Key: { eventId },
      UpdateExpression: 'SET #status = :rescheduled, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':rescheduled': 'Rescheduled',
        ':updatedAt': now,
      },
    })
    .promise();
  return true;
}

async function main() {
  console.log(`Repairing planner next_visit statuses on table=${tableName} region=${region}`);
  const all = await scanAll();
  stats.scanned = all.length;

  const legacy = all.filter(isLegacyRescheduleRow);
  stats.matchedBefore = legacy.length;

  console.log(`Scanned rows: ${stats.scanned}`);
  console.log(`Legacy rows before repair (Visited + next_visit): ${stats.matchedBefore}`);

  for (const row of legacy) {
    const eventId = String(row.eventId || '').trim();
    const visitDate = String(row.visitDate || '').trim();
    try {
      await repairOne(row);
      stats.repaired += 1;
      console.log(`[REPAIRED] eventId=${eventId} visitDate=${visitDate} status: Visited -> Rescheduled`);
    } catch (error) {
      stats.failed += 1;
      console.error(`[FAILED] eventId=${eventId} visitDate=${visitDate} error=${error?.message || error}`);
    }
  }

  const allAfter = await scanAll();
  const legacyAfter = allAfter.filter(isLegacyRescheduleRow);
  stats.matchedAfter = legacyAfter.length;

  console.log('\n========== Repair Summary ==========');
  console.log(`Scanned: ${stats.scanned}`);
  console.log(`Matched before: ${stats.matchedBefore}`);
  console.log(`Repaired: ${stats.repaired}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Matched after: ${stats.matchedAfter}`);
}

main().catch((error) => {
  console.error('Repair script failed:', error);
  process.exit(1);
});

