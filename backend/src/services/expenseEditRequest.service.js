import * as ExpenseModel from '../models/Expenses.js';
import * as ExpenseEditRequestsModel from '../models/ExpenseEditRequests.js';
import * as EmployeeModel from '../models/EmployeeMaster.js';
import { isOwnedByUser, isAdmin, isDeveloper } from '../utils/accessControl.js';
import {
  computeOutstationDuration,
  computeOutstationTravelAllowanceAmount,
  validateExpenseBusinessRules,
} from '../utils/expenseValidation.js';
import * as NotificationEmitters from './notificationEmitters.js';
import { logActivity } from '../utils/activityLogger.js';

const FIELD_BY_LABEL = {
  Amount: 'amount',
  Date: 'date',
  Location: 'location',
  Purpose: 'purpose',
  'Service Provider': 'serviceProvider',
  'Service Provider Name': 'serviceProvider',
  'Bill Number': 'billNumber',
  'Sub Category': 'subCategory',
  From: 'fromLocation',
  To: 'toLocation',
  Return: 'returnType',
  'Kilometers (km)': 'kilometers',
  Kilometers: 'kilometers',
  'Stay Date (From)': 'stayDateFrom',
  'Stay Date (To)': 'stayDateTo',
  'Fuel Type': 'fuelType',
  'Supporting Document': 'supportingDocument',
  'Arrival Date': 'arrivalDate',
  'Arrival Time': 'arrivalTime',
  'Departure Date (last)': 'departureDate',
  'Departure Date': 'departureDate',
  'Departure Time': 'departureTime',
};

const ALLOWED_FIELD_KEYS = new Set(Object.values(FIELD_BY_LABEL));
const NUMERIC_FIELD_KEYS = new Set(['amount', 'kilometers']);
const DATETIME_FIELD_KEYS = new Set(['arrivalDate', 'arrivalTime', 'departureDate', 'departureTime']);

function resolveFieldKey(requestType) {
  if (FIELD_BY_LABEL[requestType]) return FIELD_BY_LABEL[requestType];
  if (ALLOWED_FIELD_KEYS.has(requestType)) return requestType;
  return '';
}

