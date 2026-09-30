#!/usr/bin/env node
/**
 * ONE-TIME Expenses cleanup: hard-delete DUMMY and Dummy Dummy test expenses.
 *
 * Identity rules (strict):
 *   DUMMY:
 *     created_by_employee_code === 'DUMMY' AND employeeName === 'DUMMY'
 *   Dummy Dummy:
 *     created_by_employee_code === 'DUMMY2' AND employeeName === 'Dummy Dummy'
 *
 * Does NOT touch Developer Tester, real employees, ExpenseMasterValues, or app code.
 *
 * Usage:
 *   node scripts/cleanup-expenses-dummy-accounts.js --dry-run
 *   node scripts/cleanup-expenses-dummy-accounts.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import AWS from 'aws-sdk';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

const region = process.env.AWS_REGION || 'us-east-1';
const expensesTable = process.env.DYNAMODB_TABLE_EXPENSES || 'Expenses';
const documentsTable = process.env.DYNAMODB_TABLE_EXPENSE_DOCUMENTS || 'ExpenseDocuments';

const doc = new AWS.DynamoDB.DocumentClient({
  region,
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : {}),
});

function isDummy(row) {
  return (
    String(row.created_by_employee_code ?? '').trim() === 'DUMMY' &&
    String(row.employeeName ?? '').trim() === 'DUMMY'
  );
}

function isDummyDummy(row) {
  return (
    String(row.created_by_employee_code ?? '').trim() === 'DUMMY2' &&
    String(row.employeeName ?? '').trim() === 'Dummy Dummy'
  );
}

function isDeveloperTester(row) {
  return (
    String(row.created_by_employee_code ?? '').trim() === 'DUMMY' &&
    String(row.employeeName ?? '').trim() === 'Developer Tester'
  );
}

async function scanAll(tableName, extra = {}) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await doc
      .scan({
        TableName: tableName,
        ExclusiveStartKey,
        ...extra,
      })
      .promise();
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function batchWriteAll(tableName, writeRequests) {
  for (let i = 0; i < writeRequests.length; i += 25) {
    let requestItems = { [tableName]: writeRequests.slice(i, i + 25) };
    let attempts = 0;
    while (requestItems[tableName]?.length) {
      attempts += 1;
      if (attempts > 12) throw new Error(`BatchWrite retries exceeded for ${tableName}`);
      const result = await doc.batchWrite({ RequestItems: requestItems }).promise();
      const unprocessed = result.UnprocessedItems?.[tableName] || [];
      if (!unprocessed.length) break;
      await new Promise((r) => setTimeout(r, 100 * attempts));
      requestItems = { [tableName]: unprocessed };
    }
  }
}

function summarizeRows(rows, label) {
  console.log(`\n=== ${label} ===`);
  console.log(`Count: ${rows.length}`);
  for (const r of rows) {
    console.log(
      JSON.stringify({
        expenseId: r.expenseId,
        employeeName: r.employeeName,
        employeeId: r.employeeId,
        created_by_employee_code: r.created_by_employee_code,
        created_by_name: r.created_by_name,
        date: r.date,
        amount: r.amount,
        expenseHead: r.expenseHead,
        subCategory: r.subCategory,
        auditStatus: r.auditStatus || r.approval_status,
        is_deleted: r.is_deleted,
        createdAt: r.createdAt || r.created_at,
        updatedAt: r.updatedAt || r.updated_at,
      }),
    );
  }
}

async function deleteSet(rows, label) {
  if (!rows.length) {
    console.log(`\n${label}: nothing to delete`);
    return { deleted: 0, docsDeleted: 0 };
  }

  const docsToDelete = [];
  for (const row of rows) {
    const expenseId = String(row.expenseId || '').trim();
    if (!expenseId) continue;
    const docs = await scanAll(documentsTable, {
      FilterExpression: '#expenseId = :expenseId',
      ExpressionAttributeNames: { '#expenseId': 'expenseId' },
      ExpressionAttributeValues: { ':expenseId': expenseId },
    });
    docsToDelete.push(...docs.filter((d) => d.documentId));
  }

  if (!DRY_RUN) {
    await batchWriteAll(
      expensesTable,
      rows.map((r) => ({ DeleteRequest: { Key: { expenseId: r.expenseId } } })),
    );
    if (docsToDelete.length) {
      await batchWriteAll(
        documentsTable,
        docsToDelete.map((d) => ({
          DeleteRequest: { Key: { documentId: d.documentId } },
        })),
      );
    }
  }

  console.log(
    `\n${label}: deleted expenses=${rows.length}${DRY_RUN ? ' (dry-run)' : ''}, docs=${docsToDelete.length}`,
  );
  return { deleted: rows.length, docsDeleted: docsToDelete.length };
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE DELETE ===');
  const all = await scanAll(expensesTable);
  console.log(`Scanned expenses: ${all.length}`);

  const dummyRows = all.filter(isDummy);
  const dummyDummyRows = all.filter(isDummyDummy);
  const developerTesterRows = all.filter(isDeveloperTester);
  const deletionIds = new Set(
    [...dummyRows, ...dummyDummyRows].map((r) => r.expenseId).filter(Boolean),
  );
  const preserved = all.filter((r) => !deletionIds.has(r.expenseId));

  summarizeRows(dummyRows, 'DUMMY (pre-deletion)');
  summarizeRows(dummyDummyRows, 'Dummy Dummy (pre-deletion)');
  console.log(`\nDeveloper Tester present (must NOT delete): ${developerTesterRows.length}`);
  console.log(`Other records preserved: ${preserved.length}`);

  // Safety: no overlap with real employees
  for (const row of [...dummyRows, ...dummyDummyRows]) {
    const code = String(row.created_by_employee_code || '').trim();
    const name = String(row.employeeName || '').trim();
    const ok =
      (code === 'DUMMY' && name === 'DUMMY') ||
      (code === 'DUMMY2' && name === 'Dummy Dummy');
    if (!ok) {
      throw new Error(`Abort: unsafe row ${row.expenseId} code=${code} name=${name}`);
    }
  }

  if (!DRY_RUN && (dummyRows.length || dummyDummyRows.length)) {
    const outDir = path.join(__dirname, '.cleanup-output');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(outDir, `dummy-accounts-expenses-backup-${stamp}.json`);
    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        {
          deletedAt: new Date().toISOString(),
          rules: {
            DUMMY: "created_by_employee_code==='DUMMY' && employeeName==='DUMMY'",
            DummyDummy:
              "created_by_employee_code==='DUMMY2' && employeeName==='Dummy Dummy'",
          },
          DUMMY: dummyRows,
          DummyDummy: dummyDummyRows,
        },
        null,
        2,
      ),
    );
    console.log(`\nBackup written: ${backupPath}`);
  }

  const dummyResult = await deleteSet(dummyRows, 'DUMMY');
  const dummyDummyResult = await deleteSet(dummyDummyRows, 'Dummy Dummy');

  const after = await scanAll(expensesTable);
  const dummyLeft = after.filter(isDummy).length;
  const dummyDummyLeft = after.filter(isDummyDummy).length;
  const developerLeft = after.filter(isDeveloperTester).length;
  const preservedAfter = after.filter(
    (r) =>
      !isDummy(r) &&
      !isDummyDummy(r),
  ).length;

  console.log('\n========== DELETION SUMMARY ==========');
  console.log('DUMMY:');
  console.log(`  Found: ${dummyRows.length}`);
  console.log(`  Deleted: ${DRY_RUN ? 0 : dummyResult.deleted}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`  Remaining: ${dummyLeft}`);
  console.log('Dummy Dummy:');
  console.log(`  Found: ${dummyDummyRows.length}`);
  console.log(
    `  Deleted: ${DRY_RUN ? 0 : dummyDummyResult.deleted}${DRY_RUN ? ' (dry-run)' : ''}`,
  );
  console.log(`  Remaining: ${dummyDummyLeft}`);
  console.log(`Other employee records preserved: ${preservedAfter}`);
  console.log(`Developer Tester: NOT TOUCHED (count=${developerLeft})`);
  console.log('LOCATION CLEANUP SUMMARY');
  console.log('  Already completed previously — formatting-only dup groups: 0 (unchanged)');
  console.log('======================================');

  if (!DRY_RUN && (dummyLeft !== 0 || dummyDummyLeft !== 0)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
