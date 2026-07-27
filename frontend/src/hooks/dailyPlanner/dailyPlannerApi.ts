import type {
  DailyPlannerTask,
  DailyPlannerTaskDraft,
  DailyPlannerTeamMapping,
  DailyPlannerNotCompletedAction,
} from '../../types/dailyPlanner';
import { apiFetch } from '../../services/api';
import {
  assertCanCompleteTasks,
  assertCanMarkNotCompleted,
  assertCanPlanTasks,
} from '../../components/dailyPlanner/dailyPlannerDateRules';
import type { PlanningConfig } from '../../utils/planningRecognition';
import {
  assertCanCreateRegularTask,
  assertCanCreateUrgentTask,
  assertCanUpdateTasksOnDate,
  isUrgentTask,
  PLANNING_CATEGORY_REGULAR,
} from '../../utils/planningRecognition';

function normalizeTask(raw: DailyPlannerTask | Record<string, unknown>): DailyPlannerTask {
  const r = raw as Record<string, unknown>;
  const priority = String(r.currentPriority || r.priority || 'Medium').trim() as DailyPlannerTask['priority'];
  const replacementRaw =
    r.replacementTask && typeof r.replacementTask === 'object'
      ? (r.replacementTask as Record<string, unknown>)
      : null;
  return {
    ...(raw as DailyPlannerTask),
    plannerTaskId: String(r.plannerTaskId ?? '').trim(),
    employeeCode: String(r.employeeCode ?? '').trim(),
    employeeName: String(r.employeeName ?? '').trim(),
    date: String(r.date ?? '').trim(),
    taskName: String(r.taskName ?? '').trim(),
    description: String(r.description ?? '').trim(),
    priority,
    originalPriority: String(r.originalPriority || priority).trim() as DailyPlannerTask['priority'],
    currentPriority: priority,
    priorityEdited: Boolean(r.priorityEdited),
    priorityEditedBy: String(r.priorityEditedBy ?? '').trim(),
    priorityEditedByName: String(r.priorityEditedByName ?? '').trim(),
    priorityEditedAt: r.priorityEditedAt ? String(r.priorityEditedAt) : null,
    status: String(r.status ?? 'Pending').trim() as DailyPlannerTask['status'],
    reason: String(r.reason ?? '').trim(),
    taskType: String(r.taskType ?? 'Manual').trim() as DailyPlannerTask['taskType'],
    source: String(r.source ?? 'MANUAL').trim() as DailyPlannerTask['source'],
    salesPlannerId: r.salesPlannerId ? String(r.salesPlannerId).trim() : null,
    approved: Boolean(r.approved),
    approvalStatus: String(r.approvalStatus ?? '').trim(),
    approvedBy: String(r.approvedBy ?? '').trim(),
    approvedByName: String(r.approvedByName ?? '').trim(),
    approvedDate: r.approvedDate ? String(r.approvedDate) : r.approvedAt ? String(r.approvedAt) : null,
    approvedAt: r.approvedAt ? String(r.approvedAt) : r.approvedDate ? String(r.approvedDate) : null,
    managerComments: String(r.managerComments ?? '').trim(),
    verifiedBy: String(r.verifiedBy ?? '').trim(),
    verifiedByName: String(r.verifiedByName ?? '').trim(),
    verifiedAt: r.verifiedAt ? String(r.verifiedAt) : null,
    verificationStatus: String(r.verificationStatus ?? '').trim(),
    revisionReason: String(r.revisionReason ?? '').trim(),
    revisionRequestedBy: String(r.revisionRequestedBy ?? '').trim(),
    revisionRequestedByName: String(r.revisionRequestedByName ?? '').trim(),
    revisionRequestedAt: r.revisionRequestedAt ? String(r.revisionRequestedAt) : null,
    replacementTask: replacementRaw
      ? {
          taskName: String(replacementRaw.taskName ?? '').trim(),
          description: String(replacementRaw.description ?? '').trim(),
          priority: String(replacementRaw.priority || 'Medium').trim() as DailyPlannerTask['priority'],
          expectedOutcome: String(replacementRaw.expectedOutcome ?? '').trim(),
        }
      : null,
    planningCategory: (String(r.planningCategory || PLANNING_CATEGORY_REGULAR).trim() ||
      PLANNING_CATEGORY_REGULAR) as DailyPlannerTask['planningCategory'],
    urgentReason: String(r.urgentReason ?? '').trim(),
    planningWindowUsed: (r.planningWindowUsed
      ? String(r.planningWindowUsed).trim()
      : null) as DailyPlannerTask['planningWindowUsed'],
    planningTimestamp: r.planningTimestamp ? String(r.planningTimestamp) : null,
    originalDate: r.originalDate ? String(r.originalDate).trim() : null,
    rescheduledFrom: r.rescheduledFrom ? String(r.rescheduledFrom).trim() : null,
    rescheduledToDate: r.rescheduledToDate ? String(r.rescheduledToDate).trim() : null,
    rescheduledFromDate: r.rescheduledFromDate ? String(r.rescheduledFromDate).trim() : null,
    rescheduledBy: String(r.rescheduledBy ?? '').trim(),
    rescheduledByName: String(r.rescheduledByName ?? '').trim(),
    rescheduledAt: r.rescheduledAt ? String(r.rescheduledAt) : null,
    terminatedBy: String(r.terminatedBy ?? '').trim(),
    terminatedByName: String(r.terminatedByName ?? '').trim(),
    terminatedAt: r.terminatedAt ? String(r.terminatedAt) : null,
    parentTaskId: r.parentTaskId ? String(r.parentTaskId).trim() : null,
    planningScore: Number(r.planningScore) || 0,
    completionScore: Number(r.completionScore) || 0,
    finalScore: Number(r.finalScore) || 0,
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
    updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
  };
}

