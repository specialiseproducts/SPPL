/**
 * Sales quotation email notifications — follow-up, deadline, overdue, rejection.
 */

import * as SalesForecastsModel from '../models/SalesForecasts.js';
import * as EmployeeMasterModel from '../models/EmployeeMaster.js';
import { sendEmail, getAdminEmail } from './emailService.js';
import {
  buildFollowUpReminderEmail,
  buildDeadlineOwnerEmail,
  buildDeadlineAdminEmail,
  buildOverdueOwnerEmail,
  buildOverdueAdminEmail,
  buildRejectionEmail,
} from './salesQuotationEmailTemplates.js';
import {
  todayIstDateKey,
  parseDateKey,
  buildFollowUpIntervals,
  timestampInDateRange,
  calendarDayDiff,
} from '../utils/salesQuotationDates.js';
import log from '../utils/logger.js';

const FOLLOW_UP_WORKFLOWS = new Set(['draft', 'rejected']);
const DEADLINE_OVERDUE_WORKFLOWS = new Set(['draft', 'pending_approval', 'rejected']);

const ownerEmailCache = new Map();

async function resolveOwnerEmail(ownerEmployeeCode) {
  const code = String(ownerEmployeeCode || '').trim();
  if (!code) return { email: null, displayName: null };

  if (ownerEmailCache.has(code)) {
    return ownerEmailCache.get(code);
  }

  let email = null;
  let displayName = null;

  try {
    const employee = await EmployeeMasterModel.getEmployeeByCode(code);
    if (employee) {
      email = String(employee.officialEmail || employee.official_email || employee.email || '').trim() || null;
      const first = String(employee.firstName || employee.first_name || '').trim();
      const last = String(employee.lastName || employee.last_name || '').trim();
      displayName = `${first} ${last}`.trim() || String(employee.name || '').trim() || null;
    }
  } catch (err) {
    log.error('Failed to resolve owner email', { ownerEmployeeCode: code, error: err?.message || err });
  }

  const result = { email, displayName };
  ownerEmailCache.set(code, result);
  return result;
}

function normalizeWorkflow(item) {
  const ws = item?.workflowStatus;
  if (ws) return ws;
  const legacy = String(item?.approval_status || '').trim();
  if (legacy === 'Approved') return 'approved';
  if (legacy === 'Rejected') return 'rejected';
  if (legacy === 'Pending') return 'pending_approval';
  return 'draft';
}

async function sendOwnerEmail(quotation, buildFn, context = {}) {
  const ownerCode = quotation.ownerEmployeeCode || quotation.created_by_employee_code;
  const { email, displayName } = await resolveOwnerEmail(ownerCode);

  if (!email) {
    log.warn('Skipping owner email — missing Official Email Address', {
      forecastId: quotation.forecastId,
      ownerEmployeeCode: ownerCode,
    });
    return { ok: false, skipped: true };
  }

  const { subject, text } = buildFn(quotation, displayName, context);
  return sendEmail({ to: email, subject, text });
}

async function markNotificationSent(forecastId, patch) {
  try {
    await SalesForecastsModel.updateSalesForecast(forecastId, patch);
  } catch (err) {
    log.error('Failed to record email notification state', {
      forecastId,
      error: err?.message || err,
    });
  }
}

/**
 * Process 15-day follow-up reminders for a single quotation on the given IST date.
 */
export async function processFollowUpReminder(quotation, todayKey) {
  const ws = normalizeWorkflow(quotation);
  if (!FOLLOW_UP_WORKFLOWS.has(ws)) return;

  const quotationDate = String(quotation.quotationDate || '').trim();
  const decisionExpectedBy = String(quotation.decisionExpectedBy || '').trim();
  if (!quotationDate || !decisionExpectedBy) return;

  const intervals = buildFollowUpIntervals(quotationDate, decisionExpectedBy);
  const currentInterval = intervals.find((iv) => iv.endKey === todayKey);
  if (!currentInterval) return;

  const sentKeys = Array.isArray(quotation.emailFollowUpRemindersSent)
    ? quotation.emailFollowUpRemindersSent
    : [];
  if (sentKeys.includes(currentInterval.endKey)) return;

  const updatedAt = quotation.updatedAt || quotation.updated_at;
  if (timestampInDateRange(updatedAt, currentInterval.startKey, currentInterval.endKey)) {
    return;
  }

  const result = await sendOwnerEmail(quotation, (q, name) => buildFollowUpReminderEmail(q, name));
  if (result.ok) {
    await markNotificationSent(quotation.forecastId, {
      emailFollowUpRemindersSent: [...sentKeys, currentInterval.endKey],
    });
    log.info('15-day follow-up reminder sent', { forecastId: quotation.forecastId });
  }
}

/**
 * Process deadline reminder on decision expected by date.
 */
