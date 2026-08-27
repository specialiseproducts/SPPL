/**
 * Daily Planner — tasks, sales sync, team management, approvals.
 */

import * as DailyPlannerTasksModel from '../models/DailyPlannerTasks.js';
import * as DailyPlannerTeamMappingsModel from '../models/DailyPlannerTeamMappings.js';
import * as SalesPlannerEventsModel from '../models/SalesPlannerEvents.js';
import * as PlanningRecognitionService from './planningRecognition.service.js';
import * as TeamPerformanceService from './teamPerformance.service.js';
import * as PlanningAnalyticsService from './planningAnalytics.service.js';
import { PLANNING_CATEGORY_REGULAR, PLANNING_CATEGORY_URGENT, PLANNING_SOURCE_RESCHEDULED, computeTaskPlanningContribution, computeTaskCompletionContribution, sumPlannedHoursForDate, MIN_PLANNED_HOURS_PER_WORKING_DAY, buildMinimumHoursWarningMessage, buildMinimumHoursManagerWarningMessage, assertValidHoursRequired, isMorningPlanningWindow } from '../utils/planningRecognition.js';
import { getEmployeeLocation } from '../utils/employeeLocation.js';
import { isCompanyWorkingDayDateKey } from '../utils/companyWorkingDays.js';
import { todayIstDateKey } from '../utils/salesQuotationDates.js';
import { canAccessAllRecords } from '../utils/accessControl.js';
import { notifyUser } from '../utils/notifications.js';
import * as PlannerNotificationEmitters from './notificationEmitters.js';
import * as AuditTrailService from './auditTrail.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../constants/auditTrail.js';
import * as NotificationService from './notification.service.js';
import { NOTIFICATION_MODULES } from '../constants/notifications.js';

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

function auditPlannerTask(authUser, action, task, description, extra = {}) {
  const id = String(task?.plannerTaskId || task?.taskId || '').trim();
  if (!id) return;
  void AuditTrailService.log({
    module: AUDIT_MODULES.DAILY_PLANNER,
    entityType: 'plannerTask',
    entityId: id,
    action,
    description,
    performedBy: employeeCodeOf(authUser),
    performedByRole: authUser?.role || '',
    employeeCode: employeeCodeOf(authUser),
    employeeName: employeeNameOf(authUser),
    oldValues: extra.oldValues ?? null,
    newValues: extra.newValues ?? null,
    metadata: {
      ownerEmployeeCode: task?.employeeCode || '',
      taskName: task?.taskName || '',
      ...(extra.metadata || {}),
    },
  });
}

function parseMonthQuery(year, month) {
  const y = Number.parseInt(String(year ?? '').trim(), 10);
  const m = Number.parseInt(String(month ?? '').trim(), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const err = new Error('Invalid year or month');
    err.statusCode = 400;
    throw err;
  }
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { year: y, month: m, startDate, endDate };
}

function employeeCodeOf(authUser) {
  return String(authUser?.employeeCode || authUser?.id || '').trim();
}

