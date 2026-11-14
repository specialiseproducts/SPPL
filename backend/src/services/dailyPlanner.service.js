/**
 * Daily Planner — tasks, sales sync, team management, approvals.
 */

import { v4 as uuidv4 } from 'uuid';
import * as DailyPlannerTasksModel from '../models/DailyPlannerTasks.js';
import * as DailyPlannerTeamMappingsModel from '../models/DailyPlannerTeamMappings.js';
import * as SalesPlannerEventsModel from '../models/SalesPlannerEvents.js';
import * as PlanningRecognitionService from './planningRecognition.service.js';
import * as TeamPerformanceService from './teamPerformance.service.js';
import * as PlanningAnalyticsService from './planningAnalytics.service.js';
import { PLANNING_CATEGORY_REGULAR, PLANNING_CATEGORY_URGENT, PLANNING_SOURCE_RESCHEDULED, PLANNING_SOURCE_EXTRA, computeTaskPlanningContribution, computeTaskCompletionContribution, sumPlannedHoursForDate, isTaskCountedTowardDailyMinimum, getMinPlannedHoursForLocation, formatDurationLabel, PRIORITY_SORT_ORDER, buildMinimumHoursWarningMessage, buildMinimumHoursManagerWarningMessage, buildMinimumHoursRequirementMessage, assertValidHoursRequired, isMorningPlanningWindow, assertExactSevenPlannedHours, isManagerReviewWindow, MANAGER_REVIEW_WINDOW_MESSAGE, nextWorkingDayIstDateKey, getPlanningTargetDateMode, isEmployeePlanningWindow, EMPLOYEE_EVENING_PLAN_ONLY_MESSAGE, resolveActivePlanningWindow } from '../utils/planningRecognition.js';
import { getEmployeeLocation } from '../utils/employeeLocation.js';
import { isCompanyWorkingDayDateKey } from '../utils/companyWorkingDays.js';
import { todayIstDateKey } from '../utils/salesQuotationDates.js';
import {
  assertEmployeeActiveOnDate,
  EMPLOYEE_EXITED_OPERATION_MESSAGE,
} from '../utils/employeeActiveStatus.js';
import { canAccessAllRecords, isAdmin, isDeveloper, isSuperAdmin } from '../utils/accessControl.js';
import { notifyUser } from '../utils/notifications.js';
import * as PlannerNotificationEmitters from './notificationEmitters.js';
import * as AuditTrailService from './auditTrail.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../constants/auditTrail.js';
import * as NotificationService from './notification.service.js';
import { NOTIFICATION_MODULES } from '../constants/notifications.js';
import * as DailyPlannerProjectsModel from '../models/DailyPlannerProjects.js';
import * as EmployeeMasterModel from '../models/EmployeeMaster.js';
import * as PayrollLeaveRequestsModel from '../models/PayrollLeaveRequests.js';
import { rangesOverlapMonth } from '../utils/payrollLeaveDates.js';
import {
  FULL_DAY_LEAVE_TASK_BLOCKED_MESSAGE,
  classifyApprovedLeaveForDate,
  getNextEligiblePlannerWorkingDayAfter,
  isFullDayLeaveType,
  isHalfDayLeaveType,
  isOpenPlannerTaskForLeaveReschedule,
} from '../utils/dailyPlannerLeaveRules.js';
import { sendEmail } from './emailService.js';
import { buildFinalPlanEmail, buildRevisedPlanEmail } from './dailyPlannerFinalPlanEmail.js';
import { buildSuperadminReviewEmail } from './dailyPlannerSuperadminReviewEmail.js';
import {
  resolveEnhancedEligibilityForAuthUser,
  resolveEnhancedEligibilityForEmployeeCode,
} from '../utils/dailyPlannerEnhancedEligibility.js';
import * as DailyPlannerEnhancedService from './dailyPlannerEnhanced.service.js';
import * as DailyPlannerProjectObservationsModel from '../models/DailyPlannerProjectObservations.js';
import {
  assertFactoryDailyPlannerEligible,
  resolveFactoryEligibilityForAuthUser,
  resolveFactoryEligibilityForEmployeeCode,
} from '../utils/dailyPlannerFactoryEligibility.js';
import {
  normalizeCompletionTimeSlots,
  reportedMinutesFromTask,
} from '../utils/dailyPlannerTimeSlots.js';
import {
  assertAndNormalizeProcedurePayload,
  decimalHoursFromMinutes,
  descriptionFromSteps,
  evaluateStepTimings,
  mergeStepsForCompletion,
  normalizeProcedureSteps,
  progressFromProcedureSteps,
  stepTimeBounds,
  sumActualMinutes,
  sumPlannedMinutes,
  workDoneFromSteps,
} from '../utils/dailyPlannerProcedureSteps.js';

/** When procedureSteps are present, sync description + hoursRequired from the steps. */
function applyProcedurePayload(body) {
  const procedure = assertAndNormalizeProcedurePayload(body);
  if (!procedure) return { body, procedure: null };
  return {
    body: {
      ...body,
      procedureSteps: procedure.procedureSteps,
      description: procedure.description,
      hoursRequired: procedure.hoursRequired,
    },
    procedure,
  };
}

const PRIORITY_ORDER = PRIORITY_SORT_ORDER;

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

/** Employee has already reported via Mark Completed / Mark Not Completed / Reschedule. */
function hasEmployeeCompletionOutcomeStatus(task) {
  const status = String(task?.status || '').trim();
  return (
    status === 'Awaiting Verification' ||
    status === 'Completed' ||
    status === 'Terminated' ||
    status === 'Rescheduled' ||
    status === 'Verified Complete' ||
    status === 'Not Completed'
  );
}

function isTaskPlanApprovedStatus(task) {
  const status = String(task?.status || '').trim();
  if (status === 'Approved') return true;
  if (String(task?.approvalStatus || '').trim().toUpperCase() === 'APPROVED') return true;
  if (task?.approved === true) return true;
  return false;
}

/** Employee edit: only unapproved + unreported planned tasks. */
function assertEmployeeCanEditManualTask(existing) {
  assertTaskNotPermanentlyClosed(existing);
  if (hasEmployeeCompletionOutcomeStatus(existing)) {
    const err = new Error('This task has already been reported and cannot be edited');
    err.statusCode = 400;
    throw err;
  }
  if (isTaskPlanApprovedStatus(existing) || existing.planFinalizedAt) {
    const err = new Error('Approved tasks cannot be edited');
    err.statusCode = 400;
    throw err;
  }
}

/** Employee delete / whole-task reschedule: allowed until reported. */
function assertEmployeeCanDeleteOrRescheduleManualTask(existing) {
  assertTaskNotPermanentlyClosed(existing);
  if (hasEmployeeCompletionOutcomeStatus(existing)) {
    const err = new Error(
      'This task has already been reported and cannot be deleted or rescheduled',
    );
    err.statusCode = 400;
    throw err;
  }
}

async function listApprovedLeaveForEmployee(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) return [];
  const all = await PayrollLeaveRequestsModel.listLeaveRequestsForEmployee(code);
  return (all || []).filter((row) => String(row.status || '').trim() === 'Approved');
}

async function resolveLeaveKindForEmployeeDate(employeeCode, dateKey, approvedLeaves = null) {
  const leaves =
    approvedLeaves == null
      ? await listApprovedLeaveForEmployee(employeeCode)
      : approvedLeaves;
  return classifyApprovedLeaveForDate(leaves, dateKey);
}

async function assertDateAllowsPlannerTaskCreate(employeeCode, dateKey, approvedLeaves = null) {
  const { kind } = await resolveLeaveKindForEmployeeDate(employeeCode, dateKey, approvedLeaves);
  if (kind === 'full') {
    const err = new Error(FULL_DAY_LEAVE_TASK_BLOCKED_MESSAGE);
    err.statusCode = 400;
    err.code = 'FULL_DAY_LEAVE_BLOCKED';
    throw err;
  }
  return kind;
}

/**
 * Idempotent: move open planned tasks off approved full-day leave dates to the
 * first eligible working day after the leave period (skips weekends/holidays/other full leave).
 */
export const rescheduleTasksOffApprovedFullDayLeave = async (leaveRequest, authUser = null) => {
  const request = leaveRequest || {};
  const leaveRequestId = String(request.leaveRequestId || '').trim();
  const employeeCode = String(request.employeeCode || '').trim();
  if (!leaveRequestId || !employeeCode) {
    return { moved: [], targetDate: null };
  }
  if (!isFullDayLeaveType(request.leaveType)) {
    return { moved: [], targetDate: null };
  }
  if (String(request.status || '').trim() !== 'Approved') {
    return { moved: [], targetDate: null };
  }

  const startDate = String(request.startDate || '').trim().slice(0, 10);
  const endDate = String(request.endDate || '').trim().slice(0, 10);
  if (!startDate || !endDate) {
    return { moved: [], targetDate: null };
  }

  const location = await getEmployeeLocation(employeeCode);
  const approvedLeaves = await listApprovedLeaveForEmployee(employeeCode);
  // Ensure the just-approved row is included even if list is briefly stale.
  if (!approvedLeaves.some((r) => String(r.leaveRequestId || '').trim() === leaveRequestId)) {
    approvedLeaves.push(request);
  }

  const targetDate = getNextEligiblePlannerWorkingDayAfter(endDate, location, approvedLeaves);
  if (!targetDate) {
    return { moved: [], targetDate: null };
  }

  const tasksOnLeave = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
    employeeCode,
    startDate,
    endDate,
  );
  const actorCode = String(authUser?.employeeCode || authUser?.id || 'SYSTEM').trim() || 'SYSTEM';
  const actorName =
    String(
      authUser?.fullName ||
        `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim() ||
        'Leave Approval',
    ).trim() || 'Leave Approval';
  const nowIso = new Date().toISOString();
  const moved = [];

  for (const existing of tasksOnLeave || []) {
    if (!isOpenPlannerTaskForLeaveReschedule(existing)) continue;
    if (String(existing.leaveAutoRescheduleLeaveRequestId || '').trim() === leaveRequestId) {
      continue;
    }
    // Idempotent: already moved for this leave (child already exists).
    const alreadyChild = (tasksOnLeave || []).some(
      (t) =>
        String(t.parentTaskId || '').trim() === String(existing.plannerTaskId || '').trim() &&
        String(t.leaveAutoRescheduleLeaveRequestId || '').trim() === leaveRequestId,
    );
    if (alreadyChild) continue;

    const taskDate = String(existing.date || '').trim().slice(0, 10);
    const { kind } = classifyApprovedLeaveForDate(approvedLeaves, taskDate);
    if (kind !== 'full') continue;
    if (taskDate === targetDate) continue;

    const reason = `Auto-rescheduled due to approved leave (${startDate} → ${endDate})`;
    const closed = await DailyPlannerTasksModel.updateTask(existing.plannerTaskId, {
      status: 'Rescheduled',
      reason,
      rescheduledFromDate: existing.date,
      rescheduledToDate: targetDate,
      rescheduledBy: actorCode,
      rescheduledByName: actorName,
      rescheduledAt: nowIso,
      leaveAutoRescheduleLeaveRequestId: leaveRequestId,
      completionScore: 0,
      finalScore: 0,
    });

    const rescheduledTask = await DailyPlannerTasksModel.createTask({
      employeeCode: existing.employeeCode,
      employeeName: existing.employeeName,
      date: targetDate,
      taskName: existing.taskName,
      description: existing.description,
      procedureSteps: Array.isArray(existing.procedureSteps) ? existing.procedureSteps : [],
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
      status: existing.status === 'Needs Revision' ? 'Needs Revision' : existing.status || 'Pending',
      approved: existing.approved,
      approvalStatus: existing.approvalStatus,
      approvedBy: existing.approvedBy,
      approvedByName: existing.approvedByName,
      approvedAt: existing.approvedAt,
      approvedDate: existing.approvedDate,
      managerComments: existing.managerComments,
      managerInstructions: existing.managerInstructions,
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
      planningTimestamp: nowIso,
      planningScore: Number(existing.planningScore) || 0,
      completionScore: 0,
      finalScore: Number(existing.planningScore) || 0,
      createdByRole: String(existing.createdByRole || '').trim(),
      createdByEmployeeCode: String(existing.createdByEmployeeCode || '').trim(),
      createdByName: String(existing.createdByName || '').trim(),
      isProjectBased: Boolean(existing.isProjectBased),
      projectName: String(existing.projectName || '').trim(),
      projectTaskId: String(existing.projectTaskId || '').trim(),
      planFinalizedAt: existing.planFinalizedAt || null,
      planFinalizedBy: String(existing.planFinalizedBy || '').trim(),
      leaveAutoRescheduleLeaveRequestId: leaveRequestId,
      needsDocument: existing.needsDocument,
      documentFileName: existing.documentFileName,
      documentFileKey: existing.documentFileKey,
      documentUploadedAt: existing.documentUploadedAt,
      documentContentType: existing.documentContentType,
      progressDone: existing.progressDone,
      flagStatus: existing.flagStatus,
      flagInstruction: existing.flagInstruction,
      flagRaisedBy: existing.flagRaisedBy,
      flagRaisedByName: existing.flagRaisedByName,
      flagRaisedAt: existing.flagRaisedAt,
      flagAcceptedAt: existing.flagAcceptedAt,
      flagHistory: existing.flagHistory,
      revisionReason: existing.revisionReason,
      revisionRequestedBy: existing.revisionRequestedBy,
      revisionRequestedByName: existing.revisionRequestedByName,
      revisionRequestedAt: existing.revisionRequestedAt,
    });

    if (authUser) {
      auditPlannerTask(
        authUser,
        AUDIT_ACTIONS.STATUS_CHANGE,
        closed,
        'Task Auto-Rescheduled For Approved Leave',
        {
          oldValues: { date: existing.date, status: existing.status },
          newValues: {
            date: targetDate,
            status: 'Rescheduled',
            leaveRequestId,
            rescheduledTaskId: rescheduledTask.plannerTaskId,
          },
        },
      );
    }

    moved.push({ from: closed, to: rescheduledTask });
  }

  return { moved, targetDate };
};

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

async function isEmployeeOnManagersTeam(managerCode, employeeCode) {
  const mgr = String(managerCode || '').trim();
  const target = String(employeeCode || '').trim();
  if (!mgr || !target) return false;
  const team = await DailyPlannerTeamMappingsModel.listEmployeesForManager(mgr);
  return (team || []).some(
    (m) =>
      String(m.status || 'Active').trim() === 'Active' &&
      String(m.employeeCode || '').trim() === target,
  );
}

/**
 * Mutations (create/edit/approve/complete/etc.) for a team employee's tasks.
 * Super Admin: only employees on their own Active Daily Planner team mapping.
 *   Out-of-team employees are view + review-comment only (see submitSuperadminReviewComment).
 * Admin / Developer: only employees on their Active team mapping.
 */
async function assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, employeeCode) {
  const target = String(employeeCode || '').trim();
  const managerCode = employeeCodeOf(authUser);
  if (!target || !managerCode) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  if (isSuperAdmin(effectiveRole)) {
    const onTeam = await isEmployeeOnManagersTeam(managerCode, target);
    if (!onTeam) {
      const err = new Error(
        'Super Admin may only manage Daily Planner tasks for employees on their own team. Out-of-team access is view and review-comment only.',
      );
      err.statusCode = 403;
      err.code = 'SUPERADMIN_OUT_OF_TEAM_READONLY';
      throw err;
    }
    return;
  }

  if (!isAdmin(effectiveRole) && !isDeveloper(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  const onTeam = await isEmployeeOnManagersTeam(managerCode, target);
  if (!onTeam) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Read access for Team Daily Planner (including Super Admin company-wide view).
 */
async function assertCanViewTeamEmployeePlanner(authUser, effectiveRole, employeeCode) {
  const target = String(employeeCode || '').trim();
  const self = employeeCodeOf(authUser);
  if (!target) {
    const err = new Error('employeeCode is required');
    err.statusCode = 400;
    throw err;
  }
  if (target === self) return;
  if (isSuperAdmin(effectiveRole)) return;
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  // Admin / Developer: own team only.
  const onTeam = await isEmployeeOnManagersTeam(self, target);
  if (!onTeam) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

async function assertEmployeeCodeActiveOnDate(employeeCode, operationDate) {
  const code = String(employeeCode || '').trim();
  if (!code) return;
  const employee = await EmployeeMasterModel.getEmployeeByCode(code);
  assertEmployeeActiveOnDate(
    employee?.dateOfExit || employee?.date_of_exit,
    operationDate,
    EMPLOYEE_EXITED_OPERATION_MESSAGE,
  );
}

function normalizePriorityValue(value, fallback = 'Medium') {
  const p = String(value || '').trim();
  if (p === 'Urgent' || p === 'High' || p === 'Medium' || p === 'Low') return p;
  return fallback;
}

function planningCategoryFromPriority(priority) {
  return String(priority || '').trim() === 'Urgent'
    ? PLANNING_CATEGORY_URGENT
    : PLANNING_CATEGORY_REGULAR;
}

function formatPlanDateLabel(dateKey) {
  const [y, m, d] = String(dateKey || '')
    .slice(0, 10)
    .split('-')
    .map(Number);
  if (!y || !m || !d) return String(dateKey || '').trim();
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function finalizedFieldSnapshot(task) {
  const hours = Number(task?.hoursRequired);
  return {
    taskName: String(task?.taskName || '').trim(),
    description: String(task?.description || '').trim(),
    priority: String(task?.currentPriority || task?.priority || 'Medium').trim(),
    hoursRequired: Number.isFinite(hours) ? Math.round(hours * 100) / 100 : 0,
    managerInstructions: String(task?.managerInstructions || '').trim(),
    managerComments: String(task?.managerComments || '').trim(),
  };
}

function readFinalizedSnapshot(task) {
  const raw = task?.lastFinalizedSnapshot;
  if (!raw || typeof raw !== 'object') return null;
  return finalizedFieldSnapshot(raw);
}

function isTaskAddedAfterFinalize(task) {
  const snapshot = readFinalizedSnapshot(task);
  if (snapshot) return false;
  const createdAt = String(task?.createdAt || '').trim();
  const finalizedAt = String(task?.planFinalizedAt || '').trim();
  if (!finalizedAt) return true;
  if (!createdAt) return false;
  return createdAt > finalizedAt;
}

function collectFinalPlanChanges(tasks) {
  const changes = [];
  for (const task of tasks || []) {
    const current = finalizedFieldSnapshot(task);
    const previous = readFinalizedSnapshot(task);
    if (!previous) {
      if (isTaskAddedAfterFinalize(task)) {
        changes.push({
          label: `Added Task: "${current.taskName || 'Untitled'}"`,
          details: [],
        });
      }
      continue;
    }
    const details = [];
    if (previous.taskName !== current.taskName) {
      details.push(`Task Name: ${previous.taskName || '—'} → ${current.taskName || '—'}`);
    }
    if (previous.description !== current.description) {
      details.push('Task Description updated');
    }
    if (previous.priority !== current.priority) {
      details.push(`Priority: ${previous.priority} → ${current.priority}`);
    }
    if (previous.hoursRequired !== current.hoursRequired) {
      details.push(
        `Hours Planned: ${formatDurationLabel(previous.hoursRequired)} → ${formatDurationLabel(current.hoursRequired)}`,
      );
    }
    const prevRemark = [previous.managerInstructions, previous.managerComments].filter(Boolean).join(' | ');
    const nextRemark = [current.managerInstructions, current.managerComments].filter(Boolean).join(' | ');
    if (prevRemark !== nextRemark) {
      details.push('Instruction / Comment updated');
    }
    if (details.length > 0) {
      changes.push({
        label: `Edited Task: "${current.taskName || previous.taskName || 'Untitled'}"`,
        details,
      });
    }
  }
  return changes;
}

/**
 * Fire-and-forget revised plan email when manager changes a finalized day plan.
 */
async function sendRevisedPlanEmailForEmployee({
  employeeCode,
  date,
  changes,
}) {
  const code = String(employeeCode || '').trim();
  const dateKey = String(date || '').trim().slice(0, 10);
  if (!code || !dateKey) return;

  const [employee, tasks] = await Promise.all([
    EmployeeMasterModel.getEmployeeByCode(code),
    DailyPlannerTasksModel.listTasksForEmployeeMonth(code, dateKey, dateKey),
  ]);
  const officialEmail = String(
    employee?.officialEmail || employee?.official_email || employee?.email || '',
  ).trim();
  if (!officialEmail) return;

  const activeTasks = (tasks || []).filter((t) => String(t.status || '').trim() !== 'Rescheduled');
  const sorted = [...activeTasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.currentPriority || a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.currentPriority || b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return String(a.taskName || '').localeCompare(String(b.taskName || ''), undefined, {
      sensitivity: 'base',
    });
  });
  const totalHours = sumPlannedHoursForDate(sorted, dateKey);
  const employeeName =
    String(employee?.fullName || '').trim() ||
    `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() ||
    sorted[0]?.employeeName ||
    code;

  const mail = buildRevisedPlanEmail({
    employeeName,
    dateLabel: formatPlanDateLabel(dateKey),
    totalHours,
    tasks: sorted,
    changes: changes || [],
  });
  void sendEmail({
    to: officialEmail,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  }).catch((err) => {
    console.error('Revised plan email failed:', err);
  });
}

