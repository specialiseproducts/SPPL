/**
 * Expense Service
 * 
 * Business logic layer for expense management operations.
 * Handles expense CRUD operations and business rules.
 */

import * as ExpenseModel from '../models/Expenses.js';
import * as ExpenseDocumentsModel from '../models/ExpenseDocuments.js';
import * as EmployeeModel from '../models/EmployeeMaster.js';
import {
  isCanonicalExpenseHead,
  validateSubCategoryForHead,
  EXPENSE_SUBCATEGORY_MAP,
} from '../constants/expenseSubCategories.js';
import { buildAuditFields } from '../utils/audit.js';
import {
  canAccessAllExpenseRecords,
  isAdmin,
  isDeveloper,
  isOwnedByUser,
} from '../utils/accessControl.js';
import { withApprovalDefaults } from '../utils/approval.js';
import { buildSoftDeleteFields } from '../utils/softDelete.js';
import { logActivity } from '../utils/activityLogger.js';
import { DEFAULT_QUERY_LIMIT, parsePaginationOptions, toPaginatedResponse } from '../utils/dynamoPagination.js';
import { toExpenseListDto } from '../utils/listDtos.js';
import { sortExpensesDesc } from '../utils/dynamoSort.js';
import {
  validateExpenseBusinessRules,
  isTravelCarOrBike,
  isHotelBookingSelf,
} from '../utils/expenseValidation.js';
import { computeTravelCarBikeRupeeAmount } from '../utils/expenseTravelAmount.js';
import * as ExpenseTravelRateSettingsService from './expenseTravelRateSettings.service.js';
import { resolveLocationFieldsFromRow } from '../utils/expenseLocationFields.js';
import { EXPENSE_LEGACY_COMBINED_LOCATION_ATTR } from '../constants/expenseLegacy.js';
import log from '../utils/logger.js';

const SUB_OR_HEAD_KEYS = ['expenseHead', 'subCategory'];
const OTHER_FORM_FIELDS = [
  'location',
  'purpose',
  'serviceProvider',
  'billNumber',
  'date',
  'monthYear',
  'fromLocation',
  'toLocation',
  'returnType',
  'kilometers',
  'stayDateFrom',
  'stayDateTo',
  'fuelType',
  'supportingDocument',
];

function trimText(v) {
  if (v === undefined || v === null) {
    return '';
  }
  return String(v).trim();
}

function normalizeSupportingDocumentLabel(value, hasFile) {
  const t = trimText(value).toLowerCase();
  if (t === 'yes') return 'Yes';
  if (t === 'no') return 'No';
  if (hasFile) return 'Yes';
  return 'No';
}

/** Admin/Developer audit roles may view any expense for detail/document preview. */
function canViewExpenseForAudit(effectiveRole) {
  return isAdmin(effectiveRole) || isDeveloper(effectiveRole);
}

function enrichExpenseRow(row) {
  if (!row || typeof row !== 'object') {
    return row;
  }
  const { location, purpose } = resolveLocationFieldsFromRow(row);
  return { ...row, location, purpose };
}

function rowHasInlineDocumentUrl(row) {
  return (
    Array.isArray(row?.documents) &&
    row.documents.some((d) => d && String(d.fileUrl || '').trim() !== '')
  );
}

/** Legacy rows may store files only on ExpenseDocuments; hydrate inline for list DTO. */
async function attachDocumentsForListRows(rows) {
  return Promise.all(
    (rows || []).map(async (row) => {
      if (!row || rowHasInlineDocumentUrl(row)) {
        return row;
      }
      const sd = String(row.supportingDocument || '').trim().toLowerCase();
      if (sd !== 'yes') {
        return row;
      }
      try {
        const docs = await ExpenseDocumentsModel.getDocumentsByExpenseId(row.expenseId);
        const first = (docs || []).find((d) => d && String(d.fileUrl || '').trim() !== '');
        if (!first) {
          return row;
        }
        return {
          ...row,
          documents: [{ fileName: first.fileName || 'document', fileUrl: first.fileUrl }],
        };
      } catch (err) {
        log.warn('attachDocumentsForListRows failed', {
          expenseId: row.expenseId,
          message: err?.message || err,
        });
        return row;
      }
    })
  );
}

