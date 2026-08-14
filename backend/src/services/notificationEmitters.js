/**
 * Convenience emitters for module notification events.
 * Always go through NotificationService — never write DynamoDB here.
 */

import * as NotificationService from './notification.service.js';
import {
  ACTION_KINDS,
  ACTION_OUTCOMES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_MODULES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_SECTIONS,
} from '../constants/notifications.js';

const M = NOTIFICATION_MODULES;

export async function emitExpenseSubmitted(expense, actorCode) {
  const id = expense?.expenseId || '';
  await NotificationService.notifyModuleAdmins(
    M.EXPENSES,
    {
      title: 'Expense Waiting Approval',
      message: `${expense?.created_by_name || expense?.employeeName || 'Employee'} submitted an expense for approval.`,
      category: NOTIFICATION_CATEGORIES.APPROVALS,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      section: NOTIFICATION_SECTIONS.ACTION_REQUIRED,
      actionType: 'Open',
      actionId: id,
      actionUrl: `/audit-expenses/${encodeURIComponent(id)}`,
      createdBy: actorCode || '',
      metadata: { expenseId: id, expenseHead: expense?.expenseHead },
    },
    { excludeEmployeeCode: actorCode },
  );
}

function appendReason(baseMessage, reason) {
  const remark = String(reason || '').trim();
  if (!remark) return baseMessage;
  return `${baseMessage}\n\nReason:\n${remark}`;
}

/** Match sales email owner resolution (created_by → ownerEmployeeCode → …). */
function resolveSalesOwnerCode(quotation) {
  return String(
    quotation?.created_by ||
      quotation?.ownerEmployeeCode ||
      quotation?.created_by_employee_code ||
      '',
  ).trim();
}

/** Phase 1 — Expense Approved → expense owner */
export async function emitExpenseApproved(expense, actorCode) {
  const owner = expense?.created_by_employee_code || expense?.employeeCode || '';
  const id = expense?.expenseId || '';
  const employeeName = expense?.created_by_name || expense?.employeeName || '';
  await NotificationService.create({
    recipientEmployeeCode: owner,
    module: M.EXPENSES,
    title: 'Expense Approved',
    message: 'Your expense claim has been approved.',
    category: NOTIFICATION_CATEGORIES.APPROVALS,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: id,
    actionUrl: id ? `/my-expenses/edit/${encodeURIComponent(id)}` : '',
    createdBy: actorCode || '',
    metadata: {
      expenseId: id,
      employeeCode: owner,
      employeeName,
    },
  });
}

/** Phase 1 — Expense Rejected → expense owner */
export async function emitExpenseRejected(expense, reason, actorCode) {
  const owner = expense?.created_by_employee_code || expense?.employeeCode || '';
  const id = expense?.expenseId || '';
  const employeeName = expense?.created_by_name || expense?.employeeName || '';
  const remark = String(reason || '').trim();
  await NotificationService.create({
    recipientEmployeeCode: owner,
    module: M.EXPENSES,
    title: 'Expense Rejected',
    message: appendReason('Your expense claim has been rejected.', remark),
    category: NOTIFICATION_CATEGORIES.APPROVALS,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: id,
    actionUrl: id ? `/my-expenses/edit/${encodeURIComponent(id)}` : '',
    createdBy: actorCode || '',
    metadata: {
      expenseId: id,
      employeeCode: owner,
      employeeName,
      reason: remark,
    },
  });
}

export async function emitExpenseExportCompleted(employeeCode, exportBatch, actorCode) {
  await NotificationService.create({
    recipientEmployeeCode: employeeCode,
    module: M.EXPENSES,
    title: 'Expense Export Completed',
    message: exportBatch
      ? `Your expense export batch ${exportBatch} completed.`
      : 'Your expense export completed.',
    category: NOTIFICATION_CATEGORIES.EXPENSES,
    priority: NOTIFICATION_PRIORITIES.LOW,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionUrl: '',
    createdBy: actorCode || '',
    metadata: { exportBatch },
  });
}