/**
 * Factory task owners must always create project-based tasks with a Project Name.
 * Office behavior is unchanged (body.isProjectBased decides).
 */
async function resolveProjectBindingForOwner(ownerEmployeeCode, body) {
  const factoryOwner = await resolveFactoryEligibilityForEmployeeCode(ownerEmployeeCode);
  const isProjectBased =
    factoryOwner || Boolean(body?.isProjectBased === true || body?.isProjectBased === 'Yes');
  let projectName = isProjectBased
    ? String(body?.projectName || '')
        .trim()
        .replace(/\s+/g, ' ')
    : '';
  if (isProjectBased && !projectName) {
    const err = new Error(
      factoryOwner
        ? 'Project Name is required for Factory tasks'
        : 'Project Name is required when the task is project-based',
    );
    err.statusCode = 400;
    throw err;
  }

  let projectTaskId = isProjectBased ? String(body?.projectTaskId || '').trim() : '';
  if (isProjectBased && projectName) {
    // Case/whitespace-insensitive reuse of an existing project record.
    const existing = await DailyPlannerProjectsModel.getProjectByName(projectName);
    if (existing?.projectName) {
      projectName = existing.projectName;
    }
    if (existing?.managed) {
      const activeTasks = (existing.projectTasks || []).filter((t) => t.status === 'Active');
      if (projectTaskId) {
        const match = activeTasks.find((t) => t.projectTaskId === projectTaskId);
        if (!match) {
          const err = new Error('Selected task does not belong to the selected project');
          err.statusCode = 400;
          throw err;
        }
      } else {
        // Resolve by task name when projectTaskId omitted (backward compatible).
        const byName = activeTasks.find(
          (t) =>
            String(t.taskName || '').trim().toLowerCase() ===
            String(body?.taskName || '').trim().toLowerCase(),
        );
        if (byName) projectTaskId = byName.projectTaskId;
      }
    }
  }

  return { isProjectBased, projectName, projectTaskId, factoryOwner };
}

/** Upsert catalog project; return canonical displayName (deduped by normalizeProjectKey). */
async function upsertCanonicalProjectName(projectName, createdBy) {
  const name = String(projectName || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!name) return '';
  const project = await DailyPlannerProjectsModel.upsertProject(name, createdBy);
  return String(project?.projectName || name).trim();
}

