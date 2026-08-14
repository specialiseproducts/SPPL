/**
 * Sales Forecast / Opportunity service — workflow, masters, quotation refs.
 */

import * as SalesForecastsModel from '../models/SalesForecasts.js';
import * as SalesMasterDataModel from '../models/SalesMasterData.js';
import { buildAuditFields } from '../utils/audit.js';
import { canAccessAllRecords, isOwnedByUser } from '../utils/accessControl.js';
import { buildSoftDeleteFields } from '../utils/softDelete.js';
import { logActivity } from '../utils/activityLogger.js';
import { buildQuotationRef, indianFinancialYearLabel } from '../utils/salesQuotationRef.js';
import log from '../utils/logger.js';
import { ensureSalesMasterReady } from '../utils/salesMasterInit.js';
import { sendRejectionNotification } from './salesQuotationNotificationService.js';
import { resolveOwnerCode, sanitizeRejectionReason } from '../utils/salesQuotationEmailUtils.js';
import {
  buildStatusHistoryEntry,
  isIssuedQuotationLocked,
  isTerminalOpportunityStatus,
  workflowShowsQuotationRef,
} from '../utils/salesQuotationLifecycle.js';
import { parsePaginationOptions, toPaginatedResponse } from '../utils/dynamoPagination.js';
import { toSalesOpportunityListDto } from '../utils/listDtos.js';
import { sortSalesForecastsDesc } from '../utils/dynamoSort.js';
import * as SalesNotificationEmitters from './notificationEmitters.js';

const BOOTSTRAP_MASTER_CATEGORIES = [
  'STATUS',
  'PRINCIPAL',
  'CURRENCY',
  'PROBABILITY_OPTION',
  'CUSTOMER_SEGMENT',
  'ENQUIRY_TYPE',
  'DELIVERY_DAYS',
  'WARRANTY',
  'CONTACT_TITLE',
];

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

async function loadRateMap() {
  await ensureSalesMasterReady();
  return SalesMasterDataModel.getExchangeRates();
}

async function fetchAllMastersForBootstrap() {
  const pairs = await Promise.all(
    BOOTSTRAP_MASTER_CATEGORIES.map(async (cat) => {
      const values = await SalesMasterDataModel.listMasterValues(cat, { activeOnly: true });
      return [cat, values];
    })
  );
  return Object.fromEntries(pairs);
}

async function listOpportunitiesInternal(authUser, effectiveRole, pagination = {}) {
  const isAll = !authUser || canAccessAllRecords(effectiveRole);
  const ownerCode = String(authUser?.employeeCode || '').trim();

  let rows;
  let lastEvaluatedKey = null;

  if (pagination.paginated) {
    const page = isAll
      ? await SalesForecastsModel.queryAllSalesForecastsPage(pagination)
      : await SalesForecastsModel.querySalesForecastsByOwnerPage(ownerCode, pagination);
    rows = page.items;
    lastEvaluatedKey = page.lastEvaluatedKey;
  } else {
    rows = isAll
      ? await SalesForecastsModel.queryAllSalesForecasts()
      : await SalesForecastsModel.querySalesForecastsByOwner(ownerCode);
  }

  const sortedRows = sortSalesForecastsDesc(rows);
  const normalized = sortedRows
    .map((r) => toSalesOpportunityListDto(r, normalizeLegacyWorkflow))
    .filter(Boolean);

  if (pagination.paginated) {
    return toPaginatedResponse(normalized, lastEvaluatedKey);
  }
  return normalized;
}

export const getBootstrap = async (_authUser, _effectiveRole) => {
  await ensureSalesMasterReady();

  const [masters, rates] = await Promise.all([
    fetchAllMastersForBootstrap(),
    SalesMasterDataModel.getExchangeRates(),
  ]);

  return { masters, rates };
};

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

function isQuotationLocked(row) {
  return isIssuedQuotationLocked(row?.workflowStatus || 'draft', row?.quotationRef);
}