function employeeNameOf(authUser) {
  return String(
    authUser?.fullName || `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim(),
  ).trim();
}

function assertTaskNotPermanentlyClosed(task) {
  const status = String(task?.status || '').trim();
  if (status === 'Terminated' || status === 'Verified Complete') {
    const err = new Error('This task is permanently closed and cannot be modified');
    err.statusCode = 400;
    throw err;
  }
}

function assertTaskNotAlreadyRescheduled(task) {
  if (String(task?.status || '').trim() === 'Rescheduled') {
    const err = new Error(
      'This task has been rescheduled and cannot be marked complete or incomplete',
    );
    err.statusCode = 400;
    throw err;
  }
}

function revisionOutcomeOf(task) {
  return String(task?.revisionOutcome || '').trim();
}

function isRevisionActionable(task) {
  return String(task?.status || '').trim() === 'Needs Revision' && !revisionOutcomeOf(task);
}

function throwRevisionAlreadyProcessed() {
  const err = new Error('This revision request has already been processed');
  err.statusCode = 409;
  throw err;
}

async function loadOwnedRevisionParent(taskId, authUser) {
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing || existing.employeeCode !== employeeCodeOf(authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return existing;
}

async function markRevisionHandled(parentTaskId, outcome, revisedTaskId) {
  return DailyPlannerTasksModel.updateTask(
    parentTaskId,
    {
      revisionOutcome: outcome,
      revisionHandledAt: new Date().toISOString(),
      revisedTaskId: String(revisedTaskId || '').trim() || null,
    },
    {
      conditionExpression: 'attribute_not_exists(#ro) OR #ro = :empty',
      expressionAttributeNames: { '#ro': 'revisionOutcome' },
      expressionAttributeValues: { ':empty': '' },
    },
  );
}

function assertCanModerateTeamTask(effectiveRole) {
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

function normalizePriorityValue(value, fallback = 'Medium') {
  const p = String(value || '').trim();
  if (p === 'High' || p === 'Medium' || p === 'Low') return p;
  return fallback;
}

export function sortDailyPlannerTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const doneStatuses = new Set(['Completed', 'Awaiting Verification', 'Verified Complete']);
    const aCompleted = doneStatuses.has(a.status);
    const bCompleted = doneStatuses.has(b.status);
    if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

    const pa = PRIORITY_ORDER[a.currentPriority || a.priority] ?? 1;
    const pb = PRIORITY_ORDER[b.currentPriority || b.priority] ?? 1;
    if (pa !== pb) return pa - pb;

    return String(a.taskName || '').localeCompare(String(b.taskName || ''), undefined, {
      sensitivity: 'base',
    });
  });
}

function buildVisitTaskName(event) {
  const fullName = String(event.contactFullName || event.fullName || '').trim();
  return fullName ? `Visit with ${fullName}` : 'Sales Visit';
}

function importedTaskNeedsUpdate(existing, next) {
  return (
    existing.date !== next.date ||
    existing.taskName !== next.taskName ||
    existing.description !== next.description ||
    (!existing.priorityEdited && existing.currentPriority !== next.currentPriority)
  );
}

/**
 * Read-only Sales Planner sync for one employee + date range.
 * Loads tasks and sales events once each (no per-event table scans).
 * Returns the post-sync task list for that range.
 */
async function syncSalesPlannerImports(employeeCode, employeeName, startDate, endDate, year, month) {
  const code = String(employeeCode || '').trim();
  if (!code) return [];

  const [events, existingTasks] = await Promise.all([
    SalesPlannerEventsModel.listPlannerEventsForMonth(code, year, month, startDate, endDate),
    DailyPlannerTasksModel.listTasksForEmployeeMonth(code, startDate, endDate),
  ]);

  const bySalesId = new Map();
  for (const task of existingTasks) {
    if (task.source === 'SALES_FORECASTING' && task.salesPlannerId) {
      bySalesId.set(task.salesPlannerId, task);
    }
  }

  const activeSalesIds = new Set();
  const writeOps = [];
  const name = String(employeeName || '').trim();

  for (const event of events) {
    if (!event?.eventId || !event.visitDate) continue;
    if (event.visitDate < startDate || event.visitDate > endDate) continue;

    activeSalesIds.add(event.eventId);
    const existing = bySalesId.get(event.eventId);

    const taskPayload = {
      employeeCode: code,
      employeeName: name || existing?.employeeName || '',
      date: event.visitDate,
      taskName: buildVisitTaskName(event),
      description: String(event.purpose || '').trim(),
      priority: 'High',
      originalPriority: 'High',
      currentPriority: 'High',
      taskType: 'Sales Visit',
      source: 'SALES_FORECASTING',
      salesPlannerId: event.eventId,
      status:
        existing?.status === 'Completed' ||
        existing?.status === 'Not Completed' ||
        existing?.status === 'Terminated' ||
        existing?.status === 'Rescheduled'
          ? existing.status
          : 'Pending',
    };

    if (existing) {
      if (importedTaskNeedsUpdate(existing, taskPayload)) {
        writeOps.push(
          DailyPlannerTasksModel.updateTask(existing.plannerTaskId, {
            ...taskPayload,
            reason: existing.reason,
            approved: existing.approved,
            approvedBy: existing.approvedBy,
            approvedByName: existing.approvedByName,
            approvedDate: existing.approvedDate,
            priorityEdited: existing.priorityEdited,
            originalPriority: existing.originalPriority,
            currentPriority: existing.priorityEdited ? existing.currentPriority : 'High',
            managerComments: existing.managerComments,
          }),
        );
      }
    } else {
      writeOps.push(DailyPlannerTasksModel.createTask(taskPayload));
    }
  }

  for (const task of existingTasks) {
    if (task.source !== 'SALES_FORECASTING' || !task.salesPlannerId) continue;
    if (!activeSalesIds.has(task.salesPlannerId)) {
      writeOps.push(DailyPlannerTasksModel.softDeleteTask(task.plannerTaskId));
    }
  }

  if (writeOps.length === 0) return existingTasks;

  await Promise.all(writeOps);
  return DailyPlannerTasksModel.listTasksForEmployeeMonth(code, startDate, endDate);
}

export const listMyMonth = async (authUser, year, month) => {
  const code = employeeCodeOf(authUser);
  if (!code) {
    const err = new Error('Employee code required');
    err.statusCode = 400;
    throw err;
  }
  const parsed = parseMonthQuery(year, month);
  const name = employeeNameOf(authUser);

  const tasks = await syncSalesPlannerImports(
    code,
    name,
    parsed.startDate,
    parsed.endDate,
    parsed.year,
    parsed.month,
  );
  return {
    tasks: sortDailyPlannerTasks(tasks),
    year: parsed.year,
    month: parsed.month,
  };
};

export const listDayTasks = async (authUser, dateParam) => {
  const code = employeeCodeOf(authUser);
  const date = String(dateParam || '').trim();
  if (!code || !date) {
    const err = new Error('date is required');
    err.statusCode = 400;
    throw err;
  }
  const [y, m] = date.split('-').map(Number);
  const tasks = await syncSalesPlannerImports(code, employeeNameOf(authUser), date, date, y, m);
  return { tasks: sortDailyPlannerTasks(tasks), date };
};

export const createManualTask = async (body, authUser) => {
  const code = employeeCodeOf(authUser);
  const date = String(body.date || '').trim();
  const taskName = String(body.taskName || '').trim();
  if (!code || !date || !taskName) {
    const err = new Error('date and taskName are required');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const location = await getEmployeeLocation(code);
  const planningMeta = PlanningRecognitionService.validateTaskPlanningPayload(body, now, location);
  const priority = String(body.priority || 'Medium').trim();
  const hoursRequired = assertValidHoursRequired(body.hoursRequired, { required: true });

  let planningScore = 0;
  if (planningMeta.planningCategory === PLANNING_CATEGORY_REGULAR) {
    planningScore = computeTaskPlanningContribution(
      date,
      planningMeta.planningTimestamp,
      location,
      now,
    );
  }
  const completionScore = 0;
  const finalScore = planningScore + completionScore;

  const revisesTaskId = String(body.revisesTaskId || '').trim();
  let revisionParent = null;
  if (revisesTaskId) {
    revisionParent = await loadOwnedRevisionParent(revisesTaskId, authUser);
    if (!isRevisionActionable(revisionParent)) {
      throwRevisionAlreadyProcessed();
    }
  }

  const task = await DailyPlannerTasksModel.createTask({
    employeeCode: code,
    employeeName: employeeNameOf(authUser),
    date,
    taskName,
    description: String(body.description || '').trim(),
    priority,
    originalPriority: priority,
    currentPriority: priority,
    hoursRequired,
    originalHoursRequired: hoursRequired,
    hoursRequiredEdited: false,
    taskType: 'Manual',
    source: 'MANUAL',
    status: 'Pending',
    planningCategory: planningMeta.planningCategory,
    urgentReason: planningMeta.urgentReason,
    planningWindowUsed: planningMeta.planningWindowUsed,
    planningTimestamp: planningMeta.planningTimestamp,
    planningScore,
    completionScore,
    finalScore,
    parentTaskId: revisesTaskId || null,
  });

  if (revisionParent) {
    await markRevisionHandled(revisesTaskId, 'custom_revision', task.plannerTaskId);
  }

  let planningAward = null;
  if (planningMeta.planningCategory === PLANNING_CATEGORY_REGULAR) {
    planningAward = await PlanningRecognitionService.awardPlanningScoreForRegularTask({
      employeeCode: code,
      taskDateIso: date,
      reference: now,
    });
  } else if (planningMeta.planningCategory === PLANNING_CATEGORY_URGENT) {
    planningAward = await PlanningRecognitionService.recordPlanningImpactForUrgentTask({
      employeeCode: code,
      reference: now,
    });
  }

  await maybeNotifyMinimumHoursShortfall(code, date, location, employeeNameOf(authUser));

  auditPlannerTask(authUser, AUDIT_ACTIONS.CREATE, task, 'Task Created', {
    newValues: {
      taskName: task.taskName,
      priority: task.priority,
      hoursRequired: task.hoursRequired,
      date: task.date,
      status: task.status,
    },
  });

  return { task, planningAward };
};

async function listActiveManagersForEmployee(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) return [];
  const mappings = await DailyPlannerTeamMappingsModel.listAllMappings();
  return mappings
    .filter((m) => m.status === 'Active' && String(m.employeeCode || '').trim() === code)
    .map((m) => ({
      managerCode: String(m.managerCode || '').trim(),
      managerName: String(m.managerName || '').trim(),
    }))
    .filter((m) => m.managerCode);
}

function formatPlannerDateLabel(dateKey) {
  const key = String(dateKey || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key || 'today';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

async function maybeNotifyMinimumHoursShortfall(
  employeeCode,
  dateKey,
  location,
  employeeName = '',
) {
  const today = todayIstDateKey();
  const targetDate = String(dateKey || '').trim().slice(0, 10);
  if (targetDate !== today) return;
  if (!isCompanyWorkingDayDateKey(today, location)) return;
  if (isMorningPlanningWindow(new Date())) return;

  await notifyHoursShortfallForDate(employeeCode, today, employeeName);
}

async function notifyHoursShortfallForDate(employeeCode, dateKey, employeeName = '') {
  const targetDate = String(dateKey || '').trim().slice(0, 10);
  const tasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
    employeeCode,
    targetDate,
    targetDate,
  );
  const plannedHours = sumPlannedHoursForDate(tasks, targetDate);
  if (plannedHours >= MIN_PLANNED_HOURS_PER_WORKING_DAY) return;

  const remaining =
    Math.round((MIN_PLANNED_HOURS_PER_WORKING_DAY - plannedHours) * 100) / 100;
  const dayLabel = formatPlannerDateLabel(targetDate);
  const name =
    String(employeeName || '').trim() ||
    String(tasks[0]?.employeeName || '').trim() ||
    employeeCode;

  void notifyUser(
    employeeCode,
    'Minimum daily hours required',
    buildMinimumHoursWarningMessage(plannedHours, dayLabel),
    'WARNING',
    {
      date: targetDate,
      plannedHours,
      remainingHours: remaining,
      minRequired: MIN_PLANNED_HOURS_PER_WORKING_DAY,
      reminderType: 'minimum_hours',
    },
  );

  const managerMessage = buildMinimumHoursManagerWarningMessage(name, plannedHours, dayLabel);
  const managers = await listActiveManagersForEmployee(employeeCode);
  for (const manager of managers) {
    if (manager.managerCode === employeeCode) continue;
    void notifyUser(
      manager.managerCode,
      'Team member below daily hours minimum',
      managerMessage,
      'WARNING',
      {
        date: targetDate,
        employeeCode,
        employeeName: name,
        plannedHours,
        remainingHours: remaining,
        minRequired: MIN_PLANNED_HOURS_PER_WORKING_DAY,
        reminderType: 'minimum_hours_manager',
      },
    );
  }

  void NotificationService.notifyModuleAdmins(
    NOTIFICATION_MODULES.DAILY_PLANNER,
    {
      title: 'Team member below daily hours minimum',
      message: managerMessage,
      createdBy: 'system',
      actionType: 'View',
      actionId: 'team-daily-planner',
      actionUrl: '/daily-planner',
      metadata: {
        date: targetDate,
        employeeCode,
        employeeName: name,
        plannedHours,
        remainingHours: remaining,
        minRequired: MIN_PLANNED_HOURS_PER_WORKING_DAY,
        reminderType: 'minimum_hours_admin',
      },
    },
    { excludeEmployeeCode: employeeCode },
  );
}

export const updateManualTask = async (taskId, body, authUser) => {
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  if (existing.employeeCode !== employeeCodeOf(authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  if (existing.taskType === 'Sales Visit' || existing.source === 'SALES_FORECASTING') {
    const err = new Error('Sales Visit tasks cannot be edited');
    err.statusCode = 400;
    throw err;
  }
  assertTaskNotPermanentlyClosed(existing);

  const patch = {};
  if (body.taskName !== undefined) patch.taskName = String(body.taskName || '').trim();
  if (body.description !== undefined) patch.description = String(body.description || '').trim();
  if (body.priority !== undefined) {
    const p = String(body.priority || 'Medium').trim();
    patch.priority = p;
    patch.currentPriority = p;
    patch.originalPriority = existing.originalPriority || p;
  }
  if (body.hoursRequired !== undefined) {
    patch.hoursRequired = assertValidHoursRequired(body.hoursRequired, { required: true });
    if (
      existing.originalHoursRequired === undefined ||
      existing.originalHoursRequired === null ||
      existing.originalHoursRequired === ''
    ) {
      patch.originalHoursRequired = patch.hoursRequired;
    }
  }
  if (body.date !== undefined) patch.date = String(body.date || '').trim();

  const task = await DailyPlannerTasksModel.updateTask(taskId, patch);

  if (
    existing.planningCategory === PLANNING_CATEGORY_REGULAR &&
    existing.source === 'MANUAL'
  ) {
    await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
      employeeCode: existing.employeeCode,
      workingDayDateKey: existing.date,
    });
    if (patch.date && patch.date !== existing.date) {
      await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
        employeeCode: existing.employeeCode,
        workingDayDateKey: patch.date,
      });
    }
  }

  const action =
    patch.date && patch.date !== existing.date
      ? AUDIT_ACTIONS.STATUS_CHANGE
      : AUDIT_ACTIONS.UPDATE;
  const fieldDiff = AuditTrailService.diffChangedFields(existing, task, [
    'taskName',
    'description',
    'priority',
    'currentPriority',
    'hoursRequired',
    'date',
    'status',
  ]);
  auditPlannerTask(
    authUser,
    action,
    task,
    patch.date && patch.date !== existing.date ? 'Task Rescheduled' : 'Task Edited',
    {
      oldValues: fieldDiff.oldValues,
      newValues: fieldDiff.newValues,
    },
  );

  if (body.hoursRequired !== undefined) {
    const location = await getEmployeeLocation(existing.employeeCode);
    await maybeNotifyMinimumHoursShortfall(
      existing.employeeCode,
      task.date || existing.date,
      location,
      existing.employeeName,
    );
  }

  return { task };
};

async function listTasksCoveringDateKeys(employeeCode, dateKeys) {
  const months = new Set();
  for (const raw of dateKeys || []) {
    const key = String(raw || '').trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      months.add(key.slice(0, 7));
    }
  }
  const results = [];
  const seen = new Set();
  for (const ym of months) {
    const [y, m] = ym.split('-').map(Number);
    const startDate = `${ym}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const endDate = `${ym}-${String(lastDay).padStart(2, '0')}`;
    const rows = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
      employeeCode,
      startDate,
      endDate,
    );
    for (const row of rows || []) {
      const id = String(row.plannerTaskId || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      results.push(row);
    }
  }
  return results;
}

