/**
 * Enhanced Daily Planner features:
 * - Task document upload/view
 * - Progress Done (%)
 * - Project Progress aggregation
 * - Raise / Accept Flag + urgent email
 *
 * Eligibility: Factory OR (Office + Super Admin). Enforced server-side.
 */

import { v4 as uuidv4 } from 'uuid';
import * as DailyPlannerTasksModel from '../models/DailyPlannerTasks.js';
import * as DailyPlannerTeamMappingsModel from '../models/DailyPlannerTeamMappings.js';
import * as EmployeeMasterModel from '../models/EmployeeMaster.js';
import { canAccessAllRecords, isSuperAdmin } from '../utils/accessControl.js';
import {
  assertEnhancedDailyPlannerEligible,
  resolveEnhancedEligibilityForAuthUser,
  resolveEnhancedEligibilityForEmployeeCode,
} from '../utils/dailyPlannerEnhancedEligibility.js';
import { getSignedFileUrl } from '../utils/s3SignedUrl.js';
import { sendEmail } from './emailService.js';
import log from '../utils/logger.js';

function employeeCodeOf(authUser) {
  return String(authUser?.employeeCode || authUser?.id || '').trim();
}

function employeeNameOf(authUser) {
  const first = String(authUser?.firstName || '').trim();
  const last = String(authUser?.lastName || '').trim();
  const combined = `${first} ${last}`.trim();
  return combined || String(authUser?.name || authUser?.employeeCode || '').trim();
}

function normalizeProjectKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Parse enhanced create/update fields. Returns {} when not eligible (ignore client values).
 * Progress Done is only accepted for project-based tasks; non-project clears stale values.
 */
export function parseOptionalEnhancedFields(body, eligible) {
  if (!eligible) return {};
  const out = {};
  if (body.needsDocument !== undefined && body.needsDocument !== null) {
    const v = body.needsDocument;
    out.needsDocument =
      v === true || v === 'Yes' || v === 'yes' || v === 'true' || v === 1 || v === '1';
  }

  const projectBasedExplicit =
    body.isProjectBased === undefined || body.isProjectBased === null
      ? null
      : Boolean(body.isProjectBased === true || body.isProjectBased === 'Yes');

  if (projectBasedExplicit === false) {
    // Avoid submitting a stale Progress Done (%) from a prior Yes selection.
    out.progressDone = null;
  } else if (
    body.progressDone !== undefined &&
    body.progressDone !== null &&
    String(body.progressDone).trim() !== ''
  ) {
    const n = Number(body.progressDone);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      const err = new Error('Progress Done (%) must be a number between 0 and 100');
      err.statusCode = 400;
      throw err;
    }
    out.progressDone = Math.round(n);
  }
  return out;
}

const DOCUMENT_TYPES = new Set(['employee', 'managerReview', 'managerApproval']);

function normalizeDocumentType(raw) {
  const t = String(raw || 'employee').trim();
  if (!DOCUMENT_TYPES.has(t)) {
    const err = new Error(
      'documentType must be employee, managerReview, or managerApproval',
    );
    err.statusCode = 400;
    throw err;
  }
  return t;
}

function documentSlotPatch(type, { key, fileName, contentType, uploadedAt }) {
  if (type === 'managerReview') {
    return {
      managerReviewDocumentFileKey: key,
      managerReviewDocumentFileName: fileName,
      managerReviewDocumentContentType: contentType,
      managerReviewDocumentUploadedAt: uploadedAt,
    };
  }
  if (type === 'managerApproval') {
    return {
      managerApprovalDocumentFileKey: key,
      managerApprovalDocumentFileName: fileName,
      managerApprovalDocumentContentType: contentType,
      managerApprovalDocumentUploadedAt: uploadedAt,
    };
  }
  return {
    needsDocument: true,
    documentFileKey: key,
    documentFileName: fileName,
    documentContentType: contentType,
    documentUploadedAt: uploadedAt,
  };
}

