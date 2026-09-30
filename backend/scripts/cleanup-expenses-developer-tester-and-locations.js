#!/usr/bin/env node
/**
 * ONE-TIME Expenses data cleanup (migration script — not app runtime).
 *
 * A) Hard-delete confirmed Developer Tester dummy expense records
 *    Identity: created_by_employee_code === 'DUMMY'
 *           AND employeeName === 'Developer Tester'
 * B) Normalize formatting-only duplicates in location / fromLocation / toLocation
 * C) Consolidate duplicate TYPE#LOCATION rows in ExpenseMasterValues
 *
 * Usage:
 *   node scripts/cleanup-expenses-developer-tester-and-locations.js
 *   node scripts/cleanup-expenses-developer-tester-and-locations.js --dry-run
 *
 * Backup of deleted Developer Tester payloads is written under:
 *   scripts/.cleanup-output/ (gitignored temporary artifact)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import AWS from 'aws-sdk';
import {
  canonicalizeDisplayValue,
  normalizeDropdownValue,
} from '../src/utils/expenseMasterNormalize.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

const region = process.env.AWS_REGION || 'us-east-1';
const expensesTable = process.env.DYNAMODB_TABLE_EXPENSES || 'Expenses';
const documentsTable = process.env.DYNAMODB_TABLE_EXPENSE_DOCUMENTS || 'ExpenseDocuments';
const masterTable = process.env.DYNAMODB_TABLE_EXPENSE_MASTER_VALUES || 'ExpenseMasterValues';

const doc = new AWS.DynamoDB.DocumentClient({
  region,
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : {}),
});

const LOCATION_FIELDS = ['location', 'fromLocation', 'toLocation'];
const LOCATION_PK = 'TYPE#LOCATION';

function isDeveloperTesterExpense(row) {
  const code = String(row.created_by_employee_code ?? '').trim();
  const name = String(row.employeeName ?? '').trim();
  return code === 'DUMMY' && name === 'Developer Tester';
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
  const chunks = [];
  for (let i = 0; i < writeRequests.length; i += 25) {
    chunks.push(writeRequests.slice(i, i + 25));
  }
  for (const chunk of chunks) {
    let requestItems = { [tableName]: chunk };
    let attempts = 0;
    while (requestItems[tableName]?.length) {
      attempts += 1;
      if (attempts > 12) {
        throw new Error(`BatchWriteItem exceeded retries for ${tableName}`);
      }
      const result = await doc.batchWrite({ RequestItems: requestItems }).promise();
      const unprocessed = result.UnprocessedItems?.[tableName] || [];
      if (!unprocessed.length) break;
      await new Promise((r) => setTimeout(r, 100 * attempts));
      requestItems = { [tableName]: unprocessed };
    }
  }
}

/**
 * Pick a clean human-readable canonical display among formatting variants.
 * Prefers master display when available; never invents semantic merges.
 */