export async function processDeadlineReminder(quotation, todayKey) {
  const ws = normalizeWorkflow(quotation);
  if (!DEADLINE_OVERDUE_WORKFLOWS.has(ws)) return;

  const decisionExpectedBy = String(quotation.decisionExpectedBy || '').trim();
  if (!decisionExpectedBy || decisionExpectedBy.slice(0, 10) !== todayKey) return;

  if (quotation.emailDeadlineReminderSent === todayKey) return;

  const adminEmail = getAdminEmail();
  let ownerSent = false;
  let adminSent = !adminEmail;

  const ownerResult = await sendOwnerEmail(quotation, (q, name) => buildDeadlineOwnerEmail(q, name));
  if (ownerResult.ok || ownerResult.skipped) {
    ownerSent = ownerResult.ok;
  }

  if (adminEmail) {
    const { subject, text } = buildDeadlineAdminEmail(quotation);
    const adminResult = await sendEmail({ to: adminEmail, subject, text });
    adminSent = adminResult.ok;
    if (!adminResult.ok) {
      log.error('Deadline admin email failed', { forecastId: quotation.forecastId });
    }
  } else {
    log.warn('ADMIN_EMAIL not configured — skipping deadline admin notification');
  }

  if (ownerSent || adminSent) {
    await markNotificationSent(quotation.forecastId, {
      emailDeadlineReminderSent: todayKey,
    });
    log.info('Deadline reminder processed', { forecastId: quotation.forecastId, ownerSent, adminSent });
  }
}

/**
 * Process daily overdue reminders.
 */
export async function processOverdueReminder(quotation, todayKey) {
  const ws = normalizeWorkflow(quotation);
  if (!DEADLINE_OVERDUE_WORKFLOWS.has(ws)) return;

  const decisionExpectedBy = String(quotation.decisionExpectedBy || '').trim();
  const deadline = parseDateKey(decisionExpectedBy);
  const today = parseDateKey(todayKey);
  if (!deadline || !today || today <= deadline) return;

  if (quotation.emailOverdueReminderSentOn === todayKey) return;

  const overdueDays = calendarDayDiff(deadline, today);
  const adminEmail = getAdminEmail();

  let anySent = false;

  const ownerResult = await sendOwnerEmail(quotation, (q) => buildOverdueOwnerEmail(q, overdueDays));
  if (ownerResult.ok) anySent = true;

  if (adminEmail) {
    const { subject, text } = buildOverdueAdminEmail(quotation, overdueDays);
    const adminResult = await sendEmail({ to: adminEmail, subject, text });
    if (adminResult.ok) anySent = true;
    if (!adminResult.ok) {
      log.error('Overdue admin email failed', { forecastId: quotation.forecastId });
    }
  } else {
    log.warn('ADMIN_EMAIL not configured — skipping overdue admin notification');
  }

  if (anySent) {
    await markNotificationSent(quotation.forecastId, {
      emailOverdueReminderSentOn: todayKey,
    });
    log.info('Overdue reminder processed', { forecastId: quotation.forecastId, overdueDays });
  }
}

/**
 * Send rejection email immediately when admin rejects a quotation.
 */
export async function sendRejectionNotification(quotation, rejectionReason) {
  const ownerCode = quotation.ownerEmployeeCode || quotation.created_by_employee_code;
  const { email, displayName } = await resolveOwnerEmail(ownerCode);

  if (!email) {
    log.warn('Skipping rejection email — missing Official Email Address', {
      forecastId: quotation.forecastId,
      ownerEmployeeCode: ownerCode,
    });
    return { ok: false, skipped: true };
  }

  const { subject, text } = buildRejectionEmail(quotation, rejectionReason, displayName);
  const result = await sendEmail({ to: email, subject, text });

  if (result.ok) {
    log.info('Rejection email sent', { forecastId: quotation.forecastId });
  }

  return result;
}

/**
 * Run all scheduled quotation email jobs for today (IST).
 */
export async function runScheduledQuotationEmails(referenceDate = new Date()) {
  const todayKey = todayIstDateKey(referenceDate);
  log.info('Running scheduled quotation emails', { todayKey });

  ownerEmailCache.clear();

  let quotations;
  try {
    quotations = await SalesForecastsModel.queryAllSalesForecasts();
  } catch (err) {
    log.error('Scheduled emails: failed to load quotations', err?.message || err);
    return;
  }

  let processed = 0;
  let errors = 0;

  for (const quotation of quotations) {
    try {
      await processFollowUpReminder(quotation, todayKey);
      await processDeadlineReminder(quotation, todayKey);
      await processOverdueReminder(quotation, todayKey);
      processed += 1;
    } catch (err) {
      errors += 1;
      log.error('Scheduled email processing failed for quotation', {
        forecastId: quotation?.forecastId,
        error: err?.message || err,
      });
    }
  }

  log.info('Scheduled quotation emails complete', { todayKey, processed, errors });
}
