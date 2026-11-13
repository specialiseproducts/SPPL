/**
 * Email to Reporting Person when an employee submits a new leave request.
 */

import {
  HALF_DAY_PERIODS,
  LEAVE_TYPES,
} from '../utils/payrollLeaveDates.js';
import {
  leaveDaysLabel,
  leaveTypeLabel,
} from './payrollLeaveDecisionEmail.js';

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

function leaveMonthYearHeading(leaveRequest) {
  const key = String(leaveRequest?.startDate || leaveRequest?.endDate || '')
    .trim()
    .slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return 'Leave Request';
  const [y, m] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  const label = dt.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `Leave Request for ${label}`;
}

function datesDetailLabel(leaveRequest) {
  const leaveType = String(leaveRequest?.leaveType || '').trim();
  const start = formatLeaveDateLabel(leaveRequest?.startDate);
  const end = formatLeaveDateLabel(leaveRequest?.endDate);
  if (leaveType === LEAVE_TYPES.HALF_DAY) {
    const period =
      String(leaveRequest?.halfDayPeriod || '').trim() === HALF_DAY_PERIODS.SECOND
        ? '2nd Half'
        : '1st Half';
    return `From ${start} (${period})`;
  }
  if (start && end && start !== end) {
    return `From ${start} To ${end}`;
  }
  return `From ${start || end || '—'}`;
}

/**
 * Build manager-facing leave submission notification.
 * @param {object} leaveRequest
 */
export function buildLeaveSubmittedToManagerEmail(leaveRequest) {
  const employeeName =
    String(leaveRequest?.employeeName || '').trim() ||
    String(leaveRequest?.employeeCode || '').trim() ||
    'Employee';
  const typeLabel = leaveTypeLabel(leaveRequest?.leaveType);
  const datesLabel = datesDetailLabel(leaveRequest);
  const daysLabel = leaveDaysLabel(leaveRequest);
  const reason = String(leaveRequest?.reason || '').trim() || '—';
  const heading = leaveMonthYearHeading(leaveRequest);

  const subject = `Leave Request – ${employeeName} – ${typeLabel}`;

  const text = [
    heading,
    '',
    `${employeeName} has submitted a leave request that requires your attention.`,
    '',
    `Employee Name: ${employeeName}`,
    `Type of Leave: ${typeLabel}`,
    `Dates: ${datesLabel}`,
    `No. of Days: ${daysLabel}`,
    `Reason: ${reason}`,
    '',
    'Please review and approve or reject this request in the Payroll module of the ERP portal.',
  ].join('\n');

  const html = `
<div style="font-family: Arial, Helvetica, sans-serif; color: #212529; line-height: 1.5; max-width: 640px;">
  <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 600;">${escapeHtml(heading)}</h2>
  <p style="margin: 0 0 16px;">
    <strong>${escapeHtml(employeeName)}</strong> has submitted a leave request that requires your attention.
  </p>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
    style="border-collapse: collapse; width: 100%; border: 1px solid #dee2e6;">
    <tbody>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #dee2e6; background: #f8f9fa; width: 36%; font-weight: 600;">Employee Name</td>
        <td style="padding: 10px 12px; border: 1px solid #dee2e6;">${escapeHtml(employeeName)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #dee2e6; background: #f8f9fa; font-weight: 600;">Type of Leave</td>
        <td style="padding: 10px 12px; border: 1px solid #dee2e6;">${escapeHtml(typeLabel)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #dee2e6; background: #f8f9fa; font-weight: 600;">Dates</td>
        <td style="padding: 10px 12px; border: 1px solid #dee2e6;">${escapeHtml(datesLabel)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #dee2e6; background: #f8f9fa; font-weight: 600;">No. of Days</td>
        <td style="padding: 10px 12px; border: 1px solid #dee2e6;">${escapeHtml(daysLabel)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #dee2e6; background: #f8f9fa; font-weight: 600; vertical-align: top;">Reason</td>
        <td style="padding: 10px 12px; border: 1px solid #dee2e6;">${escapeHtml(reason).replace(/\n/g, '<br>')}</td>
      </tr>
    </tbody>
  </table>
  <p style="margin: 16px 0 0;">
    Please review and approve or reject this request in the Payroll module of the ERP portal.
  </p>
</div>`.trim();

  return { subject, text, html };
}