function chooseCanonicalDisplay(variants, masterDisplay, frequencyMap) {
  const unique = [...new Set(variants.map((v) => String(v).trim()).filter(Boolean))];
  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0];

  const master = String(masterDisplay || '').trim();
  if (master && unique.some((v) => normalizeDropdownValue(v) === normalizeDropdownValue(master))) {
    // Prefer exact master display if present in variants; else master string.
    const exact = unique.find((v) => v === master);
    if (exact) return exact;
    return master;
  }

  const scored = unique.map((v) => {
    const freq = frequencyMap.get(v) || 0;
    const isAllLower = v === v.toLowerCase() && /[a-z]/.test(v);
    const isAllUpper = v === v.toUpperCase() && /[A-Z]/.test(v);
    const title = canonicalizeDisplayValue(v);
    const matchesTitle = v === title;
    let score = freq * 10;
    if (matchesTitle) score += 5;
    if (!isAllLower && !isAllUpper) score += 3;
    if (isAllLower) score -= 2;
    if (isAllUpper) score -= 1;
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score || a.v.localeCompare(b.v));
  return scored[0].v;
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (no writes) ===' : '=== LIVE CLEANUP ===');
  console.log(`Expenses table: ${expensesTable}`);

  const allExpenses = await scanAll(expensesTable);
  console.log(`Scanned expenses: ${allExpenses.length}`);

  // ── A) Developer Tester identification ──────────────────────────────
  const testerRows = allExpenses.filter(isDeveloperTesterExpense);
  const nonTesterRows = allExpenses.filter((r) => !isDeveloperTesterExpense(r));

  console.log(`\nDeveloper Tester records found: ${testerRows.length}`);
  console.log(`Real / other expense records preserved: ${nonTesterRows.length}`);

  if (testerRows.length === 0) {
    console.log('No Developer Tester records to delete.');
  } else {
    // Safety: every matched row must have DUMMY code + exact name
    const unsafe = testerRows.filter(
      (r) =>
        String(r.created_by_employee_code || '').trim() !== 'DUMMY' ||
        String(r.employeeName || '').trim() !== 'Developer Tester',
    );
    if (unsafe.length) {
      throw new Error(`Abort: ${unsafe.length} matched rows failed strict identity check`);
    }

    const outDir = path.join(__dirname, '.cleanup-output');
    if (!DRY_RUN) {
      fs.mkdirSync(outDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(outDir, `developer-tester-expenses-backup-${stamp}.json`);
      fs.writeFileSync(
        backupPath,
        JSON.stringify(
          {
            deletedAt: new Date().toISOString(),
            identityRule:
              "created_by_employee_code === 'DUMMY' && employeeName === 'Developer Tester'",
            count: testerRows.length,
            records: testerRows,
          },
          null,
          2,
        ),
      );
      console.log(`Backup written: ${backupPath}`);
    }

    // Collect related documents
    const docsToDelete = [];
    for (const row of testerRows) {
      const expenseId = String(row.expenseId || '').trim();
      if (!expenseId) continue;
      const docs = await scanAll(documentsTable, {
        FilterExpression: '#expenseId = :expenseId',
        ExpressionAttributeNames: { '#expenseId': 'expenseId' },
        ExpressionAttributeValues: { ':expenseId': expenseId },
      });
      for (const d of docs) {
        if (d.documentId) docsToDelete.push(d);
      }
    }
    console.log(`Related ExpenseDocuments to delete: ${docsToDelete.length}`);

    if (!DRY_RUN) {
      await batchWriteAll(
        expensesTable,
        testerRows.map((r) => ({
          DeleteRequest: { Key: { expenseId: r.expenseId } },
        })),
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
    console.log(`Developer Tester expenses deleted: ${testerRows.length}`);
  }

  // Re-scan after delete for location work
  const remainingExpenses = DRY_RUN
    ? nonTesterRows
    : (await scanAll(expensesTable)).filter((r) => !isDeveloperTesterExpense(r));

  // Verify no Developer Tester remain
  const leftover = remainingExpenses.filter(isDeveloperTesterExpense);
  console.log(`Developer Tester remaining after delete: ${leftover.length}`);

  // ── B) Load master location display map ─────────────────────────────
  const masterRows = await scanAll(masterTable, {
    FilterExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': LOCATION_PK },
  });
  // Also query if scan filter misses — prefer query
  const masterQuery = await doc
    .query({
      TableName: masterTable,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': LOCATION_PK },
    })
    .promise();
  const locationMasters = masterQuery.Items?.length ? masterQuery.Items : masterRows;

  const masterByNormalized = new Map();
  for (const row of locationMasters) {
    const display = String(row.displayValue || '').trim();
    const key =
      String(row.normalizedValue || row.sk || '').trim() || normalizeDropdownValue(display);
    if (!key || !display) continue;
    if (!masterByNormalized.has(key)) masterByNormalized.set(key, display);
  }

  // ── C) Build formatting groups from remaining expenses ──────────────
  const fieldGroups = {
    location: new Map(), // normalized -> Map(display -> count of expenseIds)
    fromLocation: new Map(),
    toLocation: new Map(),
  };
  const frequency = new Map(); // display -> count across all three fields

  for (const row of remainingExpenses) {
    for (const field of LOCATION_FIELDS) {
      const raw = String(row[field] ?? '').trim();
      if (!raw) continue;
      const key = normalizeDropdownValue(raw);
      if (!key) continue;
      if (!fieldGroups[field].has(key)) fieldGroups[field].set(key, new Map());
      const m = fieldGroups[field].get(key);
      m.set(raw, (m.get(raw) || 0) + 1);
      frequency.set(raw, (frequency.get(raw) || 0) + 1);
    }
  }

  // Union of all variants per normalized key across fields + masters
  const allVariantsByKey = new Map();
  for (const field of LOCATION_FIELDS) {
    for (const [key, variantMap] of fieldGroups[field].entries()) {
      if (!allVariantsByKey.has(key)) allVariantsByKey.set(key, new Set());
      for (const v of variantMap.keys()) allVariantsByKey.get(key).add(v);
    }
  }
  for (const [key, display] of masterByNormalized.entries()) {
    if (!allVariantsByKey.has(key)) allVariantsByKey.set(key, new Set());
    allVariantsByKey.get(key).add(display);
  }

  const canonicalByKey = new Map();
  const ambiguousPreserved = [];
  for (const [key, variantSet] of allVariantsByKey.entries()) {
    const variants = [...variantSet];
    const canonical = chooseCanonicalDisplay(
      variants,
      masterByNormalized.get(key),
      frequency,
    );
    canonicalByKey.set(key, canonical);
    // Track intentional non-merges of related-but-different keys for report
  }

  // Known related pairs that must remain separate (report only)
  const relatedPairs = [
    ['mumbai', 'navimumbai'],
    ['mumbai', 'mumbaiindia'],
    ['mumbai', 'mumbaicentral'],
    ['delhi', 'newdelhi'],
    ['bangalore', 'bengaluru'],
    ['andheri', 'andherieast'],
    ['andheri', 'andheriwest'],
  ];
  for (const [a, b] of relatedPairs) {
    if (canonicalByKey.has(a) && canonicalByKey.has(b)) {
      ambiguousPreserved.push(`${canonicalByKey.get(a)} / ${canonicalByKey.get(b)}`);
    }
  }

  // ── D) Update expense location fields ───────────────────────────────
  const fieldUpdateCounts = { location: 0, fromLocation: 0, toLocation: 0 };
  const updates = [];

  for (const row of remainingExpenses) {
    const expenseId = String(row.expenseId || '').trim();
    if (!expenseId) continue;
    const patch = {};
    for (const field of LOCATION_FIELDS) {
      const raw = String(row[field] ?? '').trim();
      if (!raw) continue;
      const key = normalizeDropdownValue(raw);
      if (!key) continue;
      const canonical = canonicalByKey.get(key);
      if (!canonical || canonical === raw) continue;
      // Only update when this is a formatting-only change (same normalized key)
      if (normalizeDropdownValue(canonical) !== key) continue;
      patch[field] = canonical;
      fieldUpdateCounts[field] += 1;
    }
    if (Object.keys(patch).length) {
      updates.push({ expenseId, patch });
    }
  }

  console.log('\nLocation field updates planned:');
  console.log(`  location: ${fieldUpdateCounts.location}`);
  console.log(`  fromLocation: ${fieldUpdateCounts.fromLocation}`);
  console.log(`  toLocation: ${fieldUpdateCounts.toLocation}`);
  console.log(`  expense records to patch: ${updates.length}`);

  if (!DRY_RUN) {
    for (const { expenseId, patch } of updates) {
      const names = {};
      const values = {};
      const parts = [];
      let i = 0;
      for (const [field, value] of Object.entries(patch)) {
        const nk = `#f${i}`;
        const vk = `:v${i}`;
        names[nk] = field;
        values[vk] = value;
        parts.push(`${nk} = ${vk}`);
        i += 1;
      }
      await doc
        .update({
          TableName: expensesTable,
          Key: { expenseId },
          UpdateExpression: `SET ${parts.join(', ')}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        })
        .promise();
    }
  }

  // ── E) Consolidate ExpenseMasterValues TYPE#LOCATION ────────────────
  // Group master rows by normalize(displayValue) / normalize(sk)
  const masterGroups = new Map(); // normalized -> rows[]
  for (const row of locationMasters) {
    const display = String(row.displayValue || '').trim();
    const sk = String(row.sk || '').trim();
    const key = normalizeDropdownValue(display) || normalizeDropdownValue(sk) || sk;
    if (!key) continue;
    if (!masterGroups.has(key)) masterGroups.set(key, []);
    masterGroups.get(key).push(row);
  }

  let masterDuplicatesRemoved = 0;
  let masterDisplayFixed = 0;
  const masterDeletes = [];
  const masterPuts = [];

  for (const [key, rows] of masterGroups.entries()) {
    const canonical = canonicalByKey.get(key) || chooseCanonicalDisplay(
      rows.map((r) => r.displayValue),
      masterByNormalized.get(key),
      frequency,
    );
    if (!canonical) continue;

    // Prefer keeping the row whose sk already equals normalized key
    const keep =
      rows.find((r) => String(r.sk || '').trim() === key) ||
      rows[0];

    for (const row of rows) {
      if (row === keep) continue;
      // Duplicate logical master (same normalized key, different sk or duplicate)
      masterDeletes.push({ pk: row.pk, sk: row.sk });
      masterDuplicatesRemoved += 1;
    }

    const keepSk = String(keep.sk || '').trim();
    const keepDisplay = String(keep.displayValue || '').trim();

    if (keepSk !== key) {
      // Wrong sk — replace with correct normalized sk
      masterDeletes.push({ pk: keep.pk, sk: keep.sk });
      masterPuts.push({
        pk: LOCATION_PK,
        sk: key,
        type: 'LOCATION',
        normalizedValue: key,
        displayValue: canonical,
        createdAt: keep.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      masterDuplicatesRemoved += 1;
      masterDisplayFixed += 1;
    } else if (keepDisplay !== canonical) {
      masterPuts.push({
        ...keep,
        displayValue: canonical,
        normalizedValue: key,
        updatedAt: new Date().toISOString(),
      });
      masterDisplayFixed += 1;
    }
  }

  // Ensure every canonical key used by expenses exists in master
  let masterEnsured = 0;
  for (const [key, canonical] of canonicalByKey.entries()) {
    const existing = locationMasters.find(
      (r) =>
        String(r.sk || '').trim() === key ||
        normalizeDropdownValue(r.displayValue) === key,
    );
    if (!existing) {
      masterPuts.push({
        pk: LOCATION_PK,
        sk: key,
        type: 'LOCATION',
        normalizedValue: key,
        displayValue: canonical,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      masterEnsured += 1;
    }
  }

  console.log('\nMaster Location cleanup planned:');
  console.log(`  duplicate rows to remove: ${masterDuplicatesRemoved}`);
  console.log(`  display values to fix: ${masterDisplayFixed}`);
  console.log(`  missing masters to ensure: ${masterEnsured}`);

  if (!DRY_RUN) {
    if (masterDeletes.length) {
      await batchWriteAll(
        masterTable,
        masterDeletes.map((k) => ({ DeleteRequest: { Key: k } })),
      );
    }
    if (masterPuts.length) {
      // Deduplicate puts by pk+sk
      const putMap = new Map();
      for (const item of masterPuts) {
        putMap.set(`${item.pk}||${item.sk}`, item);
      }
      await batchWriteAll(
        masterTable,
        [...putMap.values()].map((Item) => ({ PutRequest: { Item } })),
      );
    }
  }

  // Final master count
  const finalMasters = await doc
    .query({
      TableName: masterTable,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': LOCATION_PK },
    })
    .promise();
  const finalMasterCount = (finalMasters.Items || []).length;

  // Verify formatting dups gone on expenses
  const verifyItems = DRY_RUN ? remainingExpenses : await scanAll(expensesTable);
  const verifyGroups = new Map();
  for (const row of verifyItems) {
    if (isDeveloperTesterExpense(row)) continue;
    for (const field of LOCATION_FIELDS) {
      const raw = String(row[field] ?? '').trim();
      if (!raw) continue;
      const key = normalizeDropdownValue(raw);
      if (!key) continue;
      if (!verifyGroups.has(key)) verifyGroups.set(key, new Set());
      verifyGroups.get(key).add(raw);
    }
  }
  const remainingFormatDups = [...verifyGroups.entries()].filter(([, s]) => s.size > 1);

  console.log('\n========== CLEANUP REPORT ==========');
  console.log(`Developer Tester records:`);
  console.log(`  Found: ${testerRows.length}`);
  console.log(`  Deleted: ${DRY_RUN ? 0 : testerRows.length}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`  Remaining: ${leftover.length}`);
  console.log(`Real expense records preserved: ${nonTesterRows.length}`);
  console.log(`Location normalization:`);
  console.log(`  Location fields updated: ${fieldUpdateCounts.location}`);
  console.log(`  From fields updated: ${fieldUpdateCounts.fromLocation}`);
  console.log(`  To fields updated: ${fieldUpdateCounts.toLocation}`);
  console.log(`Master values:`);
  console.log(`  Duplicate location entries consolidated: ${masterDuplicatesRemoved}`);
  console.log(`  Unique TYPE#LOCATION masters remaining: ${finalMasterCount}`);
  console.log(`Ambiguous values intentionally preserved:`);
  for (const line of ambiguousPreserved) console.log(`  ${line}`);
  console.log(
    `Formatting-only duplicate groups remaining after cleanup: ${remainingFormatDups.length}`,
  );
  if (remainingFormatDups.length && DRY_RUN) {
    for (const [k, s] of remainingFormatDups.slice(0, 15)) {
      console.log(`  ${k} => ${[...s].join(' | ')}`);
    }
  }
  console.log('====================================');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