export async function emitQuotationSubmitted(quotation, actorCode) {
  const id = quotation?.forecastId || '';
  await NotificationService.notifyModuleAdmins(
    M.SALES,
    {
      title: 'Quotation Waiting Approval',
      message: `${quotation?.ownerEmployeeName || 'Employee'} submitted a quotation for approval.`,
      category: NOTIFICATION_CATEGORIES.APPROVALS,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      section: NOTIFICATION_SECTIONS.ACTION_REQUIRED,
      actionType: 'Open',
      actionId: id,
      actionUrl: '',
      createdBy: actorCode || '',
      metadata: {
        forecastId: id,
        customer: quotation?.customerOrganization,
        principal: quotation?.principal,
      },
    },
    { excludeEmployeeCode: actorCode },
  );

  await NotificationService.notifyModuleAdmins(
    M.SALES,
    {
      title: 'New Quotation Submitted',
      message: `New quotation submitted by ${quotation?.ownerEmployeeName || actorCode || 'employee'}.`,
      category: NOTIFICATION_CATEGORIES.SALES,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      section: NOTIFICATION_SECTIONS.ACTIVITY,
      actionType: 'View',
      actionId: id,
      createdBy: actorCode || '',
      metadata: { forecastId: id },
    },
    { excludeEmployeeCode: actorCode },
  );
}

/** Phase 1 — Quotation Approved → quotation owner */
export async function emitQuotationApproved(quotation, actorCode) {
  const owner = resolveSalesOwnerCode(quotation);
  const id = quotation?.forecastId || '';
  const quotationRef = quotation?.quotationRef || '';
  await NotificationService.create({
    recipientEmployeeCode: owner,
    module: M.SALES,
    title: 'Quotation Approved',
    message: 'Your quotation has been approved.',
    category: NOTIFICATION_CATEGORIES.APPROVALS,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: id,
    createdBy: actorCode || '',
    metadata: {
      forecastId: id,
      quotationRef,
      employeeCode: owner,
      employeeName: quotation?.ownerEmployeeName || '',
    },
  });
}

/** Phase 1 — Quotation Rejected → quotation owner */
export async function emitQuotationRejected(quotation, reason, actorCode) {
  const owner = resolveSalesOwnerCode(quotation);
  const id = quotation?.forecastId || '';
  const quotationRef = quotation?.quotationRef || '';
  const remark = String(reason || '').trim();
  await NotificationService.create({
    recipientEmployeeCode: owner,
    module: M.SALES,
    title: 'Quotation Rejected',
    message: appendReason('Your quotation has been rejected.', remark),
    category: NOTIFICATION_CATEGORIES.APPROVALS,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: id,
    createdBy: actorCode || '',
    metadata: {
      forecastId: id,
      quotationRef,
      employeeCode: owner,
      employeeName: quotation?.ownerEmployeeName || '',
      reason: remark,
    },
  });
}

export async function emitQuotationClosed(quotation, actorCode) {
  const owner = quotation?.ownerEmployeeCode || '';
  const id = quotation?.forecastId || '';
  await NotificationService.create({
    recipientEmployeeCode: owner,
    module: M.SALES,
    title: 'Quotation Closed',
    message: `Quotation ${quotation?.quotationRef || id} is now Closed.`,
    category: NOTIFICATION_CATEGORIES.SALES,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: id,
    createdBy: actorCode || '',
    metadata: { forecastId: id, quotationRef: quotation?.quotationRef },
  });
}

export async function emitEditRequestSubmitted(request, actorCode) {
  const requestId = request?.requestId || '';
  const quotationId = request?.quotationId || '';
  await NotificationService.notifyModuleAdmins(
    M.SALES,
    {
      title: 'Quotation Edit Request',
      message: `${request?.employeeName || 'Employee'} requested edit permission on ${request?.quotationRef || 'a quotation'}.`,
      category: NOTIFICATION_CATEGORIES.APPROVALS,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      section: NOTIFICATION_SECTIONS.ACTION_REQUIRED,
      actionType: 'Action',
      actionId: requestId,
      actionUrl: quotationId
        ? `/sales-forecasting/quotations/${encodeURIComponent(quotationId)}`
        : '',
      createdBy: actorCode || '',
      metadata: {
        actionKind: ACTION_KINDS.QUOTATION_EDIT_REQUEST,
        actionable: true,
        approvalStatus: ACTION_OUTCOMES.PENDING,
        requestId,
        requestType: request?.requestType || '',
        quotationId,
        quotationRef: request?.quotationRef || '',
        employeeCode: request?.employeeCode || '',
        employeeName: request?.employeeName || '',
        requestedBy: request?.employeeName || '',
        requesterEmployeeCode: request?.employeeCode || '',
        oldValues: request?.oldValues || {},
        requestedValues: request?.requestedValues || {},
        requestedFields: request?.requestType || '',
        requestedAt: request?.requestedAt || request?.createdAt || '',
        remark: '',
      },
    },
    { excludeEmployeeCode: actorCode },
  );

  await NotificationService.create({
    recipientEmployeeCode: request?.employeeCode || actorCode,
    module: M.SALES,
    title: 'Edit Request Submitted',
    message: `Your edit request for ${request?.quotationRef || 'quotation'} is pending approval.`,
    category: NOTIFICATION_CATEGORIES.SALES,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: requestId,
    createdBy: actorCode || '',
    metadata: { requestId: requestId, quotationRef: request?.quotationRef },
  });
}

