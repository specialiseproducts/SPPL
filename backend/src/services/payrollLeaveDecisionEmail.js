/**
 * Leave approve / reject notification emails for the requesting employee.
 */

import { HALF_DAY_PERIODS, LEAVE_TYPES } from '../utils/payrollLeaveDates.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatLeaveDateLabel(dateKey) {
  const key = String(dateKey || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key || '—';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatLeaveDatesForSubject(leaveRequest) {
  const start = formatLeaveDateLabel(leaveRequest?.startDate);
  const end = formatLeaveDateLabel(leaveRequest?.endDate);
  const leaveType = String(leaveRequest?.leaveType || '').trim();
  if (leaveType === LEAVE_TYPES.HALF_DAY) {
    const period =
      String(leaveRequest?.halfDayPeriod || '').trim() === HALF_DAY_PERIODS.SECOND
        ? '2nd Half'
        : '1st Half';
    return `${start} (${period})`;
  }
  if (start && end && start !== end) return `${start} – ${end}`;
  return start || end || '—';
}

export function leaveTypeLabel(leaveType) {
  const type = String(leaveType || '').trim();
  if (type === LEAVE_TYPES.ONE_DAY) return 'One day leave';
  if (type === LEAVE_TYPES.MULTIPLE_DAY) return 'Multiple day leave';
  if (type === LEAVE_TYPES.HALF_DAY) return 'Half day leave';
  return type || '—';
}

export function leaveDaysLabel(leaveRequest) {
  const leaveType = String(leaveRequest?.leaveType || '').trim();
  if (leaveType === LEAVE_TYPES.HALF_DAY) {
    const period =
      String(leaveRequest?.halfDayPeriod || '').trim() === HALF_DAY_PERIODS.SECOND
        ? '2nd Half'
        : '1st Half';
    return `0.5 day (${period})`;
  }
  const days = Number(leaveRequest?.durationDays);
  if (Number.isFinite(days) && days > 0) {
    return days === 1 ? '1 day' : `${days} days`;
  }
  return '—';
}

function dateRangeBodyLabel(leaveRequest) {
  const start = formatLeaveDateLabel(leaveRequest?.startDate);
  const end = formatLeaveDateLabel(leaveRequest?.endDate);
  if (start && end && start !== end) return `${start} – ${end}`;
  return start || end || '—';
}

/**
 * @param {'Approved'|'Rejected'} decision
 * @param {object} leaveRequest
 * @param {{ approvalComments?: string|null }} [extras]
 */
export function buildLeaveDecisionEmail(decision, leaveRequest, extras = {}) {
  const isApproved = decision === 'Approved';
  const employeeName =
    String(leaveRequest?.employeeName || '').trim() ||
    String(leaveRequest?.employeeCode || '').trim() ||
    'Employee';
  const datesLabel = formatLeaveDatesForSubject(leaveRequest);
  const subject = isApproved
    ? `Leave Request Approved — ${datesLabel}`
    : `Leave Request Rejected — ${datesLabel}`;

  const statusLabel = isApproved ? 'Approved' : 'Rejected';
  const leaveType = leaveTypeLabel(leaveRequest?.leaveType);
  const dateRange = dateRangeBodyLabel(leaveRequest);
  const daysLabel = leaveDaysLabel(leaveRequest);

  const rejectionReason = String(
    leaveRequest?.rejectionReason || extras.rejectionReason || '',
  ).trim();
  const rejectionDisplay = rejectionReason || 'No rejection reason was provided.';
  const approvalComments = String(extras.approvalComments || '').trim();

  const textLines = [
    `Hello ${employeeName},`,
    '',
    isApproved
      ? 'Your leave request has been approved.'
      : 'Your leave request has been rejected.',
    '',
    `Employee: ${employeeName}`,
    `Leave type: ${leaveType}`,
    `Leave dates: ${dateRange}`,
    `Number of leave days: ${daysLabel}`,
    `Status: ${statusLabel}`,
  ];

  if (isApproved && approvalComments) {
    textLines.push('', 'Approval comments:', approvalComments);
  }
  if (!isApproved) {
    textLines.push('', 'Rejection reason:', rejectionDisplay);
  }

  textLines.push(
    '',
    'You can review this request in the Payroll module of the ERP portal.',
  );

  const commentBlockHtml = isApproved
    ? approvalComments
      ? `<p><strong>Approval comments:</strong></p><p>${escapeHtml(approvalComments).replace(/\n/g, '<br>')}</p>`
      : ''
    : `<p><strong>Rejection reason:</strong></p><p>${escapeHtml(rejectionDisplay).replace(/\n/g, '<br>')}</p>`;

  const html = `<p>Hello ${escapeHtml(employeeName)},</p>
<p>${
    isApproved
      ? 'Your leave request has been <strong>approved</strong>.'
      : 'Your leave request has been <strong>rejected</strong>.'
  }</p>
<ul>
<li><strong>Employee:</strong> ${escapeHtml(employeeName)}</li>
<li><strong>Leave type:</strong> ${escapeHtml(leaveType)}</li>
<li><strong>Leave dates:</strong> ${escapeHtml(dateRange)}</li>
<li><strong>Number of leave days:</strong> ${escapeHtml(daysLabel)}</li>
<li><strong>Status:</strong> ${escapeHtml(statusLabel)}</li>
</ul>
${commentBlockHtml}
<p>You can review this request in the Payroll module of the ERP portal.</p>`;

  return { subject, text: textLines.join('\n'), html };
}

export function buildLeaveApprovedEmail(leaveRequest, extras = {}) {
  return buildLeaveDecisionEmail('Approved', leaveRequest, extras);
}

export function buildLeaveRejectedEmail(leaveRequest, extras = {}) {
  return buildLeaveDecisionEmail('Rejected', leaveRequest, extras);
}
