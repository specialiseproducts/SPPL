/**
 * Quotation edit-permission request workflow (create / approve / reject).
 */

import * as SalesForecastsModel from '../models/SalesForecasts.js';
import * as QuotationEditRequestsModel from '../models/QuotationEditRequests.js';
import * as EmployeeMasterModel from '../models/EmployeeMaster.js';
import { canAccessAllRecords, isOwnedByUser } from '../utils/accessControl.js';
import { logActivity } from '../utils/activityLogger.js';
import { sendEmail } from './emailService.js';
import { buildEditPermissionRequestEmail } from './salesQuotationEmailTemplates.js';
import {
  EDIT_REQUEST_ADMIN_EMAIL,
  isValidEditRequestType,
} from '../constants/quotationEditRequest.js';
import { ensureSalesMasterReady } from '../utils/salesMasterInit.js';
import * as SalesMasterDataModel from '../models/SalesMasterData.js';
import log from '../utils/logger.js';
import * as SalesNotificationEmitters from './notificationEmitters.js';
import * as NotificationService from './notification.service.js';
import {
  ACTION_KINDS,
  ACTION_OUTCOMES,
  NOTIFICATION_MODULES,
} from '../constants/notifications.js';

function normalizeLegacyWorkflow(item) {
  if (!item) return item;
  const row = { ...item };
  if (!row.ownerEmployeeCode && row.created_by_employee_code) {
    row.ownerEmployeeCode = row.created_by_employee_code;
  }
  if (!row.ownerEmployeeName && (row.employeeName || row.created_by_name)) {
    row.ownerEmployeeName = row.employeeName || row.created_by_name;
  }
  if (row.workflowStatus) return row;
  const legacy = String(row.approval_status || '').trim();
  if (legacy === 'Approved') return { ...row, workflowStatus: 'approved' };
  if (legacy === 'Rejected') return { ...row, workflowStatus: 'rejected' };
  if (legacy === 'Pending') return { ...row, workflowStatus: 'pending_approval' };
  return { ...row, workflowStatus: 'draft' };
}