/** Phase 1 — Edit Request Approved → requesting employee */
export async function emitEditRequestApproved(request, actorCode) {
  const employeeCode = request?.employeeCode || '';
  const quotationId = request?.quotationId || '';
  await NotificationService.create({
    recipientEmployeeCode: employeeCode,
    module: M.SALES,
    title: 'Edit Request Approved',
    message: 'Your request to edit quotation has been approved.',
    category: NOTIFICATION_CATEGORIES.APPROVALS,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: quotationId,
    createdBy: actorCode || '',
    metadata: {
      requestId: request?.requestId,
      quotationId,
      quotationRef: request?.quotationRef || '',
      employeeCode,
      employeeName: request?.employeeName || '',
    },
  });
}

/** Phase 1 — Edit Request Rejected → requesting employee */
export async function emitEditRequestRejected(request, remark, actorCode) {
  const employeeCode = request?.employeeCode || '';
  const quotationId = request?.quotationId || '';
  const adminRemark = String(remark || '').trim();
  await NotificationService.create({
    recipientEmployeeCode: employeeCode,
    module: M.SALES,
    title: 'Edit Request Rejected',
    message: appendReason('Your request to edit quotation has been rejected.', adminRemark),
    category: NOTIFICATION_CATEGORIES.APPROVALS,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: quotationId,
    createdBy: actorCode || '',
    metadata: {
      requestId: request?.requestId,
      quotationId,
      quotationRef: request?.quotationRef || '',
      employeeCode,
      employeeName: request?.employeeName || '',
      reason: adminRemark,
    },
  });
}

/** Generic sales reminder helper (kept for compatibility). */
export async function emitSalesReminder(ownerCode, title, message, metadata = {}, priority = NOTIFICATION_PRIORITIES.HIGH) {
  await NotificationService.create({
    recipientEmployeeCode: ownerCode,
    module: M.SALES,
    title,
    message,
    category: NOTIFICATION_CATEGORIES.SALES,
    priority,
    section: NOTIFICATION_SECTIONS.ACTION_REQUIRED,
    actionType: 'View',
    actionId: metadata.forecastId || '',
    createdBy: 'system',
    metadata,
  });
}

/** Phase 1 — 15-Day Reminder (only when follow-up email succeeds) */
export async function emitFifteenDayFollowUpReminder(quotation) {
  const owner = resolveSalesOwnerCode(quotation);
  const id = quotation?.forecastId || '';
  const quotationRef = quotation?.quotationRef || '';
  await NotificationService.create({
    recipientEmployeeCode: owner,
    module: M.SALES,
    title: '15-Day Follow-up Reminder',
    message:
      'No updates have been made to your quotation for the last 15 days.\n\nPlease review and update its progress.',
    category: NOTIFICATION_CATEGORIES.SALES,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    section: NOTIFICATION_SECTIONS.ACTION_REQUIRED,
    actionType: 'View',
    actionId: id,
    createdBy: 'system',
    metadata: {
      forecastId: id,
      quotationRef,
      employeeCode: owner,
      employeeName: quotation?.ownerEmployeeName || '',
    },
  });
}

/** Phase 1 — Overdue Reminder (only when overdue owner email succeeds) */
export async function emitQuotationOverdueReminder(quotation, overdueDays) {
  const owner = resolveSalesOwnerCode(quotation);
  const id = quotation?.forecastId || '';
  const quotationRef = quotation?.quotationRef || '';
  await NotificationService.create({
    recipientEmployeeCode: owner,
    module: M.SALES,
    title: 'Quotation Overdue',
    message:
      'The Expected Decision Date has passed.\n\nPlease update or close the quotation.',
    category: NOTIFICATION_CATEGORIES.SALES,
    priority: NOTIFICATION_PRIORITIES.CRITICAL,
    section: NOTIFICATION_SECTIONS.ACTION_REQUIRED,
    actionType: 'View',
    actionId: id,
    createdBy: 'system',
    metadata: {
      forecastId: id,
      quotationRef,
      employeeCode: owner,
      employeeName: quotation?.ownerEmployeeName || '',
      overdueDays,
    },
  });
}

