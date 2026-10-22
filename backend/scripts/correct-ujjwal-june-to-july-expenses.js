#!/usr/bin/env node
/**
 * Targeted admin correction: move Ujjwal Gupta (SPPL 041) June 2026
 * Approved expenses to July 2026 in place (same expenseId).
 *
 * Usage:
 *   node scripts/correct-ujjwal-june-to-july-expenses.js          # dry-run
 *   node scripts/correct-ujjwal-june-to-july-expenses.js --apply   # write
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import AWS from 'aws-sdk';
import { logActivity } from '../src/utils/activityLogger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');
const EMPLOYEE_CODE = 'SPPL 041';
const EXPECTED_TOTAL = 3313;
const TARGET_MONTH_YEAR = '07-2026';

/** Confirmed IDs from Phase 1 preview (user: move all 18). */
const EXPENSE_IDS = [
  'EXP#a86b83f8-6daa-4efd-9e39-45bf114a20e7',
  'EXP#d6782539-1d2c-4413-89d6-4c08bdd6f704',
  'EXP#3b5609f8-9039-480f-af30-3dec97a5b3cc',
  'EXP#1b5f6a7f-9af1-42c1-95bf-921b56e0f9ea',
  'EXP#71742dcb-374e-4704-8c00-69c82cddccde',
  'EXP#c81a4026-2e56-44d9-8dfc-d7ac4ee54f02',
  'EXP#d930181c-eb63-41d9-82e4-e22894c021ab',
  'EXP#8e836d3e-9e3c-4652-8b4f-4fc44a6377e7',
  'EXP#9a262f5b-e129-47cb-b62d-274ec88d5e37',
  'EXP#38de4846-df33-45dc-845c-6337997f1908',
  'EXP#d6472d5f-29fa-4020-88b0-f1ff5d28f2c7',
  'EXP#9c132449-2ad3-4f69-9814-b40b63578959',
  'EXP#e97e53de-6789-45b1-8383-842d142d8495',
  'EXP#80e1fa90-6a7b-427c-b782-ec02242c4835',
  'EXP#c26624f5-9178-4ef3-ab77-dfd604995e86',
  'EXP#460d556c-f525-432e-b309-b75696392b2e',
  'EXP#87e22b5d-55ca-4059-991b-bf78db0e3dab',
  'EXP#1119ec49-9967-44d8-a6ec-263bba8fe643',
];

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

function isApproved(row) {
  const a = String(row.approval_status ?? '').trim();
  const b = String(row.auditStatus ?? '').trim();
  return a === 'Approved' && (b === 'Approved' || b === '');
}

function juneToJulyDate(dateStr) {
  const raw = String(dateStr || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) {
    throw new Error(`Unexpected date format: ${raw}`);
  }
  const [, year, month, day] = m;
  if (year !== '2026' || month !== '06') {
    throw new Error(`Expected 2026-06-DD, got ${raw}`);
  }
  const dayNum = Number(day);
  if (dayNum < 1 || dayNum > 31) {
    throw new Error(`Invalid day in ${raw}`);
  }
  // July has 31 days; all Phase-1 days (11, 20–25) are valid.
  if (dayNum > 31) {
    throw new Error(`Day ${day} invalid for July`);
  }
  return `2026-07-${day}`;
}

async function getExpense(expenseId) {
  const result = await doc
    .get({ TableName: tableName, Key: { expenseId } })
    .promise();
  return result.Item || null;
}

async function updateInPlace(expenseId, { newDate, newMonthYear, now }) {
  const result = await doc
    .update({
      TableName: tableName,
      Key: { expenseId },
      // Only touch month fields + timestamps. Do not touch approval fields.
      UpdateExpression:
        'SET #d = :date, monthYear = :my, updatedAt = :now, updated_at = :now, entityType = if_not_exists(entityType, :et)',
      ConditionExpression:
        'attribute_exists(expenseId) AND created_by_employee_code = :code AND monthYear = :june AND #d = :oldDate AND (attribute_not_exists(is_deleted) OR is_deleted = :false)',
      ExpressionAttributeNames: { '#d': 'date' },
      ExpressionAttributeValues: {
        ':date': newDate,
        ':my': newMonthYear,
        ':now': now,
        ':et': 'EXPENSE',
        ':code': EMPLOYEE_CODE,
        ':june': '06-2026',
        ':oldDate': newDate.replace('2026-07-', '2026-06-'),
        ':false': false,
      },
      ReturnValues: 'ALL_NEW',
    })
    .promise();
  return result.Attributes;
}