function documentSlotRead(task, type) {
  if (type === 'managerReview') {
    return {
      key: String(task.managerReviewDocumentFileKey || '').trim(),
      fileName: String(task.managerReviewDocumentFileName || '').trim(),
      contentType: String(task.managerReviewDocumentContentType || '').trim(),
    };
  }
  if (type === 'managerApproval') {
    return {
      key: String(task.managerApprovalDocumentFileKey || '').trim(),
      fileName: String(task.managerApprovalDocumentFileName || '').trim(),
      contentType: String(task.managerApprovalDocumentContentType || '').trim(),
    };
  }
  return {
    key: String(task.documentFileKey || '').trim(),
    fileName: String(task.documentFileName || '').trim(),
    contentType: String(task.documentContentType || '').trim(),
  };
}

async function loadTaskOrThrow(taskId) {
  const task = await DailyPlannerTasksModel.getTaskById(taskId);
  if (!task) {
    const err = new Error('Daily planner task not found');
    err.statusCode = 404;
    throw err;
  }
  return task;
}

async function assertCanAccessTask(authUser, effectiveRole, task) {
  const requester = employeeCodeOf(authUser);
  const owner = String(task.employeeCode || '').trim();
  if (requester && requester === owner) return;
  if (isSuperAdmin(effectiveRole)) return;
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const team = await DailyPlannerTeamMappingsModel.listEmployeesForManager(requester);
  const allowed = team.some((m) => String(m.employeeCode || '').trim() === owner);
  if (!allowed) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Super Admin: unrestricted. Admin/Developer: Active team mapping required.
 */
async function assertCanManageTaskEmployee(authUser, effectiveRole, employeeCode) {
  if (isSuperAdmin(effectiveRole)) return;
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const target = String(employeeCode || '').trim();
  const managerCode = employeeCodeOf(authUser);
  const team = await DailyPlannerTeamMappingsModel.listEmployeesForManager(managerCode);
  const allowed = team.some((m) => String(m.employeeCode || '').trim() === target);
  if (!allowed) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Upload into one of three independent document slots.
 * - employee: task owner (or authorized team manager creating on behalf)
 * - managerReview / managerApproval: authorized manager only (never overwrites other slots)
 */
export async function uploadTaskDocument(
  taskId,
  file,
  authUser,
  effectiveRole,
  documentTypeRaw = 'employee',
) {
  const task = await loadTaskOrThrow(taskId);
  const documentType = normalizeDocumentType(documentTypeRaw);

  const eligible = await resolveEnhancedEligibilityForEmployeeCode(task.employeeCode);
  assertEnhancedDailyPlannerEligible(eligible);

  if (documentType === 'employee') {
    await assertCanAccessTask(authUser, effectiveRole, task);
  } else {
    await assertCanManageTaskEmployee(authUser, effectiveRole, task.employeeCode);
  }

  if (!file?.key && !file?.location) {
    const err = new Error('Document file is required');
    err.statusCode = 400;
    throw err;
  }

  const key = String(file.key || '').trim();
  const fileName = String(file.originalname || fileNameFromKey(key) || 'document').trim();
  const contentType = String(file.mimetype || '').trim();
  const uploadedAt = new Date().toISOString();

  const updated = await DailyPlannerTasksModel.updateTask(
    task.plannerTaskId,
    documentSlotPatch(documentType, { key, fileName, contentType, uploadedAt }),
  );
  return { task: updated, documentType };
}

function fileNameFromKey(key) {
  const parts = String(key || '').split('/');
  const last = parts[parts.length - 1] || '';
  return last.replace(/^\d+-/, '');
}

export async function getTaskDocumentUrl(
  taskId,
  authUser,
  effectiveRole,
  documentTypeRaw = 'employee',
) {
  const task = await loadTaskOrThrow(taskId);
  await assertCanAccessTask(authUser, effectiveRole, task);

  const documentType = normalizeDocumentType(documentTypeRaw);
  const slot = documentSlotRead(task, documentType);
  if (!slot.key) {
    const err = new Error('No document uploaded for this task');
    err.statusCode = 404;
    throw err;
  }

  const url = getSignedFileUrl(slot.key);
  return {
    url,
    fileName: slot.fileName || fileNameFromKey(slot.key),
    contentType: slot.contentType || '',
    documentType,
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildFlagEmail({ employeeName, taskName, taskDate, managerName, instruction }) {
  const subject = 'URGENT: Task Instruction / Flag Raised';
  const text = [
    'An urgent instruction has been raised for one of your Daily Planner tasks.',
    '',
    `Employee: ${employeeName}`,
    `Task: ${taskName}`,
    `Date: ${taskDate}`,
    `Instruction from: ${managerName}`,
    '',
    'Instruction:',
    instruction,
    '',
    'Please review this flag in your My Daily Planner.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#212529;line-height:1.5;">
      <p><strong>An urgent instruction has been raised for one of your Daily Planner tasks.</strong></p>
      <p><strong>Task:</strong> ${escapeHtml(taskName)}</p>
      <p><strong>Date:</strong> ${escapeHtml(taskDate)}</p>
      <p><strong>Instruction from:</strong> ${escapeHtml(managerName)}</p>
      <p><strong>Instruction:</strong><br>${escapeHtml(instruction).replace(/\n/g, '<br>')}</p>
      <p>Please review this flag in your My Daily Planner.</p>
    </div>
  `;
  return { subject, text, html };
}

export async function raiseTaskFlag(taskId, body, authUser, effectiveRole) {
  const task = await loadTaskOrThrow(taskId);
  await assertCanManageTaskEmployee(authUser, effectiveRole, task.employeeCode);

  const ownerEligible = await resolveEnhancedEligibilityForEmployeeCode(task.employeeCode);
  assertEnhancedDailyPlannerEligible(
    ownerEligible,
    'Flags can only be raised on enhanced Daily Planner employee tasks.',
  );

  const instruction = String(body?.instruction || body?.flagInstruction || '').trim();
  if (!instruction) {
    const err = new Error('Instruction is required');
    err.statusCode = 400;
    throw err;
  }

  if (String(task.flagStatus || '').trim() === 'Raised') {
    const err = new Error('A flag is already raised on this task. Wait for the employee to accept it.');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const managerCode = employeeCodeOf(authUser);
  const managerName = employeeNameOf(authUser);
  const flagId = uuidv4();
  const historyEntry = {
    flagId,
    instruction,
    raisedBy: managerCode,
    raisedByName: managerName,
    raisedAt: now,
    status: 'Raised',
  };
  const priorHistory = Array.isArray(task.flagHistory) ? task.flagHistory : [];

  const updated = await DailyPlannerTasksModel.updateTask(task.plannerTaskId, {
    flagStatus: 'Raised',
    flagInstruction: instruction,
    flagRaisedBy: managerCode,
    flagRaisedByName: managerName,
    flagRaisedAt: now,
    flagAcceptedAt: null,
    flagHistory: [...priorHistory, historyEntry],
  });

  // Fire-and-forget email to task owner only.
  void (async () => {
    try {
      const employee = await EmployeeMasterModel.getEmployeeByCode(task.employeeCode);
      const to = String(
        employee?.officialEmail || employee?.official_email || employee?.email || '',
      ).trim();
      if (!to) {
        log.warn('Flag email skipped: no officialEmail for', task.employeeCode);
        return;
      }
      const mail = buildFlagEmail({
        employeeName: task.employeeName || task.employeeCode,
        taskName: task.taskName,
        taskDate: task.date,
        managerName,
        instruction,
      });
      await sendEmail({ to, ...mail });
    } catch (err) {
      log.error('Flag email failed:', err?.message || err);
    }
  })();

  return { task: updated };
}

export async function acceptTaskFlag(taskId, authUser, effectiveRole) {
  void effectiveRole;
  const task = await loadTaskOrThrow(taskId);
  const requester = employeeCodeOf(authUser);
  if (requester !== String(task.employeeCode || '').trim()) {
    const err = new Error('Only the task owner can accept this flag');
    err.statusCode = 403;
    throw err;
  }

  // No planning-window restriction — explicit exception.
  if (String(task.flagStatus || '').trim() !== 'Raised') {
    const err = new Error('No raised flag to accept on this task');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const history = Array.isArray(task.flagHistory) ? [...task.flagHistory] : [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (String(history[i]?.status || '').trim() === 'Raised') {
      history[i] = { ...history[i], status: 'Accepted', acceptedAt: now };
      break;
    }
  }

  const updated = await DailyPlannerTasksModel.updateTask(task.plannerTaskId, {
    flagStatus: 'Accepted',
    flagAcceptedAt: now,
    flagHistory: history,
  });
  return { task: updated };
}

function isValidProjectProgressTask(task) {
  if (!task) return false;
  if (!Boolean(task.isProjectBased)) return false;
  if (!String(task.projectName || '').trim()) return false;
  // Handled revision parents would double-count if progress was copied — skip.
  if (String(task.revisionOutcome || '').trim()) return false;
  const status = String(task.status || '').trim();
  if (status === 'Rescheduled') return false;
  return true;
}

function hasProgressValue(task) {
  if (
    task?.progressDone === undefined ||
    task?.progressDone === null ||
    String(task.progressDone).trim() === ''
  ) {
    return false;
  }
  const n = Number(task.progressDone);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

/**
 * Project Progress:
 * Level 1 — average of each employee's Progress Done for that project.
 * Level 2 — average of those employee averages (equal employee weight).
 */
export function aggregateProjectProgress(tasks) {
  const byProject = new Map();

  for (const task of tasks || []) {
    if (!isValidProjectProgressTask(task)) continue;
    if (!hasProgressValue(task)) continue;

    const projectName = String(task.projectName || '').trim();
    const projectKey = normalizeProjectKey(projectName);
    const empCode = String(task.employeeCode || '').trim();
    if (!projectKey || !empCode) continue;

    if (!byProject.has(projectKey)) {
      byProject.set(projectKey, {
        projectKey,
        projectName,
        employees: new Map(),
      });
    }
    const project = byProject.get(projectKey);
    if (!project.employees.has(empCode)) {
      project.employees.set(empCode, {
        employeeCode: empCode,
        employeeName: String(task.employeeName || empCode).trim(),
        progressValues: [],
      });
    }
    project.employees.get(empCode).progressValues.push(Number(task.progressDone));
  }

  const projects = [];
  for (const project of byProject.values()) {
    const employees = [];
    for (const emp of project.employees.values()) {
      const sum = emp.progressValues.reduce((a, b) => a + b, 0);
      const avg = emp.progressValues.length
        ? Math.round((sum / emp.progressValues.length) * 100) / 100
        : null;
      if (avg == null) continue;
      employees.push({
        employeeCode: emp.employeeCode,
        employeeName: emp.employeeName,
        progressPercent: avg,
        taskCountWithProgress: emp.progressValues.length,
      });
    }
    if (employees.length === 0) continue;
    const overallSum = employees.reduce((a, e) => a + e.progressPercent, 0);
    const overall = Math.round((overallSum / employees.length) * 100) / 100;
    employees.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    projects.push({
      projectKey: project.projectKey,
      projectName: project.projectName,
      progressPercent: overall,
      employeeCount: employees.length,
      employees,
    });
  }

  projects.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return { projects };
}

async function resolveScopeEmployeeCodes(authUser, effectiveRole) {
  const selfCode = employeeCodeOf(authUser);
  const codes = new Set([selfCode].filter(Boolean));

  if (canAccessAllRecords(effectiveRole)) {
    const mappings = await DailyPlannerTeamMappingsModel.listAllMappings();
    for (const m of mappings || []) {
      if (String(m.status || '').trim() !== 'Active') continue;
      const code = String(m.employeeCode || '').trim();
      if (code) codes.add(code);
    }
    return [...codes];
  }

  const team = await DailyPlannerTeamMappingsModel.listEmployeesForManager(selfCode);
  for (const m of team || []) {
    const code = String(m.employeeCode || '').trim();
    if (code) codes.add(code);
  }
  return [...codes];
}

export async function getProjectProgress(authUser, effectiveRole) {
  const selfEligible = await resolveEnhancedEligibilityForAuthUser(authUser, effectiveRole);
  assertEnhancedDailyPlannerEligible(selfEligible);

  const codes = await resolveScopeEmployeeCodes(authUser, effectiveRole);
  // All tasks for scoped employees (GSI per employee, no date filter).
  const tasks = await DailyPlannerTasksModel.listTasksForEmployees(codes, null, null);
  return aggregateProjectProgress(tasks);
}

export async function getEnhancedEligibility(authUser, effectiveRole) {
  const eligible = await resolveEnhancedEligibilityForAuthUser(authUser, effectiveRole);
  return { enhancedEligible: eligible };
}