/** Parse HH:mm / H:mm into minutes since midnight; returns null if invalid. */
function parseTimeToMinutes(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function durationHoursFromStartEnd(startTime, endTime) {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  if (startMins == null || endMins == null) {
    const err = new Error('startTime and endTime are required in HH:mm format');
    err.statusCode = 400;
    throw err;
  }
  if (endMins < startMins) {
    const err = new Error('endTime must be on or after startTime (same day)');
    err.statusCode = 400;
    throw err;
  }
  return Math.round(((endMins - startMins) / 60) * 100) / 100;
}

function normalizeClockTime(value) {
  const mins = parseTimeToMinutes(value);
  if (mins == null) return String(value || '').trim();
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function completedHoursForTask(task) {
  const completion = Number(task?.completionDurationHours);
  if (Number.isFinite(completion) && completion >= 0) return completion;
  const planned = Number(task?.hoursRequired);
  return Number.isFinite(planned) && planned > 0 ? planned : 0;
}

function sumDayCompletedHours(tasks) {
  const done = new Set(['Completed', 'Awaiting Verification', 'Verified Complete']);
  return Math.round(
    (tasks || [])
      .filter((t) => done.has(String(t.status || '').trim()))
      .reduce((sum, t) => sum + completedHoursForTask(t), 0) * 100,
  ) / 100;
}

/** Recalculate reported hours from stored Start/End times (do not trust client totals). */
function sumDayReportedHoursFromStartEnd(tasks) {
  const done = new Set(['Completed', 'Awaiting Verification', 'Verified Complete']);
  let total = 0;
  for (const task of tasks || []) {
    if (!done.has(String(task?.status || '').trim())) continue;
    // Prefer timeSlots (Factory multi-slot) via reportedMinutesFromTask; falls back to start/end.
    const minutes = reportedMinutesFromTask(task);
    if (minutes != null && Number.isFinite(minutes)) {
      total += minutes / 60;
      continue;
    }
    try {
      total += durationHoursFromStartEnd(task.completionStartTime, task.completionEndTime);
    } catch {
      // Missing/invalid times contribute 0 — submission will fail min-hours check.
    }
  }
  return Math.round(total * 100) / 100;
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
 * Sales Planner sync for one employee + date range.
 * Loads tasks and sales events once each (shared events scan/cache — no per-event scans).
 * Skips event fetch when caller already knows the owner has no events and no imported tasks.
 * Returns the post-sync task list for that range.
 */
async function syncSalesPlannerImports(
  employeeCode,
  employeeName,
  startDate,
  endDate,
  year,
  month,
  options = {},
) {
  const code = String(employeeCode || '').trim();
  if (!code) return [];

  const existingTasks =
    Array.isArray(options.existingTasks)
      ? options.existingTasks
      : await DailyPlannerTasksModel.listTasksForEmployeeMonth(code, startDate, endDate);

  const hasImportedSales = (existingTasks || []).some(
    (task) =>
      String(task.source || '').trim() === 'SALES_FORECASTING' &&
      String(task.salesPlannerId || '').trim(),
  );

  // Fast path: no imported sales tasks and caller confirmed no events for this owner.
  if (!hasImportedSales && options.knownNoSalesEvents === true) {
    return existingTasks;
  }

  const events = await SalesPlannerEventsModel.listPlannerEventsForMonth(
    code,
    year,
    month,
    startDate,
    endDate,
  );

  // Fast path: nothing to create/update/delete.
  if (!hasImportedSales && (!events || events.length === 0)) {
    return existingTasks;
  }

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

  const [existingTasks, ownersWithEvents] = await Promise.all([
    DailyPlannerTasksModel.listTasksForEmployeeMonth(
      code,
      parsed.startDate,
      parsed.endDate,
    ),
    SalesPlannerEventsModel.listOwnerCodesWithEventsInRange(
      parsed.startDate,
      parsed.endDate,
    ),
  ]);
  const tasks = await syncSalesPlannerImports(
    code,
    name,
    parsed.startDate,
    parsed.endDate,
    parsed.year,
    parsed.month,
    {
      existingTasks,
      knownNoSalesEvents: !ownersWithEvents.has(code),
    },
  );
  const sorted = sortDailyPlannerTasks(tasks);
  return {
    tasks: await annotateReportingPersonCreatedTasks(sorted, code),
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
  const [existingTasks, ownersWithEvents] = await Promise.all([
    DailyPlannerTasksModel.listTasksForEmployeeMonth(code, date, date),
    SalesPlannerEventsModel.listOwnerCodesWithEventsInRange(date, date),
  ]);
  const tasks = await syncSalesPlannerImports(
    code,
    employeeNameOf(authUser),
    date,
    date,
    y,
    m,
    {
      existingTasks,
      knownNoSalesEvents: !ownersWithEvents.has(code),
    },
  );
  const sorted = sortDailyPlannerTasks(tasks);
  return { tasks: await annotateReportingPersonCreatedTasks(sorted, code), date };
};

export const createManualTask = async (rawBody, authUser, effectiveRole, options = {}) => {
  const rawEarly = rawBody || {};
  const isExtraEarly =
    rawEarly.isExtraTask === true ||
    rawEarly.isExtraTask === 'true' ||
    String(rawEarly.source || '').trim() === PLANNING_SOURCE_EXTRA;

  // Extra Task skips planned-step validation — steps carry actual durations only.
  if (isExtraEarly) {
    const code = employeeCodeOf(authUser);
    const date = String(rawEarly.date || '').trim();
    const taskName = String(rawEarly.taskName || '').trim();
    if (!code || !date || !taskName) {
      const err = new Error('date and taskName are required');
      err.statusCode = 400;
      throw err;
    }

    await assertEmployeeCodeActiveOnDate(code, date);
    const leaveKindForDate = await assertDateAllowsPlannerTaskCreate(code, date);

    const now = new Date();
    if (!isEmployeePlanningWindow(now) && leaveKindForDate !== 'half') {
      const err = new Error(EMPLOYEE_EVENING_PLAN_ONLY_MESSAGE);
      err.statusCode = 400;
      throw err;
    }
    const today = todayIstDateKey(now);
    if (date !== today) {
      const err = new Error('Extra tasks can only be added for today');
      err.statusCode = 400;
      throw err;
    }

    const priority = normalizePriorityValue(rawEarly.priority, 'Medium');
    const incomingSteps = normalizeProcedureSteps(rawEarly.procedureSteps);
    const actualSteps = incomingSteps
      .map((s) => {
        const actualMins = Math.max(0, Math.round(Number(s.actualMinutes) || 0));
        const work = String(s.workDone || s.description || '').trim();
        if (!work || actualMins <= 0) return null;
        return {
          ...s,
          description: String(s.description || work).trim(),
          // Extra tasks do not store planned step durations.
          plannedMinutes: 0,
          actualMinutes: actualMins,
          workDone: work,
          status: 'completed',
          completed: true,
          startTime: null,
          endTime: null,
        };
      })
      .filter(Boolean);

    let workDone = String(rawEarly.workDone || rawEarly.reason || '').trim();
    let completionDurationHours;
    let completionStartTime = null;
    let completionEndTime = null;
    let procedureSteps = [];
    let description = String(rawEarly.description || '').trim();

    if (actualSteps.length > 0) {
      procedureSteps = actualSteps;
      const totalActual = sumActualMinutes(actualSteps);
      completionDurationHours = assertValidHoursRequired(decimalHoursFromMinutes(totalActual), {
        required: true,
      });
      if (!workDone) workDone = workDoneFromSteps(actualSteps);
      if (!description) description = descriptionFromSteps(actualSteps);
    } else {
      if (!workDone) {
        const err = new Error('Work done is required');
        err.statusCode = 400;
        throw err;
      }
      const startTimeRaw = rawEarly.startTime ?? rawEarly.completionStartTime;
      const endTimeRaw = rawEarly.endTime ?? rawEarly.completionEndTime;
      completionDurationHours = assertValidHoursRequired(
        durationHoursFromStartEnd(startTimeRaw, endTimeRaw),
        { required: true },
      );
      completionStartTime = normalizeClockTime(startTimeRaw);
      completionEndTime = normalizeClockTime(endTimeRaw);
      // Preserve description-only Extra procedure steps (no planned / actual step durations).
      procedureSteps = incomingSteps
        .map((s) => {
          const desc = String(s.description || '').trim();
          if (!desc) return null;
          return {
            ...s,
            description: desc,
            plannedMinutes: 0,
            actualMinutes: null,
            workDone: '',
            status: 'pending',
            completed: false,
            startTime: null,
            endTime: null,
          };
        })
        .filter(Boolean);
      if (!description && procedureSteps.length > 0) {
        description = descriptionFromSteps(procedureSteps);
      }
    }

    // Extra Task: planned hours stay 0; actual duration is completionDurationHours only.
    const hoursRequired = 0;
    const binding = await resolveProjectBindingForOwner(code, rawEarly);
    const isProjectBased = binding.isProjectBased;
    const projectTaskId = binding.projectTaskId;
    const projectName = binding.projectName
      ? await upsertCanonicalProjectName(binding.projectName, code)
      : '';

    const planningScore = 0;
    const completionScore = computeTaskCompletionContribution('Completed');
    const nowIso = now.toISOString();

    const task = await DailyPlannerTasksModel.createTask({
      employeeCode: code,
      employeeName: employeeNameOf(authUser),
      date,
      taskName,
      description,
      priority,
      originalPriority: priority,
      currentPriority: priority,
      hoursRequired,
      originalHoursRequired: hoursRequired,
      hoursRequiredEdited: false,
      taskType: 'Manual',
      source: PLANNING_SOURCE_EXTRA,
      status: 'Verified Complete',
      approved: true,
      approvalStatus: 'APPROVED',
      approvedBy: code,
      approvedByName: employeeNameOf(authUser),
      approvedAt: nowIso,
      approvedDate: nowIso,
      reason: workDone,
      managerComments: '',
      managerInstructions: '',
      isProjectBased,
      projectName,
      projectTaskId,
      createdByRole: 'User',
      createdByEmployeeCode: code,
      createdByName: employeeNameOf(authUser),
      planningCategory: planningCategoryFromPriority(priority),
      urgentReason: '',
      planningWindowUsed: resolveActivePlanningWindow(now),
      planningTimestamp: nowIso,
      planningScore,
      completionScore,
      finalScore: planningScore + completionScore,
      completionStartTime,
      completionEndTime,
      completionDurationHours,
      procedureSteps,
      verificationStatus: 'VERIFIED_COMPLETED',
      verifiedBy: code,
      verifiedByName: employeeNameOf(authUser),
      verifiedAt: nowIso,
      clientBatchId: String(rawEarly.clientBatchId || '').trim() || null,
    });

    auditPlannerTask(authUser, AUDIT_ACTIONS.CREATE, task, 'Extra Task Created', {
      newValues: {
        taskName: task.taskName,
        priority: task.priority,
        hoursRequired: task.hoursRequired,
        date: task.date,
        status: task.status,
        source: task.source,
      },
    });

    return { task, planningAward: null };
  }

  const { body, procedure } = applyProcedurePayload(rawBody);
  const procedureSteps = procedure?.procedureSteps ?? [];
  const code = employeeCodeOf(authUser);
  const date = String(body.date || '').trim();
  const taskName = String(body.taskName || '').trim();
  if (!code || !date || !taskName) {
    const err = new Error('date and taskName are required');
    err.statusCode = 400;
    throw err;
  }

  // Batch create reuses leave/location/existing-task context to avoid N× DynamoDB lookups.
  if (!options.skipActiveAssert) {
    await assertEmployeeCodeActiveOnDate(code, date);
  }
  const leaveKindForDate =
    options.leaveKind !== undefined && options.leaveKind !== null
      ? options.leaveKind
      : await assertDateAllowsPlannerTaskCreate(code, date);

  const elevated = canAccessAllRecords(effectiveRole);
  const now = new Date();
  const location = options.location || (await getEmployeeLocation(code));

  const priority = normalizePriorityValue(body.priority, 'Medium');
  // Priority Urgent maps to Urgent planning category for scoring; else Regular.
  const requestBody = {
    ...body,
    priority,
    planningCategory: planningCategoryFromPriority(priority),
  };

  const planningMeta = PlanningRecognitionService.validateTaskPlanningPayload(
    requestBody,
    now,
    location,
    // My Daily Planner self-create uses employee planning windows even for Admin/Developer.
    // Manager add-for-employee keeps elevated via createTaskForEmployee.
    { elevated: false },
  );
  const hoursRequired = assertValidHoursRequired(body.hoursRequired, { required: true });

  // Self-create must meet minimum planned hours for the day (existing + this task).
  // Applies to all roles on My Daily Planner; Team for-employee uses createTaskForEmployee.
  // Dates after tomorrow (advance planning) allow partial hours — no daily minimum.
  const revisesTaskIdEarly = String(body.revisesTaskId || '').trim();
  const existingForDate = Array.isArray(options.existingForDate)
    ? options.existingForDate
    : await DailyPlannerTasksModel.listTasksForEmployeeMonth(code, date, date);
  if (
    !revisesTaskIdEarly &&
    (existingForDate || []).some(
      (t) =>
        Boolean(t.planFinalizedAt) && String(t.status || '').trim() !== 'Rescheduled',
    )
  ) {
    const err = new Error(
      'This daily plan has been finalized. No further planning is allowed for this date.',
    );
    err.statusCode = 400;
    throw err;
  }
  const dateMode = getPlanningTargetDateMode(date, now);
  if (!revisesTaskIdEarly && !options.skipExactSevenCheck && dateMode !== 'other') {
    const existingHours = sumPlannedHoursForDate(existingForDate, date);
    assertExactSevenPlannedHours(
      Math.round((existingHours + hoursRequired) * 100) / 100,
      location,
      leaveKindForDate,
    );
  }

  const binding = await resolveProjectBindingForOwner(code, body);
  const isProjectBased = binding.isProjectBased;
  const projectTaskId = binding.projectTaskId;
  const projectName = binding.projectName
    ? await upsertCanonicalProjectName(binding.projectName, code)
    : '';

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

  const managerInstructions = elevated
    ? String(body.managerInstructions || body.instructions || '').trim()
    : '';

  const enhancedEligible =
    options.enhancedEligible !== undefined
      ? options.enhancedEligible
      : await resolveEnhancedEligibilityForAuthUser(authUser, effectiveRole);
  const enhancedFields = DailyPlannerEnhancedService.parseOptionalEnhancedFields(
    body,
    enhancedEligible,
  );

  // My Daily Planner self-create is Pending for User/Admin/Developer.
  // Super Admin own tasks (this endpoint always assigns the logged-in user) are self-approved
  // because Super Admin users have no reporting manager. Team Daily Planner uses
  // createTaskForEmployee and is unchanged. Employee custom revision is also self-approved.
  const autoApproved = Boolean(revisesTaskId) || isSuperAdmin(effectiveRole);
  const parentFinalizedAt = revisionParent?.planFinalizedAt || null;
  const task = await DailyPlannerTasksModel.createTask({
    employeeCode: code,
    employeeName: employeeNameOf(authUser),
    date,
    taskName,
    description: String(body.description || '').trim(),
    procedureSteps,
    priority,
    originalPriority: priority,
    currentPriority: priority,
    hoursRequired,
    originalHoursRequired: hoursRequired,
    hoursRequiredEdited: false,
    taskType: 'Manual',
    source: 'MANUAL',
    status: autoApproved ? 'Approved' : 'Pending',
    approved: autoApproved,
    approvalStatus: autoApproved ? 'APPROVED' : '',
    approvedBy: autoApproved ? code : '',
    approvedByName: autoApproved ? employeeNameOf(authUser) : '',
    approvedAt: autoApproved ? now.toISOString() : null,
    approvedDate: autoApproved ? now.toISOString() : null,
    managerComments: String(body.managerComments || '').trim(),
    managerInstructions,
    isProjectBased,
    projectName,
    projectTaskId,
    ...enhancedFields,
    createdByRole: elevated ? 'Manager' : 'User',
    createdByEmployeeCode: code,
    createdByName: employeeNameOf(authUser),
    planningCategory: planningMeta.planningCategory,
    urgentReason: planningMeta.urgentReason,
    planningWindowUsed: planningMeta.planningWindowUsed,
    planningTimestamp: planningMeta.planningTimestamp,
    planningScore,
    completionScore,
    finalScore,
    parentTaskId: revisesTaskId || null,
    clientBatchId: String(body.clientBatchId || '').trim() || null,
    planFinalizedAt: autoApproved ? parentFinalizedAt : null,
    planFinalizedBy: autoApproved
      ? String(revisionParent?.planFinalizedBy || '').trim()
      : '',
  });

  if (revisionParent) {
    await markRevisionHandled(revisesTaskId, 'custom_revision', task.plannerTaskId);
  }

  // Keep batch in-memory day list current so the next draft sees this create.
  if (Array.isArray(options.existingForDate)) {
    options.existingForDate.push(task);
  }

  let planningAward = null;
  if (!options.skipPlanningAward) {
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
  }

  if (!options.skipHoursNotify) {
    await maybeNotifyMinimumHoursShortfall(code, date, location, employeeNameOf(authUser));
  }

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

/**
 * User batch create for next-working-day plan — requires at least 7 hours total
 * (existing planned hours for that date + this batch).
 */
export const createManualTaskBatch = async (body, authUser, effectiveRole) => {
  const drafts = (Array.isArray(body?.tasks) ? body.tasks : []).map(
    (draft) => applyProcedurePayload(draft).body,
  );
  if (drafts.length === 0) {
    const err = new Error('At least one task is required');
    err.statusCode = 400;
    throw err;
  }

  const sharedDate = String(drafts[0]?.date || '').trim();
  if (!sharedDate || drafts.some((d) => String(d.date || '').trim() !== sharedDate)) {
    const err = new Error('All tasks must use the same date');
    err.statusCode = 400;
    throw err;
  }

  const batchHours = drafts.reduce((sum, d) => {
    const h = Number(d.hoursRequired);
    return sum + (Number.isFinite(h) && h > 0 ? h : 0);
  }, 0);

  const code = employeeCodeOf(authUser);
  const existing = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
    code,
    sharedDate,
    sharedDate,
  );
  if (
    (existing || []).some(
      (t) =>
        Boolean(t.planFinalizedAt) && String(t.status || '').trim() !== 'Rescheduled',
    )
  ) {
    const err = new Error(
      'This daily plan has been finalized. No further planning is allowed for this date.',
    );
    err.statusCode = 400;
    throw err;
  }
  const clientBatchId = String(body?.clientBatchId || drafts[0]?.clientBatchId || '').trim();
  if (clientBatchId) {
    const already = (existing || []).filter(
      (task) => String(task.clientBatchId || '').trim() === clientBatchId,
    );
    if (already.length > 0) {
      return { tasks: already };
    }
  }

  // Batch create is the My Daily Planner plan submit path — enforce minimum hours for
  // today/tomorrow. Dates after tomorrow allow partial advance planning.
  const location = await getEmployeeLocation(code);
  const leaveKind = await assertDateAllowsPlannerTaskCreate(code, sharedDate);
  const existingHours = sumPlannedHoursForDate(existing, sharedDate);
  if (getPlanningTargetDateMode(sharedDate, new Date()) !== 'other') {
    assertExactSevenPlannedHours(
      Math.round((existingHours + batchHours) * 100) / 100,
      location,
      leaveKind,
    );
  }

  await assertEmployeeCodeActiveOnDate(code, sharedDate);
  const enhancedEligible = await resolveEnhancedEligibilityForAuthUser(authUser, effectiveRole);
  // Mutated after each create so subsequent drafts see in-batch siblings (finalize / hours).
  const existingForDate = [...(existing || [])];

  const created = [];
  for (const draft of drafts) {
    const result = await createManualTask(draft, authUser, effectiveRole, {
      skipExactSevenCheck: true,
      skipPlanningAward: true,
      skipHoursNotify: true,
      skipActiveAssert: true,
      leaveKind,
      location,
      existingForDate,
      enhancedEligible,
    });
    created.push(result.task);
  }

  // One planning recompute + hours notify for the whole batch (avoids N× monthly score work).
  const hasRegular = created.some(
    (t) => String(t.planningCategory || '').trim() === PLANNING_CATEGORY_REGULAR,
  );
  const hasUrgent = created.some(
    (t) => String(t.planningCategory || '').trim() === PLANNING_CATEGORY_URGENT,
  );
  if (hasRegular) {
    await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
      employeeCode: code,
      workingDayDateKey: sharedDate,
    });
  } else if (hasUrgent) {
    await PlanningRecognitionService.recordPlanningImpactForUrgentTask({
      employeeCode: code,
      reference: new Date(),
    });
  }
  // Notifications must not block Save response latency.
  void maybeNotifyMinimumHoursShortfall(code, sharedDate, location, employeeNameOf(authUser));

  return { tasks: created };
};

/**
 * Manager/Admin creates a task for a team employee (auto-approved).
 */
export const createTaskForEmployee = async (rawBody, authUser, effectiveRole) => {
  const { body, procedure } = applyProcedurePayload(rawBody);
  const procedureSteps = procedure?.procedureSteps ?? [];
  assertCanModerateTeamTask(effectiveRole);
  const targetCode = String(body.employeeCode || '').trim();
  if (!targetCode) {
    const err = new Error('employeeCode is required');
    err.statusCode = 400;
    throw err;
  }

  const managerCode = employeeCodeOf(authUser);
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  await assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, targetCode);

  const employee = await EmployeeMasterModel.getEmployeeByCode(targetCode);
  const employeeName =
    String(employee?.fullName || '').trim() ||
    `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() ||
    targetCode;

  const date = String(body.date || '').trim();
  const taskName = String(body.taskName || '').trim();
  if (!date || !taskName) {
    const err = new Error('date and taskName are required');
    err.statusCode = 400;
    throw err;
  }

  await assertEmployeeCodeActiveOnDate(targetCode, date);
  await assertDateAllowsPlannerTaskCreate(targetCode, date);

  const now = new Date();
  const location = await getEmployeeLocation(targetCode);
  const existingForEmployeeDate = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
    targetCode,
    date,
    date,
  );
  const wasPlanFinalized = (existingForEmployeeDate || []).some(
    (t) =>
      Boolean(t.planFinalizedAt) && String(t.status || '').trim() !== 'Rescheduled',
  );
  const finalizedSample = (existingForEmployeeDate || []).find((t) => Boolean(t.planFinalizedAt));

  const priority = normalizePriorityValue(body.priority, 'Medium');
  const requestBody = {
    ...body,
    priority,
    planningCategory: planningCategoryFromPriority(priority),
  };
  const planningMeta = PlanningRecognitionService.validateTaskPlanningPayload(
    requestBody,
    now,
    location,
    { elevated: true },
  );
  const hoursRequired = assertValidHoursRequired(body.hoursRequired, { required: true });
  // Factory rule applies to the task OWNER (target employee), not the manager creating it.
  const binding = await resolveProjectBindingForOwner(targetCode, body);
  const isProjectBased = binding.isProjectBased;
  const projectTaskId = binding.projectTaskId;
  const projectName = binding.projectName
    ? await upsertCanonicalProjectName(binding.projectName, managerCode)
    : '';

  const managerInstructions = String(body.managerInstructions || body.instructions || '').trim();
  const targetEligible = await resolveEnhancedEligibilityForEmployeeCode(targetCode);
  const enhancedFields = DailyPlannerEnhancedService.parseOptionalEnhancedFields(
    body,
    targetEligible,
  );
  const task = await DailyPlannerTasksModel.createTask({
    employeeCode: targetCode,
    employeeName,
    date,
    taskName,
    description: String(body.description || '').trim(),
    procedureSteps,
    priority,
    originalPriority: priority,
    currentPriority: priority,
    hoursRequired,
    originalHoursRequired: hoursRequired,
    hoursRequiredEdited: false,
    taskType: 'Manual',
    source: 'MANUAL',
    status: 'Approved',
    approved: true,
    approvalStatus: 'APPROVED',
    approvedBy: managerCode,
    approvedByName: employeeNameOf(authUser),
    approvedAt: now.toISOString(),
    approvedDate: now.toISOString(),
    managerComments: String(body.managerComments || '').trim(),
    managerInstructions,
    isProjectBased,
    projectName,
    projectTaskId,
    ...enhancedFields,
    createdByRole: 'Manager',
    createdByEmployeeCode: managerCode,
    createdByName: employeeNameOf(authUser),
    planningCategory: planningMeta.planningCategory,
    urgentReason: planningMeta.urgentReason,
    planningWindowUsed: planningMeta.planningWindowUsed,
    planningTimestamp: planningMeta.planningTimestamp,
    planningScore: 0,
    completionScore: 0,
    finalScore: 0,
    // Keep new task inside the finalized plan when Team adds after finalize.
    planFinalizedAt: wasPlanFinalized ? finalizedSample?.planFinalizedAt || now.toISOString() : null,
    planFinalizedBy: wasPlanFinalized
      ? String(finalizedSample?.planFinalizedBy || managerCode).trim()
      : '',
  });

  if (planningMeta.planningCategory === PLANNING_CATEGORY_REGULAR) {
    await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
      employeeCode: targetCode,
      workingDayDateKey: date,
    });
  } else if (planningMeta.planningCategory === PLANNING_CATEGORY_URGENT) {
    await PlanningRecognitionService.recordPlanningImpactForUrgentTask({
      employeeCode: targetCode,
      reference: now,
    });
  }

  if (wasPlanFinalized && body?.skipRevisedEmail !== true) {
    void sendRevisedPlanEmailForEmployee({
      employeeCode: targetCode,
      date,
      changes: [
        {
          label: `Added Task: "${taskName}"`,
          details: [
            `Priority: ${priority}`,
            `Hours Planned: ${formatDurationLabel(hoursRequired)}`,
          ],
        },
      ],
    });
  }

  auditPlannerTask(authUser, AUDIT_ACTIONS.CREATE, task, 'Manager Task Created', {
    newValues: { taskName, date, employeeCode: targetCode, status: 'Approved' },
  });

  return { task };
};

export const listProjects = async () => {
  const projects = await DailyPlannerProjectsModel.listProjects();
  return { projects };
};

/**
 * Factory: list project observations for a project the user (or a managed team member) works on.
 */
export const listProjectObservations = async (query, authUser, effectiveRole) => {
  const eligible = await resolveFactoryEligibilityForAuthUser(authUser);
  assertFactoryDailyPlannerEligible(
    eligible,
    'Project observations are only available for Factory employees.',
  );

  const projectName = String(query?.projectName || '').trim();
  const projectKey = DailyPlannerProjectObservationsModel.normalizeProjectKey(projectName);
  if (!projectKey) {
    const err = new Error('projectName is required');
    err.statusCode = 400;
    throw err;
  }

  const hasProject = (tasks) =>
    (tasks || []).some(
      (t) =>
        DailyPlannerProjectObservationsModel.normalizeProjectKey(t.projectName) === projectKey,
    );

  const selfCode = employeeCodeOf(authUser);
  let allowed = hasProject(
    await DailyPlannerTasksModel.listTasksForEmployeeMonth(selfCode, null, null),
  );

  if (!allowed) {
    const teamCodes = (await resolveTeamEmployeeCodes(selfCode, effectiveRole)).filter(
      (c) => c && c !== selfCode,
    );
    if (teamCodes.length > 0) {
      allowed = hasProject(await DailyPlannerTasksModel.listTasksForEmployees(teamCodes, null, null));
    }
  }

  if (!allowed) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  const observations = await DailyPlannerProjectObservationsModel.listByProjectKey(projectKey);
  return { projectName, projectKey, observations };
};

export const upsertProject = async (body, authUser) => {
  const project = await DailyPlannerProjectsModel.upsertProject(
    body?.projectName,
    employeeCodeOf(authUser),
  );
  return { project };
};

/**
 * Finalize employee plan for a date: require location minimum hours, stamp tasks, email officialEmail.
 */
export const finalizeEmployeePlan = async (body, authUser, effectiveRole) => {
  assertCanModerateTeamTask(effectiveRole);
  const now = new Date();
  if (!isManagerReviewWindow(now) && !canAccessAllRecords(effectiveRole)) {
    const err = new Error(MANAGER_REVIEW_WINDOW_MESSAGE);
    err.statusCode = 400;
    throw err;
  }

  const employeeCode = String(body.employeeCode || '').trim();
  const date = String(body.date || '').trim().slice(0, 10);
  if (!employeeCode || !date) {
    const err = new Error('employeeCode and date are required');
    err.statusCode = 400;
    throw err;
  }
  await assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, employeeCode);

  const location = await getEmployeeLocation(employeeCode);
  const { kind: leaveKind } = await resolveLeaveKindForEmployeeDate(employeeCode, date);
  if (leaveKind === 'full') {
    const err = new Error(FULL_DAY_LEAVE_TASK_BLOCKED_MESSAGE);
    err.statusCode = 400;
    err.code = 'FULL_DAY_LEAVE_BLOCKED';
    throw err;
  }
  const minHours = getMinPlannedHoursForLocation(location, leaveKind);

  const tasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
    employeeCode,
    date,
    date,
  );
  // Authoritative plan = countable tasks only (excludes Rescheduled originals and
  // handled Needs Revision parents that were replaced by a revised child).
  const activeTasks = (tasks || []).filter((t) => isTaskCountedTowardDailyMinimum(t));
  const alreadyFinalized = activeTasks.some((t) => Boolean(t.planFinalizedAt));
  const refinalize = body?.refinalize === true;
  if (alreadyFinalized && !refinalize) {
    const err = new Error('This plan has already been finalized');
    err.statusCode = 400;
    throw err;
  }
  const totalHours = sumPlannedHoursForDate(activeTasks, date);
  if (minHours > 0 && Math.round(totalHours * 100) / 100 < minHours) {
    const err = new Error(
      `Final plan must total at least ${formatDurationLabel(minHours)} (currently ${formatDurationLabel(totalHours)}).`,
    );
    err.statusCode = 400;
    throw err;
  }

  const pending = activeTasks.filter((t) => String(t.status || '').trim() === 'Pending');
  if (pending.length > 0) {
    const err = new Error(
      'All tasks must be reviewed (Approved or otherwise finalized) before finishing the plan.',
    );
    err.statusCode = 400;
    throw err;
  }

  const finalizedAt = now.toISOString();
  const finalizedBy = employeeCodeOf(authUser);
  const planChanges = refinalize ? collectFinalPlanChanges(activeTasks) : [];
  await Promise.all(
    activeTasks.map((task) =>
      DailyPlannerTasksModel.updateTask(task.plannerTaskId, {
        planFinalizedAt: finalizedAt,
        planFinalizedBy: finalizedBy,
        lastFinalizedSnapshot: finalizedFieldSnapshot(task),
      }),
    ),
  );

  const employee = await EmployeeMasterModel.getEmployeeByCode(employeeCode);
  const officialEmail = String(
    employee?.officialEmail || employee?.official_email || employee?.email || '',
  ).trim();
  const employeeName =
    String(employee?.fullName || '').trim() ||
    `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() ||
    activeTasks[0]?.employeeName ||
    employeeCode;

  const dateLabel = formatPlanDateLabel(date);

  const refreshed = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
    employeeCode,
    date,
    date,
  );
  const finalTasks = [...(refreshed || []).filter((t) => isTaskCountedTowardDailyMinimum(t))].sort(
    (a, b) => {
    const pa = PRIORITY_ORDER[a.currentPriority || a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.currentPriority || b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return String(a.taskName || '').localeCompare(String(b.taskName || ''), undefined, {
      sensitivity: 'base',
    });
  },
  );

  let emailResult = { ok: false, skipped: true, queued: false };
  if (officialEmail && (!refinalize || planChanges.length > 0)) {
    const mail = refinalize
      ? buildRevisedPlanEmail({
          employeeName,
          dateLabel,
          totalHours,
          tasks: finalTasks,
          changes: planChanges,
        })
      : buildFinalPlanEmail({
          employeeName,
          dateLabel,
          totalHours,
          tasks: finalTasks,
        });
    // Do not block the API response on SES/SMTP latency.
    emailResult = { ok: true, skipped: false, queued: true };
    void sendEmail({
      to: officialEmail,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }).catch((err) => {
      console.error('Final plan email failed:', err);
    });
  }

  void notifyUser(
    employeeCode,
    'Daily plan finalized',
    `Your plan for ${dateLabel} has been finalized by your manager.`,
    'INFO',
    { plannerDate: date, reminderType: 'plan_finalized' },
  );

  return {
    employeeCode,
    date,
    totalHours,
    tasks: finalTasks,
    emailSent: Boolean(emailResult?.ok),
    emailQueued: Boolean(emailResult?.queued),
    emailError: null,
  };
};

export const getNextWorkingDay = async (authUser) => {
  const code = employeeCodeOf(authUser);
  const location = await getEmployeeLocation(code);
  const nextWorkingDay = nextWorkingDayIstDateKey(new Date(), location);
  return { nextWorkingDay, todayIst: todayIstDateKey() };
};

const EMPLOYEE_COMPLETION_OUTCOME_STATUSES = new Set([
  'Awaiting Verification',
  'Completed',
  'Terminated',
  'Rescheduled',
  'Verified Complete',
  'Not Completed',
]);

function tasksForDayCompletion(tasks) {
  return (tasks || []).filter((t) => {
    const status = String(t.status || '').trim();
    // Exclude Needs Revision parents still awaiting employee revision action.
    return status !== 'Needs Revision' && status !== 'Rejected';
  });
}

/**
 * Employee submits the day's completion package after every task has an outcome.
 */
export const submitDayCompletion = async (body, authUser) => {
  const code = employeeCodeOf(authUser);
  const date = String(body?.date || '').trim().slice(0, 10);
  if (!code || !date) {
    const err = new Error('date is required');
    err.statusCode = 400;
    throw err;
  }

  const tasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(code, date, date);
  const dayTasks = tasksForDayCompletion(tasks);
  if (dayTasks.length === 0) {
    const err = new Error('No tasks found for this date');
    err.statusCode = 400;
    throw err;
  }

  if (dayTasks.every((t) => Boolean(t.dayCompletionSubmittedAt))) {
    return { tasks: dayTasks, alreadySubmitted: true };
  }

  const incomplete = dayTasks.filter(
    (t) => !EMPLOYEE_COMPLETION_OUTCOME_STATUSES.has(String(t.status || '').trim()),
  );
  if (incomplete.length > 0) {
    const err = new Error(
      'All tasks must have a completion outcome (Completed, Not Completed, or Rescheduled) before submitting.',
    );
    err.statusCode = 400;
    throw err;
  }

  const location = await getEmployeeLocation(code);
  const { kind: leaveKindForCompletion } = await resolveLeaveKindForEmployeeDate(code, date);
  const minRequired = getMinPlannedHoursForLocation(location, leaveKindForCompletion);
  const reportedHours = sumDayReportedHoursFromStartEnd(dayTasks);
  if (reportedHours < minRequired) {
    const err = new Error(buildMinimumHoursRequirementMessage(location, leaveKindForCompletion));
    err.statusCode = 400;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const updated = await Promise.all(
    dayTasks.map((task) =>
      DailyPlannerTasksModel.updateTask(task.plannerTaskId, {
        dayCompletionSubmittedAt: nowIso,
        dayCompletionSubmittedBy: code,
      }),
    ),
  );

  const managers = await listActiveManagersForEmployee(code);
  const name = employeeNameOf(authUser);
  for (const manager of managers) {
    if (manager.managerCode === code) continue;
    void notifyUser(
      manager.managerCode,
      'Pending Completion Approval',
      `${name} submitted completion results for ${date}.`,
      'WARNING',
      {
        plannerDate: date,
        employeeCode: code,
        reminderType: 'pending_completion_approval',
      },
    );
  }

  return { tasks: updated, alreadySubmitted: false };
};

/**
 * Manager marks a non-verify completion outcome as reviewed (Terminated / Rescheduled / etc.).
 */
export const reviewTaskCompletion = async (taskId, body, authUser, effectiveRole) => {
  assertCanModerateTeamTask(effectiveRole);
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  await assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, existing.employeeCode);
  if (!existing.dayCompletionSubmittedAt) {
    const err = new Error('Employee has not submitted completion for this day yet');
    err.statusCode = 400;
    throw err;
  }

  const status = String(existing.status || '').trim();
  if (status === 'Awaiting Verification' || status === 'Completed') {
    return verifyTaskCompletion(taskId, body, authUser, effectiveRole);
  }

  const nowIso = new Date().toISOString();
  const task = await DailyPlannerTasksModel.updateTask(taskId, {
    completionManagerReviewedAt: nowIso,
    completionManagerReviewedBy: employeeCodeOf(authUser),
    managerComments: String(body?.comments || existing.managerComments || '').trim(),
  });
  return { task };
};

/**
 * Manager submits the full day completion review after reviewing every task.
 */
export const submitDayCompletionReview = async (body, authUser, effectiveRole) => {
  assertCanModerateTeamTask(effectiveRole);
  const employeeCode = String(body?.employeeCode || '').trim();
  const date = String(body?.date || '').trim().slice(0, 10);
  if (!employeeCode || !date) {
    const err = new Error('employeeCode and date are required');
    err.statusCode = 400;
    throw err;
  }
  await assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, employeeCode);

  const tasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
    employeeCode,
    date,
    date,
  );
  const dayTasks = tasksForDayCompletion(tasks);
  if (dayTasks.length === 0) {
    const err = new Error('No tasks found for this date');
    err.statusCode = 400;
    throw err;
  }
  if (!dayTasks.every((t) => Boolean(t.dayCompletionSubmittedAt))) {
    const err = new Error('Employee has not submitted completion for this day yet');
    err.statusCode = 400;
    throw err;
  }

  const unreviewed = dayTasks.filter((t) => {
    if (t.completionManagerReviewedAt) return false;
    if (String(t.status || '').trim() === 'Verified Complete') return false;
    if (String(t.verificationStatus || '').trim() === 'VERIFIED_COMPLETED') return false;
    return true;
  });
  if (unreviewed.length > 0) {
    const err = new Error('All task completions must be reviewed before submitting');
    err.statusCode = 400;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const reviewer = employeeCodeOf(authUser);
  const updated = await Promise.all(
    dayTasks.map((task) =>
      DailyPlannerTasksModel.updateTask(task.plannerTaskId, {
        dayCompletionReviewSubmittedAt: nowIso,
        dayCompletionReviewSubmittedBy: reviewer,
      }),
    ),
  );

  void notifyUser(
    employeeCode,
    'Completion review finished',
    `Your manager finished reviewing completion results for ${date}.`,
    'INFO',
    { plannerDate: date, reminderType: 'completion_review_submitted' },
  );

  return { tasks: updated };
};