/**
 * Soft-delete only RESCHEDULED children linked via parentTaskId to this task.
 */
async function cancelLinkedRescheduledChildren(parentTask) {
  const parentId = String(parentTask?.plannerTaskId || '').trim();
  const code = String(parentTask?.employeeCode || '').trim();
  if (!parentId || !code) return [];

  const candidates = await listTasksCoveringDateKeys(code, [
    parentTask.date,
    parentTask.rescheduledToDate,
  ]);

  const cancelled = [];
  for (const child of candidates) {
    if (String(child.parentTaskId || '').trim() !== parentId) continue;
    if (String(child.source || '').trim() !== PLANNING_SOURCE_RESCHEDULED) continue;
    await DailyPlannerTasksModel.softDeleteTask(child.plannerTaskId);
    cancelled.push(child);
  }
  return cancelled;
}

export const markTaskCompleted = async (taskId, body, authUser) => {
  const workDone = String(body?.workDone || body?.reason || '').trim();
  if (!workDone) {
    const err = new Error('Work done is required');
    err.statusCode = 400;
    throw err;
  }
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing || existing.employeeCode !== employeeCodeOf(authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  assertTaskNotPermanentlyClosed(existing);
  assertTaskNotAlreadyRescheduled(existing);
  const planningScore = Number(existing.planningScore) || 0;
  // Keep existing scoring: employee completion still awards Completed contribution.
  const completionScore = computeTaskCompletionContribution('Completed');
  const task = await DailyPlannerTasksModel.updateTask(taskId, {
    status: 'Awaiting Verification',
    reason: workDone,
    verificationStatus: 'AWAITING_VERIFICATION',
    completionScore,
    finalScore: planningScore + completionScore,
  });

  // Incomplete → Reschedule creates a child via parentTaskId. Completing the original
  // must invalidate that linked rescheduled task so it does not remain active.
  const cancelledRescheduledTasks = await cancelLinkedRescheduledChildren(existing);

  if (existing.planningCategory === PLANNING_CATEGORY_REGULAR && existing.source === 'MANUAL') {
    await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
      employeeCode: existing.employeeCode,
      workingDayDateKey: existing.date,
    });
  }
  auditPlannerTask(authUser, AUDIT_ACTIONS.STATUS_CHANGE, task, 'Task Closed', {
    oldValues: { status: existing.status },
    newValues: { status: task.status, reason: workDone },
  });
  return { task, cancelledRescheduledTasks };
};