export async function fetchDailyPlannerMonth(
  year: number,
  month: number,
): Promise<DailyPlannerTask[]> {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  const res = (await apiFetch(`/api/daily-planner/tasks/month?${params}`)) as {
    data?: { tasks?: DailyPlannerTask[] };
  };
  return (res?.data?.tasks ?? []).map(normalizeTask);
}

export async function fetchDailyPlannerDay(date: string): Promise<DailyPlannerTask[]> {
  const params = new URLSearchParams({ date });
  const res = (await apiFetch(`/api/daily-planner/tasks/day?${params}`)) as {
    data?: { tasks?: DailyPlannerTask[] };
  };
  return (res?.data?.tasks ?? []).map(normalizeTask);
}

export async function createDailyPlannerTask(
  draft: DailyPlannerTaskDraft,
  planningConfig?: PlanningConfig,
): Promise<DailyPlannerTask> {
  const category = draft.planningCategory || PLANNING_CATEGORY_REGULAR;
  if (planningConfig) {
    if (isUrgentTask(category)) {
      assertCanCreateUrgentTask(draft.date, planningConfig);
      if (!String(draft.urgentReason || '').trim()) {
        throw new Error('Urgent Task Reason is required.');
      }
    } else {
      assertCanCreateRegularTask(draft.date, planningConfig);
    }
  } else {
    assertCanPlanTasks(draft.date);
  }

  const res = (await apiFetch('/api/daily-planner/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...draft,
      planningCategory: category,
      urgentReason: draft.urgentReason || '',
    }),
  })) as { data?: { task?: DailyPlannerTask } };
  if (!res?.data?.task) throw new Error('Create failed');
  return normalizeTask(res.data.task);
}

/** Save multiple tasks in one user operation (parallel creates, single refresh in caller). */
export async function createDailyPlannerTasks(
  drafts: DailyPlannerTaskDraft[],
  planningConfig?: PlanningConfig,
): Promise<DailyPlannerTask[]> {
  if (drafts.length === 0) {
    throw new Error('At least one task is required');
  }
  const sharedDate = drafts[0].date;
  if (planningConfig) {
    for (const draft of drafts) {
      const category = draft.planningCategory || PLANNING_CATEGORY_REGULAR;
      if (isUrgentTask(category)) {
        assertCanCreateUrgentTask(draft.date, planningConfig);
      } else {
        assertCanCreateRegularTask(draft.date, planningConfig);
      }
    }
  } else {
    assertCanPlanTasks(sharedDate);
  }
  if (drafts.some((d) => d.date !== sharedDate)) {
    throw new Error('All tasks must use the same date');
  }
  return Promise.all(drafts.map((draft) => createDailyPlannerTask(draft, planningConfig)));
}

