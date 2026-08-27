/**
 * Sales History service — historical invoice records only.
 */

import * as SalesHistoryModel from '../models/SalesHistory.js';
import { buildAuditFields } from '../utils/audit.js';
import { canAccessAllRecords } from '../utils/accessControl.js';

function assertCanManage(effectiveRole) {
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

function validatePayload(body = {}, { partial = false } = {}) {
  const required = [
    'invoiceDate',
    'invoiceNumber',
    'customerName',
    'principal',
    'partNumber',
    'itemDescription',
  ];
  if (!partial) {
    for (const key of required) {
      if (!String(body[key] || '').trim()) {
        const err = new Error(`${key} is required`);
        err.statusCode = 400;
        throw err;
      }
    }
  }
  if (body.primaryContactEmail != null && String(body.primaryContactEmail).trim()) {
    const email = String(body.primaryContactEmail).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const err = new Error('primaryContactEmail is invalid');
      err.statusCode = 400;
      throw err;
    }
  }
  if (body.quantity != null && body.quantity !== '') {
    const n = Number(body.quantity);
    if (!Number.isFinite(n) || n < 0) {
      const err = new Error('quantity must be a non-negative number');
      err.statusCode = 400;
      throw err;
    }
  }
}

export async function listRecords(_authUser, _effectiveRole, query = {}) {
  // Read-only list: any authenticated salesForecasting user (route middleware).
  // Create / update / delete remain admin-gated via assertCanManage.
  return SalesHistoryModel.listRecords({
      customer: query.customer,
      principal: query.principal,
      year: query.year,
      invoiceNumber: query.invoiceNumber,
      partNumber: query.partNumber,
      q: query.q || query.search,
    });
}

export async function getRecord(recordId, effectiveRole) {
  assertCanManage(effectiveRole);
  const item = await SalesHistoryModel.getRecordById(recordId);
  if (!item) {
    const err = new Error('Sales history record not found');
    err.statusCode = 404;
    throw err;
  }
  return SalesHistoryModel.toPublicRecord(item);
}

export async function createRecord(body, authUser, effectiveRole) {
  assertCanManage(effectiveRole);
  validatePayload(body, { partial: false });
  const audit = buildAuditFields(authUser);
  const item = await SalesHistoryModel.createRecord(body, audit);
  return SalesHistoryModel.toPublicRecord(item);
}

export async function updateRecord(recordId, body, authUser, effectiveRole) {
  assertCanManage(effectiveRole);
  validatePayload(body, { partial: true });
  const item = await SalesHistoryModel.updateRecord(recordId, body);
  return SalesHistoryModel.toPublicRecord(item);
}

export async function deleteRecord(recordId, effectiveRole) {
  assertCanManage(effectiveRole);
  await SalesHistoryModel.softDeleteRecord(recordId);
  return { recordId, deleted: true };
}
