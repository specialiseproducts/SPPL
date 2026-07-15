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
  normalizeDateKey,
  buildFollowUpIntervals,
  timestampInDateRange,
  calendarDayDiff,
} from '../utils/salesQuotationDates.js';
import {
  resolveOwnerCode,
  normalizeWorkflowStatus,
  sanitizeRejectionReason,
} from '../utils/salesQuotationEmailUtils.js';
import log from '../utils/logger.js';

const FOLLOW_UP_WORKFLOWS = new Set(['draft', 'rejected']);
const DEADLINE_OVERDUE_WORKFLOWS = new Set(['draft', 'pending_approval', 'rejected']);

const ownerEmailCache = new Map();
let scheduledEmailRunInProgress = false;

function skippedResult(reason, extra = {}) {
  return { attempted: false, success: false, failed: false, reason, ...extra };
}

function attemptedResult({ success, failed, ownerAttempted = false, adminAttempted = false, extra = {} }) {
  return {
    attempted: ownerAttempted || adminAttempted,
    success,
    failed,
    ownerAttempted,
    adminAttempted,
    ...extra,
  };
}

function createRunStats() {
  return {
    quotationsLoaded: 0,
    followUpCandidates: 0,
    deadlineCandidates: 0,
    overdueCandidates: 0,
    followUpAttempted: 0,
    deadlineAttempted: 0,
    overdueAttempted: 0,
    overdueSucceeded: 0,
    overdueSkippedAlreadySent: 0,
    overdueSkippedWorkflow: 0,
    overdueSkippedDate: 0,
    ownerEmailsSent: 0,
    adminEmailsSent: 0,
    emailsAttempted: 0,
    emailsSucceeded: 0,
    emailsFailed: 0,
    skippedAlreadySent: 0,
    skippedWorkflow: 0,
    skippedDateMismatch: 0,
    skippedMissingEmail: 0,
    skippedUpdatedInInterval: 0,
    smtpFailures: 0,
  };
}

function applyProcessResult(stats, result) {
  if (!stats || !result) return;

  if (result.reason === 'already_sent') stats.skippedAlreadySent += 1;
  if (result.reason === 'workflow_not_eligible') stats.skippedWorkflow += 1;
  if (result.reason === 'date_mismatch' || result.reason === 'missing_dates') stats.skippedDateMismatch += 1;
  if (result.reason === 'missing_owner_email') stats.skippedMissingEmail += 1;
  if (result.reason === 'updated_in_interval') stats.skippedUpdatedInInterval += 1;

  if (result.ownerAttempted) {
    stats.emailsAttempted += 1;
    if (result.ownerSuccess) {
      stats.emailsSucceeded += 1;
      stats.ownerEmailsSent += 1;
    } else if (result.ownerFailed) {
      stats.emailsFailed += 1;
      stats.smtpFailures += 1;
    } else if (result.ownerSkipped) {
      stats.skippedMissingEmail += 1;
    }
  }

  if (result.adminAttempted) {
    stats.emailsAttempted += 1;
    if (result.adminSuccess) {
      stats.emailsSucceeded += 1;
      stats.adminEmailsSent += 1;
    } else if (result.adminFailed) {
      stats.emailsFailed += 1;
      stats.smtpFailures += 1;
    }
  }
}

