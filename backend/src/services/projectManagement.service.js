/**
 * Managed Project Management + weighted Project Progress for Daily Planner.
 */

import { v4 as uuidv4 } from 'uuid';
import * as DailyPlannerProjectsModel from '../models/DailyPlannerProjects.js';
import * as DailyPlannerProjectObservationsModel from '../models/DailyPlannerProjectObservations.js';
import * as DailyPlannerTasksModel from '../models/DailyPlannerTasks.js';
import * as DailyPlannerTeamMappingsModel from '../models/DailyPlannerTeamMappings.js';
import * as EmployeeMasterModel from '../models/EmployeeMaster.js';
import { canAccessAllRecords } from '../utils/accessControl.js';
import {
  assertEmployeeActiveOnDate,
  EMPLOYEE_EXITED_OPERATION_MESSAGE,
} from '../utils/employeeActiveStatus.js';
import { todayIstDateKey } from '../utils/salesQuotationDates.js';
import {
  resolveEnhancedEligibilityForAuthUser,
  assertEnhancedDailyPlannerEligible,
} from '../utils/dailyPlannerEnhancedEligibility.js';

function employeeCodeOf(authUser) {
  return String(authUser?.employeeCode || authUser?.employee_code || '').trim();
}

function employeeNameOf(authUser) {
  return (
    String(authUser?.fullName || authUser?.name || '').trim() ||
    `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim()
  );
}

function assertCanManageProjects(effectiveRole) {
  if (!canAccessAllRecords(effectiveRole)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

async function listTeamEmployeeCodes(managerCode) {
  const team = await DailyPlannerTeamMappingsModel.listEmployeesForManager(managerCode);
  return [
    ...new Set(
      (team || [])
        .map((m) => String(m.employeeCode || '').trim())
        .filter(Boolean),
    ),
  ];
}

async function resolveAssignableEmployeeCodes(authUser, effectiveRole) {
  const self = employeeCodeOf(authUser);
  if (isSuperAdminLike(effectiveRole)) {
    const mappings = await DailyPlannerTeamMappingsModel.listAllMappings();
    const codes = new Set();
    for (const m of mappings || []) {
      if (String(m.status || '').trim() !== 'Active') continue;
      const code = String(m.employeeCode || '').trim();
      if (code) codes.add(code);
      const mgr = String(m.managerCode || '').trim();
      if (mgr) codes.add(mgr);
    }
    if (self) codes.add(self);
    return [...codes];
  }
  const team = await listTeamEmployeeCodes(self);
  return [...new Set([self, ...team].filter(Boolean))];
}

function isSuperAdminLike(role) {
  const r = String(role || '').trim();
  return r === 'Super Admin' || r === 'Developer';
}

async function assertEmployeeCodeActiveToday(employeeCode) {
  const emp = await EmployeeMasterModel.getEmployeeByCode(employeeCode);
  if (!emp) {
    const err = new Error(`Employee ${employeeCode} not found`);
    err.statusCode = 400;
    throw err;
  }
  assertEmployeeActiveOnDate(
    emp.dateOfExit || emp.DateOfExit || emp.date_of_exit,
    todayIstDateKey(),
    EMPLOYEE_EXITED_OPERATION_MESSAGE,
  );
}

/** Admin is team-scoped; Super Admin / Developer can assign across active mappings. */
async function assertAssigneesInScope(assigneeCodes, authUser, effectiveRole) {
  const allowed = new Set(await resolveAssignableEmployeeCodes(authUser, effectiveRole));
  for (const code of assigneeCodes) {
    if (!allowed.has(code)) {
      const err = new Error(
        `Employee ${code} is outside your authorized team and cannot be assigned`,
      );
      err.statusCode = 403;
      throw err;
    }
    await assertEmployeeCodeActiveToday(code);
  }
}

export function sumActiveContributions(projectTasks) {
  return (projectTasks || [])
    .filter((t) => String(t.status || 'Active') === 'Active')
    .reduce((sum, t) => sum + (Number(t.contributionPercent) || 0), 0);
}

export function isAllocationValid(projectTasks) {
  const active = (projectTasks || []).filter((t) => String(t.status || 'Active') === 'Active');
  // Projects with no predefined task names are valid (no contribution allocation yet).
  if (active.length === 0) return true;
  const total = Math.round(sumActiveContributions(active) * 100) / 100;
  return Math.abs(total - 100) < 0.01;
}

/**
 * Parse showInProjectProgress from request body.
 * - Create (forCreate=true): omit → false (must not appear in Progress until opted in).
 * - Update (forCreate=false): omit → null (keep existing / legacy implicit).
 */
function parseShowInProjectProgressInput(body, { forCreate }) {
  const raw = body?.showInProjectProgress;
  if (raw === undefined || raw === null || raw === '') {
    return forCreate ? false : null;
  }
  if (raw === true || raw === false) return raw;
  if (raw === 1 || raw === 0) return raw === 1;
  const s = String(raw).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  const err = new Error('Invalid showInProjectProgress value');
  err.statusCode = 400;
  throw err;
}

function validateManagedPayload(body, { forCreate = false } = {}) {
  const projectName = String(body?.projectName || '').trim();
  if (!projectName) {
    const err = new Error('Project Name is required');
    err.statusCode = 400;
    throw err;
  }
  const tasks = Array.isArray(body?.projectTasks) ? body.projectTasks : [];
  // Explicit opt-out of predefined task names (or empty array with hasPredefinedTasks === false).
  const allowEmptyTasks =
    body?.hasPredefinedTasks === false ||
    body?.hasPredefinedTasks === 'false' ||
    body?.hasPredefinedTasks === 0;

  // Optional here: create defaults to ProjectTeamOnly, update keeps the existing value when omitted.
  const rawVisibility = String(body?.visibility ?? '').trim();
  if (rawVisibility && !DailyPlannerProjectsModel.PROJECT_VISIBILITY_VALUES.includes(rawVisibility)) {
    const err = new Error('Invalid project visibility');
    err.statusCode = 400;
    throw err;
  }

  const showInProjectProgress = parseShowInProjectProgressInput(body, { forCreate });

  if (tasks.length === 0) {
    if (allowEmptyTasks) {
      return {
        projectName,
        projectTasks: [],
        visibility: rawVisibility || null,
        showInProjectProgress,
      };
    }
    const err = new Error('At least one project task is required');
    err.statusCode = 400;
    throw err;
  }

  const normalized = [];
  for (const raw of tasks) {
    const taskName = String(raw?.taskName || '').trim();
    if (!taskName) {
      const err = new Error('Each project task requires a Task Name');
      err.statusCode = 400;
      throw err;
    }
    const contribution = Number(raw?.contributionPercent);
    if (!Number.isFinite(contribution) || contribution < 0 || contribution > 100) {
      const err = new Error(`Invalid contribution % for task "${taskName}"`);
      err.statusCode = 400;
      throw err;
    }
    const codes = Array.isArray(raw?.assignedEmployeeCodes)
      ? [...new Set(raw.assignedEmployeeCodes.map((c) => String(c || '').trim()).filter(Boolean))]
      : [];
    if (codes.length === 0) {
      const err = new Error(`Assign at least one employee to task "${taskName}"`);
      err.statusCode = 400;
      throw err;
    }
    normalized.push({
      projectTaskId: String(raw?.projectTaskId || '').trim() || uuidv4(),
      taskName,
      contributionPercent: Math.round(contribution * 100) / 100,
      assignedEmployeeCodes: codes,
      status: String(raw?.status || 'Active').trim() === 'Inactive' ? 'Inactive' : 'Active',
      createdAt: raw?.createdAt || null,
      updatedAt: raw?.updatedAt || null,
    });
  }

  const active = normalized.filter((t) => t.status === 'Active');
  if (active.length === 0) {
    const err = new Error('A project must have at least one active task');
    err.statusCode = 400;
    throw err;
  }
  const total = Math.round(sumActiveContributions(active) * 100) / 100;
  if (Math.abs(total - 100) >= 0.01) {
    const err = new Error(
      `Active task contributions must total exactly 100% (currently ${total}%)`,
    );
    err.statusCode = 400;
    throw err;
  }

  return {
    projectName,
    projectTasks: normalized,
    visibility: rawVisibility || null,
    showInProjectProgress,
  };
}

/**
 * Project visibility (Everyone | ProjectTeamOnly | OnlyMe).
 * - Records missing `visibility` are treated as ProjectTeamOnly for filtering, but admin-level
 *   viewers keep their previous broad access to such legacy records in form options so existing
 *   users are not locked out (see `visibilityImplicit`).
 * - Super Admin / Developer remain elevated and always see every project.
 * - Creator always sees their own project.
 * - ProjectTeamOnly: assigned employees + managers whose team includes an assignee.
 * `teamCodes` must include the viewer (see resolveVisibilityEmployeeCodes).
 */
function isProjectVisibleToViewer(project, { self, teamCodes, elevated }) {
  if (elevated) return true;
  if (self && String(project.createdBy || '').trim() === self) return true;
  if (project.visibility === 'OnlyMe') return false;
  if (project.visibility === 'Everyone') return true;
  for (const t of project.projectTasks || []) {
    for (const c of t.assignedEmployeeCodes || []) {
      if (c === self || teamCodes.has(c)) return true;
    }
  }
  return false;
}

async function enrichAssignees(project) {
  const codes = new Set();
  for (const t of project.projectTasks || []) {
    for (const c of t.assignedEmployeeCodes || []) codes.add(c);
  }
  const nameByCode = new Map();
  await Promise.all(
    [...codes].map(async (code) => {
      const emp = await EmployeeMasterModel.getEmployeeByCode(code);
      const name =
        String(emp?.fullName || '').trim() ||
        `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() ||
        code;
      nameByCode.set(code, name);
    }),
  );
  return {
    ...project,
    allocationValid: isAllocationValid(project.projectTasks),
    contributionTotal: Math.round(sumActiveContributions(project.projectTasks) * 100) / 100,
    projectTasks: (project.projectTasks || []).map((t) => ({
      ...t,
      assignedEmployees: (t.assignedEmployeeCodes || []).map((code) => ({
        employeeCode: code,
        employeeName: nameByCode.get(code) || code,
      })),
    })),
  };
}