export function toPublicOpportunity(item) {
  if (!item) return null;
  const row = normalizeLegacyWorkflow(item);
  const ws = row.workflowStatus || 'draft';
  const showRef = workflowShowsQuotationRef(ws) && String(row.quotationRef || '').trim() !== '';
  const statusHistory = Array.isArray(row.statusHistory) ? row.statusHistory : [];
  return {
    forecastId: row.forecastId,
    workflowStatus: ws,
    quotationRef: showRef ? String(row.quotationRef || '').trim() : '',
    quotationFy: showRef ? row.quotationFy || '' : '',
    quotationSerial: showRef ? row.quotationSerial ?? null : null,
    quotationMiddle: showRef ? row.quotationMiddle || '' : '',
    principalShortCode: showRef ? row.principalShortCode || '' : '',
    technicalSalesPerson: row.technicalSalesPerson || row.ownerEmployeeName || '',
    quotationDate: row.quotationDate || '',
    decisionExpectedBy: row.decisionExpectedBy || '',
    opportunityStatus: row.opportunityStatus || '',
    lastStatusUpdatedAt: row.lastStatusUpdatedAt || '',
    statusHistory,
    revisionNumber:
      row.revisionNumber != null && Number.isFinite(Number(row.revisionNumber))
        ? Math.max(0, Math.floor(Number(row.revisionNumber)))
        : 0,
    editAuditLog: Array.isArray(row.editAuditLog) ? row.editAuditLog : [],
    customerOrganization: row.customerOrganization || row.endCustomer || '',
    contactPersonDetails: row.contactPersonDetails || '',
    contactTitle: row.contactTitle || '',
    contactFullName: row.contactFullName || '',
    contactAddress: row.contactAddress || '',
    contactNumber: row.contactNumber || '',
    contactEmail: row.contactEmail || '',
    customerSegment: row.customerSegment || '',
    enquiryType: row.enquiryType || '',
    applicationDetails: row.applicationDetails || '',
    technicalSpecifications: row.technicalSpecifications || '',
    competition: row.competition || '',
    principal: row.principal || '',
    modelNumber: row.modelNumber || row.quotedItemModel || '',
    productDescription: row.productDescription || row.quotedItemDescription || '',
    currency: row.currency || '',
    unitPrice: row.unitPrice ?? null,
    quantity: row.quantity ?? row.qty ?? null,
    totalValue: row.totalValue != null ? row.totalValue : row.totalPrice != null ? row.totalPrice : null,
    inrValueExclGst: row.inrValueExclGst != null ? row.inrValueExclGst : row.conversionToINR != null ? row.conversionToINR : null,
    deliveryDays: row.deliveryDays ?? '',
    warranty: row.warranty || '',
    probabilityLabel:
      row.probabilityLabel ||
      (row.probability != null && row.probability !== '' ? `${row.probability}%` : ''),
    probabilityPercent:
      row.probabilityPercent ??
      (row.probability != null && row.probability !== '' ? Number(row.probability) : parseProbabilityPercent(row.probabilityLabel)),
    technicalChallenges: row.technicalChallenges || '',
    keyDecisionCriteria: row.keyDecisionCriteria || '',
    followUpActionsRequired: row.followUpActionsRequired || '',
    remarks: row.remarks || '',
    ownerEmployeeCode: row.ownerEmployeeCode || row.created_by_employee_code || '',
    ownerEmployeeName: row.ownerEmployeeName || row.employeeName || row.created_by_name || '',
    createdByEmployeeCode: row.created_by_employee_code || '',
    createdByName: row.created_by_name || '',
    approval_status: row.approval_status || '',
    approved_by: row.approved_by || '',
    approved_at: row.approved_at || '',
    rejected_by: row.rejected_by || '',
    rejected_at: row.rejected_at || '',
    approval_comments: row.approval_comments || '',
    createdAt: row.createdAt || row.created_at || '',
    updatedAt: row.updatedAt || row.updated_at || '',
  };
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

export const listOpportunities = async (authUser, effectiveRole, options = {}) => {
  await ensureSalesMasterReady();
  const pagination = parsePaginationOptions({
    limit: options.limit ?? options.Limit,
    cursor: options.cursor ?? options.nextCursor,
  });
  if (!pagination.limit) {
    pagination.limit = 50;
    pagination.paginated = true;
  }
  return listOpportunitiesInternal(authUser, effectiveRole, pagination);
};

export const getOpportunity = async (forecastId, authUser, effectiveRole) => {
  const row = await getExistingOrThrow(forecastId);
  if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(row, authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return toPublicOpportunity(row);
};

const BODY_BLOCKLIST = new Set([
  'mode',
  'forecastId',
  'nextActionDate',
  'workflowStatus',
  'quotationRef',
  'quotationFy',
  'quotationSerial',
  'quotationMiddle',
  'principalShortCode',
  'ownerEmployeeCode',
  'ownerEmployeeName',
  'technicalSalesPerson',
  'contactPersonDetails',
  'lastStatusUpdatedAt',
  'statusHistory',
  'revisionNumber',
  'editAuditLog',
]);

function sanitizeOpportunityBody(body = {}) {
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (BODY_BLOCKLIST.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function mergeOpportunityFields(existing, body, rateMap) {
  const safeBody = sanitizeOpportunityBody(body);
  const next = { ...existing, ...safeBody };
  const unitPrice = next.unitPrice !== undefined ? next.unitPrice : existing.unitPrice;
  const quantity = next.quantity !== undefined ? next.quantity : existing.quantity;
  const currency = next.currency !== undefined ? next.currency : existing.currency;
  const totals = computeTotals(unitPrice, quantity, currency, rateMap);
  next.unitPrice = unitPrice != null && unitPrice !== '' ? Number(unitPrice) : null;
  next.quantity = quantity != null && quantity !== '' ? Number(quantity) : null;
  next.totalValue = totals.totalValue;
  next.inrValueExclGst = totals.inrValueExclGst;
  const pl = next.probabilityLabel != null ? next.probabilityLabel : existing.probabilityLabel;
  next.probabilityPercent = parseProbabilityPercent(pl);
  return next;
}

function workflowToApprovalStatus(ws) {
  if (ws === 'approved' || ws === 'in_progress' || ws === 'closed') return 'Approved';
  if (ws === 'rejected') return 'Rejected';
  if (ws === 'pending_approval') return 'Pending';
  return 'Pending';
}

export const createOpportunity = async (body, authUser, effectiveRole) => {
  await ensureSalesMasterReady();
  const rateMap = await loadRateMap();

  const mode = String(body.mode || 'draft').toLowerCase() === 'submit' ? 'submit' : 'draft';
  const audit = authUser ? buildAuditFields(authUser) : {};
  const ownerEmployeeCode = String(
    canAccessAllRecords(effectiveRole) && body.ownerEmployeeCode
      ? body.ownerEmployeeCode
      : audit.created_by_employee_code || authUser?.employeeCode || ''
  ).trim();
  const ownerEmployeeName = String(
    canAccessAllRecords(effectiveRole) && body.ownerEmployeeName
      ? body.ownerEmployeeName
      : authUser?.fullName ||
          `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim() ||
          ''
  ).trim();

  const forecastId = SalesForecastsModel.buildNewForecastId();
  const ts = new Date().toISOString();

  let workflowStatus = 'draft';

  const base = {
    forecastId,
    ...audit,
    ownerEmployeeCode,
    ownerEmployeeName,
    employeeName: ownerEmployeeName,
    createdAt: ts,
    updatedAt: ts,
    is_deleted: false,
    revisionNumber: 0,
    editAuditLog: [],
    principalShortCode: '',
    technicalSalesPerson: ownerEmployeeName,
    quotationDate: body.quotationDate ?? '',
    decisionExpectedBy: body.decisionExpectedBy ?? '',
    opportunityStatus: body.opportunityStatus ?? '',
    customerOrganization: body.customerOrganization ?? '',
    contactPersonDetails: '',
    contactTitle: body.contactTitle ?? '',
    contactFullName: body.contactFullName ?? '',
    contactAddress: body.contactAddress ?? '',
    contactNumber: body.contactNumber ?? '',
    contactEmail: body.contactEmail ?? '',
    customerSegment: body.customerSegment ?? '',
    enquiryType: body.enquiryType ?? '',
    applicationDetails: body.applicationDetails ?? '',
    technicalSpecifications: body.technicalSpecifications ?? '',
    competition: body.competition ?? '',
    principal: body.principal ?? '',
    modelNumber: body.modelNumber ?? '',
    productDescription: body.productDescription ?? '',
    currency: body.currency ?? '',
    unitPrice: body.unitPrice ?? null,
    quantity: body.quantity ?? null,
    deliveryDays: body.deliveryDays != null ? String(body.deliveryDays) : '',
    warranty: body.warranty ?? '',
    probabilityLabel: body.probabilityLabel ?? '',
    technicalChallenges: body.technicalChallenges ?? '',
    keyDecisionCriteria: body.keyDecisionCriteria ?? '',
    followUpActionsRequired: body.followUpActionsRequired ?? '',
    remarks: body.remarks ?? '',
    approval_status: 'Pending',
    approved_by: '',
    approved_at: '',
    rejected_by: '',
    rejected_at: '',
    approval_comments: '',
    workflowStatus: 'draft',
  };

  const merged = mergeOpportunityFields(base, body, rateMap);

  if (mode === 'submit') {
    workflowStatus = 'pending_approval';
    merged.workflowStatus = workflowStatus;
    merged.quotationRef = '';
    merged.quotationFy = '';
    merged.quotationSerial = null;
    merged.quotationMiddle = '';
    merged.principalShortCode = '';
  }

  const item = {
    ...merged,
    approval_status: workflowToApprovalStatus(merged.workflowStatus || workflowStatus),
  };

  log.info('Creating opportunity', forecastId, mode);
  await SalesForecastsModel.createSalesForecast(item);

  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'salesForecasting',
    actionType: 'CREATE',
    targetEntity: 'salesForecast',
    targetId: forecastId,
    metadata: { mode },
  });

  return toPublicOpportunity(item);
};

export const updateOpportunity = async (forecastId, body, authUser, effectiveRole) => {
  await ensureSalesMasterReady();
  const existing = await getExistingOrThrow(forecastId);
  if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  const ws = existing.workflowStatus || 'draft';
  if (isQuotationLocked(existing)) {
    const err = new Error('Approved quotations cannot be edited');
    err.statusCode = 403;
    throw err;
  }
  if (!canAccessAllRecords(effectiveRole)) {
    if (ws === 'pending_approval') {
      const err = new Error('Cannot edit while pending approval');
      err.statusCode = 403;
      throw err;
    }
  }

  const rateMap = await loadRateMap();
  const merged = mergeOpportunityFields(existing, body, rateMap);
  if (canAccessAllRecords(effectiveRole)) {
    if (body.ownerEmployeeCode != null) {
      merged.ownerEmployeeCode = String(body.ownerEmployeeCode || '').trim();
    }
    if (body.ownerEmployeeName != null) {
      merged.ownerEmployeeName = String(body.ownerEmployeeName || '').trim();
      merged.employeeName = merged.ownerEmployeeName;
      merged.technicalSalesPerson = merged.ownerEmployeeName;
    }
  }

  const patch = {
    ...merged,
    forecastId,
    updatedAt: new Date().toISOString(),
    approval_status: workflowToApprovalStatus(merged.workflowStatus || ws),
  };

  delete patch.forecastId;

  log.info('Updating opportunity', forecastId);
  const updated = await SalesForecastsModel.updateSalesForecast(forecastId, patch);

  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'salesForecasting',
    actionType: 'UPDATE',
    targetEntity: 'salesForecast',
    targetId: forecastId,
  });

  return toPublicOpportunity(updated);
};

export const submitOpportunity = async (forecastId, authUser, effectiveRole) => {
  await ensureSalesMasterReady();
  const existing = await getExistingOrThrow(forecastId);
  if (authUser && !isOwnedByUser(existing, authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const ws = existing.workflowStatus || 'draft';
  if (ws !== 'draft' && ws !== 'rejected') {
    const err = new Error('Only draft or rejected opportunities can be submitted');
    err.statusCode = 400;
    throw err;
  }

  const rateMap = await loadRateMap();
  const merged = mergeOpportunityFields(existing, {}, rateMap);
  const patch = {
    ...merged,
    workflowStatus: 'pending_approval',
    quotationRef: '',
    quotationFy: '',
    quotationSerial: null,
    quotationMiddle: '',
    principalShortCode: '',
    approval_status: 'Pending',
    rejected_by: '',
    rejected_at: '',
    approval_comments: '',
    updatedAt: new Date().toISOString(),
  };
  delete patch.forecastId;

  const updated = await SalesForecastsModel.updateSalesForecast(forecastId, patch);

  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'salesForecasting',
    actionType: 'UPDATE',
    targetEntity: 'salesForecast',
    targetId: forecastId,
    metadata: { action: 'submit' },
  });

  void SalesNotificationEmitters.emitQuotationSubmitted(updated, authUser?.employeeCode);

  return toPublicOpportunity(updated);
};

export const approveOpportunity = async (forecastId, authUser, effectiveRole) => {
  assertCanModerate(effectiveRole);
  await ensureSalesMasterReady();
  const existing = await getExistingOrThrow(forecastId);
  if ((existing.workflowStatus || '') !== 'pending_approval') {
    const err = new Error('Only pending quotations can be approved');
    err.statusCode = 400;
    throw err;
  }

  const principal = String(existing.principal || '').trim();
  let shortCode = await SalesMasterDataModel.getPrincipalShortCode(principal);
  if (!shortCode) {
    shortCode = 'UNK';
  }

  const fySource = existing.quotationDate ? new Date(existing.quotationDate) : new Date();
  const fy = indianFinancialYearLabel(fySource);
  const serial = await SalesMasterDataModel.incrementQuotationSerial(fy);
  const quotationRef = buildQuotationRef(fy, shortCode, serial);

  const now = new Date().toISOString();
  const currentStatus = String(existing.opportunityStatus || '').trim();
  const historyEntry = buildStatusHistoryEntry({
    previousStatus: currentStatus,
    newStatus: currentStatus,
    updatedByEmployeeCode: authUser?.employeeCode || '',
    updatedByName: authUser?.fullName || authUser?.employeeCode || '',
    remarks: 'Quotation approved — lifecycle started',
    updatedAt: now,
  });
  const priorHistory = Array.isArray(existing.statusHistory) ? existing.statusHistory : [];

  const patch = {
    workflowStatus: 'in_progress',
    quotationRef,
    quotationFy: fy,
    quotationSerial: serial,
    quotationMiddle: shortCode,
    principalShortCode: shortCode,
    approval_status: 'Approved',
    approved_by: authUser?.fullName || authUser?.employeeCode || '',
    approved_at: now,
    rejected_by: '',
    rejected_at: '',
    lastStatusUpdatedAt: now,
    statusHistory: [...priorHistory, historyEntry],
    updatedAt: now,
  };

  const updated = await SalesForecastsModel.updateSalesForecast(forecastId, patch);

  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'salesForecasting',
    actionType: 'UPDATE',
    targetEntity: 'salesForecast',
    targetId: forecastId,
    oldValue: { workflowStatus: existing.workflowStatus, quotationRef: existing.quotationRef || '' },
    newValue: { workflowStatus: 'in_progress', quotationRef },
    metadata: {
      action: 'approve',
      workflowStatus: 'in_progress',
      description: 'Quotation Approved',
      quotationRef,
      reference: quotationRef,
      ownerEmployeeCode: existing.ownerEmployeeCode || '',
    },
  });

  void SalesNotificationEmitters.emitQuotationApproved(updated, authUser?.employeeCode);

  return toPublicOpportunity(updated);
};

/**
 * Owner progress check-in / status change for In Progress quotations.
 * Body: { keepCurrent: true } | { keepCurrent: false, opportunityStatus, remarks? }
 */
export const updateOpportunityStatusProgress = async (forecastId, body, authUser, effectiveRole) => {
  const existing = await getExistingOrThrow(forecastId);
  if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  if (!isOwnedByUser(existing, authUser)) {
    const err = new Error('Only the quotation owner can update progress status');
    err.statusCode = 403;
    throw err;
  }

  const ws = existing.workflowStatus || 'draft';
  const lifecycleWs = ws === 'approved' ? 'in_progress' : ws;
  if (lifecycleWs !== 'in_progress') {
    const err = new Error('Status can only be updated while the quotation is In Progress');
    err.statusCode = 400;
    throw err;
  }
  if (!String(existing.quotationRef || '').trim()) {
    const err = new Error('Quotation reference is required before updating status');
    err.statusCode = 400;
    throw err;
  }

  const keepCurrent = body?.keepCurrent === true || body?.keepCurrent === 'true';
  const previousStatus = String(existing.opportunityStatus || '').trim();
  let newStatus = previousStatus;

  if (!keepCurrent) {
    newStatus = String(body?.opportunityStatus || '').trim();
    if (!newStatus) {
      const err = new Error('opportunityStatus is required when changing status');
      err.statusCode = 400;
      throw err;
    }
  }

  const now = new Date().toISOString();
  const historyEntry = buildStatusHistoryEntry({
    previousStatus,
    newStatus,
    updatedByEmployeeCode: authUser?.employeeCode || '',
    updatedByName: authUser?.fullName || authUser?.employeeCode || '',
    remarks: String(body?.remarks || '').trim(),
    updatedAt: now,
  });
  const priorHistory = Array.isArray(existing.statusHistory) ? existing.statusHistory : [];

  const patch = {
    opportunityStatus: newStatus,
    lastStatusUpdatedAt: now,
    statusHistory: [...priorHistory, historyEntry],
    updatedAt: now,
  };

  // Migrate legacy approved → in_progress on first status touch if needed.
  if (ws === 'approved') {
    patch.workflowStatus = 'in_progress';
  }

  if (isTerminalOpportunityStatus(newStatus)) {
    patch.workflowStatus = 'closed';
  }

  const updated = await SalesForecastsModel.updateSalesForecast(forecastId, patch);

  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'salesForecasting',
    actionType: 'UPDATE',
    targetEntity: 'salesForecast',
    targetId: forecastId,
    metadata: {
      action: 'status_progress',
      keepCurrent,
      previousStatus,
      newStatus,
      workflowStatus: updated?.workflowStatus,
    },
  });

  if (updated?.workflowStatus === 'closed' && (existing.workflowStatus || '') !== 'closed') {
    void SalesNotificationEmitters.emitQuotationClosed(updated, authUser?.employeeCode);
  }

  return toPublicOpportunity(updated);
};

export const rejectOpportunity = async (forecastId, body, authUser, effectiveRole) => {
  assertCanModerate(effectiveRole);
  const existing = await getExistingOrThrow(forecastId);
  if ((existing.workflowStatus || '') !== 'pending_approval') {
    const err = new Error('Only pending quotations can be rejected');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const patch = {
    workflowStatus: 'rejected',
    quotationRef: '',
    quotationFy: '',
    quotationSerial: null,
    quotationMiddle: '',
    principalShortCode: '',
    approval_status: 'Rejected',
    rejected_by: authUser?.fullName || authUser?.employeeCode || '',
    rejected_at: now,
    approval_comments: sanitizeRejectionReason(String(body?.remarks || body?.reason || '')),
    updatedAt: now,
  };

  const updated = await SalesForecastsModel.updateSalesForecast(forecastId, patch);

  const rejectionReason = patch.approval_comments;
  const ownerCode = resolveOwnerCode(updated);
  log.info('Reject email triggered', { forecastId, ownerCode, reason: rejectionReason });

  try {
    const emailResult = await sendRejectionNotification(updated, rejectionReason);
    if (emailResult.ok) {
      log.info('Reject email success', { forecastId });
    } else {
      log.error('Reject email failed', {
        forecastId,
        error: emailResult.error,
        skipped: emailResult.skipped || false,
      });
    }
  } catch (err) {
    log.error('Reject email failed', {
      forecastId,
      error: err?.message || err,
      stack: err?.stack,
    });
  }

  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'salesForecasting',
    actionType: 'UPDATE',
    targetEntity: 'salesForecast',
    targetId: forecastId,
    metadata: { action: 'reject' },
  });

  void SalesNotificationEmitters.emitQuotationRejected(
    updated,
    rejectionReason,
    authUser?.employeeCode,
  );

  return toPublicOpportunity(updated);
};

export const deleteOpportunity = async (forecastId, authUser, effectiveRole) => {
  const existing = await getExistingOrThrow(forecastId);
  if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  const ws = existing.workflowStatus || 'draft';
  if (!canAccessAllRecords(effectiveRole) && ws === 'pending_approval') {
    const err = new Error('Cannot delete while pending approval');
    err.statusCode = 403;
    throw err;
  }

  const deleted = await SalesForecastsModel.updateSalesForecast(
    forecastId,
    buildSoftDeleteFields(authUser)
  );

  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'salesForecasting',
    actionType: 'DELETE',
    targetEntity: 'salesForecast',
    targetId: forecastId,
  });

  return toPublicOpportunity(deleted);
};

export const listMasterCategory = async (category) => {
  await ensureSalesMasterReady();
  const cat = String(category || '').trim().toUpperCase();
  if (cat === 'EXCHANGE_RATE' || cat === 'RATES') {
    return SalesMasterDataModel.getExchangeRates();
  }
  return SalesMasterDataModel.listMasterValues(cat, { activeOnly: true });
};

export const ensureMasterCategoryValue = async (category, value, effectiveRole) => {
  assertCanModerate(effectiveRole);
  await ensureSalesMasterReady();
  const cat = String(category || '').trim().toUpperCase();
  const v = await SalesMasterDataModel.ensureMasterValue(cat, value);
  return { value: v };
};

export const listMasterAdminCategory = async (category, effectiveRole) => {
  assertCanModerate(effectiveRole);
  await ensureSalesMasterReady();
  const cat = String(category || '').trim().toUpperCase();
  if (cat === 'PRINCIPAL_MAP' || cat === 'PRINCIPALS') {
    return { principals: await SalesMasterDataModel.listPrincipalMapAdmin() };
  }
  if (cat === 'ORGANIZATION_MAP' || cat === 'ORGANIZATIONS') {
    return { organizations: await SalesMasterDataModel.listOrganizationMapAdmin() };
  }
  return { items: await SalesMasterDataModel.listSimpleMasterAdmin(cat) };
};

export const adminAddMasterListItem = async (category, value, effectiveRole) => {
  assertCanModerate(effectiveRole);
  await ensureSalesMasterReady();
  const cat = String(category || '').trim().toUpperCase();
  return SalesMasterDataModel.upsertSimpleMasterItem(cat, value, { isActive: true });
};

export const adminUpdateMasterListItem = async (category, sk, body, effectiveRole) => {
  assertCanModerate(effectiveRole);
  await ensureSalesMasterReady();
  const cat = String(category || '').trim().toUpperCase();
  return SalesMasterDataModel.updateSimpleMasterItem(cat, sk, body || {});
};

export const adminUpsertPrincipalMap = async (body, effectiveRole) => {
  assertCanModerate(effectiveRole);
  await ensureSalesMasterReady();
  return SalesMasterDataModel.upsertPrincipalMapEntry(body || {});
};

export const listPrincipalModels = async (principalId, opts = {}) => {
  if (!String(principalId || '').trim()) {
    const err = new Error('principalId query parameter is required');
    err.statusCode = 400;
    throw err;
  }
  await ensureSalesMasterReady();
  const models = await SalesMasterDataModel.listPrincipalModels(principalId, opts);
  return { models };
};

export const listPrincipalModelsAdmin = async (principalId, effectiveRole) => {
  assertCanModerate(effectiveRole);
  if (!String(principalId || '').trim()) {
    const err = new Error('principalId query parameter is required');
    err.statusCode = 400;
    throw err;
  }
  await ensureSalesMasterReady();
  const models = await SalesMasterDataModel.listPrincipalModels(principalId, { activeOnly: false });
  return { models };
};

export const adminUpsertPrincipalModel = async (body, effectiveRole) => {
  assertCanModerate(effectiveRole);
  await ensureSalesMasterReady();
  const row = await SalesMasterDataModel.upsertPrincipalModel(body || {});
  return row;
};

export const adminUpsertOrganizationMap = async (body, effectiveRole) => {
  assertCanModerate(effectiveRole);
  await ensureSalesMasterReady();
  return SalesMasterDataModel.upsertOrganizationMapEntry(body || {});
};

export const listOrganizationParts = async (organizationId, opts = {}) => {
  if (!String(organizationId || '').trim()) {
    const err = new Error('organizationId query parameter is required');
    err.statusCode = 400;
    throw err;
  }
  await ensureSalesMasterReady();
  const parts = await SalesMasterDataModel.listOrganizationParts(organizationId, opts);
  return { parts };
};

export const listOrganizationPartsAdmin = async (organizationId, effectiveRole) => {
  assertCanModerate(effectiveRole);
  if (!String(organizationId || '').trim()) {
    const err = new Error('organizationId query parameter is required');
    err.statusCode = 400;
    throw err;
  }
  await ensureSalesMasterReady();
  const parts = await SalesMasterDataModel.listOrganizationParts(organizationId, {
    activeOnly: false,
  });
  return { parts };
};

export const adminUpsertOrganizationPart = async (body, effectiveRole) => {
  assertCanModerate(effectiveRole);
  await ensureSalesMasterReady();
  const row = await SalesMasterDataModel.upsertOrganizationPart(body || {});
  return row;
};

export const getExchangeRatesForSales = async () => {
  await ensureSalesMasterReady();
  return SalesMasterDataModel.getExchangeRates();
};

export const saveExchangeRatesForSales = async (rates, effectiveRole) => {
  assertCanModerate(effectiveRole);
  await ensureSalesMasterReady();
  return SalesMasterDataModel.putExchangeRates(rates);
};