function validateMergedSubCategoryOnUpdate(merged, updateData) {
  if (!isCanonicalExpenseHead(merged.expenseHead)) {
    return;
  }
  const sub = merged.subCategory != null ? String(merged.subCategory).trim() : '';
  if (sub) {
    if (!EXPENSE_SUBCATEGORY_MAP[merged.expenseHead].includes(sub)) {
      throw new Error('subCategory does not match expense head');
    }
    return;
  }
  const headOrSubTouched = SUB_OR_HEAD_KEYS.some((k) =>
    Object.prototype.hasOwnProperty.call(updateData, k)
  );
  if (headOrSubTouched) {
    throw new Error('subCategory is required');
  }
  const otherFormTouched = OTHER_FORM_FIELDS.some((k) =>
    Object.prototype.hasOwnProperty.call(updateData, k)
  );
  if (otherFormTouched) {
    throw new Error('subCategory is required');
  }
}

/**
 * Get expense by ID
 * @param {string} expenseId - Expense ID
 * @returns {Promise<Object>} Expense record with documents
 */
export const getExpenseById = async (expenseId, authUser = null, effectiveRole = 'User') => {
  try {
    if (!expenseId) {
      throw new Error('expenseId is required');
    }

    log.info('Getting expense:', expenseId);
    const expense = await ExpenseModel.getExpenseById(expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }

    const canonicalExpenseId = expense.expenseId;

    if (
      authUser &&
      !canAccessAllExpenseRecords(effectiveRole) &&
      !canViewExpenseForAudit(effectiveRole) &&
      !isOwnedByUser(expense, authUser)
    ) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    const documentsFromTable = await ExpenseDocumentsModel.getDocumentsByExpenseId(canonicalExpenseId);
    const inlineDocuments = Array.isArray(expense.documents) ? expense.documents : [];
    const documents = inlineDocuments.length > 0 ? inlineDocuments : documentsFromTable;
    return enrichExpenseRow({
      ...expense,
      documents,
    });
  } catch (error) {
    log.error('Error getting expense:', error);
    throw error;
  }
};

/**
 * Full expense + documents for Audit Eye view (read-only).
 * @returns {Promise<{ expense: Object, documents: Array }>}
 */
export const getExpenseFullDetails = async (expenseId, authUser = null, effectiveRole = 'User') => {
  if (!expenseId) {
    throw new Error('expenseId is required');
  }

  const expense = await ExpenseModel.getExpenseById(expenseId);
  if (!expense) {
    const err = new Error('Expense not found');
    err.statusCode = 404;
    throw err;
  }

  const canonicalExpenseId = expense.expenseId;

  if (
    authUser &&
    !canAccessAllExpenseRecords(effectiveRole) &&
    !canViewExpenseForAudit(effectiveRole) &&
    !isOwnedByUser(expense, authUser)
  ) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  const documentsFromTable = await ExpenseDocumentsModel.getDocumentsByExpenseId(canonicalExpenseId);
  const inlineDocuments = Array.isArray(expense.documents) ? expense.documents : [];
  const documentSource = inlineDocuments.length > 0 ? inlineDocuments : documentsFromTable;
  const documents = (documentSource || [])
    .filter((row) => row && String(row.fileUrl || '').trim() !== '')
    .map((row) => ({
      documentId: row.documentId || '',
      fileName: row.fileName || 'document',
      fileUrl: String(row.fileUrl).trim(),
    }));

  return {
    expense: enrichExpenseRow({ ...expense }),
    documents,
  };
};

/**
 * Get expenses with filters
 * @param {Object} filters - Filter criteria
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} List of expenses
 */