async function resolveOwnerEmail(ownerEmployeeCode) {
  const code = String(ownerEmployeeCode || '').trim();
  log.info('resolveOwnerEmail: resolving owner', { ownerCode: code || '(empty)' });

  if (!code) {
    log.warn('resolveOwnerEmail: owner code missing');
    return { email: null, displayName: null };
  }

  if (ownerEmailCache.has(code)) {
    const cached = ownerEmailCache.get(code);
    log.info('resolveOwnerEmail: cache hit', {
      ownerCode: code,
      officialEmail: cached.email || '(missing)',
      displayName: cached.displayName || '(missing)',
    });
    return cached;
  }

  let email = null;
  let displayName = null;
  let employeeFound = false;

  try {
    const employee = await EmployeeMasterModel.getEmployeeByCode(code);
    if (employee) {
      employeeFound = true;
      email = String(employee.officialEmail || '').trim() || null;
      const first = String(employee.firstName || employee.first_name || '').trim();
      const last = String(employee.lastName || employee.last_name || '').trim();
      displayName = `${first} ${last}`.trim() || String(employee.name || '').trim() || null;
    }
  } catch (err) {
    log.error('resolveOwnerEmail: lookup failed', {
      ownerCode: code,
      error: err?.message || err,
      stack: err?.stack,
    });
  }

  if (!employeeFound) {
    log.warn('Owner employee not found', { ownerCode: code });
  } else if (!email) {
    log.warn('Official Email missing', { ownerCode: code });
  } else {
    log.info('resolveOwnerEmail: resolved', {
      ownerCode: code,
      employeeFound: true,
      officialEmail: email,
      displayName: displayName || '(missing)',
    });
  }

  const result = { email, displayName };
  ownerEmailCache.set(code, result);
  return result;
}

async function sendOwnerEmail(quotation, buildFn, context = {}) {
  const ownerCode = resolveOwnerCode(quotation);
  log.info('sendOwnerEmail: before owner lookup', { forecastId: quotation.forecastId, ownerCode });

  const { email, displayName } = await resolveOwnerEmail(ownerCode);

  log.info('sendOwnerEmail: after owner lookup', {
    forecastId: quotation.forecastId,
    ownerCode,
    resolvedEmail: email || '(missing)',
    resolvedDisplayName: displayName || '(missing)',
  });

  if (!email) {
    log.warn('sendOwnerEmail: skipping — no owner email', {
      forecastId: quotation.forecastId,
      ownerCode,
    });
    return { ok: false, skipped: true, reason: 'missing_owner_email' };
  }

  const { subject, text } = buildFn(quotation, displayName, context);

  log.info('sendOwnerEmail: Calling sendEmail()', {
    forecastId: quotation.forecastId,
    ownerCode,
    resolvedEmail: email,
    subject,
  });

  const result = await sendEmail({ to: email, subject, text });

  if (result.ok) {
    log.info('Owner email success', { forecastId: quotation.forecastId, subject });
  } else {
    log.error('Owner email failed', {
      forecastId: quotation.forecastId,
      subject,
      error: result.error,
    });
  }

  return result;
}

async function markNotificationSent(forecastId, patch) {
  try {
    await SalesForecastsModel.updateSalesForecast(forecastId, patch);
  } catch (err) {
    log.error('Failed to record email notification state', {
      forecastId,
      error: err?.message || err,
      stack: err?.stack,
    });
  }
}

function isFollowUpCandidate(quotation, todayKey) {
  const ws = normalizeWorkflowStatus(quotation);
  if (!FOLLOW_UP_WORKFLOWS.has(ws)) return false;

  const quotationDate = normalizeDateKey(quotation.quotationDate);
  const decisionExpectedBy = normalizeDateKey(quotation.decisionExpectedBy);
  if (!quotationDate || !decisionExpectedBy) return false;

  const intervals = buildFollowUpIntervals(quotationDate, decisionExpectedBy);
  return intervals.some((iv) => iv.endKey === todayKey);
}

function isDeadlineCandidate(quotation, todayKey) {
  const ws = normalizeWorkflowStatus(quotation);
  if (!DEADLINE_OVERDUE_WORKFLOWS.has(ws)) return false;

  const decisionExpectedBy = normalizeDateKey(quotation.decisionExpectedBy);
  return Boolean(decisionExpectedBy && decisionExpectedBy === todayKey);
}

function isOverdueCandidate(quotation, todayKey) {
  const ws = normalizeWorkflowStatus(quotation);
  if (!DEADLINE_OVERDUE_WORKFLOWS.has(ws)) return false;

  const decisionExpectedBy = normalizeDateKey(quotation.decisionExpectedBy);
  const deadline = parseDateKey(decisionExpectedBy);
  const today = parseDateKey(todayKey);
  return Boolean(deadline && today && today > deadline);
}

/**
 * Process 15-day follow-up reminders for a single quotation on the given IST date.
 */
