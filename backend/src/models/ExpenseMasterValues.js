/**
 * Expense master dropdown values (service providers + shared locations).
 * PK = TYPE#SERVICE_PROVIDER | TYPE#LOCATION
 * SK = normalizedValue (trim + lowercase + remove all whitespace)
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { EXPENSE_LOCATION_SEEDS } from '../constants/expenseLocationSeeds.js';
import {
  canonicalizeDisplayValue,
  normalizeDropdownValue,
} from '../utils/expenseMasterNormalize.js';
import log from '../utils/logger.js';

const TABLE_NAME = TABLES.EXPENSE_MASTER_VALUES;
const EXPENSES_TABLE = TABLES.EXPENSES;

/** Bumped when the static location seed list is expanded so first-list can backfill. */
const LOCATION_SEED_FLAG_SK = 'SEED#LOCATION_V2';

export const MASTER_TYPES = {
  SERVICE_PROVIDER: 'SERVICE_PROVIDER',
  LOCATION: 'LOCATION',
};

const TYPE_PK = (type) => `TYPE#${String(type || '').trim().toUpperCase()}`;

function notDeleted(row) {
  return row?.is_deleted !== true;
}

async function queryByType(type) {
  const pk = TYPE_PK(type);
  const result = await dynamoDB
    .query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
    })
    .promise();
  return result.Items || [];
}

/**
 * Upsert a master value. Returns existing displayValue if normalized key exists.
 * @param {'SERVICE_PROVIDER'|'LOCATION'} type
 * @param {string} rawValue
 * @returns {Promise<string>} canonical display value
 */
export async function ensureMasterValue(type, rawValue) {
  const display = canonicalizeDisplayValue(rawValue);
  const normalized = normalizeDropdownValue(display);
  if (!normalized) return '';

  const pk = TYPE_PK(type);
  const sk = normalized;

  const existing = await dynamoDB
    .get({
      TableName: TABLE_NAME,
      Key: { pk, sk },
    })
    .promise();

  if (existing.Item?.displayValue) {
    return String(existing.Item.displayValue).trim();
  }

  const now = new Date().toISOString();
  try {
    await dynamoDB
      .put({
        TableName: TABLE_NAME,
        Item: {
          pk,
          sk,
          type: String(type).toUpperCase(),
          normalizedValue: sk,
          displayValue: display,
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      })
      .promise();
    return display;
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      const again = await dynamoDB.get({ TableName: TABLE_NAME, Key: { pk, sk } }).promise();
      return String(again.Item?.displayValue || display).trim();
    }
    throw err;
  }
}

/**
 * @returns {Promise<{ inserted: boolean, displayValue: string }>}
 */
async function ensureMasterValueWithStatus(type, rawValue) {
  const display = canonicalizeDisplayValue(rawValue);
  const normalized = normalizeDropdownValue(display);
  if (!normalized) return { inserted: false, displayValue: '' };

  const pk = TYPE_PK(type);
  const sk = normalized;
  const existing = await dynamoDB
    .get({
      TableName: TABLE_NAME,
      Key: { pk, sk },
    })
    .promise();

  if (existing.Item?.displayValue) {
    return {
      inserted: false,
      displayValue: String(existing.Item.displayValue).trim(),
    };
  }

  const resolved = await ensureMasterValue(type, rawValue);
  return { inserted: Boolean(resolved), displayValue: resolved };
}

async function listDisplayValues(type) {
  const rows = await queryByType(type);
  const map = new Map();
  for (const row of rows) {
    const display = String(row.displayValue || '').trim();
    const key = String(row.normalizedValue || normalizeDropdownValue(display));
    if (!key || !display) continue;
    if (!map.has(key)) map.set(key, display);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

async function getSeedFlag(sk) {
  const result = await dynamoDB
    .get({
      TableName: TABLE_NAME,
      Key: { pk: 'INTERNAL', sk },
    })
    .promise();
  return Boolean(result.Item);
}

async function markSeedDone(sk) {
  const now = new Date().toISOString();
  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: {
        pk: 'INTERNAL',
        sk,
        seededAt: now,
      },
    })
    .promise();
}

