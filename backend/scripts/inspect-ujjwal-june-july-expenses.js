#!/usr/bin/env node
/**
 * PHASE 1 ONLY — Inspect Ujjwal Gupta June 2026 Approved expenses.
 * Does NOT modify any data.
 *
 * Usage: node scripts/inspect-ujjwal-june-july-expenses.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import AWS from 'aws-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const region = process.env.AWS_REGION || 'us-east-1';
const expensesTable = process.env.DYNAMODB_TABLE_EXPENSES || 'Expenses';
const employeeTable = process.env.DYNAMODB_TABLE_EMPLOYEE_MASTER || 'EmployeeMaster';
const gsiEmployeeUpdated = 'GSI_EmployeeUpdated';

const doc = new AWS.DynamoDB.DocumentClient({
  region,
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : {}),
});

function normName(v) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isUjjwal(row) {
  const n = normName(row.fullName || `${row.firstName || ''} ${row.lastName || ''}`);
  return n === 'ujjwal gupta' || (n.includes('ujjwal') && n.includes('gupta'));
}

function isApproved(row) {
  const s = String(row.auditStatus ?? row.approval_status ?? '')
    .trim()
    .toLowerCase();
  return s === 'approved';
}

function isJune2026(row) {
  const my = String(row.monthYear || '').trim();
  if (my === '06-2026' || my === '6-2026') return true;
  const d = String(row.date || '').trim();
  if (/^2026-06-\d{2}/.test(d)) return true;
  if (/^06[\/\-]\d{1,2}[\/\-]2026/.test(d)) return true;
  if (/^\d{1,2}[\/\-]06[\/\-]2026/.test(d)) return true;
  return false;
}

function isJuly2026(row) {
  const my = String(row.monthYear || '').trim();
  if (my === '07-2026' || my === '7-2026') return true;
  const d = String(row.date || '').trim();
  if (/^2026-07-\d{2}/.test(d)) return true;
  return false;
}

async function scanEmployeesMatchingUjjwal() {
  const matches = [];
  let ExclusiveStartKey;
  do {
    const result = await doc
      .scan({
        TableName: employeeTable,
        ExclusiveStartKey,
      })
      .promise();
    for (const row of result.Items || []) {
      if (row?.is_deleted) continue;
      if (isUjjwal(row)) matches.push(row);
    }
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return matches;
}

async function queryExpensesByCode(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) return [];
  const items = [];
  let ExclusiveStartKey;
  try {
    do {
      const result = await doc
        .query({
          TableName: expensesTable,
          IndexName: gsiEmployeeUpdated,
          KeyConditionExpression: 'created_by_employee_code = :code',
          ExpressionAttributeValues: { ':code': code },
          ExclusiveStartKey,
        })
        .promise();
      items.push(...(result.Items || []));
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items.filter((r) => !r?.is_deleted);
  } catch (err) {
    console.warn('GSI query failed, falling back to scan:', err.message);
  }

  ExclusiveStartKey = undefined;
  do {
    const result = await doc
      .scan({
        TableName: expensesTable,
        FilterExpression: 'created_by_employee_code = :code',
        ExpressionAttributeValues: { ':code': code },
        ExclusiveStartKey,
      })
      .promise();
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items.filter((r) => !r?.is_deleted);
}

function previewRow(row) {
  return {
    expenseId: row.expenseId,
    date: row.date,
    monthYear: row.monthYear,
    expenseHead: row.expenseHead,
    subCategory: row.subCategory || null,
    serviceProvider: row.serviceProvider || null,
    amount: Number(row.amount) || 0,
    approval_status: row.approval_status || null,
    auditStatus: row.auditStatus || null,
    approved_by: row.approved_by || null,
    approved_at: row.approved_at || null,
    auditedBy: row.auditedBy || null,
    auditedAt: row.auditedAt || null,
    purpose: row.purpose || null,
    location: row.location || null,
    billNumber: row.billNumber || null,
    stayDateFrom: row.stayDateFrom || null,
    stayDateTo: row.stayDateTo || null,
    arrivalDate: row.arrivalDate || null,
    departureDate: row.departureDate || null,
    created_at: row.created_at || row.createdAt || null,
    updated_at: row.updated_at || row.updatedAt || null,
    created_by_employee_code: row.created_by_employee_code || null,
    employeeName: row.employeeName || row.created_by_name || null,
  };
}

async function main() {
  console.log('=== PHASE 1: Inspect Ujjwal Gupta June→July expense candidates ===\n');
  console.log(`Employee table: ${employeeTable}`);
  console.log(`Expenses table: ${expensesTable}`);
  console.log(`Region: ${region}\n`);

  const employees = await scanEmployeesMatchingUjjwal();
  if (employees.length === 0) {
    console.error('STOP: No EmployeeMaster row matched "Ujjwal Gupta".');
    process.exit(2);
  }
  if (employees.length > 1) {
    console.warn('WARNING: Multiple EmployeeMaster matches:');
    for (const e of employees) {
      console.warn(
        JSON.stringify({
          employeeId: e.employeeId,
          employeeCode: e.employeeCode,
          fullName: e.fullName || `${e.firstName || ''} ${e.lastName || ''}`.trim(),
          status: e.status,
        }),
      );
    }
  }

  const emp = employees[0];
  const employeeCode = String(emp.employeeCode || '').trim();
  const employeeName =
    String(emp.fullName || '').trim() ||
    `${emp.firstName || ''} ${emp.lastName || ''}`.trim();

  console.log('Resolved employee:');
  console.log(
    JSON.stringify(
      {
        employeeName,
        employeeCode,
        employeeId: emp.employeeId,
        email: emp.email || emp.officialEmail || null,
        status: emp.status || null,
      },
      null,
      2,
    ),
  );

  if (!employeeCode) {
    console.error('STOP: Employee has no employeeCode.');
    process.exit(2);
  }

  const all = await queryExpensesByCode(employeeCode);
  console.log(`\nTotal non-deleted expenses for ${employeeCode}: ${all.length}`);

  const juneAll = all.filter(isJune2026);
  const julyAll = all.filter(isJuly2026);
  const juneApproved = juneAll.filter(isApproved);
  const juneOther = juneAll.filter((r) => !isApproved(r));

  console.log(`June 2026 (any status): ${juneAll.length}`);
  console.log(`June 2026 Approved: ${juneApproved.length}`);
  console.log(`June 2026 non-Approved: ${juneOther.length}`);
  console.log(`July 2026 (any status): ${julyAll.length}`);

  const juneTotal = juneApproved.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const julyTotal = julyAll.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  console.log('\n--- PREVIEW: June 2026 Approved candidates to move ---');
  console.log(
    JSON.stringify(
      {
        employeeName,
        employeeCode,
        recordCount: juneApproved.length,
        totalAmount: Math.round(juneTotal * 100) / 100,
        records: juneApproved.map(previewRow),
      },
      null,
      2,
    ),
  );

  if (juneOther.length) {
    console.log('\n--- June 2026 non-Approved (NOT in move set) ---');
    console.log(JSON.stringify(juneOther.map(previewRow), null, 2));
  }

  console.log('\n--- Existing July 2026 expenses (context) ---');
  console.log(
    JSON.stringify(
      {
        recordCount: julyAll.length,
        totalAmount: Math.round(julyTotal * 100) / 100,
        records: julyAll.map(previewRow),
      },
      null,
      2,
    ),
  );

  // Signals that might support "meant for July"
  console.log('\n--- Ambiguity / date signals ---');
  for (const row of juneApproved) {
    const signals = [];
    const created = String(row.created_at || row.createdAt || '');
    if (created.startsWith('2026-07')) signals.push('created_at_in_july');
    if (String(row.purpose || '').toLowerCase().includes('july')) signals.push('purpose_mentions_july');
    for (const f of ['stayDateFrom', 'stayDateTo', 'arrivalDate', 'departureDate']) {
      const v = String(row[f] || '');
      if (v.includes('2026-07') || /^07/.test(v)) signals.push(`${f}_july`);
    }
    console.log(
      JSON.stringify({
        expenseId: row.expenseId,
        date: row.date,
        monthYear: row.monthYear,
        signals: signals.length ? signals : ['none_beyond_user_report'],
      }),
    );
  }

  console.log('\nPhase 1 complete — no data modified.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