export async function processFollowUpReminder(quotation, todayKey) {
  const forecastId = quotation?.forecastId;
  const originalWorkflow = quotation?.workflowStatus ?? quotation?.approval_status ?? '';
  const workflow = normalizeWorkflowStatus(quotation);

  log.info('processFollowUpReminder: entered', {
    forecastId,
    originalWorkflow,
    normalizedWorkflow: workflow,
    todayKey,
  });

  if (!FOLLOW_UP_WORKFLOWS.has(workflow)) {
    log.info('Skipped follow-up reminder: workflow not eligible', {
      forecastId,
      originalWorkflow,
      normalizedWorkflow: workflow,
    });
    return skippedResult('workflow_not_eligible');
  }

  const quotationDate = normalizeDateKey(quotation.quotationDate);
  const decisionExpectedBy = normalizeDateKey(quotation.decisionExpectedBy);

  if (!quotationDate || !decisionExpectedBy) {
    log.info('Skipped follow-up reminder: missing dates', {
      forecastId,
      quotationDate,
      decisionExpectedBy,
    });
    return skippedResult('missing_dates');
  }

  const intervals = buildFollowUpIntervals(quotationDate, decisionExpectedBy);
  const currentInterval = intervals.find((iv) => iv.endKey === todayKey);

  log.info('processFollowUpReminder: intervals', {
    forecastId,
    intervalsGenerated: intervals,
    currentInterval: currentInterval || null,
    todayKey,
  });

  if (!currentInterval) {
    log.info('Skipped follow-up reminder: no interval ending today', {
      forecastId,
      todayKey,
      decisionExpectedBy,
    });
    return skippedResult('date_mismatch');
  }

  const sentKeys = Array.isArray(quotation.emailFollowUpRemindersSent)
    ? quotation.emailFollowUpRemindersSent.map((k) => normalizeDateKey(k)).filter(Boolean)
    : [];

  if (sentKeys.includes(currentInterval.endKey)) {
    log.info('Skipped follow-up reminder: reminder already sent for interval', {
      forecastId,
      intervalEndKey: currentInterval.endKey,
      emailFollowUpRemindersSent: quotation.emailFollowUpRemindersSent,
    });
    return skippedResult('already_sent');
  }

  const updatedAt = quotation.updatedAt || quotation.updated_at;
  const insideInterval = timestampInDateRange(updatedAt, currentInterval.startKey, currentInterval.endKey);

  log.info('processFollowUpReminder: update check', {
    forecastId,
    updatedAt,
    insideInterval,
    intervalStart: currentInterval.startKey,
    intervalEnd: currentInterval.endKey,
  });

  if (insideInterval) {
    log.info('Skipped follow-up reminder: quotation updated during current interval', {
      forecastId,
      updatedAt,
    });
    return skippedResult('updated_in_interval');
  }

  const ownerResult = await sendOwnerEmail(quotation, (q, name) => buildFollowUpReminderEmail(q, name));

  const result = attemptedResult({
    success: ownerResult.ok === true,
    failed: !ownerResult.skipped && !ownerResult.ok,
    ownerAttempted: !ownerResult.skipped,
    ownerSuccess: ownerResult.ok === true,
    ownerFailed: !ownerResult.skipped && !ownerResult.ok,
    ownerSkipped: ownerResult.skipped === true,
  });

  if (ownerResult.ok) {
    await markNotificationSent(forecastId, {
      emailFollowUpRemindersSent: [...sentKeys, currentInterval.endKey],
    });
    log.info('15-day follow-up reminder sent', { forecastId });
  }

  return result;
}

/**
 * Process deadline reminder on decision expected by date.
 */