function assertCanModerateExpenseAudit(effectiveRole) {
  if (!isAdmin(effectiveRole) && !isDeveloper(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

function toPublic(item) {
  if (!item) return null;
  return {
    requestId: item.requestId || '',
    expenseId: item.expenseId || '',
    expenseRef: item.expenseRef || item.expenseId || '',
    revisionNumber: Number(item.revisionNumber || 0),
    employeeCode: item.employeeCode || '',
    employeeName: item.employeeName || '',
    employeeOfficialEmail: item.employeeOfficialEmail || '',
    requestType: item.requestType || '',
    oldValues: item.oldValues || {},
    requestedValues: item.requestedValues || {},
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

function sanitizeRequestedValues(requestType, value) {
  const text = String(value || '').trim();
  const fieldKey = resolveFieldKey(requestType);
  if (!fieldKey) {
    const err = new Error('Invalid request type');
    err.statusCode = 400;
    throw err;
  }
  if (!text) {
    const err = new Error('Requested value is required');
    err.statusCode = 400;
    throw err;
  }
  if (NUMERIC_FIELD_KEYS.has(fieldKey)) {
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0) {
      const err = new Error(`${requestType} must be a valid non-negative number`);
      err.statusCode = 400;
      throw err;
    }
    return { [fieldKey]: n };
  }
  return { [fieldKey]: text };
}

function buildOldValues(expense, requestType) {
  const fieldKey = resolveFieldKey(requestType);
  if (!fieldKey) return {};
  return { [fieldKey]: expense?.[fieldKey] ?? null };
}

export async function listPendingExpenseEditRequests(authUser, effectiveRole) {
  assertCanModerateExpenseAudit(effectiveRole);
  const rows = await ExpenseEditRequestsModel.listPendingExpenseEditRequests();
  return rows.map(toPublic).filter(Boolean);
}

export async function listExpenseEditRequests(expenseId, authUser, effectiveRole) {
  const expense = await ExpenseModel.getExpenseById(expenseId);
  if (!expense) {
    const err = new Error('Expense not found');
    err.statusCode = 404;
    throw err;
  }
  if (!isAdmin(effectiveRole) && !isDeveloper(effectiveRole) && !isOwnedByUser(expense, authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const rows = await ExpenseEditRequestsModel.listExpenseEditRequestsByExpenseId(expense.expenseId);
  return rows.map(toPublic).filter(Boolean);
}

export async function createExpenseEditRequest(expenseId, body, authUser, effectiveRole) {
  const expense = await ExpenseModel.getExpenseById(expenseId);
  if (!expense) {
    const err = new Error('Expense not found');
    err.statusCode = 404;
    throw err;
  }
  if (!isOwnedByUser(expense, authUser)) {
    const err = new Error('Only the expense owner can request edit permission');
    err.statusCode = 403;
    throw err;
  }
  const status = String(expense.auditStatus ?? expense.approval_status ?? 'Pending').trim();
  if (status !== 'Approved') {
    const err = new Error('Edit permission can only be requested for Approved expenses');
    err.statusCode = 400;
    throw err;
  }
  const pending = await ExpenseEditRequestsModel.findPendingExpenseEditRequest(expense.expenseId);
  if (pending) {
    const err = new Error('There is already a pending edit request awaiting admin approval.');
    err.statusCode = 409;
    throw err;
  }

  const requestType = String(body?.requestType || '').trim();
  const requestedValues = sanitizeRequestedValues(requestType, body?.requestedValue);
  const oldValues = buildOldValues(expense, requestType);

  let employeeOfficialEmail = '';
  try {
    const emp = await EmployeeModel.getEmployeeByCode(authUser?.employeeCode || '');
    employeeOfficialEmail = String(emp?.officialEmail || '').trim();
  } catch {
    employeeOfficialEmail = '';
  }

  const created = await ExpenseEditRequestsModel.createExpenseEditRequest({
    expenseId: expense.expenseId,
    expenseRef: expense.expenseId,
    revisionNumber: Number(expense.revisionNumber || 0),
    employeeCode: authUser?.employeeCode || expense.created_by_employee_code || '',
    employeeName: authUser?.fullName || expense.employeeName || '',
    employeeOfficialEmail,
    requestType,
    oldValues,
    requestedValues,
  });

  const publicRow = toPublic(created);
  void NotificationEmitters.emitExpenseEditRequestSubmitted(publicRow, authUser?.employeeCode);
  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'expenses',
    actionType: 'CREATE',
    targetEntity: 'expenseEditRequest',
    targetId: publicRow.requestId,
    metadata: { expenseId: expense.expenseId, requestType },
  });
  return publicRow;
}

export async function approveExpenseEditRequest(requestId, authUser, effectiveRole) {
  assertCanModerateExpenseAudit(effectiveRole);
  const request = await ExpenseEditRequestsModel.getExpenseEditRequestById(requestId);
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

  const expense = await ExpenseModel.getExpenseById(request.expenseId);
  if (!expense) {
    const err = new Error('Expense not found');
    err.statusCode = 404;
    throw err;
  }

  const patch = { ...(request.requestedValues || {}) };
  const merged = { ...expense, ...patch };
  if (Object.keys(patch).some((key) => DATETIME_FIELD_KEYS.has(key))) {
    const duration = computeOutstationDuration(merged);
    if (duration) {
      patch.durationHours = duration.durationHours;
      patch.durationDays = duration.durationDays;
      merged.durationHours = duration.durationHours;
      merged.durationDays = duration.durationDays;
      const allowance = computeOutstationTravelAllowanceAmount(duration.durationHours);
      if (allowance != null) {
        patch.amount = allowance;
        patch.travelAllowanceAmount = allowance;
        merged.amount = allowance;
        merged.travelAllowanceAmount = allowance;
      }
    }
  }
  validateExpenseBusinessRules(merged);
  patch.updatedAt = new Date().toISOString();
  patch.approval_status = 'Approved';
  patch.auditStatus = 'Approved';

  await ExpenseModel.updateExpense(expense.expenseId, patch);

  const reviewerName = authUser?.fullName || authUser?.employeeCode || '';
  const now = new Date().toISOString();
  const updatedRequest = await ExpenseEditRequestsModel.updateExpenseEditRequest(requestId, {
    status: 'Approved',
    reviewedAt: now,
    reviewedBy: reviewerName,
    reviewedByEmployeeCode: authUser?.employeeCode || '',
  });
  const publicRow = toPublic(updatedRequest);
  void NotificationEmitters.emitExpenseEditRequestApproved(publicRow, authUser?.employeeCode);
  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'expenses',
    actionType: 'UPDATE',
    targetEntity: 'expenseEditRequest',
    targetId: requestId,
    metadata: { expenseId: expense.expenseId, requestType: request.requestType, action: 'approve' },
  });
  return publicRow;
}

export async function rejectExpenseEditRequest(requestId, body, authUser, effectiveRole) {
  assertCanModerateExpenseAudit(effectiveRole);
  const request = await ExpenseEditRequestsModel.getExpenseEditRequestById(requestId);
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
  const adminRemark = String(body?.adminRemark || body?.reason || '').trim();
  if (!adminRemark) {
    const err = new Error('Admin remark is required to reject an edit request');
    err.statusCode = 400;
    throw err;
  }
  const reviewerName = authUser?.fullName || authUser?.employeeCode || '';
  const now = new Date().toISOString();
  const updatedRequest = await ExpenseEditRequestsModel.updateExpenseEditRequest(requestId, {
    status: 'Rejected',
    adminRemark,
    reviewedAt: now,
    reviewedBy: reviewerName,
    reviewedByEmployeeCode: authUser?.employeeCode || '',
  });
  const publicRow = toPublic(updatedRequest);
  void NotificationEmitters.emitExpenseEditRequestRejected(publicRow, adminRemark, authUser?.employeeCode);
  await logActivity({
    actorEmployeeCode: authUser?.employeeCode || '',
    actorName: authUser?.fullName || '',
    actorRole: authUser?.role || '',
    module: 'expenses',
    actionType: 'UPDATE',
    targetEntity: 'expenseEditRequest',
    targetId: requestId,
    metadata: { expenseId: request.expenseId, requestType: request.requestType, action: 'reject' },
  });
  return publicRow;
}