export const getExpenses = async (filters = {}, options = {}, authUser = null, effectiveRole = 'User') => {
  try {
    log.info('Getting expenses with filters:', filters);
    const isAll = !authUser || canAccessAllExpenseRecords(effectiveRole);
    const pagination = parsePaginationOptions({
      limit: options.limit ?? DEFAULT_QUERY_LIMIT,
      cursor: options.cursor ?? options.nextCursor,
    });

    let rows;
    let lastEvaluatedKey = null;

    if (isAll) {
      const result = await ExpenseModel.getAllExpenses(filters, pagination);
      if (result && typeof result === 'object' && Array.isArray(result.items)) {
        rows = result.items;
        lastEvaluatedKey = result.lastEvaluatedKey;
      } else {
        rows = result;
      }
    } else {
      const code = String(authUser.employeeCode || '').trim();
      const page = await ExpenseModel.queryExpensesByEmployeeCodePage(code, pagination);
      rows = page.items;
      lastEvaluatedKey = page.lastEvaluatedKey;
    }

    const withDocuments = options.skipDocumentHydration
      ? rows
      : await attachDocumentsForListRows(rows);
    const mapped = sortExpensesDesc(
      withDocuments.map((row) => toExpenseListDto(row, enrichExpenseRow))
    );

    return toPaginatedResponse(mapped, lastEvaluatedKey);
  } catch (error) {
    log.error('Error getting expenses:', error);
    throw error;
  }
};

/**
 * Create new expense
 * @param {Object} expenseData - Expense data
 * @param {string} userId - User ID creating the expense (for audit)
 * @returns {Promise<Object>} Created expense record
 */
