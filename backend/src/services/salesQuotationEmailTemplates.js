/**
 * Centralized email templates for sales quotation notifications.
 */

import { formatDisplayDate } from '../utils/salesQuotationDates.js';

function productName(quotation) {
  return (
    String(quotation.modelNumber || '').trim() ||
    String(quotation.productDescription || '').trim() ||
    '—'
  );
}

function customerName(quotation) {
  return String(quotation.customerOrganization || quotation.endCustomer || '').trim() || '—';
}

function principalName(quotation) {
  return String(quotation.principal || '').trim() || '—';
}

function ownerName(quotation) {
  return String(quotation.ownerEmployeeName || quotation.employeeName || '').trim() || '—';
}

function workflowLabel(ws) {
  switch (ws) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'pending_approval':
      return 'Pending Approval';
    default:
      return 'Draft';
  }
}

export function buildFollowUpReminderEmail(quotation, ownerDisplayName) {
  const product = productName(quotation);
  const customer = customerName(quotation);
  const principal = principalName(quotation);
  const greeting = ownerDisplayName || ownerName(quotation);

  const subject = `Quotation 15 Day Follow-up Reminder: ${product} - ${customer}`;
  const text = [
    `Hello ${greeting},`,
    '',
    'This is a periodic follow-up reminder regarding your quotation.',
    '',
    'Quotation Details',
    '',
    product,
    customer,
    principal,
    '',
    'No updates have been recorded during the current follow-up period.',
    '',
    'Please review the quotation, obtain the latest customer status, and update it.',
  ].join('\n');

  return { subject, text };
}

export function buildDeadlineOwnerEmail(quotation, ownerDisplayName) {
  const product = productName(quotation);
  const customer = customerName(quotation);
  const principal = principalName(quotation);
  const greeting = ownerDisplayName || ownerName(quotation);

  const subject = `Quotation Deadline Reminder: ${product} - ${customer}`;
  const text = [
    `Hello ${greeting},`,
    '',
    'This is a reminder that the quotation:',
    '',
    product,
    customer,
    principal,
    '',
    'has a Decision Expected By date of today.',
    '',
    'Please take necessary action.',
  ].join('\n');

  return { subject, text };
}

export function buildDeadlineAdminEmail(quotation) {
  const product = productName(quotation);
  const customer = customerName(quotation);
  const principal = principalName(quotation);
  const owner = ownerName(quotation);
  const deadlineDate = formatDisplayDate(quotation.decisionExpectedBy);

  const subject = `[REMINDER] Quotation Deadline Today - ${product} - ${customer}`;
  const text = [
    'Hello Admin,',
    '',
    'A quotation has reached its deadline today.',
    '',
    'Quotation Details',
    '',
    product,
    customer,
    principal,
    owner,
    '',
    'Deadline Type:',
    'Decision Expected By',
    deadlineDate,
    '',
    'Action Required:',
    'Please ensure that the quotation owner follows up and updates the quotation status accordingly.',
  ].join('\n');

  return { subject, text };
}

export function buildOverdueOwnerEmail(quotation, overdueDays) {
  const product = productName(quotation);
  const customer = customerName(quotation);
  const principal = principalName(quotation);
  const deadlineDate = formatDisplayDate(quotation.decisionExpectedBy);
  const status = workflowLabel(quotation.workflowStatus || 'draft');
  const overdueLabel = overdueDays === 1 ? '1 day' : `${overdueDays} days`;

  const subject = `URGENT: ${product} - ${customer}`;
  const text = [
    product,
    customer,
    principal,
    deadlineDate,
    status,
    `Overdue by ${overdueLabel}`,
    '',
    'Please update the quotation immediately.',
  ].join('\n');

  return { subject, text };
}

export function buildOverdueAdminEmail(quotation, overdueDays) {
  const product = productName(quotation);
  const customer = customerName(quotation);
  const principal = principalName(quotation);
  const owner = ownerName(quotation);
  const deadlineDate = formatDisplayDate(quotation.decisionExpectedBy);
  const status = workflowLabel(quotation.workflowStatus || 'draft');
  const overdueLabel = overdueDays === 1 ? '1 day' : `${overdueDays} days`;

  const subject = `[URGENT] Quotation Overdue - ${product} - ${customer}`;
  const text = [
    'Hello Admin,',
    '',
    'A quotation is overdue and requires immediate attention.',
    '',
    'Quotation Details',
    '',
    product,
    customer,
    principal,
    owner,
    '',
    'Deadline Type',
    'Decision Expected By',
    deadlineDate,
    'Current Status',
    status,
    `Overdue by ${overdueLabel}`,
    '',
    'Action Required',
    'Please follow up with the quotation owner and ensure the quotation is updated or closed.',
  ].join('\n');

  return { subject, text };
}

export function buildRejectionEmail(quotation, rejectionReason, ownerDisplayName) {
  const product = productName(quotation);
  const customer = customerName(quotation);
  const principal = principalName(quotation);
  const greeting = ownerDisplayName || ownerName(quotation);
  const reason = String(rejectionReason || '').trim() || '—';

  const subject = `Quotation Rejected: ${product} - ${customer}`;
  const text = [
    `Hello ${greeting},`,
    '',
    'Your quotation has been reviewed and has been rejected.',
    '',
    'Quotation Details',
    '',
    product,
    customer,
    principal,
    '',
    'Reason for Rejection:',
    reason,
    '',
    'Please review the above comments, make the necessary changes, and update the quotation in the Sales Forecasting System before resubmitting it for approval.',
  ].join('\n');

  return { subject, text };
}