export async function completeDailyPlannerTask(
  taskId: string,
  workDone: string,
  taskDate: string,
  planningConfig?: PlanningConfig,
): Promise<DailyPlannerTask> {
  assertCanCompleteTasks(taskDate);
  if (planningConfig) {
    assertCanUpdateTasksOnDate(taskDate, planningConfig);
  }
  const res = (await apiFetch(`/api/daily-planner/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workDone }),
  })) as { data?: { task?: DailyPlannerTask } };
  if (!res?.data?.task) throw new Error('Update failed');
  return normalizeTask(res.data.task);
}

export interface DailyPlannerNotCompletedPayload {
  reason: string;
  action: DailyPlannerNotCompletedAction;
  newDate?: string;
}

export interface DailyPlannerNotCompletedResult {
  task: DailyPlannerTask;
  rescheduledTask?: DailyPlannerTask;
}

export async function notCompletedDailyPlannerTask(
  taskId: string,
  payload: DailyPlannerNotCompletedPayload,
  taskDate: string,
  planningConfig?: PlanningConfig,
): Promise<DailyPlannerNotCompletedResult> {
  assertCanMarkNotCompleted(taskDate);
  if (planningConfig) {
    assertCanUpdateTasksOnDate(taskDate, planningConfig);
  }
  const res = (await apiFetch(
    `/api/daily-planner/tasks/${encodeURIComponent(taskId)}/not-completed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )) as { data?: { task?: DailyPlannerTask; rescheduledTask?: DailyPlannerTask } };
  if (!res?.data?.task) throw new Error('Update failed');
  return {
    task: normalizeTask(res.data.task),
    rescheduledTask: res.data.rescheduledTask
      ? normalizeTask(res.data.rescheduledTask)
      : undefined,
  };
}

export async function fetchTeamDailyPlannerTasks(filters: {
  employeeCode?: string;
  date?: string;
  priority?: string;
  status?: string;
  taskType?: string;
}): Promise<DailyPlannerTask[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  const res = (await apiFetch(`/api/daily-planner/tasks/team?${params}`)) as {
    data?: { tasks?: DailyPlannerTask[] };
  };
  return (res?.data?.tasks ?? []).map(normalizeTask);
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toUtcMonthIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isCurrentUtcMonth(year: number, month: number): boolean {
  const now = new Date();
  return now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month;
}

/** Full team month via existing team endpoint (no backend changes). */
export async function fetchTeamDailyPlannerMonth(
  year: number,
  month: number,
  employeeCode = '',
): Promise<DailyPlannerTask[]> {
  const baseFilters = {
    employeeCode,
    priority: '',
    status: '',
    taskType: '',
  };

  if (isCurrentUtcMonth(year, month)) {
    return fetchTeamDailyPlannerTasks({ ...baseFilters, date: '' });
  }

  const dayCount = daysInUtcMonth(year, month);
  const batches = await Promise.all(
    Array.from({ length: dayCount }, (_, index) =>
      fetchTeamDailyPlannerTasks({
        ...baseFilters,
        date: toUtcMonthIso(year, month, index + 1),
      }),
    ),
  );

  const byId = new Map<string, DailyPlannerTask>();
  for (const list of batches) {
    for (const task of list) {
      byId.set(task.plannerTaskId, task);
    }
  }
  return Array.from(byId.values());
}

export async function approveDailyPlannerTask(
  taskId: string,
  options?: { comments?: string; priority?: string },
): Promise<DailyPlannerTask> {
  const res = (await apiFetch(`/api/daily-planner/tasks/${encodeURIComponent(taskId)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      comments: options?.comments || '',
      ...(options?.priority ? { priority: options.priority } : {}),
    }),
  })) as { data?: { task?: DailyPlannerTask } };
  if (!res?.data?.task) throw new Error('Approve failed');
  return normalizeTask(res.data.task);
}

export async function rejectDailyPlannerTask(
  taskId: string,
  comments?: string,
): Promise<DailyPlannerTask> {
  const res = (await apiFetch(`/api/daily-planner/tasks/${encodeURIComponent(taskId)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comments: comments || '', reason: comments || '' }),
  })) as { data?: { task?: DailyPlannerTask } };
  if (!res?.data?.task) throw new Error('Needs revision request failed');
  return normalizeTask(res.data.task);
}

