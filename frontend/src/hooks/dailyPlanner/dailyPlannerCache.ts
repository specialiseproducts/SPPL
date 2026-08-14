import type { QueryClient } from '@tanstack/react-query';
import type { DailyPlannerTask } from '../../types/dailyPlanner';
import { dailyPlannerQueryKeys } from './dailyPlannerQueryKeys';

function isTaskList(data: unknown): data is DailyPlannerTask[] {
  return Array.isArray(data);
}

function upsertIntoList(list: DailyPlannerTask[], incoming: DailyPlannerTask[]): DailyPlannerTask[] {
  const next = new Map(list.map((task) => [task.plannerTaskId, task]));
  for (const task of incoming) {
    next.set(task.plannerTaskId, task);
  }
  return Array.from(next.values());
}

function patchTaskLists(
  queryClient: QueryClient,
  updater: (list: DailyPlannerTask[]) => DailyPlannerTask[],
) {
  queryClient.setQueriesData({ queryKey: dailyPlannerQueryKeys.all }, (current) => {
    if (!isTaskList(current)) return current;
    return updater(current);
  });
}

export function upsertPlannerTasksInCache(
  queryClient: QueryClient,
  tasks: DailyPlannerTask[],
) {
  if (tasks.length === 0) return;
  patchTaskLists(queryClient, (list) => upsertIntoList(list, tasks));
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