export const markTaskNotCompleted = async (taskId, body, authUser) => {
  const reason = String(body.reason || '').trim();
  const action = String(body.action || 'terminate').trim().toLowerCase();
  if (!reason) {
    const err = new Error('Reason is required');
    err.statusCode = 400;
    throw err;
  }
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing || existing.employeeCode !== employeeCodeOf(authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  assertTaskNotPermanentlyClosed(existing);
  assertTaskNotAlreadyRescheduled(existing);

  const now = new Date();
  const code = employeeCodeOf(authUser);
  const name = employeeNameOf(authUser);
  const location = await getEmployeeLocation(code);

  if (action === 'terminate') {
    const planningScore = Number(existing.planningScore) || 0;
    const completionScore = computeTaskCompletionContribution('Terminated');
    const task = await DailyPlannerTasksModel.updateTask(taskId, {
      status: 'Terminated',
      reason,
      terminatedAt: now.toISOString(),
      terminatedBy: code,
      terminatedByName: name,
      completionScore,
      finalScore: planningScore + completionScore,
    });
    if (existing.planningCategory === PLANNING_CATEGORY_REGULAR && existing.source === 'MANUAL') {
      await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
        employeeCode: code,
        workingDayDateKey: existing.date,
      });
    }
    return { task };
  }

  if (action === 'next_date' || action === 'nextdate') {
    const newDate = await PlanningRecognitionService.validateRescheduleTargetDate(
      body.newDate,
      now,
      location,
    );
    if (newDate === existing.date) {
      const err = new Error('New date must be different from the current task date');
      err.statusCode = 400;
      throw err;
    }

    const rescheduledAt = now.toISOString();
    const task = await DailyPlannerTasksModel.updateTask(taskId, {
      status: 'Rescheduled',
      reason,
      rescheduledFromDate: existing.date,
      rescheduledToDate: newDate,
      rescheduledBy: code,
      rescheduledByName: name,
      rescheduledAt,
      completionScore: 0,
      finalScore: 0,
    });

    const rescheduledTask = await DailyPlannerTasksModel.createTask({
      employeeCode: existing.employeeCode,
      employeeName: existing.employeeName,
      date: newDate,
      taskName: existing.taskName,
      description: existing.description,
      priority: existing.currentPriority || existing.priority,
      originalPriority: existing.originalPriority || existing.priority,
      currentPriority: existing.currentPriority || existing.priority,
      priorityEdited: existing.priorityEdited,
      hoursRequired: existing.hoursRequired,
      originalHoursRequired: existing.originalHoursRequired ?? existing.hoursRequired,
      hoursRequiredEdited: existing.hoursRequiredEdited,
      taskType: existing.taskType,
      source: PLANNING_SOURCE_RESCHEDULED,
      salesPlannerId: existing.salesPlannerId,
      status: 'Pending',
      planningCategory:
        existing.planningCategory === PLANNING_CATEGORY_URGENT
          ? PLANNING_CATEGORY_URGENT
          : PLANNING_CATEGORY_REGULAR,
      urgentReason: existing.urgentReason || '',
      originalDate: existing.originalDate || existing.date,
      rescheduledFrom: existing.date,
      reason,
      parentTaskId: existing.plannerTaskId,
      planningWindowUsed: null,
      planningTimestamp: rescheduledAt,
      planningScore: 0,
      completionScore: 0,
      finalScore: 0,
    });

    if (existing.planningCategory === PLANNING_CATEGORY_REGULAR && existing.source === 'MANUAL') {
      await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
        employeeCode: code,
        workingDayDateKey: existing.date,
      });
    }

    return { task, rescheduledTask };
  }

  const err = new Error('Invalid action. Use terminate or next_date.');
  err.statusCode = 400;
  throw err;
};