export async function requestNeedsRevisionDailyPlannerTask(
  taskId: string,
  body: {
    reason: string;
    replacementTask: {
      taskName: string;
      description: string;
      priority: string;
      expectedOutcome?: string;
    };
  },
): Promise<DailyPlannerTask> {
  const res = (await apiFetch(
    `/api/daily-planner/tasks/${encodeURIComponent(taskId)}/needs-revision`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )) as { data?: { task?: DailyPlannerTask } };
  if (!res?.data?.task) throw new Error('Needs revision request failed');
  return normalizeTask(res.data.task);
}

export async function verifyDailyPlannerCompletion(
  taskId: string,
  comments?: string,
): Promise<DailyPlannerTask> {
  const res = (await apiFetch(
    `/api/daily-planner/tasks/${encodeURIComponent(taskId)}/verify-completion`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments: comments || '' }),
    },
  )) as { data?: { task?: DailyPlannerTask } };
  if (!res?.data?.task) throw new Error('Verify completion failed');
  return normalizeTask(res.data.task);
}

export async function acceptDailyPlannerRevision(
  taskId: string,
): Promise<{ task: DailyPlannerTask; revisedTask: DailyPlannerTask }> {
  const res = (await apiFetch(
    `/api/daily-planner/tasks/${encodeURIComponent(taskId)}/accept-revision`,
    { method: 'POST' },
  )) as { data?: { task?: DailyPlannerTask; revisedTask?: DailyPlannerTask } };
  if (!res?.data?.task || !res?.data?.revisedTask) {
    throw new Error('Accept revision failed');
  }
  return {
    task: normalizeTask(res.data.task),
    revisedTask: normalizeTask(res.data.revisedTask),
  };
}

export async function editDailyPlannerPriority(
  taskId: string,
  priority: string,
  comments?: string,
): Promise<DailyPlannerTask> {
  const res = (await apiFetch(`/api/daily-planner/tasks/${encodeURIComponent(taskId)}/priority`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priority, comments: comments || '' }),
  })) as { data?: { task?: DailyPlannerTask } };
  if (!res?.data?.task) throw new Error('Priority update failed');
  return normalizeTask(res.data.task);
}

export async function fetchTeamMappings(): Promise<DailyPlannerTeamMapping[]> {
  const res = (await apiFetch('/api/daily-planner/team-mappings')) as {
    data?: { mappings?: DailyPlannerTeamMapping[] };
  };
  return res?.data?.mappings ?? [];
}

export async function assignTeamMapping(body: {
  managerCode: string;
  managerName: string;
  employeeCode: string;
  employeeName: string;
}): Promise<DailyPlannerTeamMapping> {
  const res = (await apiFetch('/api/daily-planner/team-mappings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })) as { data?: { mapping?: DailyPlannerTeamMapping } };
  if (!res?.data?.mapping) throw new Error('Assign failed');
  return res.data.mapping;
}

export async function removeTeamMapping(mappingId: string): Promise<void> {
  await apiFetch(`/api/daily-planner/team-mappings/${encodeURIComponent(mappingId)}`, {
    method: 'DELETE',
  });
}

export async function transferTeamMapping(
  mappingId: string,
  managerCode: string,
  managerName: string,
): Promise<DailyPlannerTeamMapping> {
  const res = (await apiFetch(
    `/api/daily-planner/team-mappings/${encodeURIComponent(mappingId)}/transfer`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerCode, managerName }),
    },
  )) as { data?: { mapping?: DailyPlannerTeamMapping } };
  if (!res?.data?.mapping) throw new Error('Transfer failed');
  return res.data.mapping;
}