export async function processDeadlineReminder(quotation, todayKey) {
  const forecastId = quotation?.forecastId;
  const originalWorkflow = quotation?.workflowStatus ?? quotation?.approval_status ?? '';
  const workflow = normalizeWorkflowStatus(quotation);
  const decisionExpectedBy = normalizeDateKey(quotation.decisionExpectedBy);
  const normalizedTodayKey = normalizeDateKey(todayKey);
  const storedDeadlineSent = normalizeDateKey(quotation.emailDeadlineReminderSent);

  log.info('processDeadlineReminder: entered', {
    forecastId,
    originalWorkflow,
    normalizedWorkflow: workflow,
    decisionExpectedBy,
    todayKey: normalizedTodayKey,
    emailDeadlineReminderSent: quotation.emailDeadlineReminderSent ?? null,
    normalizedEmailDeadlineReminderSent: storedDeadlineSent || null,
  });

  if (!DEADLINE_OVERDUE_WORKFLOWS.has(workflow)) {
    log.info('Skipped deadline reminder: workflow not eligible', {
      forecastId,
      originalWorkflow,
      normalizedWorkflow: workflow,
    });
    return skippedResult('workflow_not_eligible');
  }

  if (!decisionExpectedBy) {
    log.info('Skipped deadline reminder: missing decisionExpectedBy', { forecastId });
    return skippedResult('missing_dates');
  }

  if (decisionExpectedBy !== normalizedTodayKey) {
    log.info('Deadline mismatch', {
      forecastId,
      decisionExpectedBy,
      todayKey: normalizedTodayKey,
    });
    return skippedResult('date_mismatch');
  }

  if (storedDeadlineSent && storedDeadlineSent === normalizedTodayKey) {
    log.info('Deadline reminder skipped because already sent today', {
      forecastId,
      emailDeadlineReminderSent: quotation.emailDeadlineReminderSent,
      normalizedEmailDeadlineReminderSent: storedDeadlineSent,
      todayKey: normalizedTodayKey,
    });
    return skippedResult('already_sent');
  }

  log.info('processDeadlineReminder: entered deadline logic — attempting sends', { forecastId });

  const adminEmail = getAdminEmail();
  let ownerSuccess = false;
  let ownerFailed = false;
  let ownerSkipped = false;
  let adminSuccess = false;
  let adminFailed = false;
  let adminAttempted = false;

  const ownerResult = await sendOwnerEmail(quotation, (q, name) => buildDeadlineOwnerEmail(q, name));
  if (ownerResult.skipped) {
    ownerSkipped = true;
  } else if (ownerResult.ok) {
    ownerSuccess = true;
  } else {
    ownerFailed = true;
  }

  if (adminEmail) {
    const { subject, text } = buildDeadlineAdminEmail(quotation);
    log.info('processDeadlineReminder: sending admin email', {
      forecastId,
      ADMIN_EMAIL: adminEmail,
      subject,
    });
    adminAttempted = true;
    const adminResult = await sendEmail({ to: adminEmail, subject, text });
    if (adminResult.ok) {
      adminSuccess = true;
      log.info('Admin email success', { forecastId, type: 'deadline' });
    } else {
      adminFailed = true;
      log.error('Admin email failed', { forecastId, type: 'deadline', error: adminResult.error });
    }
  } else {
    log.warn('ADMIN_EMAIL not configured — skipping deadline admin notification', { forecastId });
  }

  const anySuccess = ownerSuccess || adminSuccess;

  if (anySuccess) {
    await markNotificationSent(forecastId, {
      emailDeadlineReminderSent: normalizedTodayKey,
    });
    log.info('Deadline reminder processed', {
      forecastId,
      ownerSuccess,
      adminSuccess,
    });
  } else {
    log.warn('Deadline reminder: no emails sent — marker NOT updated', {
      forecastId,
      ownerSkipped,
      ownerFailed,
      adminFailed,
      adminAttempted,
    });
  }

  return attemptedResult({
    success: anySuccess,
    failed: ownerFailed || adminFailed,
    ownerAttempted: !ownerSkipped,
    adminAttempted,
    ownerSuccess,
    ownerFailed,
    adminSuccess,
    adminFailed,
    ownerSkipped,
  });
}

/**
 * Process daily overdue reminders.
 */
