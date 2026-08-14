/**
 * Centralized Enterprise Audit Trail service.
 * Modules call AuditTrailService.log() — never write DynamoDB directly.
 */

import * as AuditTrailModel from '../models/AuditTrail.js';
import {
  AUDIT_STATUS,
  buildEntityKey,
  resolveAuditAction,
} from '../constants/auditTrail.js';
import { canAccessAllRecords, isOwnedByUser } from '../utils/accessControl.js';
import { diffChangedFields } from '../utils/auditTrailDiff.js';
import logger from '../utils/logger.js';

/**
 * Append one business audit entry. Never throws to callers.
 * @returns {Promise<object|null>}
 */
export async function log(input = {}) {
  try {
    const performedBy = String(input.performedBy || input.employeeCode || '').trim();
    const module = String(input.module || '').trim();
    const entityType = String(input.entityType || '').trim();
    const entityId = String(input.entityId || '').trim();
    if (!module && !entityType && !entityId && !performedBy) {
      return null;
    }

    let oldValues = input.oldValues ?? input.oldValue ?? null;
    let newValues = input.newValues ?? input.newValue ?? null;

    if (input.before && input.after && (oldValues == null || newValues == null)) {
      const diff = diffChangedFields(input.before, input.after, input.diffKeys);
      oldValues = oldValues ?? diff.oldValues;
      newValues = newValues ?? diff.newValues;
    }

    if (oldValues != null && typeof oldValues !== 'object') {
      oldValues = { value: oldValues };
    }
    if (newValues != null && typeof newValues !== 'object') {
      newValues = { value: newValues };
    }

    const item = await AuditTrailModel.createAuditTrailEntry({
      employeeCode: String(input.employeeCode || performedBy).trim(),
      employeeName: String(input.employeeName || '').trim(),
      module,
      entityType,
      entityId,
      entityKey: input.entityKey || buildEntityKey(entityType, entityId),
      action: String(input.action || 'CUSTOM').trim().toUpperCase() || 'CUSTOM',
      description: String(input.description || '').trim(),
      oldValues,
      newValues,
      status: String(input.status || AUDIT_STATUS.SUCCESS).trim() || AUDIT_STATUS.SUCCESS,
      performedBy,
      performedByRole: String(input.performedByRole || '').trim(),
      performedAt: input.performedAt,
      metadata: input.metadata || {},
      reference: input.reference,
      ipAddress: input.ipAddress ?? null,
      deviceInfo: input.deviceInfo ?? null,
      browser: input.browser ?? null,
      sessionId: input.sessionId ?? null,
    });

    return AuditTrailModel.toPublicAuditEntry(item);
  } catch (err) {
    logger.error('AuditTrailService.log failed', { error: err?.message || err });
    return null;
  }
}

/**
 * Bridge from legacy ActivityLogs `logActivity` payloads → AuditTrail.
 */
export async function logFromActivityPayload(payload = {}) {
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const action = resolveAuditAction(payload.actionType, metadata);
  const description =
    payload.description ||
    metadata.description ||
    buildDefaultDescription(payload.module, action, payload.targetEntity, payload.targetId);

  return log({
    employeeCode: payload.actorEmployeeCode,
    employeeName: payload.actorName,
    module: payload.module,
    entityType: payload.targetEntity,
    entityId: payload.targetId,
    action,
    description,
    oldValues: payload.oldValue ?? null,
    newValues: payload.newValue ?? null,
    performedBy: payload.actorEmployeeCode,
    performedByRole: payload.actorRole,
    metadata: {
      ...metadata,
      source: 'activityLogger',
    },
    reference: metadata.reference || metadata.quotationRef || metadata.expenseId || '',
    status: AUDIT_STATUS.SUCCESS,
  });
}

function buildDefaultDescription(module, action, entityType, entityId) {
  const parts = [action, entityType, entityId].filter(Boolean);
  if (module) parts.unshift(module);
  return parts.join(' · ');
}

async function userCanAccessEntity(authUser, effectiveRole, entityType, entityId) {
  if (canAccessAllRecords(effectiveRole)) return true;
  const type = String(entityType || '').trim().toLowerCase();
  const id = String(entityId || '').trim();
  if (!type || !id) return false;

  try {
    if (type === 'expense') {
      const ExpenseModel = await import('../models/Expenses.js');
      const row = await ExpenseModel.getExpenseById(id);
      return Boolean(row && isOwnedByUser(row, authUser));
    }
    if (type === 'opportunity' || type === 'salesforecast' || type === 'quotation') {
      const SalesModel = await import('../models/SalesForecasts.js');
      const row = await SalesModel.getSalesForecastById(id);
      return Boolean(row && isOwnedByUser(row, authUser));
    }
    if (type === 'plannertask' || type === 'task') {
      const Tasks = await import('../models/DailyPlannerTasks.js');
      const row = await Tasks.getTaskById(id);
      return Boolean(row && isOwnedByUser(row, authUser));
    }
    if (type === 'order' || type === 'orderprocessing') {
      const Orders = await import('../models/OrderProcessing.js');
      const row = await Orders.getOrderById(id);
      return Boolean(row && isOwnedByUser(row, authUser));
    }
    if (type === 'employee') {
      return id === String(authUser?.employeeCode || '').trim();
    }
  } catch (err) {
    logger.warn('Audit entity access check failed', { entityType, entityId, error: err?.message });
  }
  return false;
}

/**
 * List audit entries with security scoping.
 */
export async function listForUser(authUser, effectiveRole, filters = {}, options = {}) {
  const code = String(authUser?.employeeCode || '').trim();
  const privileged = canAccessAllRecords(effectiveRole);
  const queryFilters = { ...filters };

  if (!privileged) {
    if (queryFilters.entityType && queryFilters.entityId) {
      const ok = await userCanAccessEntity(
        authUser,
        effectiveRole,
        queryFilters.entityType,
        queryFilters.entityId,
      );
      if (!ok) {
        const err = new Error('Forbidden');
        err.statusCode = 403;
        throw err;
      }
    } else {
      queryFilters.employeeCode = code;
    }
  }

  const page = await AuditTrailModel.listFiltered(queryFilters, options);
  return {
    data: page.data || [],
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
  };
}

export async function listForEntity(authUser, effectiveRole, entityType, entityId, options = {}) {
  return listForUser(
    authUser,
    effectiveRole,
    { entityType, entityId, module: options.module },
    options,
  );
}

export { diffChangedFields, buildEntityKey };