export const deleteManualTask = async (taskId, authUser) => {
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing || existing.employeeCode !== employeeCodeOf(authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  if (existing.source === 'SALES_FORECASTING') {
    const err = new Error('Imported sales tasks cannot be deleted');
    err.statusCode = 400;
    throw err;
  }
  assertTaskNotPermanentlyClosed(existing);
  await DailyPlannerTasksModel.softDeleteTask(taskId);
  if (existing.planningCategory === PLANNING_CATEGORY_REGULAR && existing.source === 'MANUAL') {
    await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
      employeeCode: existing.employeeCode,
      workingDayDateKey: existing.date,
    });
  }
  auditPlannerTask(authUser, AUDIT_ACTIONS.DELETE, existing, 'Task Closed', {
    oldValues: { status: existing.status },
    newValues: { status: 'Deleted' },
  });
  return { success: true };
};

async function resolveTeamEmployeeCodes(managerCode, effectiveRole) {
  if (canAccessAllRecords(effectiveRole)) {
    const mappings = await DailyPlannerTeamMappingsModel.listAllMappings();
    const fromMappings = mappings
      .filter((m) => m.status === 'Active')
      .map((m) => m.employeeCode);
    return [...new Set(fromMappings)];
  }
  const team = await DailyPlannerTeamMappingsModel.listEmployeesForManager(managerCode);
  return team.map((m) => m.employeeCode);
}