export async function processOverdueReminder(quotation, todayKey) {
  const forecastId = quotation?.forecastId;
  const originalWorkflow = quotation?.workflowStatus ?? quotation?.approval_status ?? '';
  const workflow = normalizeWorkflowStatus(quotation);
  const decisionExpectedBy = normalizeDateKey(quotation.decisionExpectedBy);
  const normalizedTodayKey = normalizeDateKey(todayKey);
  const storedOverdueSent = normalizeDateKey(quotation.emailOverdueReminderSentOn);
  const deadline = parseDateKey(decisionExpectedBy);
  const today = parseDateKey(normalizedTodayKey);
  const overdueDaysPreview =
    deadline && today && today > deadline ? calendarDayDiff(deadline, today) : null;
  const isOverdue = Boolean(deadline && today && today > deadline);

  log.info('=== OVERDUE DEBUG ===', {
    forecastId,
    workflow: originalWorkflow,
    normalizedWorkflow: workflow,
    decisionExpectedBy,
    todayKey: normalizedTodayKey,
    parsedDeadlineDate: deadline ? decisionExpectedBy : null,
    parsedTodayDate: today ? normalizedTodayKey : null,
    emailOverdueReminderSentOn: quotation.emailOverdueReminderSentOn ?? null,
    normalizedEmailOverdueReminderSentOn: storedOverdueSent || null,
    isOverdue,
    overdueDays: overdueDaysPreview,
  });
  log.info('=====================');

  if (!DEADLINE_OVERDUE_WORKFLOWS.has(workflow)) {
    log.info('Skipped: workflow not eligible', {
      forecastId,
      originalWorkflow,
      normalizedWorkflow: workflow,
    });
    return skippedResult('workflow_not_eligible');
  }

  if (!decisionExpectedBy) {
    log.info('Skipped: no decisionExpectedBy', { forecastId });
    return skippedResult('missing_dates');
  }

  const calendarDiff = deadline && today ? calendarDayDiff(deadline, today) : null;

  log.info('Overdue calculation', {
    forecastId,
    deadline: decisionExpectedBy,
    today: normalizedTodayKey,
    calendarDayDiff: calendarDiff,
    todayGreaterThanDeadline: isOverdue,
  });

  if (!deadline || !today) {
    log.info('Skipped: could not parse deadline or today date', {
      forecastId,
      decisionExpectedBy,
      todayKey: normalizedTodayKey,
    });
    return skippedResult('date_mismatch');
  }

  if (!isOverdue) {
    log.info('Skipped: today <= deadline', {
      forecastId,
      deadline: decisionExpectedBy,
      today: normalizedTodayKey,
      calendarDayDiff: calendarDiff,
    });
    return skippedResult('date_mismatch');
  }

  if (storedOverdueSent && storedOverdueSent === normalizedTodayKey) {
    log.info('Skipped: already sent today', {
      forecastId,
      alreadySentMarkerFound: quotation.emailOverdueReminderSentOn,
      normalizedAlreadySentMarker: storedOverdueSent,
      todayKey: normalizedTodayKey,
    });
    return skippedResult('already_sent');
  }

  log.info('Proceeding to send overdue email', { forecastId });

  const overdueDays = calendarDayDiff(deadline, today);
  const adminEmail = getAdminEmail();
  let ownerSuccess = false;
  let ownerFailed = false;
  let ownerSkipped = false;
  let adminSuccess = false;
  let adminFailed = false;
  let adminAttempted = false;
  let ownerResult = null;
  let adminResult = null;

  log.info('Calling owner overdue email...', { forecastId, overdueDays });
  ownerResult = await sendOwnerEmail(quotation, (q, name) => buildOverdueOwnerEmail(q, overdueDays, name));
  log.info('Owner overdue email result:', {
    forecastId,
    ok: ownerResult?.ok,
    skipped: ownerResult?.skipped,
    error: ownerResult?.error,
  });

  if (ownerResult.skipped) {
    ownerSkipped = true;
  } else if (ownerResult.ok) {
    ownerSuccess = true;
  } else {
    ownerFailed = true;
  }

  if (adminEmail) {
    const { subject, text } = buildOverdueAdminEmail(quotation, overdueDays);
    log.info('Calling admin overdue email...', {
      forecastId,
      ADMIN_EMAIL: adminEmail,
      subject,
    });
    adminAttempted = true;
    adminResult = await sendEmail({ to: adminEmail, subject, text });
    log.info('Admin overdue email result:', {
      forecastId,
      ok: adminResult?.ok,
      error: adminResult?.error,
    });
    if (adminResult.ok) {
      adminSuccess = true;
    } else {
      adminFailed = true;
      log.error('Admin email failed', { forecastId, type: 'overdue', error: adminResult.error });
    }
  } else {
    log.warn('ADMIN_EMAIL not configured — skipping overdue admin notification', { forecastId });
  }

  const anySuccess = ownerSuccess || adminSuccess;

  log.info('Overdue send summary before marker update', {
    forecastId,
    ownerResult: {
      ok: ownerResult?.ok,
      skipped: ownerResult?.skipped,
      error: ownerResult?.error,
    },
    adminResult: adminResult
      ? { ok: adminResult.ok, error: adminResult.error }
      : { attempted: adminAttempted },
    anySent: anySuccess,
  });

  if (anySuccess) {
    await markNotificationSent(forecastId, {
      emailOverdueReminderSentOn: normalizedTodayKey,
    });
    log.info('Overdue reminder processed — marker updated', {
      forecastId,
      overdueDays,
      ownerSuccess,
      adminSuccess,
    });
  } else {
    log.warn('Overdue reminder: no emails sent — marker NOT updated', {
      forecastId,
      ownerSkipped,
      ownerFailed,
      adminFailed,
      adminAttempted,
    });
  }

  return attemptedResult({
    success: anySuccess,
    failed: ownerFailed || adminFailed,
    ownerAttempted: !ownerSkipped,
    adminAttempted,
    ownerSuccess,
    ownerFailed,
    adminSuccess,
    adminFailed,
    ownerSkipped,
  });
}

