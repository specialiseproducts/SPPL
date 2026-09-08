import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { DailyPlannerTask } from '../../types/dailyPlanner';
import { dailyPlannerQueryKeys } from './dailyPlannerQueryKeys';

const TASK_LIST_QUERY_KINDS = new Set(['month', 'day', 'team', 'teamMonth']);

function isTaskListQueryKey(queryKey: QueryKey): boolean {
  if (!Array.isArray(queryKey) || queryKey[0] !== 'dailyPlanner') return false;
  return TASK_LIST_QUERY_KINDS.has(String(queryKey[1] || ''));
}

/** Arrays of planner tasks only (never pending-approval or dashboard shapes). */
function isTaskList(data: unknown): data is DailyPlannerTask[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true;
  const first = data[0] as Record<string, unknown> | null;
  return Boolean(first && typeof first === 'object' && first.plannerTaskId);
}

function upsertIntoList(list: DailyPlannerTask[], incoming: DailyPlannerTask[]): DailyPlannerTask[] {
  const next = new Map(list.map((task) => [task.plannerTaskId, task]));
  for (const task of incoming) {
    if (!task?.plannerTaskId) continue;
    next.set(task.plannerTaskId, task);
  }
  return Array.from(next.values());
}

function patchTaskLists(
  queryClient: QueryClient,
  updater: (list: DailyPlannerTask[]) => DailyPlannerTask[],
) {
  const entries = queryClient.getQueriesData({ queryKey: dailyPlannerQueryKeys.all });
  for (const [queryKey, data] of entries) {
    if (!isTaskListQueryKey(queryKey)) continue;
    if (!isTaskList(data)) continue;
    queryClient.setQueryData(queryKey, updater(data));
  }
}

export function upsertPlannerTasksInCache(
  queryClient: QueryClient,
  tasks: DailyPlannerTask[],
) {
  if (tasks.length === 0) return;
  patchTaskLists(queryClient, (list) => upsertIntoList(list, tasks));
}

/**
 * Replace all cached tasks for one employee+date with the authoritative list
 * (e.g. after Finalize Plan). Prevents stale draft/orphan tasks from remaining.
 */
export function replacePlannerDayTasksInCache(
  queryClient: QueryClient,
  employeeCode: string,
  date: string,
  tasks: DailyPlannerTask[],
) {
  const code = String(employeeCode || '').trim();
  const day = String(date || '').trim().slice(0, 10);
  if (!code || !day) return;
  patchTaskLists(queryClient, (list) => {
    const kept = list.filter(
      (task) =>
        !(
          String(task.employeeCode || '').trim() === code &&
          String(task.date || '').trim().slice(0, 10) === day
        ),
    );
    return [...kept, ...tasks];
  });
}

export function removePlannerTasksFromCache(queryClient: QueryClient, taskIds: string[]) {
  const ids = new Set(taskIds.filter(Boolean));
  if (ids.size === 0) return;
  patchTaskLists(queryClient, (list) => list.filter((task) => !ids.has(task.plannerTaskId)));
}

export function markRevisionParentHandledInCache(
  queryClient: QueryClient,
  parentTaskId: string,
  outcome: NonNullable<DailyPlannerTask['revisionOutcome']>,
  revisedTaskId?: string,
) {
  const id = String(parentTaskId || '').trim();
  if (!id) return;
  patchTaskLists(queryClient, (list) =>
    list.map((task) =>
      task.plannerTaskId === id
        ? {
            ...task,
            revisionOutcome: outcome,
            revisionHandledAt: new Date().toISOString(),
            revisedTaskId: revisedTaskId || task.revisedTaskId || null,
          }
        : task,
    ),
  );
}