export async function listManagedProjects(authUser, effectiveRole) {
  assertCanManageProjects(effectiveRole);
  const self = employeeCodeOf(authUser);
  const elevated = isSuperAdminLike(effectiveRole);
  // Prefer managed-only Query (GSI); avoids scanning legacy catalog names.
  const managed = await DailyPlannerProjectsModel.listManagedProjects();

  // Super Admin / Developer: skip team-mapping scan — they see all managed projects.
  let visible = managed;
  if (!elevated) {
    // Admin: Query manager→employee GSI only (not full mappings table scan).
    const allowed = new Set(await resolveAssignableEmployeeCodes(authUser, effectiveRole));
    visible = managed.filter((p) =>
      isProjectVisibleToViewer(p, { self, teamCodes: allowed, elevated: false }),
    );
  }

  // Skip N+1 EmployeeMaster lookups on list — UI list only needs names/counts;
  // assignee display names are loaded lazily via /assignees when editing.
  return {
    projects: visible.map((p) => ({
      ...p,
      allocationValid: isAllocationValid(p.projectTasks),
      contributionTotal: Math.round(sumActiveContributions(p.projectTasks) * 100) / 100,
    })),
  };
}

export async function getManagedProject(projectKey, authUser, effectiveRole) {
  assertCanManageProjects(effectiveRole);
  const project = await DailyPlannerProjectsModel.getProjectByKey(projectKey);
  if (!project || !project.managed || project.status === 'Inactive') {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }
  const list = await listManagedProjects(authUser, effectiveRole);
  const found = list.projects.find((p) => p.projectKey === project.projectKey);
  if (!found) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return { project: found };
}