/**
 * Pending completion approvals for Team Daily Planner (manager/admin).
 * Uses existing GSI_EmployeeDate per team member — no Sales sync, no table scan of all tasks.
 * Groups by employee+date where dayCompletionSubmittedAt is set and dayCompletionReviewSubmittedAt is not.
 *
 * Employee scope matches Team Daily Planner employee filter exactly:
 * Active team mappings for the logged-in manager only (not all managers' teams).
 */
export const listPendingCompletionApprovals = async (authUser, effectiveRole) => {
  assertCanModerateTeamTask(effectiveRole);
  const managerCode = employeeCodeOf(authUser);
  const team = await DailyPlannerTeamMappingsModel.listEmployeesForManager(managerCode);
  const employeeCodes = [
    ...new Set(team.map((m) => String(m.employeeCode || '').trim()).filter(Boolean)),
  ];
  if (employeeCodes.length === 0) {
    return { approvals: [] };
  }

  const endDate = todayIstDateKey();
  const startDate = shiftIsoDateKey(endDate, -14);
  const tasks = await DailyPlannerTasksModel.listTasksForEmployees(
    employeeCodes,
    startDate,
    endDate,
  );

  const byKey = new Map();
  for (const task of tasks || []) {
    const code = String(task.employeeCode || '').trim();
    const date = String(task.date || '').trim().slice(0, 10);
    if (!code || !date) continue;
    const key = `${code}#${date}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(task);
  }

  const approvals = [];
  for (const [, dayTasksRaw] of byKey) {
    const dayTasks = tasksForDayCompletion(dayTasksRaw);
    if (dayTasks.length === 0) continue;
    if (!dayTasks.every((t) => Boolean(t.dayCompletionSubmittedAt))) continue;
    if (dayTasks.every((t) => Boolean(t.dayCompletionReviewSubmittedAt))) continue;

    const sorted = [...dayTasks].sort((a, b) =>
      String(a.taskName || '').localeCompare(String(b.taskName || '')),
    );
    const submittedAt =
      sorted
        .map((t) => t.dayCompletionSubmittedAt || '')
        .filter(Boolean)
        .sort()
        .at(-1) || null;

    approvals.push({
      employeeCode: String(sorted[0].employeeCode || '').trim(),
      employeeName: String(sorted[0].employeeName || '').trim(),
      date: String(sorted[0].date || '').trim().slice(0, 10),
      taskCount: sorted.length,
      submittedAt,
      status: 'Pending',
      tasks: sorted,
    });
  }

  approvals.sort((a, b) => {
    const byDate = String(b.date || '').localeCompare(String(a.date || ''));
    if (byDate !== 0) return byDate;
    return String(a.employeeName || '').localeCompare(String(b.employeeName || ''));
  });

  return { approvals };
};

function shiftIsoDateKey(dateKey, deltaDays) {
  const key = String(dateKey || '').trim().slice(0, 10);
  const parts = key.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return key;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + Number(deltaDays || 0)));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MAPPINGS_CACHE_TTL_MS = 60_000;
let mappingsCache = { at: 0, items: null };

async function listActiveManagersForEmployee(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) return [];
  let mappings = mappingsCache.items;
  if (!mappings || Date.now() - mappingsCache.at > MAPPINGS_CACHE_TTL_MS) {
    mappings = await DailyPlannerTeamMappingsModel.listAllMappings();
    mappingsCache = { at: Date.now(), items: mappings };
  }
  return mappings
    .filter((m) => m.status === 'Active' && String(m.employeeCode || '').trim() === code)
    .map((m) => ({
      managerCode: String(m.managerCode || '').trim(),
      managerName: String(m.managerName || '').trim(),
    }))
    .filter((m) => m.managerCode);
}

/** True when the employee has at least one active reporting manager (other than self). */
async function employeeHasReportingPerson(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) return false;
  const managers = await listActiveManagersForEmployee(code);
  return managers.some((m) => m.managerCode && m.managerCode !== code);
}

/**
 * Enrich tasks for My Daily Planner: flag tasks created by an active reporting person.
 * Does not invent creator names when createdByEmployeeCode is missing.
 */
async function annotateReportingPersonCreatedTasks(tasks, employeeCode) {
  const code = String(employeeCode || '').trim();
  const list = Array.isArray(tasks) ? tasks : [];
  if (!code || list.length === 0) return list;
  const managers = await listActiveManagersForEmployee(code);
  const managerByCode = new Map(
    managers
      .filter((m) => m.managerCode && m.managerCode !== code)
      .map((m) => [m.managerCode, m.managerName || '']),
  );
  if (managerByCode.size === 0) {
    return list.map((t) => ({ ...t, createdByReportingPerson: false }));
  }
  return list.map((t) => {
    const creator = String(t.createdByEmployeeCode || '').trim();
    const isReportingPerson =
      Boolean(creator) && creator !== code && managerByCode.has(creator);
    const mappedName = isReportingPerson ? managerByCode.get(creator) || '' : '';
    const storedName = String(t.createdByName || '').trim();
    return {
      ...t,
      createdByReportingPerson: isReportingPerson,
      // Prefer stored creator name; fall back to mapping name when available.
      createdByName: storedName || (isReportingPerson ? mappedName : ''),
    };
  });
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
  const location = await getEmployeeLocation(employeeCode);
  const minRequired = getMinPlannedHoursForLocation(location);
  const tasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
    employeeCode,
    targetDate,
    targetDate,
  );
  const plannedHours = sumPlannedHoursForDate(tasks, targetDate);
  if (plannedHours >= minRequired) return;

  const remaining = Math.round((minRequired - plannedHours) * 100) / 100;
  const dayLabel = formatPlannerDateLabel(targetDate);
  const name =
    String(employeeName || '').trim() ||
    String(tasks[0]?.employeeName || '').trim() ||
    employeeCode;

  void notifyUser(
    employeeCode,
    'Minimum daily hours required',
    buildMinimumHoursWarningMessage(plannedHours, dayLabel, location),
    'WARNING',
    {
      date: targetDate,
      plannedHours,
      remainingHours: remaining,
      minRequired,
      reminderType: 'minimum_hours',
    },
  );

  const managerMessage = buildMinimumHoursManagerWarningMessage(
    name,
    plannedHours,
    dayLabel,
    location,
  );
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
        minRequired,
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
        minRequired,
        reminderType: 'minimum_hours_admin',
      },
    },
    { excludeEmployeeCode: employeeCode },
  );
}

export const updateManualTask = async (taskId, rawBody, authUser) => {
  // When procedureSteps are sent, description + hoursRequired are synced from the steps
  // so Task Review (which prefers procedureSteps) shows the latest edited values.
  const { body, procedure } = applyProcedurePayload(rawBody || {});
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
  assertEmployeeCanEditManualTask(existing);

  const patch = {};
  if (body.taskName !== undefined) patch.taskName = String(body.taskName || '').trim();
  if (body.description !== undefined) patch.description = String(body.description || '').trim();
  if (body.priority !== undefined) {
    const p = normalizePriorityValue(body.priority, existing.currentPriority || 'Medium');
    patch.priority = p;
    patch.currentPriority = p;
    patch.originalPriority = existing.originalPriority || p;
    patch.planningCategory = planningCategoryFromPriority(p);
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
  if (procedure) {
    patch.procedureSteps = procedure.procedureSteps;
  }
  if (body.date !== undefined) patch.date = String(body.date || '').trim();
  if (patch.date && patch.date !== existing.date) {
    await assertDateAllowsPlannerTaskCreate(existing.employeeCode, patch.date);
  }

  if (
    body.projectName !== undefined ||
    body.isProjectBased !== undefined ||
    body.projectTaskId !== undefined
  ) {
    const binding = await resolveProjectBindingForOwner(existing.employeeCode, {
      isProjectBased:
        body.isProjectBased !== undefined ? body.isProjectBased : existing.isProjectBased,
      projectName:
        body.projectName !== undefined ? body.projectName : existing.projectName,
      projectTaskId:
        body.projectTaskId !== undefined ? body.projectTaskId : existing.projectTaskId,
      taskName: body.taskName !== undefined ? body.taskName : existing.taskName,
    });
    patch.isProjectBased = binding.isProjectBased;
    patch.projectTaskId = binding.projectTaskId || '';
    patch.projectName = binding.projectName
      ? await upsertCanonicalProjectName(binding.projectName, existing.employeeCode)
      : '';
  }

  const ownerEligible = await resolveEnhancedEligibilityForEmployeeCode(existing.employeeCode);
  Object.assign(
    patch,
    DailyPlannerEnhancedService.parseOptionalEnhancedFields(body, ownerEligible),
  );

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
    'projectName',
    'isProjectBased',
    'currentPriority',
    'hoursRequired',
    'procedureSteps',
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

  if (body.hoursRequired !== undefined || procedure) {
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

/**
 * Employee selects which tasks to keep vs reschedule after approved half-day leave.
 * Full-day leave continues to use automatic reschedule — this path is half-day only.
 */
export const applyHalfDayLeaveTaskSelection = async (body, authUser) => {
  const code = employeeCodeOf(authUser);
  const leaveRequestId = String(body?.leaveRequestId || '').trim();
  const targetDate = String(body?.targetDate || '').trim().slice(0, 10);
  const rescheduleTaskIds = [
    ...new Set(
      (Array.isArray(body?.rescheduleTaskIds) ? body.rescheduleTaskIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean),
    ),
  ];

  if (!leaveRequestId) {
    const err = new Error('leaveRequestId is required');
    err.statusCode = 400;
    throw err;
  }

  const approvedLeaves = await listApprovedLeaveForEmployee(code);
  const leaveRequest =
    approvedLeaves.find((r) => String(r.leaveRequestId || '').trim() === leaveRequestId) || null;
  if (!leaveRequest || !isHalfDayLeaveType(leaveRequest.leaveType)) {
    const err = new Error('Approved half-day leave request not found');
    err.statusCode = 404;
    throw err;
  }

  const leaveDate = String(leaveRequest.startDate || '').trim().slice(0, 10);
  const location = await getEmployeeLocation(code);
  const dayTasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
    code,
    leaveDate,
    leaveDate,
  );
  const openTasks = (dayTasks || []).filter((t) => isOpenPlannerTaskForLeaveReschedule(t));
  const openById = new Map(openTasks.map((t) => [String(t.plannerTaskId || '').trim(), t]));

  for (const id of rescheduleTaskIds) {
    if (!openById.has(id)) {
      const err = new Error('One or more selected tasks are not eligible to reschedule');
      err.statusCode = 400;
      throw err;
    }
  }

  const moved = [];
  const kept = [];
  const nowIso = new Date().toISOString();
  const actorName = employeeNameOf(authUser) || code;

  if (rescheduleTaskIds.length > 0) {
    if (!targetDate) {
      const err = new Error('Select a destination date for the tasks to reschedule');
      err.statusCode = 400;
      throw err;
    }
    if (targetDate === leaveDate) {
      const err = new Error('Destination date must be different from the half-day leave date');
      err.statusCode = 400;
      throw err;
    }
    await PlanningRecognitionService.validateRescheduleTargetDate(targetDate, new Date(), location);
    await assertEmployeeCodeActiveOnDate(code, targetDate);
    await assertDateAllowsPlannerTaskCreate(code, targetDate, approvedLeaves);

    // Destination must satisfy its own minimum planned hours after the move.
    const destTasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
      code,
      targetDate,
      targetDate,
    );
    const destHoursBefore = sumPlannedHoursForDate(
      (destTasks || []).filter((t) => isTaskCountedTowardDailyMinimum(t)),
      targetDate,
    );
    const movingHours = rescheduleTaskIds.reduce((sum, id) => {
      const t = openById.get(id);
      const h = Number(t?.hoursRequired);
      return sum + (Number.isFinite(h) && h > 0 ? h : 0);
    }, 0);
    const { kind: destLeaveKind } = classifyApprovedLeaveForDate(approvedLeaves, targetDate);
    const destMin = getMinPlannedHoursForLocation(location, destLeaveKind);
    const destHoursAfter = Math.round((destHoursBefore + movingHours) * 100) / 100;
    // If the destination already has countable planned work, the combined total must meet
    // that date's minimum (do not leave an existing plan under-min via reschedule).
    if (destMin > 0 && destHoursBefore > 0 && destHoursAfter < destMin) {
      const err = new Error(
        `Destination date must total at least ${formatDurationLabel(destMin)} after rescheduling (would be ${formatDurationLabel(destHoursAfter)}).`,
      );
      err.statusCode = 400;
      throw err;
    }

    for (const id of rescheduleTaskIds) {
      const existing = openById.get(id);
      const reason = `Rescheduled due to approved half-day leave (${leaveDate})`;
      const closed = await DailyPlannerTasksModel.updateTask(existing.plannerTaskId, {
        status: 'Rescheduled',
        reason,
        rescheduledFromDate: existing.date,
        rescheduledToDate: targetDate,
        rescheduledBy: code,
        rescheduledByName: actorName,
        rescheduledAt: nowIso,
        leaveAutoRescheduleLeaveRequestId: leaveRequestId,
        leaveHalfDaySelectionAckLeaveRequestId: leaveRequestId,
        completionScore: 0,
        finalScore: 0,
      });
      const child = await DailyPlannerTasksModel.createTask({
        employeeCode: existing.employeeCode,
        employeeName: existing.employeeName,
        date: targetDate,
        taskName: existing.taskName,
        description: existing.description,
        procedureSteps: Array.isArray(existing.procedureSteps) ? existing.procedureSteps : [],
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
        status: existing.status === 'Needs Revision' ? 'Needs Revision' : existing.status || 'Pending',
        approved: existing.approved,
        approvalStatus: existing.approvalStatus,
        approvedBy: existing.approvedBy,
        approvedByName: existing.approvedByName,
        approvedAt: existing.approvedAt,
        approvedDate: existing.approvedDate,
        managerComments: existing.managerComments,
        managerInstructions: existing.managerInstructions,
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
        planningTimestamp: nowIso,
        planningScore: Number(existing.planningScore) || 0,
        completionScore: 0,
        finalScore: Number(existing.planningScore) || 0,
        createdByRole: String(existing.createdByRole || '').trim(),
        createdByEmployeeCode: String(existing.createdByEmployeeCode || '').trim(),
        createdByName: String(existing.createdByName || '').trim(),
        isProjectBased: Boolean(existing.isProjectBased),
        projectName: String(existing.projectName || '').trim(),
        projectTaskId: String(existing.projectTaskId || '').trim(),
        leaveAutoRescheduleLeaveRequestId: leaveRequestId,
      });
      moved.push({ original: closed, rescheduled: child });
    }
  }

  // Acknowledge remaining open tasks so the prompt does not reappear.
  for (const existing of openTasks) {
    const id = String(existing.plannerTaskId || '').trim();
    if (rescheduleTaskIds.includes(id)) continue;
    if (String(existing.leaveHalfDaySelectionAckLeaveRequestId || '').trim() === leaveRequestId) {
      kept.push(existing);
      continue;
    }
    const updated = await DailyPlannerTasksModel.updateTask(id, {
      leaveHalfDaySelectionAckLeaveRequestId: leaveRequestId,
    });
    kept.push(updated);
  }

  await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
    employeeCode: code,
    workingDayDateKey: leaveDate,
  });
  if (targetDate) {
    await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
      employeeCode: code,
      workingDayDateKey: targetDate,
    });
  }

  return {
    leaveRequestId,
    leaveDate,
    targetDate: targetDate || null,
    moved,
    kept,
  };
};

/**
 * Manager/Admin updates a team employee's task (allowed even after plan finalize).
 * When the plan was finalized, sends a revised plan email describing the changes.
 */
export const updateTaskForEmployee = async (taskId, rawBody, authUser, effectiveRole) => {
  assertCanModerateTeamTask(effectiveRole);
  // When procedureSteps are sent, description + hoursRequired are synced from the steps.
  const { body, procedure } = applyProcedurePayload(rawBody || {});
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  await assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, existing.employeeCode);
  if (existing.taskType === 'Sales Visit' || existing.source === 'SALES_FORECASTING') {
    const err = new Error('Sales Visit tasks cannot be edited');
    err.statusCode = 400;
    throw err;
  }
  assertTaskNotPermanentlyClosed(existing);

  const wasFinalized = Boolean(existing.planFinalizedAt);
  const allowFinalizedEdit = body?.allowFinalizedEdit === true;
  if (wasFinalized && !allowFinalizedEdit) {
    const err = new Error(
      'This plan is finalized. Priority, hours, and other plan fields cannot be edited until Edit is used.',
    );
    err.statusCode = 400;
    throw err;
  }

  const patch = {};
  const changes = [];

  if (body.taskName !== undefined) {
    const next = String(body.taskName || '').trim();
    if (next && next !== existing.taskName) {
      patch.taskName = next;
      changes.push(`Task name: "${existing.taskName}" → "${next}"`);
    }
  }
  if (body.description !== undefined) {
    const next = String(body.description || '').trim();
    if (next !== String(existing.description || '').trim()) {
      patch.description = next;
      changes.push(`Description updated for "${existing.taskName}"`);
    }
  }
  if (body.priority !== undefined) {
    const p = normalizePriorityValue(
      body.priority,
      existing.currentPriority || existing.priority || 'Medium',
    );
    const prev = existing.currentPriority || existing.priority || 'Medium';
    if (p !== prev) {
      patch.priority = p;
      patch.currentPriority = p;
      patch.originalPriority = existing.originalPriority || prev;
      patch.planningCategory = planningCategoryFromPriority(p);
      changes.push(`Priority for "${existing.taskName}": ${prev} → ${p}`);
    }
  }
  if (body.hoursRequired !== undefined) {
    const nextHours = assertValidHoursRequired(body.hoursRequired, { required: true });
    const prevHours = Number(existing.hoursRequired);
    if (!Number.isFinite(prevHours) || prevHours !== nextHours) {
      patch.hoursRequired = nextHours;
      if (
        existing.originalHoursRequired === undefined ||
        existing.originalHoursRequired === null ||
        existing.originalHoursRequired === ''
      ) {
        patch.originalHoursRequired = nextHours;
      }
      changes.push(
        `Hours for "${existing.taskName}": ${formatDurationLabel(prevHours || 0)} → ${formatDurationLabel(nextHours)}`,
      );
    }
  }
  if (procedure) {
    patch.procedureSteps = procedure.procedureSteps;
    if (
      JSON.stringify(procedure.procedureSteps) !== JSON.stringify(existing.procedureSteps || [])
    ) {
      changes.push(`Step procedure updated for "${existing.taskName}"`);
    }
  }
  if (body.managerInstructions !== undefined || body.instructions !== undefined) {
    const next = String(body.managerInstructions ?? body.instructions ?? '').trim();
    if (next !== String(existing.managerInstructions || '').trim()) {
      patch.managerInstructions = next;
      changes.push(`Instruction updated for "${existing.taskName}"`);
    }
  }
  if (body.managerComments !== undefined || body.comments !== undefined) {
    const next = String(body.managerComments ?? body.comments ?? '').trim();
    if (next !== String(existing.managerComments || '').trim()) {
      patch.managerComments = next;
      changes.push(`Comment updated for "${existing.taskName}"`);
    }
  }

  const closedStatuses = new Set([
    'Completed',
    'Verified Complete',
    'Awaiting Verification',
    'Terminated',
    'Rescheduled',
    'Not Completed',
  ]);
  if (
    body?.preserveStatus !== true &&
    !closedStatuses.has(String(existing.status || '').trim()) &&
    existing.status !== 'Approved'
  ) {
    const reviewerCode = employeeCodeOf(authUser);
    const nowIso = new Date().toISOString();
    patch.status = 'Approved';
    patch.approved = true;
    patch.approvalStatus = 'APPROVED';
    patch.approvedBy = reviewerCode;
    patch.approvedByName = employeeNameOf(authUser);
    patch.approvedAt = nowIso;
    patch.approvedDate = nowIso;
  }

  if (wasFinalized && changes.length > 0 && !readFinalizedSnapshot(existing)) {
    patch.lastFinalizedSnapshot = finalizedFieldSnapshot(existing);
  }

  if (Object.keys(patch).length === 0) {
    return { task: existing };
  }

  const task = await DailyPlannerTasksModel.updateTask(taskId, patch);

  if (
    (existing.planningCategory === PLANNING_CATEGORY_REGULAR ||
      patch.planningCategory === PLANNING_CATEGORY_REGULAR) &&
    existing.source === 'MANUAL'
  ) {
    await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
      employeeCode: existing.employeeCode,
      workingDayDateKey: existing.date,
    });
  } else if (patch.planningCategory === PLANNING_CATEGORY_URGENT) {
    await PlanningRecognitionService.recordPlanningImpactForUrgentTask({
      employeeCode: existing.employeeCode,
      reference: new Date(),
    });
  }

  if (wasFinalized && changes.length > 0 && body?.skipRevisedEmail !== true && !allowFinalizedEdit) {
    void sendRevisedPlanEmailForEmployee({
      employeeCode: existing.employeeCode,
      date: existing.date,
      changes,
    });
  }

  const fieldDiff = AuditTrailService.diffChangedFields(existing, task, [
    'taskName',
    'description',
    'priority',
    'currentPriority',
    'hoursRequired',
  ]);
  auditPlannerTask(authUser, AUDIT_ACTIONS.UPDATE, task, 'Manager Task Edited', {
    oldValues: fieldDiff.oldValues,
    newValues: fieldDiff.newValues,
  });

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

function parseYesNoFlag(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const v = String(value).trim().toLowerCase();
  if (v === 'true' || v === 'yes' || v === '1') return true;
  if (v === 'false' || v === 'no' || v === '0') return false;
  return null;
}

export const markTaskCompleted = async (taskId, body, authUser, effectiveRole, options = {}) => {
  let workDone = String(body?.workDone || body?.reason || '').trim();
  const stepFlow = Array.isArray(body?.procedureSteps) && body.procedureSteps.length > 0;
  // Step-based completion can derive Work Done from the completed step descriptions.
  if (!workDone && !stepFlow) {
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

  // Idempotent: already verified-complete — return current task (preserve completion data).
  if (
    String(existing.status || '').trim() === 'Verified Complete' ||
    String(existing.verificationStatus || '').trim() === 'VERIFIED_COMPLETED'
  ) {
    return {
      task: existing,
      cancelledRescheduledTasks: [],
      completionDurationHours: existing.completionDurationHours ?? null,
      dayCompletedHours: null,
    };
  }

  const factoryOwner = await resolveFactoryEligibilityForEmployeeCode(existing.employeeCode);
  const startTimeRaw = body?.startTime ?? body?.completionStartTime;
  const endTimeRaw = body?.endTime ?? body?.completionEndTime;

  let completionDurationHours;
  let completionStartTime;
  let completionEndTime;
  let timeSlotsPatch = {};
  let stepPatch = null;
  let hasRescheduledSteps = false;
  if (stepFlow) {
    // Step-based reporting (Factory + Office): per-step Start/End is the primary path.
    const { steps, incompleteStepIds } = evaluateStepTimings(
      mergeStepsForCompletion(existing, body.procedureSteps),
    );
    const activeSteps = steps.filter((s) => s.status !== 'rescheduled');
    if (activeSteps.length === 0) {
      const err = new Error('At least one step is required to mark the task completed');
      err.statusCode = 400;
      throw err;
    }
    if (incompleteStepIds.length > 0) {
      const err = new Error(
        'Some steps do not have complete time entries. Enter Start and End Time for every step, or reschedule the incomplete steps.',
      );
      err.statusCode = 400;
      err.incompleteStepIds = incompleteStepIds;
      throw err;
    }
    const totalActualMinutes = sumActualMinutes(steps);
    const bounds = stepTimeBounds(steps);
    completionDurationHours = decimalHoursFromMinutes(totalActualMinutes);
    completionStartTime = bounds.startTime;
    completionEndTime = bounds.endTime;
    timeSlotsPatch = { timeSlots: [] };
    hasRescheduledSteps = steps.some((s) => s.status === 'rescheduled');
    if (!workDone) {
      // Prefer per-step Work Done reports; fall back to planned descriptions.
      workDone = workDoneFromSteps(activeSteps);
    }
    stepPatch = {
      procedureSteps: steps,
      // Duration-weighted; all steps completed => 100% even when actual < planned.
      progressDone: progressFromProcedureSteps(steps),
    };
  } else if (factoryOwner) {
    // Factory: up to 3 time slots (or legacy start/end as a single slot).
    const normalized = normalizeCompletionTimeSlots(body?.timeSlots, {
      startTime: startTimeRaw,
      endTime: endTimeRaw,
    });
    completionDurationHours = normalized.completionDurationHours;
    completionStartTime = normalized.completionStartTime;
    completionEndTime = normalized.completionEndTime;
    timeSlotsPatch = { timeSlots: normalized.timeSlots };
  } else {
    // Office: unchanged — Start/End only.
    completionDurationHours = durationHoursFromStartEnd(startTimeRaw, endTimeRaw);
    completionStartTime = normalizeClockTime(startTimeRaw);
    completionEndTime = normalizeClockTime(endTimeRaw);
  }

  assertTaskNotPermanentlyClosed(existing);
  assertTaskNotAlreadyRescheduled(existing);

  // Factory/Office v2 observation capture (task-owner eligibility).
  let observationPatch = {};
  let observationToSync = null;
  if (factoryOwner) {
    const hasObservation = parseYesNoFlag(body?.hasObservation);
    const observationProvided =
      body?.observationText !== undefined || body?.observation !== undefined;
    const observationTextRaw = String(body?.observationText ?? body?.observation ?? '').trim();
    if (hasObservation === true) {
      if (!observationTextRaw) {
        const err = new Error('Observation is required when Observation is Yes');
        err.statusCode = 400;
        throw err;
      }
      const nowIso = new Date().toISOString();
      const observationId =
        String(body?.observationId || '').trim() ||
        String(existing.observationId || '').trim() ||
        uuidv4();
      const sameObservation = String(existing.observationId || '').trim() === observationId;
      observationPatch = {
        hasObservation: true,
        observationText: observationTextRaw,
        observationId,
        observationSubmittedBy: employeeCodeOf(authUser),
        observationSubmittedByName: employeeNameOf(authUser),
        observationSubmittedAt:
          (sameObservation && existing.observationSubmittedAt) || nowIso,
      };
      observationToSync = { observationId, observationText: observationTextRaw };
    } else if (hasObservation === false) {
      observationPatch = { hasObservation: false };
      // Only clear text when the client explicitly sent the field; never wipe history on omit.
      if (observationProvided) observationPatch.observationText = '';
    }
  }

  const planningScore = Number(existing.planningScore) || 0;
  // Keep existing scoring: employee completion still awards Completed contribution.
  const completionScore = computeTaskCompletionContribution('Completed');
  const ownerEligible = await resolveEnhancedEligibilityForEmployeeCode(existing.employeeCode);
  const enhancedFields = DailyPlannerEnhancedService.parseOptionalEnhancedFields(
    body || {},
    ownerEligible,
  );

  // Super Admin with no reporting person: self-approve completion (no manager exists).
  // User/Admin and anyone with a reporting person keep normal Awaiting Verification flow.
  const actorCode = employeeCodeOf(authUser);
  const actorName = employeeNameOf(authUser);
  const nowIso = new Date().toISOString();
  const selfApproveCompletion =
    isSuperAdmin(effectiveRole) && !(await employeeHasReportingPerson(actorCode));

  const completionStatusPatch = selfApproveCompletion
    ? {
        status: 'Verified Complete',
        verificationStatus: 'VERIFIED_COMPLETED',
        verifiedBy: actorCode,
        verifiedByName: actorName,
        verifiedAt: nowIso,
        completionManagerReviewedAt: nowIso,
        completionManagerReviewedBy: actorCode,
        dayCompletionSubmittedAt: existing.dayCompletionSubmittedAt || nowIso,
        dayCompletionSubmittedBy: existing.dayCompletionSubmittedBy || actorCode,
        dayCompletionReviewSubmittedAt: existing.dayCompletionReviewSubmittedAt || nowIso,
        dayCompletionReviewSubmittedBy: existing.dayCompletionReviewSubmittedBy || actorCode,
      }
    : {
        status: 'Awaiting Verification',
        verificationStatus: 'AWAITING_VERIFICATION',
      };

  const task = await DailyPlannerTasksModel.updateTask(taskId, {
    reason: workDone,
    completionStartTime,
    completionEndTime,
    completionDurationHours,
    ...timeSlotsPatch,
    completionScore,
    finalScore: planningScore + completionScore,
    ...enhancedFields,
    // Step-derived progress overrides any manually supplied Progress Done (%).
    ...(stepPatch
      ? {
          procedureSteps: stepPatch.procedureSteps,
          ...(ownerEligible ? { progressDone: stepPatch.progressDone } : {}),
        }
      : {}),
    ...observationPatch,
    ...completionStatusPatch,
  });

  if (observationToSync) {
    const projectName = String(existing.projectName || body?.projectName || '').trim();
    if (projectName) {
      // Idempotent by (projectKey, observationId); retries reuse the persisted observationId.
      await DailyPlannerProjectObservationsModel.putObservation({
        projectName,
        observationId: observationToSync.observationId,
        observationText: observationToSync.observationText,
        employeeCode: existing.employeeCode,
        employeeName: employeeNameOf(authUser) || existing.employeeName,
        plannerTaskId: existing.plannerTaskId,
        submittedAt: observationPatch.observationSubmittedAt,
      });
    } else {
      console.warn(
        'Observation saved on task but not synced to project observations (no projectName):',
        existing.plannerTaskId,
      );
    }
  }

  // Incomplete → Reschedule creates a child via parentTaskId. Completing the original
  // must invalidate that linked rescheduled task so it does not remain active.
  // Step-level reschedules (reschedule-steps) intentionally keep their child task: it holds the
  // unfinished steps and must survive completion of the original.
  const cancelledRescheduledTasks = hasRescheduledSteps
    ? []
    : await cancelLinkedRescheduledChildren(existing);

  if (
    !options.skipPlanningRecompute &&
    existing.planningCategory === PLANNING_CATEGORY_REGULAR &&
    existing.source === 'MANUAL'
  ) {
    await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
      employeeCode: existing.employeeCode,
      workingDayDateKey: existing.date,
    });
  }
  if (selfApproveCompletion) {
    auditPlannerTask(authUser, AUDIT_ACTIONS.VERIFY, task, 'Completion Self-Verified (Super Admin)', {
      oldValues: { status: existing.status },
      newValues: {
        status: task.status,
        verificationStatus: task.verificationStatus,
        reason: workDone,
        verifiedBy: actorCode,
      },
    });
  } else {
    auditPlannerTask(authUser, AUDIT_ACTIONS.STATUS_CHANGE, task, 'Task Closed', {
      oldValues: { status: existing.status },
      newValues: { status: task.status, reason: workDone },
    });
  }

  let dayCompletedHours = null;
  if (!options.skipDayCompletedHours) {
    const dayTasks = await DailyPlannerTasksModel.listTasksForEmployeeMonth(
      existing.employeeCode,
      existing.date,
      existing.date,
    );
    dayCompletedHours = sumDayCompletedHours(
      (dayTasks || []).map((t) =>
        t.plannerTaskId === task.plannerTaskId ? { ...t, ...task } : t,
      ),
    );
  }

  return {
    task,
    cancelledRescheduledTasks,
    completionDurationHours,
    dayCompletedHours,
  };
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
  assertEmployeeCanDeleteOrRescheduleManualTask(existing);
  assertTaskNotAlreadyRescheduled(existing);

  const now = new Date();
  const code = employeeCodeOf(authUser);
  const name = employeeNameOf(authUser);
  const location = await getEmployeeLocation(code);

  if (action === 'terminate') {
    const planningScore = Number(existing.planningScore) || 0;
    const completionScore = computeTaskCompletionContribution('Terminated');
    const ownerEligible = await resolveEnhancedEligibilityForEmployeeCode(existing.employeeCode);
    const enhancedFields = DailyPlannerEnhancedService.parseOptionalEnhancedFields(
      body || {},
      ownerEligible,
    );
    const task = await DailyPlannerTasksModel.updateTask(taskId, {
      status: 'Terminated',
      reason,
      terminatedAt: now.toISOString(),
      terminatedBy: code,
      terminatedByName: name,
      completionScore,
      finalScore: planningScore + completionScore,
      ...enhancedFields,
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
    await assertEmployeeCodeActiveOnDate(existing.employeeCode, newDate);
    await assertDateAllowsPlannerTaskCreate(existing.employeeCode, newDate);

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

    const preservedSteps = normalizeProcedureSteps(existing.procedureSteps).map((s) => ({
      ...s,
      startTime: null,
      endTime: null,
      actualMinutes: null,
      workDone: '',
      status: 'pending',
      completed: false,
      rescheduledToDate: null,
    }));
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
      // Preserve original creator through reschedule (do not replace with editor).
      createdByRole: String(existing.createdByRole || '').trim(),
      createdByEmployeeCode: String(existing.createdByEmployeeCode || '').trim(),
      createdByName: String(existing.createdByName || '').trim(),
      isProjectBased: Boolean(existing.isProjectBased),
      projectName: String(existing.projectName || '').trim(),
      projectTaskId: String(existing.projectTaskId || '').trim(),
      procedureSteps: preservedSteps,
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

/**
 * Step-level reschedule (Mark Completed → "No, reschedule missing steps").
 * - Steps without a full Start + End time are marked `rescheduled` on the original task.
 * - A NEW task on `newDate` is created holding ONLY those unfinished steps.
 * - Completed (timed) steps stay on the original; hoursRequired / progressDone are recalculated.
 * The original task is NOT closed here — the client then completes it via the normal
 * complete API so Awaiting Verification / approval is unchanged.
 */
export const rescheduleIncompleteSteps = async (taskId, body, authUser) => {
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing || existing.employeeCode !== employeeCodeOf(authUser)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  assertTaskNotPermanentlyClosed(existing);
  assertTaskNotAlreadyRescheduled(existing);
  if (String(existing.source || '').trim() === PLANNING_SOURCE_EXTRA) {
    const err = new Error('Extra tasks cannot be partially rescheduled');
    err.statusCode = 400;
    throw err;
  }

  const { steps, incompleteStepIds } = evaluateStepTimings(
    mergeStepsForCompletion(existing, body?.procedureSteps),
  );
  const incompleteSet = new Set(incompleteStepIds);
  const incompleteSteps = steps.filter((s) => incompleteSet.has(s.stepId));
  const completedSteps = steps.filter((s) => s.status === 'completed');
  if (incompleteSteps.length === 0) {
    const err = new Error('There are no incomplete steps to reschedule');
    err.statusCode = 400;
    throw err;
  }
  if (completedSteps.length === 0) {
    const err = new Error(
      'Enter Start and End Time for at least one step, or use Not Completed → Next Date to reschedule the whole task.',
    );
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const code = employeeCodeOf(authUser);
  const name = employeeNameOf(authUser);
  const location = await getEmployeeLocation(code);
  const newDate = await PlanningRecognitionService.validateRescheduleTargetDate(
    body?.newDate,
    now,
    location,
  );
  await assertDateAllowsPlannerTaskCreate(existing.employeeCode, newDate);
  if (newDate === existing.date) {
    const err = new Error('New date must be different from the current task date');
    err.statusCode = 400;
    throw err;
  }
  await assertEmployeeCodeActiveOnDate(existing.employeeCode, newDate);

  const reason =
    String(body?.reason || '').trim() ||
    `Incomplete steps rescheduled to ${newDate}`;
  const rescheduledAt = now.toISOString();

  const originalSteps = steps.map((s) =>
    incompleteSet.has(s.stepId)
      ? {
          ...s,
          status: 'rescheduled',
          completed: false,
          rescheduledToDate: newDate,
        }
      : s,
  );
  const remainingSteps = originalSteps.filter((s) => s.status !== 'rescheduled');
  const remainingPlannedMinutes = sumPlannedMinutes(remainingSteps);

  const childSteps = incompleteSteps.map((s) => ({
    stepId: s.stepId,
    description: s.description,
    plannedMinutes: s.plannedMinutes,
    startTime: null,
    endTime: null,
    actualMinutes: null,
    status: 'pending',
    completed: false,
    rescheduledToDate: null,
    managerComment: '',
  }));
  const childHours = decimalHoursFromMinutes(sumPlannedMinutes(childSteps));

  const rescheduledTask = await DailyPlannerTasksModel.createTask({
    employeeCode: existing.employeeCode,
    employeeName: existing.employeeName,
    date: newDate,
    taskName: existing.taskName,
    description: descriptionFromSteps(childSteps),
    procedureSteps: childSteps,
    priority: existing.currentPriority || existing.priority,
    originalPriority: existing.originalPriority || existing.priority,
    currentPriority: existing.currentPriority || existing.priority,
    priorityEdited: existing.priorityEdited,
    hoursRequired: childHours,
    originalHoursRequired: childHours,
    hoursRequiredEdited: false,
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
    createdByRole: String(existing.createdByRole || '').trim(),
    createdByEmployeeCode: String(existing.createdByEmployeeCode || '').trim(),
    createdByName: String(existing.createdByName || '').trim(),
    isProjectBased: Boolean(existing.isProjectBased),
    projectName: String(existing.projectName || '').trim(),
    projectTaskId: String(existing.projectTaskId || '').trim(),
  });

  const ownerEligible = await resolveEnhancedEligibilityForEmployeeCode(existing.employeeCode);
  const task = await DailyPlannerTasksModel.updateTask(taskId, {
    procedureSteps: originalSteps,
    description: descriptionFromSteps(remainingSteps),
    hoursRequired: decimalHoursFromMinutes(remainingPlannedMinutes),
    ...(ownerEligible ? { progressDone: progressFromProcedureSteps(originalSteps) } : {}),
  });

  auditPlannerTask(authUser, AUDIT_ACTIONS.STATUS_CHANGE, task, 'Incomplete Steps Rescheduled', {
    oldValues: { hoursRequired: existing.hoursRequired },
    newValues: {
      hoursRequired: task.hoursRequired,
      rescheduledToDate: newDate,
      rescheduledStepIds: incompleteSteps.map((s) => s.stepId),
      rescheduledTaskId: rescheduledTask.plannerTaskId,
      reason,
      rescheduledBy: name,
    },
  });

  return { task, rescheduledTask };
};

/**
 * Factory batch completion: sequential markTaskCompleted / markTaskNotCompleted.
 * Does NOT submit the day (client still calls submit-completion). Partial failures are reported.
 */
export const batchCompleteTasks = async (body, authUser, effectiveRole) => {
  const eligible = await resolveFactoryEligibilityForAuthUser(authUser);
  assertFactoryDailyPlannerEligible(
    eligible,
    'Batch completion is only available for Factory employees.',
  );

  const date = String(body?.date || '').trim();
  const completions = Array.isArray(body?.completions) ? body.completions : [];
  const notCompleted = Array.isArray(body?.notCompleted) ? body.notCompleted : [];
  if (completions.length === 0 && notCompleted.length === 0) {
    const err = new Error('At least one completion or not-completed entry is required');
    err.statusCode = 400;
    throw err;
  }

  const succeeded = [];
  const failed = [];
  const needsPlanningRecompute = new Set();

  const assertTaskOnDate = async (taskId) => {
    if (!date) return null;
    const task = await DailyPlannerTasksModel.getTaskById(taskId);
    if (task && task.date !== date) {
      const err = new Error(`Task is not scheduled for ${date}`);
      err.statusCode = 400;
      throw err;
    }
    return task;
  };

  for (const entry of completions) {
    const taskId = String(entry?.taskId || '').trim();
    try {
      if (!taskId) {
        const err = new Error('taskId is required');
        err.statusCode = 400;
        throw err;
      }
      const preloaded = await assertTaskOnDate(taskId);
      if (
        preloaded &&
        String(preloaded.planningCategory || '').trim() === PLANNING_CATEGORY_REGULAR &&
        String(preloaded.source || '').trim() === 'MANUAL'
      ) {
        needsPlanningRecompute.add(
          `${String(preloaded.employeeCode || '').trim()}|${String(preloaded.date || '').trim()}`,
        );
      }
      const { taskId: _omit, ...payload } = entry;
      // Defer score recompute + day-hours to once per batch (not per task).
      const result = await markTaskCompleted(taskId, payload, authUser, effectiveRole, {
        skipPlanningRecompute: true,
        skipDayCompletedHours: true,
      });
      succeeded.push({
        taskId,
        type: 'completed',
        task: result.task,
        cancelledRescheduledTasks: result.cancelledRescheduledTasks || [],
      });
    } catch (error) {
      console.error('Daily planner batchComplete completion error:', taskId, error?.message || error);
      failed.push({
        taskId,
        message: String(error?.message || 'Failed to complete task'),
        statusCode: error?.statusCode || 500,
      });
    }
  }

  for (const entry of notCompleted) {
    const taskId = String(entry?.taskId || '').trim();
    try {
      if (!taskId) {
        const err = new Error('taskId is required');
        err.statusCode = 400;
        throw err;
      }
      await assertTaskOnDate(taskId);
      const rawAction = String(entry?.action || 'terminate').trim().toLowerCase();
      const action = ['reschedule', 'next_date', 'nextdate'].includes(rawAction)
        ? 'next_date'
        : rawAction;
      const result = await markTaskNotCompleted(
        taskId,
        { reason: entry?.reason, action, newDate: entry?.newDate },
        authUser,
      );
      succeeded.push({
        taskId,
        type: 'notCompleted',
        task: result.task,
        rescheduledTask: result.rescheduledTask || null,
      });
    } catch (error) {
      console.error('Daily planner batchComplete notCompleted error:', taskId, error?.message || error);
      failed.push({
        taskId,
        message: String(error?.message || 'Failed to update task'),
        statusCode: error?.statusCode || 500,
      });
    }
  }

  for (const key of needsPlanningRecompute) {
    const [employeeCode, workingDayDateKey] = key.split('|');
    if (!employeeCode || !workingDayDateKey) continue;
    try {
      await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
        employeeCode,
        workingDayDateKey,
      });
    } catch (error) {
      console.error(
        'Daily planner batchComplete planning recompute error:',
        key,
        error?.message || error,
      );
    }
  }

  return { succeeded, failed };
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
  if (String(existing.source || '').trim() === PLANNING_SOURCE_EXTRA) {
    const err = new Error('Extra tasks cannot be deleted');
    err.statusCode = 400;
    throw err;
  }
  assertEmployeeCanDeleteOrRescheduleManualTask(existing);
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

  // One shared Sales events scan (cached), then sync only employees who need it.
  await SalesPlannerEventsModel.warmSalesEventsCache();
  const [ownersWithEvents, existingTasks] = await Promise.all([
    SalesPlannerEventsModel.listOwnerCodesWithEventsInRange(startDate, endDate),
    DailyPlannerTasksModel.listTasksForEmployees(employeeCodes, startDate, endDate),
  ]);
  const tasksByEmployee = new Map();
  for (const task of existingTasks || []) {
    const code = String(task.employeeCode || '').trim();
    if (!code) continue;
    if (!tasksByEmployee.has(code)) tasksByEmployee.set(code, []);
    tasksByEmployee.get(code).push(task);
  }

  const syncedBatches = await Promise.all(
    employeeCodes.map((code) => {
      const mine = tasksByEmployee.get(code) || [];
      const hasImportedSales = mine.some(
        (t) =>
          String(t.source || '').trim() === 'SALES_FORECASTING' &&
          String(t.salesPlannerId || '').trim(),
      );
      const knownNoSalesEvents = !ownersWithEvents.has(code);
      if (!hasImportedSales && knownNoSalesEvents) {
        return Promise.resolve(mine);
      }
      return syncSalesPlannerImports(code, '', startDate, endDate, year, month, {
        existingTasks: mine,
        knownNoSalesEvents,
      });
    }),
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

const PAST_DATA_STATUSES = new Set(['Completed', 'Verified Complete']);
const PAST_DATA_MAX_RANGE_DAYS = 366;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Team Task Review → Past Data: completed tasks for one project in a date range.
 * Authorization mirrors Task Review: team managers only, scoped to their team
 * (Super Admin / all-records roles: every mapped employee).
 */
export const listProjectCompletedTasks = async (
  projectKeyRaw,
  query,
  authUser,
  effectiveRole,
) => {
  assertCanModerateTeamTask(effectiveRole);

  const projectKey = DailyPlannerProjectsModel.normalizeProjectKey(projectKeyRaw);
  if (!projectKey) {
    const err = new Error('projectKey is required');
    err.statusCode = 400;
    throw err;
  }
  const from = String(query?.from || '').trim().slice(0, 10);
  const to = String(query?.to || '').trim().slice(0, 10);
  if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
    const err = new Error('from and to dates (YYYY-MM-DD) are required');
    err.statusCode = 400;
    throw err;
  }
  if (from > to) {
    const err = new Error('From Date must not be after To Date');
    err.statusCode = 400;
    throw err;
  }
  const spanDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (!(spanDays <= PAST_DATA_MAX_RANGE_DAYS)) {
    const err = new Error(`Date range cannot exceed ${PAST_DATA_MAX_RANGE_DAYS} days`);
    err.statusCode = 400;
    throw err;
  }

  const managerCode = employeeCodeOf(authUser);
  let employeeCodes = await resolveTeamEmployeeCodes(managerCode, effectiveRole);
  const filterEmployee = String(query?.employeeCode || '').trim();
  if (filterEmployee) {
    if (!employeeCodes.includes(filterEmployee) && !canAccessAllRecords(effectiveRole)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
    employeeCodes = [filterEmployee];
  }
  if (employeeCodes.length === 0) {
    return { projectKey, from, to, tasks: [] };
  }

  // One indexed (employeeCode + date range) query per employee, then project/status filter.
  const rows = await DailyPlannerTasksModel.listTasksForEmployees(employeeCodes, from, to);
  const tasks = rows
    .filter(
      (t) =>
        PAST_DATA_STATUSES.has(String(t.status || '').trim()) &&
        DailyPlannerProjectsModel.normalizeProjectKey(t.projectName) === projectKey,
    )
    .sort((a, b) => {
      const byDate = String(b.date || '').localeCompare(String(a.date || ''));
      if (byDate !== 0) return byDate;
      return String(a.employeeCode || '').localeCompare(String(b.employeeCode || ''));
    });

  return { projectKey, from, to, tasks };
};

export const approveTask = async (taskId, body, authUser, effectiveRole) => {
  assertCanModerateTeamTask(effectiveRole);
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  await assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, existing.employeeCode);

  // Persist Manager Comments only (Finish Review flush) — do not change status/workflow.
  if (body?.commentsOnly === true || body?.persistCommentsOnly === true) {
    const nextComments = String(body.comments ?? body.managerComments ?? '').trim();
    const commentChanged = nextComments !== String(existing.managerComments || '').trim();
    const patch = { managerComments: nextComments };
    if (
      existing.planFinalizedAt &&
      commentChanged &&
      !readFinalizedSnapshot(existing)
    ) {
      patch.lastFinalizedSnapshot = finalizedFieldSnapshot(existing);
    }
    const task = await DailyPlannerTasksModel.updateTask(taskId, patch);
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
  const hoursRequested =
    body.hoursRequired !== undefined &&
    body.hoursRequired !== null &&
    String(body.hoursRequired).trim() !== '';
  if (existing.planFinalizedAt && (requestedPriority || hoursRequested) && body?.allowFinalizedEdit !== true) {
    const err = new Error(
      'This plan is finalized. Priority and Hours Required to Complete cannot be changed.',
    );
    err.statusCode = 400;
    throw err;
  }
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
    // Fire-and-forget: hours shortfall path may scan team mappings.
    void notifyHoursShortfallForDate(
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
  await assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, existing.employeeCode);
  if (existing.revisedTaskId && String(existing.revisionOutcome || '').trim()) {
    const revisedTask = await DailyPlannerTasksModel.getTaskById(existing.revisedTaskId);
    return { task: existing, revisedTask: revisedTask || undefined };
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
    // Frontend label is "Instruction"; keep expectedOutcome field for backward compatibility.
    expectedOutcome: String(
      replacementRaw.instruction ?? replacementRaw.expectedOutcome ?? '',
    ).trim(),
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

  const descriptionParts = [replacementTask.description];
  if (replacementTask.expectedOutcome) {
    descriptionParts.push(`Instruction: ${replacementTask.expectedOutcome}`);
  }
  const revisedTask = await DailyPlannerTasksModel.createTask({
    employeeCode: existing.employeeCode,
    employeeName: existing.employeeName,
    date: existing.date,
    taskName: replacementTask.taskName,
    description: descriptionParts.filter(Boolean).join('\n'),
    priority: replacementTask.priority,
    originalPriority: replacementTask.priority,
    currentPriority: replacementTask.priority,
    hoursRequired: replacementTask.hoursRequired,
    originalHoursRequired: replacementTask.hoursRequired,
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
    managerComments: reason,
    planningCategory: planningCategoryFromPriority(replacementTask.priority),
    urgentReason: existing.urgentReason || '',
    parentTaskId: existing.plannerTaskId,
    planningTimestamp: nowIso,
    planningScore: 0,
    completionScore: 0,
    finalScore: 0,
    planFinalizedAt: existing.planFinalizedAt || null,
    planFinalizedBy: String(existing.planFinalizedBy || '').trim(),
    createdByRole: 'Manager',
    createdByEmployeeCode: reviewerCode,
    createdByName: reviewerName,
  });

  const handled = await markRevisionHandled(
    existing.plannerTaskId,
    'accepted_suggestion',
    revisedTask.plannerTaskId,
  );

  void notifyUser(
    existing.employeeCode,
    'Daily Planner task revised',
    `"${existing.taskName}" was revised and the replacement task is approved.`,
    'INFO',
    { plannerTaskId: revisedTask.plannerTaskId },
  );

  auditPlannerTask(authUser, AUDIT_ACTIONS.REJECT, handled, 'Task Revised And Approved', {
    oldValues: { status: existing.status },
    newValues: { status: 'Approved', revisedTaskId: revisedTask.plannerTaskId },
    metadata: { remark: reason },
  });

  return { task: handled, revisedTask };
};

/**
 * Super Admin / Admin (team-scoped) — reopen an Approved task for correction.
 * Preserves prior approval actor/timestamps; clears current approved flag.
 */
export const reopenApprovedTask = async (taskId, body, authUser, effectiveRole) => {
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  await assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, existing.employeeCode);
  if (String(existing.status || '').trim() !== 'Approved') {
    const err = new Error('Only approved tasks can be reopened');
    err.statusCode = 400;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const actorCode = employeeCodeOf(authUser);
  const actorName = employeeNameOf(authUser);
  const reopenReason = String(body.reason || body.instruction || body.comments || '').trim();
  const skipNotification = body.skipNotification === true || body.silent === true;

  const task = await DailyPlannerTasksModel.updateTask(taskId, {
    status: 'Pending',
    approved: false,
    approvalStatus: '',
    // Keep approvedBy / approvedAt / approvedByName as historical approval evidence.
    reopenedFromStatus: 'Approved',
    reopenedBy: actorCode,
    reopenedByName: actorName,
    reopenedAt: nowIso,
    reopenReason,
    verificationStatus: '',
  });

  if (!skipNotification) {
    void notifyUser(
      existing.employeeCode,
      'Daily Planner task reopened',
      `"${existing.taskName}" was reopened by Super Admin for correction.`,
      'WARNING',
      { plannerTaskId: taskId },
    );
  }

  auditPlannerTask(authUser, AUDIT_ACTIONS.STATUS_CHANGE, task, 'Task Reopened By Super Admin', {
    oldValues: {
      status: existing.status,
      approved: existing.approved,
      approvedBy: existing.approvedBy,
      approvedAt: existing.approvedAt || existing.approvedDate,
    },
    newValues: {
      status: task.status,
      approved: task.approved,
      reopenedBy: actorCode,
      reopenedAt: nowIso,
    },
    metadata: {
      remark: reopenReason,
      previousStatus: 'Approved',
      previousApprovedBy: existing.approvedBy || '',
      previousApprovedAt: existing.approvedAt || existing.approvedDate || '',
    },
  });

  return { task };
};

/**
 * Super Admin / Admin (team-scoped) — reschedule a team task to a new date
 * (creates linked RESCHEDULED child). Reuses the employee not-completed next_date
 * architecture without requiring task ownership.
 */
export const rescheduleTaskBySuperAdmin = async (taskId, body, authUser, effectiveRole) => {
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  await assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, existing.employeeCode);
  assertTaskNotAlreadyRescheduled(existing);
  const status = String(existing.status || '').trim();
  if (status === 'Verified Complete') {
    const err = new Error('Verified complete tasks cannot be rescheduled');
    err.statusCode = 400;
    throw err;
  }

  const instruction = String(body.instruction || body.reason || body.comments || '').trim();
  const location = await getEmployeeLocation(existing.employeeCode);
  const newDate = await PlanningRecognitionService.validateRescheduleTargetDate(
    body.newDate,
    new Date(),
    location,
  );
  if (newDate === existing.date) {
    const err = new Error('New date must be different from the current task date');
    err.statusCode = 400;
    throw err;
  }
  await assertEmployeeCodeActiveOnDate(existing.employeeCode, newDate);
  await assertDateAllowsPlannerTaskCreate(existing.employeeCode, newDate);

  const now = new Date();
  const actorCode = employeeCodeOf(authUser);
  const actorName = employeeNameOf(authUser);
  const rescheduledAt = now.toISOString();
  const reasonText = instruction || 'Rescheduled by Super Admin';

  const task = await DailyPlannerTasksModel.updateTask(taskId, {
    status: 'Rescheduled',
    reason: reasonText,
    managerInstructions: instruction || existing.managerInstructions || '',
    rescheduledFromDate: existing.date,
    rescheduledToDate: newDate,
    rescheduledBy: actorCode,
    rescheduledByName: actorName,
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
    status: 'Approved',
    approved: true,
    approvalStatus: 'APPROVED',
    approvedBy: actorCode,
    approvedByName: actorName,
    approvedDate: rescheduledAt,
    approvedAt: rescheduledAt,
    managerComments: existing.managerComments || '',
    managerInstructions: instruction || existing.managerInstructions || '',
    planningCategory:
      existing.planningCategory === PLANNING_CATEGORY_URGENT
        ? PLANNING_CATEGORY_URGENT
        : PLANNING_CATEGORY_REGULAR,
    urgentReason: existing.urgentReason || '',
    originalDate: existing.originalDate || existing.date,
    rescheduledFrom: existing.date,
    reason: reasonText,
    parentTaskId: existing.plannerTaskId,
    planningWindowUsed: null,
    planningTimestamp: rescheduledAt,
    planningScore: 0,
    completionScore: 0,
    finalScore: 0,
    planFinalizedAt: existing.planFinalizedAt || null,
    planFinalizedBy: String(existing.planFinalizedBy || '').trim(),
    createdByRole: String(existing.createdByRole || '').trim(),
    createdByEmployeeCode: String(existing.createdByEmployeeCode || '').trim(),
    createdByName: String(existing.createdByName || '').trim(),
    isProjectBased: Boolean(existing.isProjectBased),
    projectName: String(existing.projectName || '').trim(),
  });

  if (existing.planningCategory === PLANNING_CATEGORY_REGULAR && existing.source === 'MANUAL') {
    await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
      employeeCode: existing.employeeCode,
      workingDayDateKey: existing.date,
    });
  }

  void notifyUser(
    existing.employeeCode,
    'Daily Planner task rescheduled',
    `"${existing.taskName}" was rescheduled to ${newDate}.`,
    'INFO',
    { plannerTaskId: rescheduledTask.plannerTaskId },
  );

  auditPlannerTask(authUser, AUDIT_ACTIONS.STATUS_CHANGE, task, 'Task Rescheduled By Super Admin', {
    oldValues: { status: existing.status, date: existing.date },
    newValues: {
      status: 'Rescheduled',
      rescheduledToDate: newDate,
      rescheduledTaskId: rescheduledTask.plannerTaskId,
    },
    metadata: { remark: instruction, newDate },
  });

  return { task, rescheduledTask };
};

/**
 * Super Admin / Admin (team-scoped) — soft-delete a team task (preserves row + audit history).
 */
export const deleteTaskBySuperAdmin = async (taskId, body, authUser, effectiveRole) => {
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  await assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, existing.employeeCode);
  if (String(existing.status || '').trim() === 'Rescheduled') {
    const err = new Error('Rescheduled original tasks cannot be deleted');
    err.statusCode = 400;
    throw err;
  }

  const reason = String(body.reason || body.instruction || body.comments || '').trim();
  const actorCode = employeeCodeOf(authUser);
  const actorName = employeeNameOf(authUser);
  const nowIso = new Date().toISOString();

  // Stamp termination metadata on the row before soft-delete for audit/history.
  await DailyPlannerTasksModel.updateTask(taskId, {
    status: 'Terminated',
    reason: reason || 'Deleted by Super Admin',
    terminatedAt: nowIso,
    terminatedBy: actorCode,
    terminatedByName: actorName,
  });
  await DailyPlannerTasksModel.softDeleteTask(taskId);

  if (existing.planningCategory === PLANNING_CATEGORY_REGULAR && existing.source === 'MANUAL') {
    await PlanningRecognitionService.recomputePlanningScoreForWorkingDay({
      employeeCode: existing.employeeCode,
      workingDayDateKey: existing.date,
    });
  }

  void notifyUser(
    existing.employeeCode,
    'Daily Planner task deleted',
    `"${existing.taskName}" was removed by Super Admin.`,
    'WARNING',
    { plannerTaskId: taskId },
  );

  auditPlannerTask(authUser, AUDIT_ACTIONS.DELETE, existing, 'Task Deleted By Super Admin', {
    oldValues: { status: existing.status, approved: existing.approved },
    newValues: { status: 'Deleted', is_deleted: true },
    metadata: {
      remark: reason,
      previousStatus: existing.status,
      previousApprovedBy: existing.approvedBy || '',
      previousApprovedAt: existing.approvedAt || existing.approvedDate || '',
      reopenedBy: existing.reopenedBy || '',
      reopenedAt: existing.reopenedAt || '',
    },
  });

  return { success: true, plannerTaskId: taskId };
};

export const verifyTaskCompletion = async (taskId, body, authUser, effectiveRole) => {
  assertCanModerateTeamTask(effectiveRole);
  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  await assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, existing.employeeCode);

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
    completionManagerReviewedAt: nowIso,
    completionManagerReviewedBy: employeeCodeOf(authUser),
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
    planFinalizedAt: existing.planFinalizedAt || null,
    planFinalizedBy: String(existing.planFinalizedBy || '').trim(),
    createdByRole: 'Manager',
    createdByEmployeeCode: reviewerCode,
    createdByName: reviewerName,
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
  if (
    !newPriority ||
    (newPriority !== 'Urgent' &&
      newPriority !== 'High' &&
      newPriority !== 'Medium' &&
      newPriority !== 'Low')
  ) {
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
  await assertCanCorrectTeamEmployeeTask(authUser, effectiveRole, existing.employeeCode);

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
    planningCategory: planningCategoryFromPriority(newPriority),
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
  // Canonical EmployeeMaster location for Team Daily Planner holiday/working-day rules.
  const enriched = await Promise.all(
    (mappings || []).map(async (mapping) => {
      const location = await getEmployeeLocation(mapping?.employeeCode);
      const enhancedEligible = await resolveEnhancedEligibilityForEmployeeCode(
        mapping?.employeeCode,
      );
      return { ...mapping, location, enhancedEligible };
    }),
  );
  return { mappings: enriched };
};

export const assignTeamMapping = async (body, authUser, effectiveRole) => {
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const actorCode = employeeCodeOf(authUser);
  const managerCode = String(body.managerCode || '').trim() || actorCode;
  if (!managerCode) {
    const err = new Error('Reporting manager is required');
    err.statusCode = 400;
    throw err;
  }
  const managerName =
    String(body.managerName || '').trim() ||
    (managerCode === actorCode ? employeeNameOf(authUser) : '') ||
    managerCode;
  const employeeCode = String(body.employeeCode || '').trim();
  const today = todayIstDateKey();
  await assertEmployeeCodeActiveOnDate(employeeCode, today);
  await assertEmployeeCodeActiveOnDate(managerCode, today);
  const mapping = await DailyPlannerTeamMappingsModel.createMapping({
    managerCode,
    managerName,
    employeeCode,
    employeeName: String(body.employeeName || '').trim(),
    createdBy: actorCode,
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
  await assertEmployeeCodeActiveOnDate(newManagerCode, todayIstDateKey());
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

export const getPlanningConfig = async (authUser, effectiveRole) => {
  const code = employeeCodeOf(authUser);
  const config = await PlanningRecognitionService.getPlanningConfig(new Date(), code);
  const enhancedEligible = await resolveEnhancedEligibilityForAuthUser(authUser, effectiveRole);
  const factoryEligible = await resolveFactoryEligibilityForAuthUser(authUser);
  return { config: { ...config, enhancedEligible, factoryEligible } };
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

/**
 * Approved Payroll leave for Daily Planner calendars (source of truth: PayrollLeaveRequests).
 * Auth: self, Super Admin (company-wide), or Admin/Developer for their own DP team only.
 */
export const listApprovedLeaveForPlanner = async (
  employeeCode,
  authUser,
  effectiveRole,
  query = {},
) => {
  const code = String(employeeCode || '').trim();
  if (!code) {
    const err = new Error('employeeCode is required');
    err.statusCode = 400;
    throw err;
  }
  await assertCanViewTeamEmployeePlanner(authUser, effectiveRole, code);

  const year = Number(query.year);
  const month = Number(query.month);
  const all = await PayrollLeaveRequestsModel.listLeaveRequestsForEmployee(code);
  let leaveRequests = (all || []).filter(
    (row) => String(row.status || '').trim() === 'Approved',
  );
  if (Number.isFinite(year) && year > 0 && Number.isFinite(month) && month >= 1 && month <= 12) {
    leaveRequests = leaveRequests.filter((row) =>
      rangesOverlapMonth(row.startDate, row.endDate, year, month),
    );
  }
  leaveRequests.sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  return { leaveRequests };
};

function officialEmailOfEmployee(employee) {
  return String(
    employee?.officialEmail || employee?.official_email || employee?.email || '',
  ).trim();
}

/**
 * Super Admin review comment for an employee outside their own team.
 * Persists permanently on the task; emails employee + reporting person(s).
 */
export const submitSuperadminReviewComment = async (
  taskId,
  body,
  authUser,
  effectiveRole,
) => {
  if (!isSuperAdmin(effectiveRole)) {
    const err = new Error('Only Super Admin can submit company-wide review comments');
    err.statusCode = 403;
    throw err;
  }

  const existing = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!existing) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }

  const targetCode = String(existing.employeeCode || '').trim();
  const reviewerCode = employeeCodeOf(authUser);
  const onTeam = await isEmployeeOnManagersTeam(reviewerCode, targetCode);
  if (onTeam) {
    const err = new Error(
      'Use the normal Team Daily Planner review actions for employees on your own team',
    );
    err.statusCode = 400;
    throw err;
  }

  const commentText = String(body?.comment || body?.comments || '').trim();
  if (!commentText) {
    const err = new Error('Review comment is required');
    err.statusCode = 400;
    throw err;
  }

  const submissionId = String(body?.submissionId || '').trim();
  const prior = Array.isArray(existing.superadminReviewComments)
    ? existing.superadminReviewComments
    : [];
  if (submissionId) {
    const dup = prior.find((c) => String(c?.submissionId || '').trim() === submissionId);
    if (dup) {
      return {
        task: existing,
        comment: dup,
        duplicate: true,
        email: {
          employee: { ok: false, skipped: true, reason: 'duplicate_submission' },
          reportingPersons: [],
        },
      };
    }
  }

  const reviewerName = employeeNameOf(authUser) || reviewerCode;
  const comment = {
    commentId: uuidv4(),
    submissionId: submissionId || uuidv4(),
    commentText,
    reviewerCode,
    reviewerName,
    employeeCode: targetCode,
    plannerTaskId: String(existing.plannerTaskId || taskId).trim(),
    taskDate: String(existing.date || '').trim().slice(0, 10),
    taskName: String(existing.taskName || '').trim(),
    projectName: String(existing.projectName || '').trim(),
    submittedAt: new Date().toISOString(),
  };

  const task = await DailyPlannerTasksModel.updateTask(taskId, {
    superadminReviewComments: [...prior, comment],
  });

  // Notify after persist — never roll back comment on email failure.
  const employee = await EmployeeMasterModel.getEmployeeByCode(targetCode);
  const employeeName =
    String(employee?.fullName || '').trim() ||
    `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() ||
    String(existing.employeeName || '').trim() ||
    targetCode;
  const employeeEmail = officialEmailOfEmployee(employee);
  const mail = buildSuperadminReviewEmail({
    recipientName: employeeName,
    employeeName,
    reviewerName,
    taskName: comment.taskName,
    projectName: comment.projectName,
    taskDate: comment.taskDate,
    commentText: comment.commentText,
  });

  let employeeEmailResult = { ok: false, skipped: true, reason: 'missing_email' };
  if (employeeEmail) {
    employeeEmailResult = await sendEmail({
      to: employeeEmail,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    if (!employeeEmailResult?.ok) {
      console.error('Superadmin review email to employee failed', {
        employeeCode: targetCode,
        error: employeeEmailResult?.error,
      });
    }
  } else {
    console.error('Superadmin review email skipped — employee has no official email', {
      employeeCode: targetCode,
    });
  }

  const managers = await listActiveManagersForEmployee(targetCode);
  const reportingResults = [];
  for (const manager of managers) {
    if (!manager.managerCode || manager.managerCode === targetCode) continue;
    if (manager.managerCode === reviewerCode) continue;
    const mgrEmp = await EmployeeMasterModel.getEmployeeByCode(manager.managerCode);
    const mgrEmail = officialEmailOfEmployee(mgrEmp);
    const mgrName =
      String(mgrEmp?.fullName || '').trim() ||
      manager.managerName ||
      manager.managerCode;
    if (!mgrEmail) {
      console.error('Superadmin review email skipped — reporting person has no email', {
        managerCode: manager.managerCode,
      });
      reportingResults.push({
        managerCode: manager.managerCode,
        ok: false,
        skipped: true,
        reason: 'missing_email',
      });
      continue;
    }
    const mgrMail = buildSuperadminReviewEmail({
      recipientName: mgrName,
      employeeName,
      reviewerName,
      taskName: comment.taskName,
      projectName: comment.projectName,
      taskDate: comment.taskDate,
      commentText: comment.commentText,
    });
    const result = await sendEmail({
      to: mgrEmail,
      subject: mgrMail.subject,
      text: mgrMail.text,
      html: mgrMail.html,
    });
    if (!result?.ok) {
      console.error('Superadmin review email to reporting person failed', {
        managerCode: manager.managerCode,
        error: result?.error,
      });
    }
    reportingResults.push({
      managerCode: manager.managerCode,
      ok: Boolean(result?.ok),
      skipped: false,
      error: result?.ok ? undefined : result?.error,
    });
  }

  auditPlannerTask(authUser, AUDIT_ACTIONS.UPDATE, task, 'Superadmin review comment', {
    newValues: {
      commentId: comment.commentId,
      taskDate: comment.taskDate,
    },
  });

  return {
    task,
    comment,
    duplicate: false,
    email: {
      employee: employeeEmailResult,
      reportingPersons: reportingResults,
    },
  };
};