/**
 * Send rejection email immediately when admin rejects a quotation.
 */
export async function sendRejectionNotification(quotation, rejectionReason) {
  const ownerCode = resolveOwnerCode(quotation);
  const { email, displayName } = await resolveOwnerEmail(ownerCode);

  if (!email) {
    log.warn('sendRejectionNotification: skipping — no owner email', {
      forecastId: quotation.forecastId,
      ownerCode,
    });
    return { ok: false, skipped: true };
  }

  const rawRejectionReason = rejectionReason;
  const sanitizedRejectionReason = sanitizeRejectionReason(rejectionReason);

  log.info('sendRejectionNotification: rejection reason sanitization', {
    forecastId: quotation.forecastId,
    rawRejectionReason,
    sanitizedRejectionReason,
  });

  const { subject, text } = buildRejectionEmail(quotation, sanitizedRejectionReason, displayName);

  log.info('sendRejectionNotification: sending', {
    forecastId: quotation.forecastId,
    ownerCode,
    resolvedEmail: email,
    subject,
  });

  const result = await sendEmail({ to: email, subject, text });

  if (result.ok) {
    log.info('Rejection email sent', { forecastId: quotation.forecastId });
  } else {
    log.error('Rejection email failed', {
      forecastId: quotation.forecastId,
      error: result.error,
    });
  }

  return result;
}

/**
 * Run all scheduled quotation email jobs for today (IST).
 */
