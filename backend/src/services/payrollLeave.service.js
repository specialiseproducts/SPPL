/**
 * Payroll leave-request service — employee self-service + Team Calendar approvals.
 */

import * as PayrollLeaveRequestsModel from '../models/PayrollLeaveRequests.js';
import * as PayrollTeamMappingsModel from '../models/PayrollTeamMappings.js';
import * as EmployeeMasterModel from '../models/EmployeeMaster.js';
import { canAccessAllRecords } from '../utils/accessControl.js';
import {
  HALF_DAY_PERIODS,
  LEAVE_TYPES,
  dateRangesOverlap,
  inclusiveCalendarDays,
  isActiveLeaveConflictStatus,
  rangesOverlapMonth,
  requiresAdvanceNoticeWarning,
} from '../utils/payrollLeaveDates.js';
import { todayIstDateKey, normalizeDateKey } from '../utils/salesQuotationDates.js';
import { sendEmail } from './emailService.js';
import {
  buildLeaveApprovedEmail,
  buildLeaveRejectedEmail,
} from './payrollLeaveDecisionEmail.js';
import log from '../utils/logger.js';

function employeeCodeOf(authUser) {
  return String(authUser?.employeeCode || authUser?.id || '').trim();
}

function employeeNameOf(authUser) {
  return String(
    authUser?.fullName || `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim(),
  ).trim();
}

function badRequest(message, code, data) {
  const err = new Error(message);
  err.statusCode = 400;
  if (code) err.code = code;
  if (data != null) err.data = data;
  return err;
}

function forbidden(message) {
  const err = new Error(message || 'Forbidden');
  err.statusCode = 403;
  return err;
}

function notFound(message) {
  const err = new Error(message || 'Leave request not found');
  err.statusCode = 404;
  return err;
}

function officialEmailOfEmployee(employee) {
  return String(
    employee?.officialEmail || employee?.official_email || employee?.email || '',
  ).trim();
}

/**
 * Notify the requesting employee after a leave decision is persisted.
 * Never throws — email failure must not roll back the leave decision.
 */
async function notifyLeaveDecisionEmail(decision, leaveRequest) {
  const employeeCode = String(leaveRequest?.employeeCode || '').trim();
  if (!employeeCode) {
    return { ok: false, skipped: true, reason: 'missing_employee_code' };
  }

  let employee = null;
  try {
    employee = await EmployeeMasterModel.getEmployeeByCode(employeeCode);
  } catch (err) {
    log.error('Leave decision email: failed to load employee', {
      employeeCode,
      decision,
      error: err?.message || err,
    });
    return { ok: false, skipped: true, reason: 'employee_lookup_failed' };
  }

  const to = officialEmailOfEmployee(employee);
  if (!to) {
    log.error('Leave decision email skipped — employee has no official email', {
      employeeCode,
      decision,
    });
    return { ok: false, skipped: true, reason: 'missing_email' };
  }

  const employeeName =
    String(leaveRequest?.employeeName || '').trim() ||
    String(employee?.fullName || '').trim() ||
    `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() ||
    employeeCode;

  const mail =
    decision === 'Approved'
      ? buildLeaveApprovedEmail({ ...leaveRequest, employeeName })
      : buildLeaveRejectedEmail({ ...leaveRequest, employeeName });

  const result = await sendEmail({
    to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });

  if (!result?.ok) {
    log.error('Leave decision email send failed', {
      employeeCode,
      decision,
      leaveRequestId: leaveRequest?.leaveRequestId,
      error: result?.error,
    });
  }

  return result;
}

function normalizeLeavePayload(body, today) {
  const leaveType = String(body?.leaveType || '').trim();
  const reason = String(body?.reason || '').trim();

  if (![LEAVE_TYPES.ONE_DAY, LEAVE_TYPES.MULTIPLE_DAY, LEAVE_TYPES.HALF_DAY].includes(leaveType)) {
    throw badRequest('Select a leave type');
  }
  if (!reason) {
    throw badRequest('Reason of Leave is required');
  }

  let startDate = normalizeDateKey(body?.startDate);
  let endDate = normalizeDateKey(body?.endDate);
  let halfDayPeriod = null;
  let durationDays = 1;

  if (leaveType === LEAVE_TYPES.ONE_DAY) {
    if (!startDate) throw badRequest('Leave date is required');
    endDate = startDate;
    durationDays = 1;
  } else if (leaveType === LEAVE_TYPES.HALF_DAY) {
    if (!startDate) throw badRequest('Leave date is required');
    const period = String(body?.halfDayPeriod || '').trim();
    if (period !== HALF_DAY_PERIODS.FIRST && period !== HALF_DAY_PERIODS.SECOND) {
      throw badRequest('Select a half-day period');
    }
    halfDayPeriod = period;
    endDate = startDate;
    durationDays = 1;
  } else {
    if (!startDate) throw badRequest('Start Date is required');
    if (!endDate) throw badRequest('End Date is required');
    if (endDate < startDate) {
      throw badRequest('End Date must be the same as or later than Start Date');
    }
    durationDays = inclusiveCalendarDays(startDate, endDate);
    if (durationDays == null || durationDays < 1) {
      throw badRequest('Invalid date range');
    }
  }

  if (startDate < today) {
    throw badRequest('Leave cannot start on a past date');
  }

  const needsAdvanceWarning = requiresAdvanceNoticeWarning(durationDays, today, startDate);
  const advanceNoticeAcknowledged = Boolean(body?.advanceNoticeAcknowledged);
  if (needsAdvanceWarning && !advanceNoticeAcknowledged) {
    throw badRequest(
      'Leave longer than two days should be requested at least 15 days in advance. Acknowledge the notice to continue.',
      'ADVANCE_NOTICE_REQUIRED',
      {
        requiresAdvanceNoticeAcknowledgement: true,
        durationDays,
        daysUntilStart: Math.floor(
          (Date.parse(`${startDate}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) /
            86400000,
        ),
      },
    );
  }

  return {
    leaveType,
    reason,
    startDate,
    endDate,
    halfDayPeriod,
    durationDays,
    advanceNoticeAcknowledged: needsAdvanceWarning ? true : advanceNoticeAcknowledged,
  };
}

async function assertNoDateOverlap({
  employeeCode,
  startDate,
  endDate,
  excludeLeaveRequestId,
}) {
  const existing = await PayrollLeaveRequestsModel.listLeaveRequestsForEmployee(employeeCode);
  const excludeId = String(excludeLeaveRequestId || '').trim();
  const conflict = existing.find((row) => {
    if (excludeId && row.leaveRequestId === excludeId) return false;
    if (!isActiveLeaveConflictStatus(row.status)) return false;
    return dateRangesOverlap(startDate, endDate, row.startDate, row.endDate);
  });

  if (conflict) {
    throw badRequest(
      `This leave overlaps an existing ${conflict.status || 'active'} leave request (${conflict.startDate}${
        conflict.endDate !== conflict.startDate ? ` – ${conflict.endDate}` : ''
      }). Edit or delete the pending request, or choose different dates.`,
      'LEAVE_DATE_CONFLICT',
      {
        conflictingLeaveRequestId: conflict.leaveRequestId,
        conflictingStatus: conflict.status,
        conflictingStartDate: conflict.startDate,
        conflictingEndDate: conflict.endDate,
      },
    );
  }
}

function assertOwnedPending(existing, authUser) {
  const code = employeeCodeOf(authUser);
  if (!existing) throw notFound('Leave request not found');
  if (String(existing.employeeCode || '').trim() !== code) {
    throw forbidden('You can only modify your own leave requests');
  }
  const status = String(existing.status || '').trim();
  if (status !== 'Pending') {
    throw badRequest(
      status === 'Approved'
        ? 'Approved leave cannot be changed or deleted'
        : `Only Pending leave requests can be edited or deleted (current status: ${status || 'unknown'})`,
      'LEAVE_NOT_EDITABLE',
      { status },
    );
  }
  return existing;
}

export const listMyLeaveRequests = async (authUser, query = {}) => {
  const code = employeeCodeOf(authUser);
  if (!code) throw badRequest('Employee identity is required');

  const year = Number(query.year);
  const month = Number(query.month);
  const all = await PayrollLeaveRequestsModel.listLeaveRequestsForEmployee(code);

  let leaveRequests = all.filter((row) => {
    const status = String(row.status || '').trim();
    return status !== 'Deleted';
  });
  if (Number.isFinite(year) && year > 0 && Number.isFinite(month) && month >= 1 && month <= 12) {
    leaveRequests = leaveRequests.filter((row) =>
      rangesOverlapMonth(row.startDate, row.endDate, year, month),
    );
  }

  leaveRequests.sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  return { leaveRequests };
};

export const createLeaveRequest = async (body, authUser) => {
  const code = employeeCodeOf(authUser);
  if (!code) throw badRequest('Employee identity is required');

  const today = todayIstDateKey();
  const normalized = normalizeLeavePayload(body, today);

  await assertNoDateOverlap({
    employeeCode: code,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
  });

  const duplicate = await PayrollLeaveRequestsModel.findDuplicatePending({
    employeeCode: code,
    leaveType: normalized.leaveType,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    halfDayPeriod: normalized.halfDayPeriod,
  });
  if (duplicate) {
    return { leaveRequest: duplicate, duplicate: true };
  }

  const leaveRequest = await PayrollLeaveRequestsModel.createLeaveRequest({
    employeeCode: code,
    employeeName: employeeNameOf(authUser) || code,
    leaveType: normalized.leaveType,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    halfDayPeriod: normalized.halfDayPeriod,
    reason: normalized.reason,
    durationDays: normalized.durationDays,
    advanceNoticeAcknowledged: normalized.advanceNoticeAcknowledged,
    createdBy: code,
  });

  return { leaveRequest, duplicate: false };
};

export const updateLeaveRequest = async (leaveRequestId, body, authUser) => {
  const existing = await PayrollLeaveRequestsModel.getLeaveRequestById(leaveRequestId);
  assertOwnedPending(existing, authUser);

  const today = todayIstDateKey();
  const normalized = normalizeLeavePayload(body, today);
  const code = employeeCodeOf(authUser);

  await assertNoDateOverlap({
    employeeCode: code,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    excludeLeaveRequestId: existing.leaveRequestId,
  });

  const leaveRequest = await PayrollLeaveRequestsModel.updateLeaveRequest(existing.leaveRequestId, {
    leaveType: normalized.leaveType,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    halfDayPeriod: normalized.halfDayPeriod,
    reason: normalized.reason,
    durationDays: normalized.durationDays,
    advanceNoticeAcknowledged: normalized.advanceNoticeAcknowledged,
    // Never allow client to change owner or approval status.
    employeeCode: existing.employeeCode,
    status: 'Pending',
  });

  return { leaveRequest };
};

export const deleteLeaveRequest = async (leaveRequestId, authUser) => {
  const existing = await PayrollLeaveRequestsModel.getLeaveRequestById(leaveRequestId);
  assertOwnedPending(existing, authUser);
  const code = employeeCodeOf(authUser);
  await PayrollLeaveRequestsModel.softDeleteLeaveRequest(existing.leaveRequestId, {
    employeeCode: code,
  });
  return { success: true };
};

function assertCanModerateTeamLeave(effectiveRole) {
  if (!canAccessAllRecords(effectiveRole)) {
    throw forbidden('Forbidden');
  }
}

async function assertManagesEmployee(authUser, employeeCode) {
  const managerCode = employeeCodeOf(authUser);
  const target = String(employeeCode || '').trim();
  if (!managerCode || !target) throw forbidden('You can only review your team members');
  const team = await PayrollTeamMappingsModel.listEmployeesForManager(managerCode);
  const ok = (team || []).some(
    (m) =>
      String(m.status || '').trim() === 'Active' &&
      String(m.employeeCode || '').trim() === target,
  );
  if (!ok) {
    throw forbidden('You can only review leave for employees in your Payroll team');
  }
}

async function listTeamEmployeeCodes(authUser) {
  const managerCode = employeeCodeOf(authUser);
  const team = await PayrollTeamMappingsModel.listEmployeesForManager(managerCode);
  return [
    ...new Set(
      (team || [])
        .filter((m) => String(m.status || '').trim() === 'Active')
        .map((m) => String(m.employeeCode || '').trim())
        .filter(Boolean),
    ),
  ];
}

/** Pending leave requests for the logged-in reporting person's Payroll team. */
export const listPendingLeaveApprovals = async (authUser, effectiveRole) => {
  assertCanModerateTeamLeave(effectiveRole);
  const employeeCodes = await listTeamEmployeeCodes(authUser);
  if (employeeCodes.length === 0) {
    return { leaveRequests: [] };
  }

  const collected = [];
  for (const code of employeeCodes) {
    const rows = await PayrollLeaveRequestsModel.listLeaveRequestsForEmployee(code);
    for (const row of rows || []) {
      if (String(row.status || '').trim() !== 'Pending') continue;
      collected.push(row);
    }
  }

  collected.sort((a, b) => {
    const byCreated = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    if (byCreated !== 0) return byCreated;
    return String(a.startDate || '').localeCompare(String(b.startDate || ''));
  });

  return { leaveRequests: collected };
};

/** Leave requests for one team employee (Team Calendar month view). */
export const listTeamMemberLeaveRequests = async (
  employeeCode,
  authUser,
  effectiveRole,
  query = {},
) => {
  assertCanModerateTeamLeave(effectiveRole);
  const code = String(employeeCode || '').trim();
  if (!code) throw badRequest('employeeCode is required');
  await assertManagesEmployee(authUser, code);

  const year = Number(query.year);
  const month = Number(query.month);
  const all = await PayrollLeaveRequestsModel.listLeaveRequestsForEmployee(code);
  let leaveRequests = (all || []).filter((row) => {
    const status = String(row.status || '').trim();
    return status !== 'Deleted';
  });
  if (Number.isFinite(year) && year > 0 && Number.isFinite(month) && month >= 1 && month <= 12) {
    leaveRequests = leaveRequests.filter((row) =>
      rangesOverlapMonth(row.startDate, row.endDate, year, month),
    );
  }
  leaveRequests.sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  return { leaveRequests };
};

export const approveLeaveRequest = async (leaveRequestId, authUser, effectiveRole) => {
  assertCanModerateTeamLeave(effectiveRole);
  const existing = await PayrollLeaveRequestsModel.getLeaveRequestById(leaveRequestId);
  if (!existing) throw notFound('Leave request not found');
  await assertManagesEmployee(authUser, existing.employeeCode);

  if (String(existing.status || '').trim() !== 'Pending') {
    throw badRequest(
      `Only Pending leave requests can be approved (current status: ${existing.status || 'unknown'})`,
      'LEAVE_NOT_APPROVABLE',
      { status: existing.status },
    );
  }

  const actor = employeeCodeOf(authUser);
  const now = new Date().toISOString();
  const leaveRequest = await PayrollLeaveRequestsModel.updateLeaveRequest(existing.leaveRequestId, {
    status: 'Approved',
    approvedBy: actor,
    approvedAt: now,
    rejectionReason: '',
  });

  // Notify after persist — never roll back approval on email failure.
  // Pending-only guard above prevents duplicate emails on retry of already-approved requests.
  const email = await notifyLeaveDecisionEmail('Approved', leaveRequest);

  // Full-day leave: move any already-planned Daily Planner tasks to the next eligible working day.
  // Dynamic import avoids a circular dependency with dailyPlanner.service.
  let leaveReschedule = null;
  try {
    const DailyPlannerService = await import('./dailyPlanner.service.js');
    leaveReschedule = await DailyPlannerService.rescheduleTasksOffApprovedFullDayLeave(
      leaveRequest,
      authUser,
    );
  } catch (err) {
    // Leave approval must succeed even if reschedule hits a transient planner error;
    // create/reschedule APIs still block full-day leave dates going forward.
    leaveReschedule = {
      error: String(err?.message || err || 'leave_reschedule_failed'),
      moved: [],
    };
  }

  return { leaveRequest, leaveReschedule, email };
};

export const rejectLeaveRequest = async (leaveRequestId, body, authUser, effectiveRole) => {
  assertCanModerateTeamLeave(effectiveRole);
  const existing = await PayrollLeaveRequestsModel.getLeaveRequestById(leaveRequestId);
  if (!existing) throw notFound('Leave request not found');
  await assertManagesEmployee(authUser, existing.employeeCode);

  if (String(existing.status || '').trim() !== 'Pending') {
    throw badRequest(
      `Only Pending leave requests can be rejected (current status: ${existing.status || 'unknown'})`,
      'LEAVE_NOT_REJECTABLE',
      { status: existing.status },
    );
  }

  const reason = String(body?.reason || body?.rejectionReason || '').trim();
  if (!reason) {
    throw badRequest('Rejection reason is required');
  }

  const actor = employeeCodeOf(authUser);
  const now = new Date().toISOString();
  const leaveRequest = await PayrollLeaveRequestsModel.updateLeaveRequest(existing.leaveRequestId, {
    status: 'Rejected',
    rejectedBy: actor,
    rejectedAt: now,
    rejectionReason: reason,
  });

  // Notify after persist — never roll back rejection on email failure.
  // Pending-only guard above prevents duplicate emails on retry of already-rejected requests.
  const email = await notifyLeaveDecisionEmail('Rejected', leaveRequest);

  return { leaveRequest, email };
};