export const listTeamTasks = async (authUser, effectiveRole, filters = {}) => {
  const managerCode = employeeCodeOf(authUser);

  let employeeCodes = await resolveTeamEmployeeCodes(managerCode, effectiveRole);
  const filterEmployee = String(filters.employeeCode || '').trim();
  if (filterEmployee) {
    if (!employeeCodes.includes(filterEmployee) && !canAccessAllRecords(effectiveRole)) {
      return { tasks: [] };
    }
    employeeCodes = [filterEmployee];
  }

  if (employeeCodes.length === 0) {
    return { tasks: [] };
  }

  const date = String(filters.date || '').trim();
  let startDate = '';
  let endDate = '';
  let year;
  let month;
  if (date) {
    startDate = date;
    endDate = date;
    const parts = date.split('-').map(Number);
    year = parts[0];
    month = parts[1];
  } else {
    const now = new Date();
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1;
    const parsed = parseMonthQuery(year, month);
    startDate = parsed.startDate;
    endDate = parsed.endDate;
  }

  const syncedBatches = await Promise.all(
    employeeCodes.map((code) =>
      syncSalesPlannerImports(code, '', startDate, endDate, year, month),
    ),
  );
  let tasks = syncedBatches.flat();

  const priority = String(filters.priority || '').trim();
  if (priority) tasks = tasks.filter((t) => (t.currentPriority || t.priority) === priority);

  const status = String(filters.status || '').trim();
  if (status) tasks = tasks.filter((t) => t.status === status);

  const taskType = String(filters.taskType || '').trim();
  if (taskType) tasks = tasks.filter((t) => t.taskType === taskType);

  return { tasks: sortDailyPlannerTasks(tasks) };
};

export const approveTask = async (taskId, body, authUser, effectiveRole) => {
  assertCanModerateTeamTask(effectiveRole);
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }

  // Persist Manager Comments only (Finish Review flush) — do not change status/workflow.
  if (body?.commentsOnly === true || body?.persistCommentsOnly === true) {
    const task = await DailyPlannerTasksModel.updateTask(taskId, {
      managerComments: String(body.comments ?? body.managerComments ?? '').trim(),
    });
    return { task };
  }

  const nowIso = new Date().toISOString();
  const reviewerCode = employeeCodeOf(authUser);
  const reviewerName = employeeNameOf(authUser);
  const patch = {
    approved: true,
    approvalStatus: 'APPROVED',
    status: 'Approved',
    approvedBy: reviewerCode,
    approvedByName: reviewerName,
    approvedDate: nowIso,
    approvedAt: nowIso,
    managerComments: String(body.comments || existing.managerComments || '').trim(),
  };

  const requestedPriority = body.priority != null ? String(body.priority).trim() : '';
  if (requestedPriority) {
    const nextPriority = normalizePriorityValue(
      requestedPriority,
      existing.currentPriority || existing.priority || 'Medium',
    );
    const originalPriority =
      existing.originalPriority || existing.priority || nextPriority;
    patch.priority = nextPriority;
    patch.currentPriority = nextPriority;
    patch.originalPriority = originalPriority;
    patch.priorityEdited = originalPriority !== nextPriority;
    if (patch.priorityEdited) {
      patch.priorityEditedBy = reviewerCode;
      patch.priorityEditedByName = reviewerName;
      patch.priorityEditedAt = nowIso;
    }
  }

  if (body.hoursRequired !== undefined && body.hoursRequired !== null && String(body.hoursRequired).trim() !== '') {
    const nextHours = assertValidHoursRequired(body.hoursRequired, { required: true });
    const originalHours =
      existing.originalHoursRequired != null && existing.originalHoursRequired !== ''
        ? Number(existing.originalHoursRequired)
        : existing.hoursRequired != null && existing.hoursRequired !== ''
          ? Number(existing.hoursRequired)
          : nextHours;
    patch.hoursRequired = nextHours;
    patch.originalHoursRequired = Number.isFinite(originalHours) ? originalHours : nextHours;
    patch.hoursRequiredEdited = patch.originalHoursRequired !== nextHours;
    if (patch.hoursRequiredEdited) {
      patch.hoursRequiredEditedBy = reviewerCode;
      patch.hoursRequiredEditedByName = reviewerName;
      patch.hoursRequiredEditedAt = nowIso;
    }
  }

  const task = await DailyPlannerTasksModel.updateTask(taskId, patch);

  void PlannerNotificationEmitters.emitPlannerTaskApproved(
    { ...existing, ...task },
    reviewerCode,
  );

  auditPlannerTask(authUser, AUDIT_ACTIONS.APPROVE, task, 'Task Approved', {
    oldValues: {
      status: existing.status,
      approvalStatus: existing.approvalStatus,
      hoursRequired: existing.hoursRequired,
    },
    newValues: {
      status: task.status,
      approvalStatus: task.approvalStatus,
      hoursRequired: task.hoursRequired,
    },
  });

  const location = await getEmployeeLocation(existing.employeeCode);
  if (isCompanyWorkingDayDateKey(existing.date, location)) {
    await notifyHoursShortfallForDate(
      existing.employeeCode,
      existing.date,
      existing.employeeName,
    );
  }

  return { task };
};

export const rejectTask = async (taskId, body, authUser, effectiveRole) => {
  // Backward-compatible alias — prefer requestNeedsRevision.
  return requestNeedsRevision(taskId, body, authUser, effectiveRole);
};

export const requestNeedsRevision = async (taskId, body, authUser, effectiveRole) => {
  assertCanModerateTeamTask(effectiveRole);
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }

  const reason = String(body.reason || body.comments || '').trim();
  if (!reason) {
    const err = new Error('Reason is required');
    err.statusCode = 400;
    throw err;
  }

  const replacementRaw = body.replacementTask || {};
  const replacementHours = assertValidHoursRequired(replacementRaw.hoursRequired, { required: true });
  const replacementTask = {
    taskName: String(replacementRaw.taskName || '').trim(),
    description: String(replacementRaw.description || '').trim(),
    priority: normalizePriorityValue(
      replacementRaw.priority,
      existing.currentPriority || existing.priority || 'Medium',
    ),
    hoursRequired: replacementHours,
    expectedOutcome: String(replacementRaw.expectedOutcome || '').trim(),
  };

  if (!replacementTask.taskName) {
    const err = new Error('Replacement task name is required');
    err.statusCode = 400;
    throw err;
  }
  if (!replacementTask.description) {
    const err = new Error('Replacement task description is required');
    err.statusCode = 400;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const reviewerCode = employeeCodeOf(authUser);
  const reviewerName = employeeNameOf(authUser);

  const task = await DailyPlannerTasksModel.updateTask(taskId, {
    approved: false,
    status: 'Needs Revision',
    revisionReason: reason,
    managerComments: reason,
    revisionRequestedBy: reviewerCode,
    revisionRequestedByName: reviewerName,
    revisionRequestedAt: nowIso,
    replacementTask,
    verificationStatus: '',
  });

  void PlannerNotificationEmitters.emitPlannerTaskRejected(
    { ...existing, ...task },
    reason,
    reviewerCode,
  );

  auditPlannerTask(authUser, AUDIT_ACTIONS.REJECT, task, 'Task Rejected', {
    oldValues: { status: existing.status },
    newValues: { status: task.status, revisionReason: reason },
    metadata: { remark: reason },
  });

  return { task };
};