export async function runScheduledQuotationEmails(referenceDate = new Date()) {
  if (scheduledEmailRunInProgress) {
    log.warn('Sales quotation scheduled email run skipped — already in progress');
    return;
  }

  scheduledEmailRunInProgress = true;
  const todayKey = todayIstDateKey(referenceDate);
  const stats = createRunStats();

  log.info('===== SALES EMAIL SCHEDULER START =====', { todayKey });
  log.info('Scheduler running', { todayKey });

  ownerEmailCache.clear();

  try {
    let quotations;
    try {
      quotations = await SalesForecastsModel.queryAllSalesForecasts();
    } catch (err) {
      log.error('Scheduled emails: failed to load quotations', {
        error: err?.message || err,
        stack: err?.stack,
      });
      return;
    }

    stats.quotationsLoaded = quotations.length;
    log.info('Quotations found', { count: stats.quotationsLoaded, todayKey });

    for (const quotation of quotations) {
      const forecastId = quotation?.forecastId;
      const originalWorkflow = quotation?.workflowStatus ?? quotation?.approval_status ?? '';
      const workflow = normalizeWorkflowStatus(quotation);
      const decisionExpectedBy = normalizeDateKey(quotation.decisionExpectedBy);
      const createdBy = resolveOwnerCode(quotation);
      const adminEmail = getAdminEmail();

      log.info('Quotation snapshot', {
        forecastId,
        originalWorkflow,
        normalizedWorkflow: workflow,
        decisionExpectedBy,
        todayKey,
        created_by: createdBy,
        adminResolved: adminEmail || '(not configured)',
      });

      if (isFollowUpCandidate(quotation, todayKey)) stats.followUpCandidates += 1;
      if (isDeadlineCandidate(quotation, todayKey)) stats.deadlineCandidates += 1;
      if (isOverdueCandidate(quotation, todayKey)) stats.overdueCandidates += 1;

      log.info('Processing quotation', { forecastId });

      try {
        log.info('Entering processFollowUpReminder', { forecastId });
        const followUpResult = await processFollowUpReminder(quotation, todayKey);
        log.info('Finished processFollowUpReminder', { forecastId, result: followUpResult });
        if (followUpResult.attempted) stats.followUpAttempted += 1;
        applyProcessResult(stats, followUpResult);

        log.info('Entering processDeadlineReminder', { forecastId });
        const deadlineResult = await processDeadlineReminder(quotation, todayKey);
        log.info('Finished processDeadlineReminder', { forecastId, result: deadlineResult });
        if (deadlineResult.attempted) stats.deadlineAttempted += 1;
        applyProcessResult(stats, deadlineResult);

        log.info('Entering processOverdueReminder', { forecastId });
        const overdueResult = await processOverdueReminder(quotation, todayKey);
        log.info('Finished processOverdueReminder', { forecastId, result: overdueResult });
        if (overdueResult.attempted) stats.overdueAttempted += 1;
        if (overdueResult.success) stats.overdueSucceeded += 1;
        if (overdueResult.reason === 'already_sent') stats.overdueSkippedAlreadySent += 1;
        if (overdueResult.reason === 'workflow_not_eligible') stats.overdueSkippedWorkflow += 1;
        if (overdueResult.reason === 'date_mismatch' || overdueResult.reason === 'missing_dates') {
          stats.overdueSkippedDate += 1;
        }
        applyProcessResult(stats, overdueResult);

        log.info('Completed quotation', { forecastId });
      } catch (err) {
        log.error('Scheduled email processing failed for quotation', {
          forecastId,
          error: err?.message || err,
          stack: err?.stack,
        });
      }
    }

    log.info('===== SALES EMAIL SCHEDULER COMPLETE =====', {
      todayKey,
      totalQuotations: stats.quotationsLoaded,
      followUpCandidates: stats.followUpCandidates,
      deadlineCandidates: stats.deadlineCandidates,
      overdueCandidates: stats.overdueCandidates,
      followUpAttempted: stats.followUpAttempted,
      deadlineAttempted: stats.deadlineAttempted,
      overdueAttempted: stats.overdueAttempted,
      overdueSucceeded: stats.overdueSucceeded,
      overdueSkippedAlreadySent: stats.overdueSkippedAlreadySent,
      overdueSkippedWorkflow: stats.overdueSkippedWorkflow,
      overdueSkippedDate: stats.overdueSkippedDate,
      ownerEmailsSent: stats.ownerEmailsSent,
      adminEmailsSent: stats.adminEmailsSent,
      skippedAlreadySent: stats.skippedAlreadySent,
      skippedWorkflow: stats.skippedWorkflow,
      skippedDateMismatch: stats.skippedDateMismatch,
      skippedMissingEmail: stats.skippedMissingEmail,
      skippedUpdatedInInterval: stats.skippedUpdatedInInterval,
      smtpFailures: stats.smtpFailures,
      emailsAttempted: stats.emailsAttempted,
      totalSuccess: stats.emailsSucceeded,
      totalFailures: stats.emailsFailed,
    });
  } finally {
    scheduledEmailRunInProgress = false;
  }
}