function parseProbabilityPercent(label) {
  const m = String(label || '').trim().match(/^(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function computeTotals(unitPrice, quantity, currency, rateMap) {
  const up = Number(unitPrice);
  const qty = Number(quantity);
  const safeUp = Number.isFinite(up) ? up : 0;
  const safeQty = Number.isFinite(qty) ? qty : 0;
  const totalValue = parseFloat((safeUp * safeQty).toFixed(2));
  const cur = String(currency || 'INR').trim() || 'INR';
  const mult = cur === 'INR' ? 1 : Number(rateMap[cur] ?? 0) || 0;
  const inrValueExclGst = parseFloat((totalValue * mult).toFixed(2));
  return { totalValue, inrValueExclGst };
}

function assertCanModerate(effectiveRole) {
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

async function getExistingOrThrow(forecastId) {
  const existing = await SalesForecastsModel.getSalesForecastById(forecastId);
  if (!existing) {
    const err = new Error('Sales forecast not found');
    err.statusCode = 404;
    throw err;
  }
  return normalizeLegacyWorkflow(existing);
}

function revisionOf(row) {
  const n = Number(row?.revisionNumber);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function toPublicEditRequest(item) {
  if (!item) return null;
  return {
    requestId: item.requestId || item.forecastId,
    quotationId: item.quotationId || '',
    quotationRef: item.quotationRef || '',
    revisionNumber: revisionOf(item),
    employeeCode: item.employeeCode || '',
    employeeName: item.employeeName || '',
    employeeOfficialEmail: item.employeeOfficialEmail || '',
    customerOrganization: item.customerOrganization || '',
    principal: item.principal || '',
    requestType: item.requestType || '',
    oldValues: item.oldValues && typeof item.oldValues === 'object' ? item.oldValues : {},
    requestedValues:
      item.requestedValues && typeof item.requestedValues === 'object' ? item.requestedValues : {},
    status: item.status || 'Pending',
    adminRemark: item.adminRemark || '',
    requestedAt: item.requestedAt || item.createdAt || '',
    reviewedAt: item.reviewedAt || '',
    reviewedBy: item.reviewedBy || '',
    reviewedByEmployeeCode: item.reviewedByEmployeeCode || '',
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || '',
  };
}

function buildOldValues(quotation, requestType) {
  switch (requestType) {
    case 'Price':
      return {
        unitPrice: quotation.unitPrice ?? null,
        quantity: quotation.quantity ?? quotation.qty ?? null,
      };
    case 'Warranty':
      return { warranty: quotation.warranty || '' };
    case 'Decision Expected By':
      return { decisionExpectedBy: quotation.decisionExpectedBy || '' };
    case 'Part Number':
      return {
        principal: quotation.principal || '',
        modelNumber: quotation.modelNumber || quotation.quotedItemModel || '',
        productDescription: quotation.productDescription || quotation.quotedItemDescription || '',
      };
    case 'Probability':
      return {
        probabilityLabel:
          quotation.probabilityLabel ||
          (quotation.probability != null && quotation.probability !== ''
            ? `${quotation.probability}%`
            : ''),
        probabilityPercent:
          quotation.probabilityPercent ??
          (quotation.probability != null && quotation.probability !== ''
            ? Number(quotation.probability)
            : parseProbabilityPercent(quotation.probabilityLabel)),
      };
    default:
      return {};
  }
}

function sanitizeRequestedValues(requestType, bodyValues = {}) {
  const v = bodyValues && typeof bodyValues === 'object' ? bodyValues : {};
  switch (requestType) {
    case 'Price': {
      const unitPrice = v.unitPrice;
      const quantity = v.quantity;
      if (unitPrice === undefined || unitPrice === null || unitPrice === '') {
        const err = new Error('Editable Unit Price is required');
        err.statusCode = 400;
        throw err;
      }
      if (quantity === undefined || quantity === null || quantity === '') {
        const err = new Error('Editable Quantity is required');
        err.statusCode = 400;
        throw err;
      }
      return {
        unitPrice: Number(unitPrice),
        quantity: Number(quantity),
      };
    }
    case 'Warranty': {
      const warranty = String(v.warranty || '').trim();
      if (!warranty) {
        const err = new Error('Editable Warranty is required');
        err.statusCode = 400;
        throw err;
      }
      return { warranty };
    }
    case 'Decision Expected By': {
      const decisionExpectedBy = String(v.decisionExpectedBy || '').trim();
      if (!decisionExpectedBy) {
        const err = new Error('Editable Decision Expected By is required');
        err.statusCode = 400;
        throw err;
      }
      return { decisionExpectedBy };
    }
    case 'Part Number': {
      const principal = String(v.principal || '').trim();
      const modelNumber = String(v.modelNumber || '').trim();
      const productDescription = String(v.productDescription || '').trim();
      if (!principal) {
        const err = new Error('Editable Principal is required');
        err.statusCode = 400;
        throw err;
      }
      if (!modelNumber) {
        const err = new Error('Editable Model Number is required');
        err.statusCode = 400;
        throw err;
      }
      return { principal, modelNumber, productDescription };
    }
    case 'Probability': {
      const probabilityLabel = String(v.probabilityLabel || '').trim();
      if (!probabilityLabel) {
        const err = new Error('Editable Probability % is required');
        err.statusCode = 400;
        throw err;
      }
      return {
        probabilityLabel,
        probabilityPercent: parseProbabilityPercent(probabilityLabel),
      };
    }
    default: {
      const err = new Error('Invalid request type');
      err.statusCode = 400;
      throw err;
    }
  }
}

function buildApplyPatch(existing, requestType, requestedValues, rateMap) {
  const now = new Date().toISOString();
  const patch = { updatedAt: now };
  const audits = [];
  const rev = revisionOf(existing) + 1;
  const old = buildOldValues(existing, requestType);

  const pushAudit = (fieldChanged, oldValue, newValue) => {
    audits.push({
      date: now.slice(0, 10),
      time: now.slice(11, 19),
      timestamp: now,
      fieldChanged,
      oldValue: oldValue == null ? '' : String(oldValue),
      newValue: newValue == null ? '' : String(newValue),
      revision: rev,
    });
  };

  switch (requestType) {
    case 'Price': {
      const unitPrice = Number(requestedValues.unitPrice);
      const quantity = Number(requestedValues.quantity);
      const totals = computeTotals(unitPrice, quantity, existing.currency, rateMap);
      patch.unitPrice = unitPrice;
      patch.quantity = quantity;
      patch.totalValue = totals.totalValue;
      patch.inrValueExclGst = totals.inrValueExclGst;
      pushAudit('unitPrice', old.unitPrice, unitPrice);
      pushAudit('quantity', old.quantity, quantity);
      break;
    }
    case 'Warranty':
      patch.warranty = requestedValues.warranty;
      pushAudit('warranty', old.warranty, requestedValues.warranty);
      break;
    case 'Decision Expected By':
      patch.decisionExpectedBy = requestedValues.decisionExpectedBy;
      pushAudit('decisionExpectedBy', old.decisionExpectedBy, requestedValues.decisionExpectedBy);
      break;
    case 'Part Number':
      patch.principal = requestedValues.principal;
      patch.modelNumber = requestedValues.modelNumber;
      patch.productDescription = requestedValues.productDescription;
      pushAudit('principal', old.principal, requestedValues.principal);
      pushAudit('modelNumber', old.modelNumber, requestedValues.modelNumber);
      pushAudit('productDescription', old.productDescription, requestedValues.productDescription);
      break;
    case 'Probability':
      patch.probabilityLabel = requestedValues.probabilityLabel;
      patch.probabilityPercent = requestedValues.probabilityPercent;
      pushAudit('probabilityLabel', old.probabilityLabel, requestedValues.probabilityLabel);
      break;
    default:
      break;
  }

  patch.revisionNumber = rev;
  return { patch, audits, revisionNumber: rev };
}

export async function listPendingEditRequests(authUser, effectiveRole) {
  assertCanModerate(effectiveRole);
  const rows = await QuotationEditRequestsModel.listPendingEditRequests();
  return rows.map(toPublicEditRequest).filter(Boolean);
}

export async function listEditRequestsForQuotation(forecastId, authUser, effectiveRole) {
  const existing = await getExistingOrThrow(forecastId);
  if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const rows = await QuotationEditRequestsModel.listEditRequestsByQuotationId(forecastId);
  return rows.map(toPublicEditRequest).filter(Boolean);
}

export async function createEditRequest(forecastId, body, authUser, effectiveRole) {
  const existing = await getExistingOrThrow(forecastId);
  if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  if (!isOwnedByUser(existing, authUser)) {
    const err = new Error('Only the quotation owner can request edit permission');
    err.statusCode = 403;
    throw err;
  }

  const ws = existing.workflowStatus || 'draft';
  const lifecycleWs = ws === 'approved' ? 'in_progress' : ws;
  if (lifecycleWs !== 'in_progress') {
    const err = new Error('Edit permission can only be requested while the quotation is In Progress');
    err.statusCode = 400;
    throw err;
  }
  if (!String(existing.quotationRef || '').trim()) {
    const err = new Error('Quotation reference is required before requesting edit permission');
    err.statusCode = 400;
    throw err;
  }

  const requestType = String(body?.requestType || '').trim();
  if (!isValidEditRequestType(requestType)) {
    const err = new Error('Invalid request type');
    err.statusCode = 400;
    throw err;
  }

  const pending = await QuotationEditRequestsModel.findPendingEditRequestForQuotation(forecastId);
  if (pending) {
    const err = new Error('There is already a pending edit request awaiting admin approval.');
    err.statusCode = 409;
    throw err;
  }

  const requestedValues = sanitizeRequestedValues(requestType, body?.requestedValues);
  const oldValues = buildOldValues(existing, requestType);

  let employeeOfficialEmail = '';
  try {
    const emp = await EmployeeMasterModel.getEmployeeByCode(authUser?.employeeCode || '');
    employeeOfficialEmail = String(emp?.officialEmail || '').trim();
  } catch {
    employeeOfficialEmail = '';
  }

  const created = await QuotationEditRequestsModel.createEditRequest({
    quotationId: forecastId,
    quotationRef: existing.quotationRef || '',
    revisionNumber: revisionOf(existing),
    employeeCode: authUser?.employeeCode || existing.ownerEmployeeCode || '',
    employeeName: authUser?.fullName || existing.ownerEmployeeName || '',
    employeeOfficialEmail,
    customerOrganization: existing.customerOrganization || existing.endCustomer || '',
    principal: existing.principal || '',
    requestType,
    oldValues,
    requestedValues,
  });

  const emailPayload = toPublicEditRequest(created);
  try {
    const { subject, text } = buildEditPermissionRequestEmail(emailPayload);
    const emailResult = await sendEmail({
      to: EDIT_REQUEST_ADMIN_EMAIL,
      subject,
      text,
    });
    if (!emailResult.ok) {
      log.error('Edit permission request email failed', {
        requestId: created.requestId,
        error: emailResult.error,
      });
    }
  } catch (err) {
    log.error('Edit permission request email failed', {
      requestId: created.requestId,
      error: err?.message || err,
    });
  }

  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'salesForecasting',
    actionType: 'CREATE',
    targetEntity: 'quotationEditRequest',
    targetId: created.requestId || created.forecastId,
    metadata: {
      action: 'edit_permission_request',
      quotationId: forecastId,
      requestType,
    },
  });

  const publicRequest = toPublicEditRequest(created);
  void SalesNotificationEmitters.emitEditRequestSubmitted(publicRequest, authUser?.employeeCode);

  return publicRequest;
}

export async function approveEditRequest(requestId, authUser, effectiveRole) {
  assertCanModerate(effectiveRole);
  const request = await QuotationEditRequestsModel.getEditRequestById(requestId);
  if (!request) {
    const err = new Error('Edit request not found');
    err.statusCode = 404;
    throw err;
  }
  if (String(request.status || '').trim() !== 'Pending') {
    const err = new Error('This request has already been processed.');
    err.statusCode = 409;
    throw err;
  }

  const quotationId = String(request.quotationId || '').trim();
  const existing = await getExistingOrThrow(quotationId);
  const ws = existing.workflowStatus || 'draft';

  await ensureSalesMasterReady();
  const rateMap = await SalesMasterDataModel.getExchangeRates();
  const { patch, audits, revisionNumber } = buildApplyPatch(
    existing,
    request.requestType,
    request.requestedValues || {},
    rateMap
  );

  // Workflow stays In Progress unless already Closed — do not reopen.
  if (ws !== 'closed' && ws === 'approved') {
    patch.workflowStatus = 'in_progress';
  }

  const priorAudit = Array.isArray(existing.editAuditLog) ? existing.editAuditLog : [];
  const reviewerName = authUser?.fullName || authUser?.employeeCode || '';
  const enrichedAudits = audits.map((a) => ({
    ...a,
    user: reviewerName,
    approvedBy: reviewerName,
  }));
  patch.editAuditLog = [...priorAudit, ...enrichedAudits];

  const updatedQuotation = await SalesForecastsModel.updateSalesForecast(quotationId, patch);

  const now = new Date().toISOString();
  const updatedRequest = await QuotationEditRequestsModel.updateEditRequest(requestId, {
    status: 'Approved',
    reviewedAt: now,
    reviewedBy: reviewerName,
    reviewedByEmployeeCode: authUser?.employeeCode || '',
    revisionNumber,
  });

  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'salesForecasting',
    actionType: 'UPDATE',
    targetEntity: 'quotationEditRequest',
    targetId: requestId,
    metadata: {
      action: 'edit_permission_approve',
      quotationId,
      requestType: request.requestType,
      revisionNumber,
      audits: enrichedAudits,
    },
  });

  const publicRequest = toPublicEditRequest(updatedRequest);
  void SalesNotificationEmitters.emitEditRequestApproved(publicRequest, authUser?.employeeCode);
  void NotificationService.resolveActionRequired({
    moduleName: NOTIFICATION_MODULES.SALES,
    actionKind: ACTION_KINDS.QUOTATION_EDIT_REQUEST,
    actionId: requestId,
    outcome: ACTION_OUTCOMES.COMPLETED,
    title: 'Quotation Edit Request',
    message: `Edit request for ${publicRequest.quotationRef || 'quotation'} was approved.`,
  });

  return {
    request: publicRequest,
    quotationId,
    revisionNumber: revisionOf(updatedQuotation),
  };
}

export async function rejectEditRequest(requestId, body, authUser, effectiveRole) {
  assertCanModerate(effectiveRole);
  const request = await QuotationEditRequestsModel.getEditRequestById(requestId);
  if (!request) {
    const err = new Error('Edit request not found');
    err.statusCode = 404;
    throw err;
  }
  if (String(request.status || '').trim() !== 'Pending') {
    const err = new Error('This request has already been processed.');
    err.statusCode = 409;
    throw err;
  }

  const adminRemark = String(body?.adminRemark || body?.remarks || body?.reason || '').trim();
  if (!adminRemark) {
    const err = new Error('Admin remark is required to reject an edit request');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const reviewerName = authUser?.fullName || authUser?.employeeCode || '';
  const updatedRequest = await QuotationEditRequestsModel.updateEditRequest(requestId, {
    status: 'Rejected',
    adminRemark,
    reviewedAt: now,
    reviewedBy: reviewerName,
    reviewedByEmployeeCode: authUser?.employeeCode || '',
  });

  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'salesForecasting',
    actionType: 'UPDATE',
    targetEntity: 'quotationEditRequest',
    targetId: requestId,
    metadata: {
      action: 'edit_permission_reject',
      quotationId: request.quotationId,
      adminRemark,
    },
  });

  const publicRequest = toPublicEditRequest(updatedRequest);
  void SalesNotificationEmitters.emitEditRequestRejected(
    publicRequest,
    adminRemark,
    authUser?.employeeCode,
  );
  void NotificationService.resolveActionRequired({
    moduleName: NOTIFICATION_MODULES.SALES,
    actionKind: ACTION_KINDS.QUOTATION_EDIT_REQUEST,
    actionId: requestId,
    outcome: ACTION_OUTCOMES.REJECTED,
    title: 'Quotation Edit Request',
    message: `Edit request for ${publicRequest.quotationRef || 'quotation'} was rejected.`,
    remark: adminRemark,
  });

  return publicRequest;
}