// ---------------------------------------------------------------------------
// Phase 2 — Daily Planner
// ---------------------------------------------------------------------------

const EARNABLE_BADGES = new Set([
  'Bronze Planner',
  'Silver Planner',
  'Gold Planner',
  'Platinum Planner',
]);

const BADGE_RANK = {
  'No Badge': 0,
  'Bronze Planner': 1,
  'Silver Planner': 2,
  'Gold Planner': 3,
  'Platinum Planner': 4,
};

function badgeRank(badge) {
  const key = String(badge || 'No Badge').trim() || 'No Badge';
  return BADGE_RANK[key] ?? 0;
}

/** Phase 2 — Task Approved → task owner */
export async function emitPlannerTaskApproved(task, actorCode) {
  const owner = task?.employeeCode || '';
  const id = task?.plannerTaskId || task?.taskId || '';
  await NotificationService.create({
    recipientEmployeeCode: owner,
    module: M.DAILY_PLANNER,
    title: 'Task Approved',
    message: 'Your Daily Planner task has been approved.',
    category: NOTIFICATION_CATEGORIES.APPROVALS,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: id,
    actionUrl: id ? `/daily-planner/tasks/${encodeURIComponent(id)}` : '/daily-planner',
    createdBy: actorCode || '',
    metadata: {
      employeeCode: owner,
      employeeName: task?.employeeName || '',
      taskId: id,
      plannerTaskId: id,
      taskName: task?.taskName || '',
      plannerDate: task?.date || '',
      focus: 'task',
    },
  });
}

/** Phase 2 — Task Rejected / needs revision → task owner */
export async function emitPlannerTaskRejected(task, reason, actorCode) {
  const owner = task?.employeeCode || '';
  const id = task?.plannerTaskId || task?.taskId || '';
  const remark = String(reason || '').trim();
  await NotificationService.create({
    recipientEmployeeCode: owner,
    module: M.DAILY_PLANNER,
    title: 'Task Rejected',
    message: appendReason('Your Daily Planner task has been rejected.', remark),
    category: NOTIFICATION_CATEGORIES.APPROVALS,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: id,
    actionUrl: id ? `/daily-planner/tasks/${encodeURIComponent(id)}` : '/daily-planner',
    createdBy: actorCode || '',
    metadata: {
      employeeCode: owner,
      employeeName: task?.employeeName || '',
      taskId: id,
      plannerTaskId: id,
      taskName: task?.taskName || '',
      plannerDate: task?.date || '',
      reason: remark,
      focus: 'task',
    },
  });
}

/** Phase 2 — Planning Score Updated → employee (only when score value changes) */
export async function emitPlanningScoreUpdated(employeeCode, score, extras = {}) {
  const code = String(employeeCode || '').trim();
  const scoreText = score == null || Number.isNaN(Number(score)) ? '' : String(Number(score));
  const message = scoreText
    ? `Your Planning Score has been updated.\n\nCurrent Score:\n${scoreText}`
    : 'Your Planning Score has been updated.';
  await NotificationService.create({
    recipientEmployeeCode: code,
    module: M.DAILY_PLANNER,
    title: 'Planning Score Updated',
    message,
    category: NOTIFICATION_CATEGORIES.DAILY_PLANNER,
    priority: NOTIFICATION_PRIORITIES.LOW,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: 'planning-performance',
    actionUrl: '/daily-planner/performance',
    createdBy: 'system',
    metadata: {
      employeeCode: code,
      planningScore: scoreText ? Number(scoreText) : extras.planningScore,
      plannerDate: extras.plannerDate || extras.yearMonth || '',
      yearMonth: extras.yearMonth || '',
      focus: 'planning-performance',
    },
  });
}