export const createExpense = async (expenseData, documents = [], authUser = null) => {
  try {
    if (!authUser?.employeeCode) {
      const err = new Error('Unauthorized');
      err.statusCode = 401;
      throw err;
    }

    const raw = expenseData && typeof expenseData === 'object' ? expenseData : {};

    const expenseHead = trimText(raw.expenseHead);
    const subCategory = trimText(raw.subCategory);
    const serviceProvider = trimText(raw.serviceProvider);
    const billNumber = trimText(raw.billNumber);
    let date = trimText(raw.date);
    const monthYear = trimText(raw.monthYear);
    const travelCarBike = isTravelCarOrBike(expenseHead, subCategory || '');
    const hotelSelf = isHotelBookingSelf(expenseHead, subCategory || '');

    if (!expenseHead) {
      throw new Error('expenseHead is required');
    }
    if (!travelCarBike) {
      if (!serviceProvider) {
        throw new Error('serviceProvider is required');
      }
      if (!billNumber) {
        throw new Error('billNumber is required');
      }
    }
    if (!date && hotelSelf) {
      date = trimText(raw.stayDateFrom) || trimText(raw.stayDateTo);
    }
    if (!date) {
      throw new Error('date is required');
    }

    let location = trimText(raw.location);
    let purpose = trimText(raw.purpose);
    const legacyCombined = trimText(raw[EXPENSE_LEGACY_COMBINED_LOCATION_ATTR]);
    if (!location && legacyCombined) {
      location = legacyCombined;
    }
    if (!purpose && legacyCombined) {
      purpose = legacyCombined;
    }
    if (!location) {
      throw new Error('location is required');
    }
    if (!purpose) {
      throw new Error('purpose is required');
    }

    validateSubCategoryForHead(expenseHead, subCategory || undefined);

    const employeeRow = await EmployeeModel.getEmployeeByCode(authUser.employeeCode);
    const employeeEmail =
      String(employeeRow?.officialEmail || employeeRow?.personalEmail || '').trim() || '';

    const auditFields = buildAuditFields(authUser);
    const employeeName =
      String(authUser.fullName || '').trim() ||
      `${String(authUser.firstName || '').trim()} ${String(authUser.lastName || '').trim()}`.trim() ||
      String(authUser.employeeCode || '').trim();

    const travelExtras = {};
    const fromLoc = trimText(raw.fromLocation);
    const toLoc = trimText(raw.toLocation);
    const retT = trimText(raw.returnType);
    if (fromLoc) {
      travelExtras.fromLocation = fromLoc;
    }
    if (toLoc) {
      travelExtras.toLocation = toLoc;
    }
    if (retT) {
      travelExtras.returnType = retT;
    }
    if (
      raw.kilometers !== undefined &&
      raw.kilometers !== null &&
      trimText(raw.kilometers) !== ''
    ) {
      const km = Number(raw.kilometers);
      if (Number.isFinite(km)) {
        travelExtras.kilometers = km;
      }
    }

    if (travelCarBike) {
      const ft = trimText(raw.fuelType);
      if (ft !== 'Petrol/Diesel' && ft !== 'Electric') {
        throw new Error('fuelType must be Petrol/Diesel or Electric for Travel Car/Bike');
      }
      travelExtras.fuelType = ft;
    }

    let amountNum;
    if (travelCarBike) {
      const rates = await ExpenseTravelRateSettingsService.getTravelRateSettingsForApi();
      amountNum = computeTravelCarBikeRupeeAmount({
        expenseHead,
        subCategory: subCategory || '',
        kilometers: travelExtras.kilometers,
        fuelType: travelExtras.fuelType,
        rates: { car: rates.car, bike: rates.bike },
      });
    } else {
      const amountRaw = raw.amount;
      if (amountRaw === undefined || amountRaw === null || trimText(amountRaw) === '') {
        throw new Error('amount is required');
      }
      amountNum = Number(amountRaw);
      if (Number.isNaN(amountNum)) {
        throw new Error('amount must be a number');
      }
    }

    const hotelExtras = {};
    const sdf = trimText(raw.stayDateFrom);
    const sdt = trimText(raw.stayDateTo);
    if (sdf) {
      hotelExtras.stayDateFrom = sdf;
    }
    if (sdt) {
      hotelExtras.stayDateTo = sdt;
    }

    const hasUploadedDocs = Array.isArray(documents) && documents.length > 0;
    let supportingDocument = normalizeSupportingDocumentLabel(
      raw.supportingDocument,
      hasUploadedDocs
    );
    if (travelCarBike) {
      supportingDocument = 'No';
    }
    if (supportingDocument === 'Yes' && !hasUploadedDocs) {
      throw new Error('Supporting document file is required when Supporting Document is Yes');
    }
    const documentsForItem =
      supportingDocument === 'No' || travelCarBike ? [] : documents || [];

    const basePayload = {
      expenseHead,
      ...(subCategory ? { subCategory } : {}),
      ...(travelCarBike
        ? { serviceProvider: '', billNumber: '' }
        : { serviceProvider, billNumber }),
      date,
      ...(monthYear ? { monthYear } : {}),
      location,
      purpose,
      employeeId: String(authUser.employeeCode || '').trim(),
      employeeName,
      employeeEmail,
      amount: amountNum,
      supportingDocument,
      ...travelExtras,
      ...hotelExtras,
    };

    validateExpenseBusinessRules(basePayload);

    const payload = {
      ...withApprovalDefaults(basePayload),
      ...auditFields,
      documents: documentsForItem,
      createdAt: raw.createdAt || auditFields.created_at || undefined,
      updatedAt: auditFields.updated_at || undefined,
    };

    log.info('Creating expense (sanitized keys):', {
      expenseHead: payload.expenseHead,
      subCategory: payload.subCategory,
      hasLocation: Boolean(payload.location),
      hasPurpose: Boolean(payload.purpose),
      amount: payload.amount,
      employeeId: payload.employeeId,
    });
    const expense = await ExpenseModel.createExpense(payload);
    await logActivity({
      actorEmployeeCode: authUser?.employeeCode || '',
      actorName: authUser?.fullName || '',
      actorRole: authUser?.role || '',
      module: 'expenses',
      actionType: 'CREATE',
      targetEntity: 'expense',
      targetId: expense.expenseId,
    });

    const mergedDocuments = [];
    if (supportingDocument === 'Yes') {
      if (Array.isArray(documentsForItem)) {
        mergedDocuments.push(...documentsForItem);
      }
      if (Array.isArray(raw.documents) && raw.documents.every((d) => d && typeof d === 'object')) {
        mergedDocuments.push(...raw.documents);
      }
    }
    const savedDocuments = [];

    for (const document of mergedDocuments) {
      if (!document?.fileName || !document?.fileUrl) {
        continue;
      }

      const saved = await ExpenseDocumentsModel.createDocument({
        expenseId: expense.expenseId,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        created_by_employee_code: auditFields.created_by_employee_code || '',
        created_by_name: auditFields.created_by_name || '',
        created_by_role: auditFields.created_by_role || '',
        created_by_user_id: auditFields.created_by_user_id || '',
        created_by_first_name: auditFields.created_by_first_name || '',
        created_by_last_name: auditFields.created_by_last_name || '',
        created_by: auditFields.created_by || '',
      });

      savedDocuments.push(saved);
    }

    return {
      ...enrichExpenseRow(expense),
      documents: savedDocuments,
    };
  } catch (error) {
    log.error('Error creating expense:', error);
    throw error;
  }
};

