#!/usr/bin/env node
/**
 * PHASE 0–1 ONLY: Identify Developer Tester expense records.
 * Does NOT delete or modify any data.
 *
 * Usage: node scripts/inspect-developer-tester-expenses.js
 */

import dotenv from 'dotenv';
import AWS from 'aws-sdk';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const tableName = process.env.DYNAMODB_TABLE_EXPENSES || 'Expenses';
const doc = new AWS.DynamoDB.DocumentClient({
  region,
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : {}),
});

function looksLikeDeveloperTester(row) {
  const fields = [
    row.employeeName,
    row.created_by_name,
    row.created_by_first_name,
    row.created_by_last_name,
    `${row.created_by_first_name || ''} ${row.created_by_last_name || ''}`,
    row.created_by,
    row.employeeId,
    row.created_by_employee_code,
    row.created_by_user_id,
  ];
  return fields.some((v) => {
    const s = String(v ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    return s === 'developer tester' || s.includes('developer tester');
  });
}

async function scanAll() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await doc
      .scan({
        TableName: tableName,
        ExclusiveStartKey,
      })
      .promise();
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function summarizeIdentity(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = JSON.stringify({
      created_by_employee_code: String(row.created_by_employee_code || '').trim(),
      employeeId: String(row.employeeId || '').trim(),
      created_by_user_id: String(row.created_by_user_id || '').trim(),
      employeeName: String(row.employeeName || '').trim(),
      created_by_name: String(row.created_by_name || '').trim(),
      created_by_role: String(row.created_by_role || '').trim(),
    });
    byKey.set(key, (byKey.get(key) || 0) + 1);
  }
  return [...byKey.entries()].map(([k, count]) => ({ count, identity: JSON.parse(k) }));
}

async function main() {
  console.log(`Scanning ${tableName}…`);
  const all = await scanAll();
  console.log(`Total expense rows scanned: ${all.length}`);

  const matches = all.filter(looksLikeDeveloperTester);
  console.log(`Rows matching Developer Tester heuristics: ${matches.length}`);

  const identities = summarizeIdentity(matches);
  console.log('\nIdentity groupings for matched rows:');
  console.log(JSON.stringify(identities, null, 2));

  // Also list distinct employee names for comparison
  const nameCounts = new Map();
  for (const row of all) {
    const n = String(row.employeeName || row.created_by_name || '').trim() || '(blank)';
    nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
  }
  const topNames = [...nameCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);
  console.log('\nTop employeeName/created_by_name values:');
  for (const [name, count] of topNames) {
    console.log(`  ${count}\t${name}`);
  }

  console.log('\nSample matched records (up to 15):');
  for (const row of matches.slice(0, 15)) {
    console.log(
      JSON.stringify(
        {
          expenseId: row.expenseId,
          employeeName: row.employeeName,
          employeeId: row.employeeId,
          created_by_employee_code: row.created_by_employee_code,
          created_by_name: row.created_by_name,
          created_by_role: row.created_by_role,
          date: row.date,
          amount: row.amount,
          expenseHead: row.expenseHead,
          location: row.location,
          fromLocation: row.fromLocation,
          toLocation: row.toLocation,
          auditStatus: row.auditStatus || row.approval_status,
          is_deleted: row.is_deleted,
          createdAt: row.createdAt || row.created_at,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
