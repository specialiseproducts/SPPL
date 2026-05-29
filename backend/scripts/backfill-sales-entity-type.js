#!/usr/bin/env node
/**
 * One-time backfill: sanitize GSI key attributes on legacy SalesForecasts rows.
 *
 * DynamoDB rejects empty strings ("") on GSI key attributes. This script:
 * - Sets entityType to OPPORTUNITY when missing/blank
 * - Sets updatedAt to a valid ISO timestamp when missing/blank
 * - Sets ownerEmployeeCode only when a non-empty value can be derived
 * - REMOVEs ownerEmployeeCode when it is "" and cannot be repaired (never writes "")
 *
 * Usage: node scripts/backfill-sales-entity-type.js
 */

import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import { ENTITY_TYPE_OPPORTUNITY } from '../src/config/dynamodbIndexes.js';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const tableName = process.env.DYNAMODB_TABLE_SALES_FORECASTS || 'SalesForecasts';
const doc = new AWS.DynamoDB.DocumentClient({ region });

const stats = {
  scanned: 0,
  repaired: 0,
  skipped: 0,
  skippedOwner: 0,
  invalidByField: {
    entityType: 0,
    updatedAt: 0,
    ownerEmployeeCode: 0,
  },
};

function isBlank(value) {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

function isEmptyStringAttr(value) {
  return typeof value === 'string' && value === '';
}

function nonEmptyTrimmed(value) {
  const s = String(value ?? '').trim();
  return s.length > 0 ? s : null;
}

function toIsoTimestamp(value) {
  const s = nonEmptyTrimmed(value);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function resolveUpdatedAt(item) {
  const candidates = [
    item.updatedAt,
    item.updated_at,
    item.createdAt,
    item.created_at,
  ];
  for (const c of candidates) {
    const iso = toIsoTimestamp(c);
    if (iso) return iso;
  }
  return new Date().toISOString();
}

/**
 * @returns {{ action: 'set' | 'remove' | 'none', value?: string, reason?: string }}
 */
function resolveOwnerEmployeeCode(item) {
  const current = item.ownerEmployeeCode;
  const derived =
    nonEmptyTrimmed(current) ||
    nonEmptyTrimmed(item.created_by_employee_code) ||
    nonEmptyTrimmed(item.created_by);

  if (derived) {
    return { action: 'set', value: derived };
  }

  if (isEmptyStringAttr(current) || (typeof current === 'string' && current.trim() === '' && current !== undefined)) {
    return {
      action: 'remove',
      reason: 'ownerEmployeeCode is empty string and no fallback (created_by_employee_code)',
    };
  }

  return { action: 'none' };
}

function collectInvalidFields(item) {
  const invalid = [];
  if (isEmptyStringAttr(item.entityType)) invalid.push('entityType');
  if (isEmptyStringAttr(item.updatedAt)) invalid.push('updatedAt');
  if (isEmptyStringAttr(item.ownerEmployeeCode)) invalid.push('ownerEmployeeCode');
  return invalid;
}

/**
 * Build update plan for one row. Never assigns "" to any GSI key attribute.
 */
function buildRepairPlan(item) {
  const forecastId = item.forecastId;
  if (!forecastId) {
    return { forecastId: '(missing)', skip: true, reason: 'missing forecastId' };
  }

  const plan = {
    forecastId,
    skip: false,
    invalidFields: collectInvalidFields(item),
    set: {},
    remove: [],
    skippedOwner: false,
    warnings: [],
  };

  for (const field of plan.invalidFields) {
    stats.invalidByField[field] = (stats.invalidByField[field] || 0) + 1;
  }

  const entityType = nonEmptyTrimmed(item.entityType);
  if (!entityType || entityType !== ENTITY_TYPE_OPPORTUNITY) {
    plan.set.entityType = ENTITY_TYPE_OPPORTUNITY;
  }

  const currentUpdatedAt = nonEmptyTrimmed(item.updatedAt);
  const resolvedUpdatedAt = resolveUpdatedAt(item);
  if (!currentUpdatedAt || isEmptyStringAttr(item.updatedAt)) {
    plan.set.updatedAt = resolvedUpdatedAt;
  } else if (toIsoTimestamp(item.updatedAt) !== currentUpdatedAt) {
    plan.set.updatedAt = toIsoTimestamp(item.updatedAt);
  }

  const owner = resolveOwnerEmployeeCode(item);
  if (owner.action === 'set') {
    const currentOwner = nonEmptyTrimmed(item.ownerEmployeeCode);
    if (currentOwner !== owner.value) {
      plan.set.ownerEmployeeCode = owner.value;
    }
  } else if (owner.action === 'remove') {
    plan.remove.push('ownerEmployeeCode');
    plan.skippedOwner = true;
    plan.warnings.push(owner.reason || 'removed empty ownerEmployeeCode');
  }

  const hasWork = Object.keys(plan.set).length > 0 || plan.remove.length > 0;
  if (!hasWork) {
    plan.skip = true;
    plan.reason = 'already valid';
  }

  return plan;
}

async function applyRepairPlan(plan) {
  const names = {};
  const values = {};
  const setParts = [];
  const removeParts = [];

  let i = 0;
  for (const [key, value] of Object.entries(plan.set)) {
    if (isBlank(value)) {
      throw new Error(`Refusing to SET empty GSI key "${key}" on ${plan.forecastId}`);
    }
    const nk = `#k${i}`;
    const vk = `:v${i}`;
    names[nk] = key;
    values[vk] = value;
    setParts.push(`${nk} = ${vk}`);
    i += 1;
  }

  for (const key of plan.remove) {
    const nk = `#r${removeParts.length}`;
    names[nk] = key;
    removeParts.push(nk);
  }

  let updateExpression = '';
  if (setParts.length) updateExpression += `SET ${setParts.join(', ')}`;
  if (removeParts.length) {
    if (updateExpression) updateExpression += ' ';
    updateExpression += `REMOVE ${removeParts.join(', ')}`;
  }

  await doc
    .update({
      TableName: tableName,
      Key: { forecastId: plan.forecastId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ExpressionAttributeValues: Object.keys(values).length ? values : undefined,
    })
    .promise();
}

function logPlan(plan, outcome) {
  const invalid = plan.invalidFields?.length ? plan.invalidFields.join(', ') : 'none';
  const setKeys = Object.keys(plan.set || {}).join(', ') || 'none';
  const removeKeys = (plan.remove || []).join(', ') || 'none';

  if (outcome === 'repaired') {
    console.log(
      `[REPAIRED] forecastId=${plan.forecastId} invalid=[${invalid}] SET=[${setKeys}] REMOVE=[${removeKeys}]` +
        (plan.warnings?.length ? ` warnings=${plan.warnings.join('; ')}` : '')
    );
  } else if (outcome === 'skipped') {
    console.log(
      `[SKIPPED] forecastId=${plan.forecastId} reason=${plan.reason || 'unknown'}` +
        (plan.invalidFields?.length ? ` hadInvalid=[${invalid}]` : '')
    );
  } else if (outcome === 'skipped-owner') {
    console.log(
      `[SKIPPED-OWNER] forecastId=${plan.forecastId} invalid=[${invalid}] SET=[${setKeys}] REMOVE=[${removeKeys}]` +
        ` — entityType/updatedAt repaired; ownerEmployeeCode not set (no non-empty owner)`
    );
  }
}

async function main() {
  console.log(`Backfill SalesForecasts GSI keys on table: ${tableName} (region: ${region})`);
  console.log('Rules: entityType→OPPORTUNITY if blank; updatedAt→valid ISO if blank; never SET "" on GSI keys\n');

  let startKey;

  do {
    const page = await doc
      .scan({
        TableName: tableName,
        ExclusiveStartKey: startKey,
      })
      .promise();

    for (const item of page.Items || []) {
      stats.scanned += 1;
      const plan = buildRepairPlan(item);

      if (plan.skip && plan.reason === 'missing forecastId') {
        stats.skipped += 1;
        logPlan(plan, 'skipped');
        continue;
      }

      if (plan.skip) {
        stats.skipped += 1;
        continue;
      }

      try {
        await applyRepairPlan(plan);
        stats.repaired += 1;
        if (plan.skippedOwner) {
          stats.skippedOwner += 1;
          logPlan(plan, 'skipped-owner');
        } else {
          logPlan(plan, 'repaired');
        }
      } catch (err) {
        console.error(`[FAILED] forecastId=${plan.forecastId}`, err.message);
        throw err;
      }
    }

    startKey = page.LastEvaluatedKey;
    console.log(
      `Progress: scanned=${stats.scanned} repaired=${stats.repaired} skipped=${stats.skipped} skippedOwner=${stats.skippedOwner}`
    );
  } while (startKey);

  console.log('\n========== Backfill complete ==========');
  console.log(`Scanned:          ${stats.scanned}`);
  console.log(`Repaired:         ${stats.repaired}`);
  console.log(`Skipped (clean):  ${stats.skipped}`);
  console.log(`Skipped owner:    ${stats.skippedOwner} (owner GSI not populated; entity/updatedAt may still be fixed)`);
  console.log('Invalid empty-string fields seen (row counts, may overlap):');
  console.log(`  entityType:           ${stats.invalidByField.entityType}`);
  console.log(`  updatedAt:            ${stats.invalidByField.updatedAt}`);
  console.log(`  ownerEmployeeCode:    ${stats.invalidByField.ownerEmployeeCode}`);
  console.log('Status: SUCCESS');
}

main().catch((err) => {
  console.error('\n========== Backfill FAILED ==========');
  console.error(err);
  process.exit(1);
});
