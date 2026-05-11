/**
 * Single-item DynamoDB store for expense travel per-km rates (Super Admin managed).
 * PK: settingId = EXPENSE_TRAVEL_RATES_V1
 *
 * If the DynamoDB table is not provisioned yet, AWS returns "Requested resource not found".
 * In that case we fall back to a local JSON file so GET/PUT work without a new table
 * (suitable for dev/single-node deploys). Set DYNAMODB_TABLE_EXPENSE_TRAVEL_RATE_SETTINGS in prod.
 */

import fs from 'fs';
import path from 'path';
import { dynamoDB, TABLES } from '../config/dynamodb.js';

const TABLE_NAME = TABLES.EXPENSE_TRAVEL_RATE_SETTINGS;
export const EXPENSE_TRAVEL_RATES_SETTING_ID = 'EXPENSE_TRAVEL_RATES_V1';

const LOCAL_FALLBACK_FILE = path.join(process.cwd(), 'data', 'expense-travel-rates.json');

function isDynamoTableMissing(err) {
  if (!err) return false;
  if (err.code === 'ResourceNotFoundException') return true;
  const msg = String(err.message || '');
  return msg.includes('Requested resource not found') || msg.includes('Cannot do operations on a non-existent table');
}

function readLocalFallback() {
  try {
    if (!fs.existsSync(LOCAL_FALLBACK_FILE)) return null;
    const raw = fs.readFileSync(LOCAL_FALLBACK_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.settingId === EXPENSE_TRAVEL_RATES_SETTING_ID) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeLocalFallback(item) {
  fs.mkdirSync(path.dirname(LOCAL_FALLBACK_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_FALLBACK_FILE, JSON.stringify(item, null, 2), 'utf8');
}

export async function getTravelRateSettings() {
  try {
    const result = await dynamoDB
      .get({
        TableName: TABLE_NAME,
        Key: { settingId: EXPENSE_TRAVEL_RATES_SETTING_ID },
      })
      .promise();
    return result.Item || null;
  } catch (err) {
    if (isDynamoTableMissing(err)) {
      return readLocalFallback();
    }
    throw err;
  }
}

export async function putTravelRateSettings(item) {
  try {
    await dynamoDB
      .put({
        TableName: TABLE_NAME,
        Item: item,
      })
      .promise();
    return item;
  } catch (err) {
    if (isDynamoTableMissing(err)) {
      writeLocalFallback(item);
      return item;
    }
    throw err;
  }
}