export const verifyTaskCompletion = async (taskId, body, authUser, effectiveRole) => {
  assertCanModerateTeamTask(effectiveRole);
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }

  const status = String(existing.status || '').trim();
  if (status !== 'Awaiting Verification' && status !== 'Completed') {
    const err = new Error('Task is not awaiting verification');
    err.statusCode = 400;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const task = await DailyPlannerTasksModel.updateTask(taskId, {
    status: 'Verified Complete',
    verificationStatus: 'VERIFIED_COMPLETED',
    verifiedBy: employeeCodeOf(authUser),
    verifiedByName: employeeNameOf(authUser),
    verifiedAt: nowIso,
    managerComments: String(body.comments || existing.managerComments || '').trim(),
  });

  void notifyUser(
    existing.employeeCode,
    'Daily Planner completion verified',
    `Completion of "${existing.taskName}" was verified.`,
    'INFO',
    { plannerTaskId: taskId },
  );

  auditPlannerTask(authUser, AUDIT_ACTIONS.VERIFY, task, 'Completion Verified', {
    oldValues: { status: existing.status },
    newValues: { status: task.status, verificationStatus: task.verificationStatus },
  });

  return { task };
};

export const acceptRevisionSuggestion = async (taskId, authUser) => {
  const existing = await loadOwnedRevisionParent(taskId, authUser);
  const existingOutcome = revisionOutcomeOf(existing);
  if (existingOutcome === 'accepted_suggestion' && existing.revisedTaskId) {
    const already = await DailyPlannerTasksModel.getTaskById(existing.revisedTaskId);
    if (already) {
      return { task: existing, revisedTask: already };
    }
  }
  if (!isRevisionActionable(existing)) {
    if (existingOutcome) throwRevisionAlreadyProcessed();
    const err = new Error('Task is not awaiting revision');
    err.statusCode = 400;
    throw err;
  }

  const suggestion = existing.replacementTask;
  if (!suggestion || !String(suggestion.taskName || '').trim()) {
    const err = new Error('No manager suggestion available');
    err.statusCode = 400;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const priority = normalizePriorityValue(
    suggestion.priority,
    existing.currentPriority || existing.priority || 'Medium',
  );
  const descriptionParts = [String(suggestion.description || '').trim()];
  const expected = String(suggestion.expectedOutcome || '').trim();
  if (expected) {
    descriptionParts.push(`Expected Outcome: ${expected}`);
  }

  const reviewerCode = String(existing.revisionRequestedBy || '').trim();
  const reviewerName = String(existing.revisionRequestedByName || '').trim();
  const suggestionHoursRaw =
    suggestion.hoursRequired !== undefined && suggestion.hoursRequired !== null && suggestion.hoursRequired !== ''
      ? Number(suggestion.hoursRequired)
      : null;
  const hoursRequired =
    suggestionHoursRaw != null && Number.isFinite(suggestionHoursRaw) && suggestionHoursRaw > 0
      ? Math.round(suggestionHoursRaw * 100) / 100
      : existing.hoursRequired;
  const originalHoursRequired =
    suggestionHoursRaw != null && Number.isFinite(suggestionHoursRaw) && suggestionHoursRaw > 0
      ? hoursRequired
      : existing.originalHoursRequired ?? existing.hoursRequired;

  const revisedTask = await DailyPlannerTasksModel.createTask({
    employeeCode: existing.employeeCode,
    employeeName: existing.employeeName,
    date: existing.date,
    taskName: String(suggestion.taskName).trim(),
    description: descriptionParts.filter(Boolean).join('\n'),
    priority,
    originalPriority: priority,
    currentPriority: priority,
    priorityEdited: false,
    hoursRequired,
    originalHoursRequired,
    hoursRequiredEdited: false,
    taskType: 'Manual',
    source: 'MANUAL',
    status: 'Approved',
    approved: true,
    approvalStatus: 'APPROVED',
    approvedBy: reviewerCode,
    approvedByName: reviewerName,
    approvedDate: nowIso,
    approvedAt: nowIso,
    managerComments: 'Approved — accepted manager suggestion',
    planningCategory:
      existing.planningCategory === PLANNING_CATEGORY_URGENT
        ? PLANNING_CATEGORY_URGENT
        : PLANNING_CATEGORY_REGULAR,
    urgentReason: existing.urgentReason || '',
    parentTaskId: existing.plannerTaskId,
    planningWindowUsed: null,
    planningTimestamp: nowIso,
    planningScore: 0,
    completionScore: 0,
    finalScore: 0,
  });

  const task = await markRevisionHandled(
    existing.plannerTaskId,
    'accepted_suggestion',
    revisedTask.plannerTaskId,
  );

  if (existing.planningCategory === PLANNING_CATEGORY_REGULAR) {
    await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
      employeeCode: existing.employeeCode,
      workingDayDateKey: existing.date,
    });
  }

  return { task, revisedTask };
};