export async function createManagedProject(body, authUser, effectiveRole) {
  assertCanManageProjects(effectiveRole);
  const { projectName, projectTasks, visibility, showInProjectProgress } =
    validateManagedPayload(body, { forCreate: true });
  const allAssignees = [
    ...new Set(projectTasks.flatMap((t) => t.assignedEmployeeCodes)),
  ];
  await assertAssigneesInScope(allAssignees, authUser, effectiveRole);

  const existing = await DailyPlannerProjectsModel.getProjectByName(projectName);
  if (existing?.managed && existing.status !== 'Inactive') {
    const err = new Error('A managed project with this name already exists');
    err.statusCode = 409;
    throw err;
  }

  const project = await DailyPlannerProjectsModel.putManagedProject({
    projectName,
    projectTasks,
    visibility: visibility || DailyPlannerProjectsModel.DEFAULT_PROJECT_VISIBILITY,
    showInProjectProgress:
      showInProjectProgress === true || showInProjectProgress === false
        ? showInProjectProgress
        : false,
    createdBy: employeeCodeOf(authUser),
    createdByName: employeeNameOf(authUser),
    status: 'Active',
  });
  return { project: await enrichAssignees(project) };
}

export async function updateManagedProject(projectKey, body, authUser, effectiveRole) {
  assertCanManageProjects(effectiveRole);
  const existing = await DailyPlannerProjectsModel.getProjectByKey(projectKey);
  if (!existing || !existing.managed) {
    const err = new Error('Managed project not found');
    err.statusCode = 404;
    throw err;
  }

  const list = await listManagedProjects(authUser, effectiveRole);
  if (!list.projects.some((p) => p.projectKey === existing.projectKey)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  const { projectName, projectTasks, visibility, showInProjectProgress } =
    validateManagedPayload(
      {
        ...body,
        projectName: body?.projectName ?? existing.projectName,
      },
      { forCreate: false },
    );
  const allAssignees = [
    ...new Set(projectTasks.flatMap((t) => t.assignedEmployeeCodes)),
  ];
  await assertAssigneesInScope(allAssignees, authUser, effectiveRole);

  // Preserve inactive historical tasks if client omitted them (soft-remove pattern).
  const incomingIds = new Set(projectTasks.map((t) => t.projectTaskId));
  const preservedInactive = (existing.projectTasks || [])
    .filter((t) => t.status === 'Inactive' && !incomingIds.has(t.projectTaskId))
    .map((t) => ({ ...t, status: 'Inactive' }));

  // Soft-deactivate tasks removed from the active payload.
  const removed = (existing.projectTasks || [])
    .filter(
      (t) =>
        t.status === 'Active' &&
        !projectTasks.some((n) => n.projectTaskId === t.projectTaskId),
    )
    .map((t) => ({ ...t, status: 'Inactive' }));

  const putPayload = {
    projectKey: existing.projectKey,
    projectName,
    projectTasks: [...projectTasks, ...removed, ...preservedInactive],
    visibility: visibility || undefined,
    createdBy: existing.createdBy,
    createdByName: existing.createdByName,
    status: body?.status === 'Inactive' ? 'Inactive' : 'Active',
  };
  if (showInProjectProgress === true || showInProjectProgress === false) {
    putPayload.showInProjectProgress = showInProjectProgress;
  }
  const project = await DailyPlannerProjectsModel.putManagedProject(putPayload);
  return { project: await enrichAssignees(project) };
}

export async function deactivateManagedProject(projectKey, authUser, effectiveRole) {
  assertCanManageProjects(effectiveRole);
  const existing = await DailyPlannerProjectsModel.getProjectByKey(projectKey);
  if (!existing || !existing.managed) {
    const err = new Error('Managed project not found');
    err.statusCode = 404;
    throw err;
  }
  const list = await listManagedProjects(authUser, effectiveRole);
  if (!list.projects.some((p) => p.projectKey === existing.projectKey)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  await DailyPlannerProjectsModel.softDeleteProject(existing.projectKey, employeeCodeOf(authUser));
  return { success: true, projectKey: existing.projectKey };
}

export async function listAssignableEmployees(authUser, effectiveRole) {
  assertCanManageProjects(effectiveRole);
  const codes = await resolveAssignableEmployeeCodes(authUser, effectiveRole);
  const employees = [];
  for (const code of codes) {
    try {
      await assertEmployeeCodeActiveToday(code);
    } catch {
      continue;
    }
    const emp = await EmployeeMasterModel.getEmployeeByCode(code);
    const name =
      String(emp?.fullName || '').trim() ||
      `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() ||
      code;
    employees.push({ employeeCode: code, employeeName: name });
  }
  employees.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  return { employees };
}

/**
 * Project / task options for Create / Extra / Edit forms (employee-scoped).
 */
export async function listProjectOptionsForEmployee(authUser, effectiveRole) {
  const self = employeeCodeOf(authUser);
  const managed = await DailyPlannerProjectsModel.listManagedProjects();
  // Legacy (non-managed) catalog names still need a full list for free-text fallbacks.
  const all = await DailyPlannerProjectsModel.listProjects();

  const viewer = await resolveVisibilityEmployeeCodes(authUser, effectiveRole);
  const options = [];
  for (const project of managed) {
    // Legacy (no stored visibility) keeps prior admin access to all managed projects.
    const legacyAdminAccess = project.visibilityImplicit && canAccessAllRecords(effectiveRole);
    if (!legacyAdminAccess && !isProjectVisibleToViewer(project, viewer)) continue;
    const activeTasks = (project.projectTasks || []).filter((t) => t.status === 'Active');
    let tasksForUser = activeTasks;
    if (!canAccessAllRecords(effectiveRole)) {
      tasksForUser = activeTasks.filter((t) =>
        (t.assignedEmployeeCodes || []).includes(self),
      );
      // Keep projects with no predefined tasks when the viewer can see the project
      // (creator / Everyone / team). Manual task-name entry is used downstream.
      if (tasksForUser.length === 0 && activeTasks.length > 0) continue;
    }
    options.push({
      projectKey: project.projectKey,
      projectName: project.projectName,
      tasks: tasksForUser.map((t) => ({
        projectTaskId: t.projectTaskId,
        taskName: t.taskName,
        contributionPercent: t.contributionPercent,
      })),
    });
  }

  // Legacy catalog names (non-managed) remain selectable as free-text fallbacks.
  const legacyNames = all
    .filter((p) => !p.managed && p.projectName)
    .map((p) => p.projectName);

  options.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return { projects: options, legacyProjectNames: legacyNames };
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

function isValidProgressSourceTask(task) {
  if (!task) return false;
  if (String(task.revisionOutcome || '').trim()) return false;
  if (String(task.status || '').trim() === 'Rescheduled') return false;
  return true;
}

/**
 * Authoritative progress for one project task across assignees:
 * per assignee take the latest progressDone (by updatedAt/createdAt), then average.
 * Task contribution is counted once regardless of assignee count.
 */
function resolveProjectTaskProgress(projectTask, allTasks) {
  const taskId = String(projectTask.projectTaskId || '').trim();
  const taskName = String(projectTask.taskName || '').trim().toLowerCase();
  const assignees = projectTask.assignedEmployeeCodes || [];
  const perEmployee = [];

  for (const code of assignees) {
    const candidates = (allTasks || []).filter((t) => {
      if (!isValidProgressSourceTask(t)) return false;
      if (String(t.employeeCode || '').trim() !== code) return false;
      const linkedId = String(t.projectTaskId || '').trim();
      if (taskId && linkedId) return linkedId === taskId;
      // Fallback for historical rows without projectTaskId: match task name + project.
      return String(t.taskName || '').trim().toLowerCase() === taskName;
    });
    const withProgress = candidates.filter(hasProgressValue);
    if (withProgress.length === 0) {
      perEmployee.push(0);
      continue;
    }
    withProgress.sort((a, b) =>
      String(b.updatedAt || b.createdAt || '').localeCompare(
        String(a.updatedAt || a.createdAt || ''),
      ),
    );
    perEmployee.push(Number(withProgress[0].progressDone));
  }

  if (perEmployee.length === 0) return 0;
  const avg = perEmployee.reduce((a, b) => a + b, 0) / perEmployee.length;
  return Math.round(avg * 100) / 100;
}

export function computeWeightedProjectProgress(project, allTasks) {
  const active = (project.projectTasks || []).filter((t) => t.status === 'Active');
  const allocationValid = isAllocationValid(active);
  if (!allocationValid || active.length === 0) {
    return {
      progressPercent: null,
      allocationValid: false,
      contributionTotal: Math.round(sumActiveContributions(active) * 100) / 100,
      tasks: active.map((t) => ({
        projectTaskId: t.projectTaskId,
        taskName: t.taskName,
        contributionPercent: t.contributionPercent,
        taskProgressPercent: resolveProjectTaskProgress(t, allTasks),
        assignedEmployeeCodes: t.assignedEmployeeCodes || [],
      })),
    };
  }

  let overall = 0;
  const tasks = active.map((t) => {
    const taskProgress = resolveProjectTaskProgress(t, allTasks);
    const contribution = Number(t.contributionPercent) || 0;
    overall += (contribution * taskProgress) / 100;
    return {
      projectTaskId: t.projectTaskId,
      taskName: t.taskName,
      contributionPercent: contribution,
      taskProgressPercent: taskProgress,
      weightedContribution: Math.round(((contribution * taskProgress) / 100) * 100) / 100,
      assignedEmployeeCodes: t.assignedEmployeeCodes || [],
    };
  });

  return {
    progressPercent: Math.round(overall * 100) / 100,
    allocationValid: true,
    contributionTotal: 100,
    tasks,
  };
}

async function resolveVisibilityEmployeeCodes(authUser, effectiveRole) {
  const self = employeeCodeOf(authUser);
  const codes = new Set([self].filter(Boolean));
  if (canAccessAllRecords(effectiveRole)) {
    if (isSuperAdminLike(effectiveRole)) {
      const mappings = await DailyPlannerTeamMappingsModel.listAllMappings();
      for (const m of mappings || []) {
        if (String(m.status || '').trim() !== 'Active') continue;
        const c = String(m.employeeCode || '').trim();
        if (c) codes.add(c);
      }
      return { self, teamCodes: codes, elevated: true };
    }
    // Admin: own team only for discovery seed.
    for (const c of await listTeamEmployeeCodes(self)) codes.add(c);
    return { self, teamCodes: codes, elevated: false };
  }
  for (const c of await listTeamEmployeeCodes(self)) codes.add(c);
  return { self, teamCodes: codes, elevated: false };
}

/**
 * Team-connected project visibility + weighted progress.
 * A manager sees a project if any team member participates; once visible,
 * all project participants (including other teams) are included.
 */
export async function getConnectedProjectProgress(authUser, effectiveRole) {
  const selfEligible = await resolveEnhancedEligibilityForAuthUser(authUser, effectiveRole);
  assertEnhancedDailyPlannerEligible(selfEligible);

  const { self, teamCodes, elevated } = await resolveVisibilityEmployeeCodes(
    authUser,
    effectiveRole,
  );
  const managed = await DailyPlannerProjectsModel.listManagedProjects();

  // Visibility: Everyone (all eligible), ProjectTeamOnly / legacy (creator, assignees, their
  // managers via team), OnlyMe (creator); Super Admin / Developer always elevated.
  // Independently: showInProjectProgress must be true for ordinary users (legacy missing → true).
  const visibleManaged = managed.filter((p) => {
    if (!isProjectVisibleToViewer(p, { self, teamCodes, elevated })) return false;
    if (elevated) return true;
    if (p.showInProjectProgress === false) return false;
    return true;
  });
  const hiddenManagedKeys = new Set(
    managed.filter((p) => !visibleManaged.includes(p)).map((p) => p.projectKey),
  );
  // Legacy catalog scan only when needed for non-managed progress rows.
  const allProjects = await DailyPlannerProjectsModel.listProjects();

  // Load DP tasks for all participants on visible projects (not only team).
  const participantCodes = new Set(teamCodes);
  for (const p of visibleManaged) {
    for (const t of p.projectTasks || []) {
      for (const c of t.assignedEmployeeCodes || []) participantCodes.add(c);
    }
  }
  const allTasks = await DailyPlannerTasksModel.listTasksForEmployees(
    [...participantCodes],
    null,
    null,
  );

  const projects = [];
  for (const project of visibleManaged) {
    const weighted = computeWeightedProjectProgress(project, allTasks);
    const nameByCode = new Map();
    const employeeProgress = new Map();

    for (const t of project.projectTasks || []) {
      if (t.status !== 'Active') continue;
      for (const code of t.assignedEmployeeCodes || []) {
        const empTasks = (allTasks || []).filter(
          (row) =>
            String(row.employeeCode || '').trim() === code &&
            isValidProgressSourceTask(row) &&
            (String(row.projectTaskId || '').trim() === t.projectTaskId ||
              (!row.projectTaskId &&
                String(row.taskName || '').trim().toLowerCase() ===
                  String(t.taskName || '').trim().toLowerCase())),
        );
        const withP = empTasks.filter(hasProgressValue);
        let pct = 0;
        if (withP.length > 0) {
          withP.sort((a, b) =>
            String(b.updatedAt || b.createdAt || '').localeCompare(
              String(a.updatedAt || a.createdAt || ''),
            ),
          );
          pct = Number(withP[0].progressDone);
          if (!nameByCode.has(code)) {
            nameByCode.set(code, String(withP[0].employeeName || code).trim());
          }
        }
        if (!employeeProgress.has(code)) {
          employeeProgress.set(code, { values: [], name: nameByCode.get(code) || code });
        }
        employeeProgress.get(code).values.push(pct);
      }
    }

    // Resolve missing names
    for (const code of employeeProgress.keys()) {
      if (nameByCode.has(code)) continue;
      const emp = await EmployeeMasterModel.getEmployeeByCode(code);
      const name =
        String(emp?.fullName || '').trim() ||
        `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() ||
        code;
      nameByCode.set(code, name);
      employeeProgress.get(code).name = name;
    }

    const employees = [...employeeProgress.entries()].map(([code, data]) => {
      const avg =
        data.values.length > 0
          ? Math.round(
              (data.values.reduce((a, b) => a + b, 0) / data.values.length) * 100,
            ) / 100
          : 0;
      return {
        employeeCode: code,
        employeeName: data.name || nameByCode.get(code) || code,
        progressPercent: avg,
      };
    });
    employees.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    projects.push({
      projectKey: project.projectKey,
      projectName: project.projectName,
      managed: true,
      allocationValid: weighted.allocationValid,
      progressPercent: weighted.progressPercent,
      contributionTotal: weighted.contributionTotal,
      employeeCount: employees.length,
      employees,
      tasks: weighted.tasks,
    });
  }

  // Legacy (non-managed) projects: keep prior average-of-averages for team-scoped tasks only.
  const { aggregateProjectProgress } = await import('./dailyPlannerEnhanced.service.js');
  const legacyTasks = (allTasks || []).filter((t) => {
    const key = DailyPlannerProjectsModel.normalizeProjectKey(t.projectName);
    if (visibleManaged.some((p) => p.projectKey === key)) return false;
    // Never leak a hidden managed project through the legacy aggregate.
    if (hiddenManagedKeys.has(key)) return false;
    if (!Boolean(t.isProjectBased)) return false;
    if (!teamCodes.has(String(t.employeeCode || '').trim()) && !elevated) {
      // Employee self-view: only own legacy tasks.
      if (!canAccessAllRecords(effectiveRole)) {
        return String(t.employeeCode || '').trim() === self;
      }
    }
    return true;
  });
  // For ordinary employees, only their own tasks for legacy.
  const legacyScopeTasks = canAccessAllRecords(effectiveRole)
    ? legacyTasks
    : legacyTasks.filter((t) => String(t.employeeCode || '').trim() === self || teamCodes.has(String(t.employeeCode || '').trim()));

  const legacyAgg = aggregateProjectProgress(legacyScopeTasks);
  for (const p of legacyAgg.projects || []) {
    projects.push({
      ...p,
      managed: false,
      allocationValid: null,
      contributionTotal: null,
      tasks: [],
    });
  }

  projects.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return { projects };
}

export async function getProjectDetails(projectKey, authUser, effectiveRole) {
  // Visibility is enforced here: getConnectedProjectProgress only returns projects the viewer may see.
  const progress = await getConnectedProjectProgress(authUser, effectiveRole);
  const project = progress.projects.find((p) => p.projectKey === projectKey);
  if (!project) {
    const err = new Error('Project not found or not visible');
    err.statusCode = 404;
    throw err;
  }

  const managed = await DailyPlannerProjectsModel.getProjectByKey(projectKey);
  const observations = await DailyPlannerProjectObservationsModel.listByProjectKey(projectKey);

  // Attach taskName from plannerTaskId or projectTask when possible.
  const participantCodes = new Set(
    (project.employees || []).map((e) => e.employeeCode).filter(Boolean),
  );
  const tasks = await DailyPlannerTasksModel.listTasksForEmployees(
    [...participantCodes],
    null,
    null,
  );
  const taskById = new Map((tasks || []).map((t) => [t.plannerTaskId, t]));

  const enrichedObs = (observations || []).map((o) => {
    const linked = taskById.get(String(o.plannerTaskId || '').trim());
    let taskName = linked ? String(linked.taskName || '').trim() : '';
    if (!taskName && managed?.projectTasks?.length) {
      const match = managed.projectTasks.find(
        (pt) =>
          String(linked?.projectTaskId || '').trim() === pt.projectTaskId ||
          String(linked?.taskName || '').trim().toLowerCase() ===
            String(pt.taskName || '').trim().toLowerCase(),
      );
      if (match) taskName = match.taskName;
    }
    return {
      ...o,
      taskName: taskName || '—',
      projectName: project.projectName,
    };
  });

  return {
    project: {
      ...project,
      projectTasks: managed?.projectTasks || project.tasks || [],
    },
    observations: enrichedObs,
  };
}

export async function addProjectObservation(projectKey, body, authUser, effectiveRole) {
  const self = employeeCodeOf(authUser);
  const details = await getProjectDetails(projectKey, authUser, effectiveRole);
  const project = details.project;
  const projectTaskId = String(body?.projectTaskId || '').trim();
  const observationText = String(body?.observationText || body?.observation || '').trim();
  if (!observationText) {
    const err = new Error('Observation text is required');
    err.statusCode = 400;
    throw err;
  }

  const managed = await DailyPlannerProjectsModel.getProjectByKey(projectKey);
  let taskName = '';
  let matchedTask = null;
  if (managed?.managed) {
    matchedTask = (managed.projectTasks || []).find(
      (t) => t.projectTaskId === projectTaskId && t.status === 'Active',
    );
    if (projectTaskId && !matchedTask) {
      const err = new Error('Selected task does not belong to this project');
      err.statusCode = 400;
      throw err;
    }
    taskName = matchedTask?.taskName || '';
    // Must be assigned or elevated.
    if (matchedTask && !canAccessAllRecords(effectiveRole)) {
      if (!(matchedTask.assignedEmployeeCodes || []).includes(self)) {
        const err = new Error('You are not assigned to this project task');
        err.statusCode = 403;
        throw err;
      }
    }
  }

  const observationId = uuidv4();
  const submittedAt = new Date().toISOString();
  const observation = await DailyPlannerProjectObservationsModel.putObservation({
    projectName: project.projectName,
    observationId,
    observationText,
    employeeCode: self,
    employeeName: employeeNameOf(authUser),
    plannerTaskId: String(body?.plannerTaskId || '').trim() || null,
    submittedAt,
  });

  return {
    observation: {
      ...observation,
      taskName: taskName || '—',
      projectName: project.projectName,
      projectTaskId: projectTaskId || null,
    },
  };
}