async function queryByEmployee() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await doc
      .query({
        TableName: tableName,
        IndexName: 'GSI_EmployeeUpdated',
        KeyConditionExpression: 'created_by_employee_code = :code',
        ExpressionAttributeValues: { ':code': EMPLOYEE_CODE },
        ExclusiveStartKey,
      })
      .promise();
    items.push(...(result.Items || []).filter((r) => !r?.is_deleted));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function main() {
  console.log(APPLY ? '=== APPLY mode ===' : '=== DRY-RUN mode (pass --apply to write) ===');
  console.log(`Employee: ${EMPLOYEE_CODE}`);
  console.log(`IDs: ${EXPENSE_IDS.length}`);

  if (EXPENSE_IDS.length !== 18) {
    throw new Error(`Expected 18 IDs, got ${EXPENSE_IDS.length}`);
  }

  const beforeRows = [];
  let beforeTotal = 0;

  for (const expenseId of EXPENSE_IDS) {
    const row = await getExpense(expenseId);
    if (!row || row.is_deleted) {
      throw new Error(`Missing or deleted: ${expenseId}`);
    }
    if (String(row.created_by_employee_code || '').trim() !== EMPLOYEE_CODE) {
      throw new Error(`Wrong owner for ${expenseId}: ${row.created_by_employee_code}`);
    }
    if (String(row.monthYear || '').trim() !== '06-2026') {
      throw new Error(`${expenseId} monthYear is ${row.monthYear}, expected 06-2026`);
    }
    if (!String(row.date || '').startsWith('2026-06-')) {
      throw new Error(`${expenseId} date is ${row.date}, expected 2026-06-*`);
    }
    if (!isApproved(row)) {
      throw new Error(
        `${expenseId} not Approved: approval_status=${row.approval_status} auditStatus=${row.auditStatus}`,
      );
    }
    const newDate = juneToJulyDate(row.date);
    const amount = Number(row.amount) || 0;
    beforeTotal += amount;
    beforeRows.push({
      expenseId,
      date: row.date,
      newDate,
      monthYear: row.monthYear,
      amount,
      approval_status: row.approval_status,
      auditStatus: row.auditStatus,
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      auditedBy: row.auditedBy,
      auditedAt: row.auditedAt,
    });
  }

  beforeTotal = Math.round(beforeTotal * 100) / 100;
  console.log('\nPre-change preview:');
  console.table(
    beforeRows.map((r) => ({
      expenseId: r.expenseId.slice(0, 28) + '…',
      from: r.date,
      to: r.newDate,
      amount: r.amount,
      status: r.approval_status,
    })),
  );
  console.log(`Before count=${beforeRows.length} total=${beforeTotal}`);

  if (beforeTotal !== EXPECTED_TOTAL) {
    throw new Error(`Total ${beforeTotal} !== expected ${EXPECTED_TOTAL}; aborting`);
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to write.');
    return;
  }

  const now = new Date().toISOString();
  const updated = [];

  for (const plan of beforeRows) {
    const attrs = await updateInPlace(plan.expenseId, {
      newDate: plan.newDate,
      newMonthYear: TARGET_MONTH_YEAR,
      now,
    });

    if (String(attrs.monthYear) !== TARGET_MONTH_YEAR || String(attrs.date) !== plan.newDate) {
      throw new Error(`Post-update mismatch for ${plan.expenseId}`);
    }
    if (String(attrs.approval_status) !== 'Approved') {
      throw new Error(`Approval lost for ${plan.expenseId}`);
    }
    if (attrs.auditStatus && String(attrs.auditStatus) !== 'Approved') {
      throw new Error(`auditStatus changed for ${plan.expenseId}: ${attrs.auditStatus}`);
    }

    await logActivity({
      actorEmployeeCode: 'SYSTEM',
      actorName: 'Admin data correction',
      actorRole: 'Developer',
      module: 'expenses',
      actionType: 'UPDATE',
      targetEntity: 'expense',
      targetId: plan.expenseId,
      description:
        'Admin correction: month mis-entry — moved Ujjwal Gupta (SPPL 041) expense from June 2026 to July 2026; Approved status preserved',
      oldValue: { date: plan.date, monthYear: '06-2026' },
      newValue: { date: plan.newDate, monthYear: TARGET_MONTH_YEAR },
      metadata: {
        correctionType: 'month_reclassification',
        employeeCode: EMPLOYEE_CODE,
        dayOfMonthRetained: true,
        dayIndependentlyVerified: false,
      },
    });

    updated.push({
      expenseId: plan.expenseId,
      date: attrs.date,
      monthYear: attrs.monthYear,
      amount: Number(attrs.amount) || 0,
      approval_status: attrs.approval_status,
      auditStatus: attrs.auditStatus,
    });
    console.log(`Updated ${plan.expenseId}: ${plan.date} → ${plan.newDate}`);
  }

  // Independent re-query verification
  const all = await queryByEmployee();
  const idSet = new Set(EXPENSE_IDS);
  const corrected = all.filter((r) => idSet.has(r.expenseId));
  const stillJune = corrected.filter((r) => String(r.monthYear) === '06-2026');
  const nowJuly = corrected.filter((r) => String(r.monthYear) === '07-2026');
  const juneAny = all.filter((r) => String(r.monthYear) === '06-2026');
  const julyAny = all.filter((r) => String(r.monthYear) === '07-2026');
  const afterTotal = Math.round(
    nowJuly.filter((r) => idSet.has(r.expenseId)).reduce((s, r) => s + (Number(r.amount) || 0), 0) *
      100,
  ) / 100;

  const statusOk = nowJuly.every(
    (r) =>
      idSet.has(r.expenseId) &&
      String(r.approval_status) === 'Approved' &&
      (String(r.auditStatus || 'Approved') === 'Approved'),
  );

  console.log('\n=== Verification ===');
  console.log({
    correctedFound: corrected.length,
    stillJuneAmongCorrected: stillJune.length,
    julyAmongCorrected: nowJuly.length,
    ujjwalRemainingJuneCount: juneAny.length,
    ujjwalJulyCount: julyAny.length,
    correctedJulyTotal: afterTotal,
    expectedTotal: EXPECTED_TOTAL,
    totalMatch: afterTotal === EXPECTED_TOTAL,
    allApproved: statusOk,
    allEighteenPresent: corrected.length === 18 && nowJuly.length === 18,
  });

  if (
    stillJune.length !== 0 ||
    nowJuly.length !== 18 ||
    afterTotal !== EXPECTED_TOTAL ||
    !statusOk ||
    juneAny.length !== 0
  ) {
    console.error('VERIFICATION FAILED');
    process.exit(1);
  }

  console.log('\nSUCCESS: 18 records moved in place to 07-2026; Approved preserved; no June copies remain for these IDs.');
  console.log(
    'Note: exact July calendar day was not independently verified; original day-of-month retained.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