export const editTaskPriority = async (taskId, body, authUser, effectiveRole) => {
  assertCanModerateTeamTask(effectiveRole);
  const newPriority = normalizePriorityValue(body.priority, '');
  if (!newPriority || (newPriority !== 'High' && newPriority !== 'Medium' && newPriority !== 'Low')) {
    const err = new Error('priority is required');
    err.statusCode = 400;
    throw err;
  }

  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const originalPriority = existing.originalPriority || existing.priority || newPriority;
  const task = await DailyPlannerTasksModel.updateTask(taskId, {
    priority: newPriority,
    currentPriority: newPriority,
    originalPriority,
    priorityEdited: originalPriority !== newPriority,
    priorityEditedBy: employeeCodeOf(authUser),
    priorityEditedByName: employeeNameOf(authUser),
    priorityEditedAt: nowIso,
    managerComments: String(body.comments || existing.managerComments || '').trim(),
    approved: existing.approved,
    status: existing.status === 'Pending' ? 'Pending' : existing.status,
  });

  void notifyUser(
    existing.employeeCode,
    'Daily Planner priority updated',
    `Priority for "${existing.taskName}" changed to ${newPriority}.`,
    'INFO',
    { plannerTaskId: taskId, priority: newPriority },
  );

  auditPlannerTask(authUser, AUDIT_ACTIONS.UPDATE, task, 'Priority Changed', {
    oldValues: {
      priority: existing.currentPriority || existing.priority,
    },
    newValues: { priority: newPriority },
  });

  return { task };
};

export const listTeamMappings = async (authUser, effectiveRole) => {
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const mappings = await DailyPlannerTeamMappingsModel.listAllMappings();
  return { mappings };
};

export const assignTeamMapping = async (body, authUser, effectiveRole) => {
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const managerCode = employeeCodeOf(authUser);
  if (!managerCode) {
    const err = new Error('Authenticated user employee code is required');
    err.statusCode = 400;
    throw err;
  }
  const managerName = employeeNameOf(authUser) || managerCode;
  const mapping = await DailyPlannerTeamMappingsModel.createMapping({
    managerCode,
    managerName,
    employeeCode: String(body.employeeCode || '').trim(),
    employeeName: String(body.employeeName || '').trim(),
    createdBy: managerCode,
  });
  return { mapping };
};

export const removeTeamMapping = async (mappingId, effectiveRole) => {
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  await DailyPlannerTeamMappingsModel.softDeleteMapping(mappingId);
  return { success: true };
};

export const transferTeamMapping = async (mappingId, body, effectiveRole) => {
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const newManagerCode = String(body.managerCode || '').trim();
  const newManagerName = String(body.managerName || '').trim();
  if (!newManagerCode) {
    const err = new Error('managerCode is required');
    err.statusCode = 400;
    throw err;
  }
  const mapping = await DailyPlannerTeamMappingsModel.updateMapping(mappingId, {
    managerCode: newManagerCode,
    managerName: newManagerName,
  });
  return { mapping };
};

export const getTask = async (taskId, authUser, effectiveRole) => {
  const task = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  const code = employeeCodeOf(authUser);
  if (task.employeeCode !== code && !canAccessAllRecords(effectiveRole)) {
    const team = await DailyPlannerTeamMappingsModel.listEmployeesForManager(code);
    if (!team.some((m) => m.employeeCode === task.employeeCode)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
  }
  return { task };
};

export const getPlanningConfig = async (authUser) => {
  const code = employeeCodeOf(authUser);
  return { config: await PlanningRecognitionService.getPlanningConfig(new Date(), code) };
};

export const getMyPlanningProfile = async (authUser) => {
  const code = employeeCodeOf(authUser);
  if (!code) {
    const err = new Error('Employee code is required');
    err.statusCode = 400;
    throw err;
  }
  const profile = await PlanningRecognitionService.getEmployeePlanningProfile(code);
  return profile;
};

export const getEmployeePlanningProfile = async (employeeCode, authUser, effectiveRole) => {
  const requester = employeeCodeOf(authUser);
  const target = String(employeeCode || '').trim();
  if (!target) {
    const err = new Error('employeeCode is required');
    err.statusCode = 400;
    throw err;
  }
  if (target !== requester && !canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const profile = await PlanningRecognitionService.getEmployeePlanningProfile(target);
  return profile;
};

export const getTeamPerformance = async (authUser, effectiveRole, query = {}) => {
  return TeamPerformanceService.getTeamPerformance(authUser, effectiveRole, query);
};

export const getPlanningDashboard = async (authUser, effectiveRole) => {
  return PlanningAnalyticsService.getPlanningDashboard(authUser, effectiveRole);
};

export const getManagerPlanningDashboard = async (authUser, effectiveRole) => {
  return PlanningAnalyticsService.getManagerPlanningDashboard(authUser, effectiveRole);
};

export const getPlanningHistory = async (authUser, effectiveRole, query = {}) => {
  return PlanningAnalyticsService.getPlanningHistory(authUser, effectiveRole, query);
};

export const getPlanningReport = async (authUser, effectiveRole, query = {}) => {
  return PlanningAnalyticsService.getPlanningReport(authUser, effectiveRole, query);
};

export const getTeamPlanningHistory = async (authUser, effectiveRole, query = {}) => {
  return PlanningAnalyticsService.getTeamPlanningHistory(authUser, effectiveRole, query);
};

export const getPlanningExportPayload = async (authUser, effectiveRole, query = {}) => {
  return PlanningAnalyticsService.getPlanningExportPayload(authUser, effectiveRole, query);
};