async function scanExpenseFieldValues(fieldNames) {
  const values = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamoDB
      .scan({
        TableName: EXPENSES_TABLE,
        ProjectionExpression: fieldNames.map((_, i) => `#f${i}`).join(', ') + ', is_deleted',
        ExpressionAttributeNames: Object.fromEntries(
          fieldNames.map((name, i) => [`#f${i}`, name]),
        ),
        ExclusiveStartKey,
      })
      .promise();
    for (const row of result.Items || []) {
      if (!notDeleted(row)) continue;
      for (const name of fieldNames) {
        const v = String(row[name] ?? '').trim();
        if (v) values.push(v);
      }
    }
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return values;
}

async function runInChunks(items, chunkSize, worker) {
  const results = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(worker));
    results.push(...chunkResults);
  }
  return results;
}

/**
 * Idempotent Location master populate:
 * predefined Indian locations + unique Location/From/To from Expenses.
 * Safe to run multiple times; never deletes existing rows.
 *
 * @returns {Promise<{
 *   candidates: number,
 *   unique: number,
 *   inserted: number,
 *   alreadyPresent: number,
 *   totalLocations: number,
 * }>}
 */
export async function populateLocationMasterValues() {
  const fromExpenses = await scanExpenseFieldValues([
    'location',
    'fromLocation',
    'toLocation',
  ]);

  // Seeds first so clean display names win when normalized keys collide with messy expense text.
  const candidates = [...EXPENSE_LOCATION_SEEDS, ...fromExpenses];
  const uniqueByNormalized = new Map();
  for (const raw of candidates) {
    const trimmed = String(raw ?? '').trim();
    const key = normalizeDropdownValue(trimmed);
    if (!key) continue;
    if (!uniqueByNormalized.has(key)) {
      uniqueByNormalized.set(key, trimmed);
    }
  }

  const uniqueValues = Array.from(uniqueByNormalized.values());
  const outcomes = await runInChunks(uniqueValues, 20, (value) =>
    ensureMasterValueWithStatus(MASTER_TYPES.LOCATION, value),
  );

  let inserted = 0;
  let alreadyPresent = 0;
  for (const outcome of outcomes) {
    if (!outcome.displayValue) continue;
    if (outcome.inserted) inserted += 1;
    else alreadyPresent += 1;
  }

  const totalLocations = (await listDisplayValues(MASTER_TYPES.LOCATION)).length;

  log.info('ExpenseMasterValues location populate complete', {
    candidates: candidates.length,
    unique: uniqueValues.length,
    inserted,
    alreadyPresent,
    totalLocations,
  });

  return {
    candidates: candidates.length,
    unique: uniqueValues.length,
    inserted,
    alreadyPresent,
    totalLocations,
  };
}

async function seedServiceProvidersIfNeeded() {
  if (await getSeedFlag(`SEED#${MASTER_TYPES.SERVICE_PROVIDER}`)) return;
  try {
    const fromExpenses = await scanExpenseFieldValues(['serviceProvider']);
    for (const value of fromExpenses) {
      await ensureMasterValue(MASTER_TYPES.SERVICE_PROVIDER, value);
    }
    await markSeedDone(`SEED#${MASTER_TYPES.SERVICE_PROVIDER}`);
  } catch (err) {
    log.warn('ExpenseMasterValues service-provider seed skipped/failed', {
      message: err?.message,
    });
  }
}

async function seedLocationsIfNeeded() {
  if (await getSeedFlag(LOCATION_SEED_FLAG_SK)) return;
  try {
    await populateLocationMasterValues();
    await markSeedDone(LOCATION_SEED_FLAG_SK);
  } catch (err) {
    log.warn('ExpenseMasterValues location seed skipped/failed', {
      message: err?.message,
    });
  }
}

export async function listServiceProviders() {
  await seedServiceProvidersIfNeeded();
  return listDisplayValues(MASTER_TYPES.SERVICE_PROVIDER);
}

export async function listLocations() {
  await seedLocationsIfNeeded();
  return listDisplayValues(MASTER_TYPES.LOCATION);
}