/** Phase 2 — Badge Earned → employee (only when earnable badge upgrades) */
export async function emitPlannerBadgeEarned(employeeCode, badgeName, extras = {}) {
  const code = String(employeeCode || '').trim();
  const badge = String(badgeName || '').trim();
  if (!code || !EARNABLE_BADGES.has(badge)) return null;
  await NotificationService.create({
    recipientEmployeeCode: code,
    module: M.DAILY_PLANNER,
    title: 'Congratulations!',
    message: `You have earned the\n\n${badge}\n\nplanning badge.`,
    category: NOTIFICATION_CATEGORIES.DAILY_PLANNER,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: 'planning-performance',
    actionUrl: '/daily-planner/performance',
    createdBy: 'system',
    metadata: {
      employeeCode: code,
      badge,
      planningScore: extras.planningScore,
      yearMonth: extras.yearMonth || '',
      focus: 'planning-performance',
    },
  });
}

/**
 * After monthly planning summarize — notify only on real score / badge changes.
 * @param {object|null} previousDto
 * @param {object|null} nextDto
 */
export async function emitPlanningScoreAndBadgeIfChanged(previousDto, nextDto) {
  const code = String(nextDto?.employeeCode || previousDto?.employeeCode || '').trim();
  if (!code || !nextDto) return;

  const prevScore = previousDto == null ? null : Number(previousDto.planningScore);
  const nextScore = Number(nextDto.planningScore);
  const scoreChanged =
    previousDto == null
      ? Number.isFinite(nextScore) && nextScore > 0
      : Number.isFinite(nextScore) && prevScore !== nextScore;

  if (scoreChanged) {
    void emitPlanningScoreUpdated(code, nextScore, {
      yearMonth: nextDto.yearMonth,
      planningScore: nextScore,
    });
  }

  const prevBadge = String(previousDto?.badge || 'No Badge').trim() || 'No Badge';
  const nextBadge = String(nextDto.badge || 'No Badge').trim() || 'No Badge';
  if (EARNABLE_BADGES.has(nextBadge) && badgeRank(nextBadge) > badgeRank(prevBadge)) {
    void emitPlannerBadgeEarned(code, nextBadge, {
      planningScore: nextScore,
      yearMonth: nextDto.yearMonth,
    });
  }
}

/** Phase 2 — Planning Reminder (only when existing reminder jobs already notify) */
export async function emitPlanningReminder(employeeCode, extras = {}) {
  const code = String(employeeCode || '').trim();
  await NotificationService.create({
    recipientEmployeeCode: code,
    module: M.DAILY_PLANNER,
    title: 'Planning Reminder',
    message: 'Please review and update your Daily Planner.',
    category: NOTIFICATION_CATEGORIES.DAILY_PLANNER,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    section: NOTIFICATION_SECTIONS.ACTION_REQUIRED,
    actionType: 'View',
    actionId: 'my-daily-planner',
    actionUrl: '/daily-planner',
    createdBy: 'system',
    metadata: {
      employeeCode: code,
      plannerDate: extras.plannerDate || extras.date || '',
      reminderType: extras.reminderType || '',
      focus: 'planner',
      ...extras,
    },
  });
}

export async function emitNewUserCreated(employee, actorCode) {
  await NotificationService.notifyModuleAdmins(
    M.USER_MANAGEMENT,
    {
      title: 'New User Created',
      message: `User ${employee?.fullName || employee?.employeeCode || ''} was created.`,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      section: NOTIFICATION_SECTIONS.ACTIVITY,
      actionType: 'Open',
      actionId: employee?.employeeCode || employee?.employeeId || '',
      createdBy: actorCode || '',
      metadata: { employeeCode: employee?.employeeCode },
    },
    { excludeEmployeeCode: actorCode },
  );
}

export async function emitRoleUpdated(employeeCode, actorCode) {
  await NotificationService.notifyModuleAdmins(
    M.USER_MANAGEMENT,
    {
      title: 'Role Updated',
      message: `Access role was updated for ${employeeCode}.`,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      section: NOTIFICATION_SECTIONS.ACTIVITY,
      actionType: 'Open',
      actionId: employeeCode,
      createdBy: actorCode || '',
      metadata: { employeeCode },
    },
    { excludeEmployeeCode: actorCode },
  );

  await NotificationService.create({
    recipientEmployeeCode: employeeCode,
    module: M.USER_MANAGEMENT,
    title: 'Permission Changed',
    message: 'Your module permissions or role were updated.',
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    section: NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: 'View',
    actionId: employeeCode,
    createdBy: actorCode || '',
    metadata: { employeeCode },
  });
}
