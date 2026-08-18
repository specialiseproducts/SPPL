/**
 * SalesHistory — historical sales records (last ~5 years).
 * Independent of quotations / approvals / notifications.
 *
 * Table: SalesHistory
 * PK: recordId (HIST#uuid)
 * No sort key. No GSIs (list via scan + in-memory filters for now).
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';

const TABLE_NAME = TABLES.SALES_HISTORY;

function trim(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

/** Decode percent-encoding; ignore a truncated "HIST" left when `#uuid` is stripped as a URL fragment. */
export function normalizeRecordId(recordId) {
  let id = trim(recordId);
  if (!id) return '';
  if (id.includes('%')) {
    try {
      id = decodeURIComponent(id);
    } catch {
      // keep the trimmed original
    }
  }
  if (id === 'HIST') return '';
  return id;
}

export function toPublicRecord(item) {
  if (!item || item.isDeleted) return null;
  return {
    recordId: item.recordId,
    invoiceDate: item.invoiceDate || '',
    invoiceNumber: item.invoiceNumber || '',
    customerName: item.customerName || '',
    billingAddress: item.billingAddress || '',
    principal: item.principal || '',
    serialNumber: item.serialNumber || '',
    warranty: item.warranty || '',
    partNumber: item.partNumber || '',
    itemDescription: item.itemDescription || '',
    quantity: item.quantity != null && item.quantity !== '' ? Number(item.quantity) : null,
    endUser: item.endUser || '',
    primaryContactEmail: item.primaryContactEmail || '',
    createdAt: item.createdAt || item.created_at || '',
    updatedAt: item.updatedAt || item.updated_at || '',
    created_by_employee_code: item.created_by_employee_code || '',
    created_by_name: item.created_by_name || '',
  };
}

export async function createRecord(data, audit = {}) {
  const now = new Date().toISOString();
  const recordId = `HIST#${uuidv4()}`;
  const item = {
    recordId,
    invoiceDate: trim(data.invoiceDate),
    invoiceNumber: trim(data.invoiceNumber),
    customerName: trim(data.customerName),
    billingAddress: trim(data.billingAddress),
    principal: trim(data.principal),
    serialNumber: trim(data.serialNumber),
    warranty: trim(data.warranty),
    partNumber: trim(data.partNumber),
    itemDescription: trim(data.itemDescription),
    quantity:
      data.quantity === '' || data.quantity === undefined || data.quantity === null
        ? null
        : Number(data.quantity),
    endUser: trim(data.endUser),
    primaryContactEmail: trim(data.primaryContactEmail),
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    created_by_employee_code: audit.created_by_employee_code || '',
    created_by_name: audit.created_by_name || '',
    created_by_role: audit.created_by_role || '',
    created_at: now,
    updated_at: now,
  };

  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(recordId)',
    })
    .promise();

  return item;
}

export async function getRecordById(recordId) {
  const id = normalizeRecordId(recordId);
  if (!id) return null;
  const result = await dynamoDB
    .get({
      TableName: TABLE_NAME,
      Key: { recordId: id },
      ConsistentRead: true,
    })
    .promise();
  const item = result.Item || null;
  if (!item || item.isDeleted) return null;
  return item;
}

export async function updateRecord(recordId, patch = {}) {
  const existing = await getRecordById(recordId);
  if (!existing) {
    const err = new Error('Sales history record not found');
    err.statusCode = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const next = {
    ...existing,
    invoiceDate: patch.invoiceDate !== undefined ? trim(patch.invoiceDate) : existing.invoiceDate,
    invoiceNumber:
      patch.invoiceNumber !== undefined ? trim(patch.invoiceNumber) : existing.invoiceNumber,
    customerName:
      patch.customerName !== undefined ? trim(patch.customerName) : existing.customerName,
    billingAddress:
      patch.billingAddress !== undefined ? trim(patch.billingAddress) : existing.billingAddress,
    principal: patch.principal !== undefined ? trim(patch.principal) : existing.principal,
    serialNumber:
      patch.serialNumber !== undefined ? trim(patch.serialNumber) : existing.serialNumber,
    warranty: patch.warranty !== undefined ? trim(patch.warranty) : existing.warranty,
    partNumber: patch.partNumber !== undefined ? trim(patch.partNumber) : existing.partNumber,
    itemDescription:
      patch.itemDescription !== undefined
        ? trim(patch.itemDescription)
        : existing.itemDescription,
    quantity:
      patch.quantity !== undefined
        ? patch.quantity === '' || patch.quantity === null
          ? null
          : Number(patch.quantity)
        : existing.quantity,
    endUser: patch.endUser !== undefined ? trim(patch.endUser) : existing.endUser,
    primaryContactEmail:
      patch.primaryContactEmail !== undefined
        ? trim(patch.primaryContactEmail)
        : existing.primaryContactEmail,
    updatedAt: now,
    updated_at: now,
  };

  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: next,
    })
    .promise();

  return next;
}

export async function softDeleteRecord(recordId) {
  const existing = await getRecordById(recordId);
  if (!existing) {
    const err = new Error('Sales history record not found');
    err.statusCode = 404;
    throw err;
  }
  const now = new Date().toISOString();
  const next = {
    ...existing,
    isDeleted: true,
    deletedAt: now,
    updatedAt: now,
    updated_at: now,
  };
  await dynamoDB.put({ TableName: TABLE_NAME, Item: next }).promise();
  return next;
}

/**
 * Scan-based list (no GSIs). Walks every DynamoDB page via LastEvaluatedKey,
 * then applies search/filters in memory so the UI receives the full matching set.
 */
export async function listRecords(filters = {}) {
  const customer = trim(filters.customer).toLowerCase();
  const principal = trim(filters.principal).toLowerCase();
  const year = trim(filters.year);
  const invoiceNumber = trim(filters.invoiceNumber).toLowerCase();
  const partNumber = trim(filters.partNumber).toLowerCase();
  const q = trim(filters.q || filters.search).toLowerCase();

  const collected = [];
  let exclusiveStartKey;

  do {
    const result = await dynamoDB
      .scan({
        TableName: TABLE_NAME,
        ExclusiveStartKey: exclusiveStartKey,
      })
      .promise();

    for (const raw of result.Items || []) {
      if (raw.isDeleted) continue;
      const row = toPublicRecord(raw);
      if (!row) continue;

      if (customer && !String(row.customerName).toLowerCase().includes(customer)) continue;
      if (principal && !String(row.principal).toLowerCase().includes(principal)) continue;
      if (year) {
        const y = String(row.invoiceDate || '').slice(0, 4);
        if (y !== year) continue;
      }
      if (invoiceNumber && !String(row.invoiceNumber).toLowerCase().includes(invoiceNumber)) {
        continue;
      }
      if (partNumber && !String(row.partNumber).toLowerCase().includes(partNumber)) continue;
      if (q) {
        const blob = [
          row.invoiceNumber,
          row.customerName,
          row.principal,
          row.partNumber,
          row.itemDescription,
          row.serialNumber,
          row.endUser,
          row.primaryContactEmail,
        ]
          .join(' ')
          .toLowerCase();
        if (!blob.includes(q)) continue;
      }

      collected.push(row);
    }

    exclusiveStartKey = result.LastEvaluatedKey || undefined;
  } while (exclusiveStartKey);

  collected.sort((a, b) => String(b.invoiceDate || '').localeCompare(String(a.invoiceDate || '')));

  return {
    data: collected,
    nextCursor: null,
  };
}