/**
 * Update expense
 * @param {string} expenseId - Expense ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Updated expense record
 */
export const updateExpense = async (expenseId, updateData, authUser = null, effectiveRole = 'User') => {
  try {
    if (!expenseId) {
      throw new Error('expenseId is required');
    }

    if (updateData?.amount !== undefined && Number.isNaN(Number(updateData.amount))) {
      throw new Error('amount must be a number');
    }

    const existing = await ExpenseModel.getExpenseById(expenseId);
    if (!existing) {
      throw new Error('Expense not found');
    }
    const canonicalExpenseId = existing.expenseId;
    if (authUser && !canAccessAllExpenseRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    const updatePayload = {
      ...updateData,
    };

    const existingAuditStatus = String(
      existing.auditStatus ?? existing.approval_status ?? 'Pending'
    ).trim();
    if (existingAuditStatus === 'Rejected') {
      updatePayload.approval_status = 'Pending';
      updatePayload.auditStatus = 'Pending';
      updatePayload.approved_by = '';
      updatePayload.approved_at = '';
      updatePayload.rejected_by = '';
      updatePayload.rejected_at = '';
      updatePayload.auditReason = '';
      updatePayload.approval_comments = '';
      updatePayload.auditedBy = '';
      updatePayload.auditedAt = '';
    }

    delete updatePayload.employeeName;
    delete updatePayload.employeeId;
    delete updatePayload.employeeEmail;

    const nextHead =
      updatePayload.expenseHead !== undefined
        ? trimText(updatePayload.expenseHead)
        : trimText(existing.expenseHead);
    const nextSubRaw =
      updatePayload.subCategory !== undefined
        ? updatePayload.subCategory
        : existing.subCategory;
    const nextSub = nextSubRaw != null ? String(nextSubRaw).trim() : '';

    if (isTravelCarOrBike(nextHead, nextSub)) {
      updatePayload.serviceProvider = '';
      updatePayload.billNumber = '';
      updatePayload.supportingDocument = 'No';
    }

    const sdUpdate = trimText(updatePayload.supportingDocument);
    if (sdUpdate.toLowerCase() === 'no') {
      const existingDocs = await ExpenseDocumentsModel.getDocumentsByExpenseId(canonicalExpenseId);
      for (const d of existingDocs) {
        if (d?.documentId) {
          await ExpenseDocumentsModel.deleteDocument(d.documentId);
        }
      }
      updatePayload.documents = [];
      updatePayload.supportingDocument = 'No';
    } else if (sdUpdate.toLowerCase() === 'yes') {
      updatePayload.supportingDocument = 'Yes';
    }

    const merged = {
      ...existing,
      ...updatePayload,
    };

    const resolvedLp = resolveLocationFieldsFromRow(merged);
    if (!resolvedLp.location) {
      throw new Error('location is required');
    }
    if (!resolvedLp.purpose) {
      throw new Error('purpose is required');
    }
    merged.location = resolvedLp.location;
    merged.purpose = resolvedLp.purpose;
    updatePayload.location = resolvedLp.location;
    updatePayload.purpose = resolvedLp.purpose;

    const mergedSub = merged.subCategory != null ? String(merged.subCategory).trim() : '';

    if (isHotelBookingSelf(merged.expenseHead, mergedSub)) {
      const derivedDate =
        trimText(merged.stayDateFrom) ||
        trimText(merged.stayDateTo) ||
        trimText(merged.date);
      if (derivedDate) {
        updatePayload.date = derivedDate;
        merged.date = derivedDate;
      }
    }

    if (!isTravelCarOrBike(merged.expenseHead, mergedSub)) {
      updatePayload.fuelType = '';
    }

    if (trimText(updatePayload.supportingDocument).toLowerCase() === 'yes') {
      const hasNewDocs = Array.isArray(updatePayload.documents) && updatePayload.documents.length > 0;
      let hasOldDocs = Array.isArray(existing.documents) && existing.documents.length > 0;
      if (!hasOldDocs) {
        const tableDocs = await ExpenseDocumentsModel.getDocumentsByExpenseId(canonicalExpenseId);
        hasOldDocs = (tableDocs || []).some((d) => d && String(d.fileUrl || '').trim() !== '');
      }
      if (!hasNewDocs && !hasOldDocs) {
        throw new Error('Supporting document file is required when Supporting Document is Yes');
      }
    }

    validateMergedSubCategoryOnUpdate(merged, updatePayload);

    if (isTravelCarOrBike(merged.expenseHead, mergedSub)) {
      const rates = await ExpenseTravelRateSettingsService.getTravelRateSettingsForApi();
      const authoritative = computeTravelCarBikeRupeeAmount({
        expenseHead: merged.expenseHead,
        subCategory: mergedSub,
        kilometers: merged.kilometers,
        fuelType: merged.fuelType,
        rates: { car: rates.car, bike: rates.bike },
      });
      updatePayload.amount = authoritative;
      merged.amount = authoritative;
    }

    validateExpenseBusinessRules(merged);

    log.info('Updating expense:', { routeOrClientId: expenseId, dynamoKey: canonicalExpenseId });
    const updated = await ExpenseModel.updateExpense(canonicalExpenseId, updatePayload);
    await logActivity({
      actorEmployeeCode: authUser?.employeeCode || '',
      actorName: authUser?.fullName || '',
      actorRole: authUser?.role || '',
      module: 'expenses',
      actionType: 'UPDATE',
      targetEntity: 'expense',
      targetId: canonicalExpenseId,
    });
    return enrichExpenseRow(updated);
  } catch (error) {
    log.error('Error updating expense:', error);
    throw error;
  }
};

/**
 * Delete expense
 * @param {string} expenseId - Expense ID
 * @param {string} userId - User ID making the deletion (for audit)
 * @returns {Promise<Object>} Deletion result
 */
export const deleteExpense = async (expenseId, userId, authUser = null, effectiveRole = 'User') => {
  try {
    if (!expenseId) {
      throw new Error('expenseId is required');
    }

    const existing = await ExpenseModel.getExpenseById(expenseId);
    if (!existing) {
      throw new Error('Expense not found');
    }
    const canonicalExpenseId = existing.expenseId;
    if (authUser && !canAccessAllExpenseRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    log.info('Deleting expense:', { routeOrClientId: expenseId, dynamoKey: canonicalExpenseId });
    const documents = await ExpenseDocumentsModel.getDocumentsByExpenseId(canonicalExpenseId);
    for (const document of documents) {
      await ExpenseDocumentsModel.deleteDocument(document.documentId);
    }

    const deleted = await ExpenseModel.updateExpense(canonicalExpenseId, buildSoftDeleteFields(authUser));
    await logActivity({
      actorEmployeeCode: authUser?.employeeCode || '',
      actorName: authUser?.fullName || '',
      actorRole: authUser?.role || '',
      module: 'expenses',
      actionType: 'DELETE',
      targetEntity: 'expense',
      targetId: canonicalExpenseId,
    });
    return enrichExpenseRow(deleted);
  } catch (error) {
    log.error('Error deleting expense:', error);
    throw error;
  }
};

function assertCanModerateExpenseAudit(effectiveRole) {
  if (!isAdmin(effectiveRole) && !isDeveloper(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Organization-wide expense list for Audit Expenses (Admin / Developer).
 * Filters are applied in DynamoDB (employeeId, month, year).
 */
export const getExpensesForAudit = async (
  filters = {},
  options = {},
  authUser = null,
  effectiveRole = 'User'
) => {
  assertCanModerateExpenseAudit(effectiveRole);
  const pagination = parsePaginationOptions({
    limit: options.limit ?? DEFAULT_QUERY_LIMIT,
    cursor: options.cursor ?? options.nextCursor,
  });
  const page = await ExpenseModel.queryExpensesForAuditPage(filters, pagination);
  const mapped = sortExpensesDesc(
    page.items.map((row) => toExpenseListDto(row, enrichExpenseRow))
  );
  return toPaginatedResponse(mapped, page.lastEvaluatedKey);
};

export const approveExpense = async (expenseId, authUser, effectiveRole) => {
  assertCanModerateExpenseAudit(effectiveRole);
  const existing = await ExpenseModel.getExpenseById(expenseId);
  if (!existing) {
    const err = new Error('Expense not found');
    err.statusCode = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const auditor = authUser?.fullName || authUser?.employeeCode || '';
  const patch = {
    approval_status: 'Approved',
    auditStatus: 'Approved',
    approved_by: auditor,
    approved_at: now,
    auditedBy: auditor,
    auditedAt: now,
    auditReason: '',
    approval_comments: '',
    rejected_by: '',
    rejected_at: '',
    updatedAt: now,
    updated_at: now,
  };

  const updated = await ExpenseModel.updateExpense(existing.expenseId, patch);
  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'expenses',
    actionType: 'UPDATE',
    targetEntity: 'expense',
    targetId: existing.expenseId,
    metadata: { action: 'audit_approve' },
  });
  return enrichExpenseRow(updated);
};

export const rejectExpense = async (expenseId, body, authUser, effectiveRole) => {
  assertCanModerateExpenseAudit(effectiveRole);
  const existing = await ExpenseModel.getExpenseById(expenseId);
  if (!existing) {
    const err = new Error('Expense not found');
    err.statusCode = 404;
    throw err;
  }

  const reason = String(body?.reason || body?.remarks || '').trim();
  const now = new Date().toISOString();
  const auditor = authUser?.fullName || authUser?.employeeCode || '';
  const patch = {
    approval_status: 'Rejected',
    auditStatus: 'Rejected',
    rejected_by: auditor,
    rejected_at: now,
    auditedBy: auditor,
    auditedAt: now,
    auditReason: reason,
    approval_comments: reason,
    approved_by: '',
    approved_at: '',
    updatedAt: now,
    updated_at: now,
  };

  const updated = await ExpenseModel.updateExpense(existing.expenseId, patch);
  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'expenses',
    actionType: 'UPDATE',
    targetEntity: 'expense',
    targetId: existing.expenseId,
    metadata: { action: 'audit_reject', reason },
  });
  return enrichExpenseRow(updated);
};

export const getExpenseDocuments = async (expenseId, authUser = null, effectiveRole = 'User') => {
  try {
    if (!expenseId) {
      throw new Error('expenseId is required');
    }

    const expense = await ExpenseModel.getExpenseById(expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }
    const canonicalExpenseId = expense.expenseId;
    if (
      authUser &&
      !canAccessAllExpenseRecords(effectiveRole) &&
      !canViewExpenseForAudit(effectiveRole) &&
      !isOwnedByUser(expense, authUser)
    ) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    log.info('Getting expense documents:', { routeOrClientId: expenseId, dynamoKey: canonicalExpenseId });
    return await ExpenseDocumentsModel.getDocumentsByExpenseId(canonicalExpenseId);
  } catch (error) {
    log.error('Error getting expense documents:', error);
    throw error;
  }
};


