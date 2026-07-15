import { todayIso } from './dailyPlannerUtils';

export type DailyPlannerDateMode = 'past' | 'today' | 'future';

export const PAST_DATE_READONLY_MESSAGE =
  'This date is in the past. Tasks can no longer be modified.';

export const FUTURE_COMPLETION_BLOCKED_MESSAGE =
  'Completion actions are only available on the task date.';

/** Compare planner date (YYYY-MM-DD) with the current system date. */
export function getDailyPlannerDateMode(
  dateIso: string,
  now: Date = new Date(),
): DailyPlannerDateMode {
  const today = todayIso(now);
  const normalized = String(dateIso ?? '').trim();
  if (!normalized) return 'today';
  if (normalized < today) return 'past';
  if (normalized > today) return 'future';
  return 'today';
}

export function canPlanTasksOnDate(dateIso: string, now?: Date): boolean {
  const mode = getDailyPlannerDateMode(dateIso, now);
  return mode === 'today' || mode === 'future';
}

export function canCompleteTasksOnDate(dateIso: string, now?: Date): boolean {
  return getDailyPlannerDateMode(dateIso, now) === 'today';
}

export function assertCanPlanTasks(dateIso: string, now?: Date): void {
  if (!canPlanTasksOnDate(dateIso, now)) {
    throw new Error(PAST_DATE_READONLY_MESSAGE);
  }
}

export function assertCanCompleteTasks(dateIso: string, now?: Date): void {
  const mode = getDailyPlannerDateMode(dateIso, now);
  if (mode === 'past') {
    throw new Error(PAST_DATE_READONLY_MESSAGE);
  }
  if (mode === 'future') {
    throw new Error(FUTURE_COMPLETION_BLOCKED_MESSAGE);
  }
}

export function assertCanMarkNotCompleted(dateIso: string, now?: Date): void {
  assertCanCompleteTasks(dateIso, now);
}
