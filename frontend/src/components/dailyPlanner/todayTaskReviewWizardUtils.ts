import type { DailyPlannerTask } from '../../types/dailyPlanner';
import { isUrgentTask } from '../../utils/planningRecognition';

export type WizardReviewIndicator = 'approved' | 'verified' | 'revision' | 'pending';

export type TaskOriginLabel =
  | 'Daily Planner'
  | 'Sales Forecasting'
  | 'Urgent Task'
  | 'Rescheduled';

/** Maps existing task metadata to a user-facing origin label. */
export function getTaskOriginLabel(task: DailyPlannerTask): TaskOriginLabel {
  const source = String(task.source || '').trim().toUpperCase();

  if (
    source === 'RESCHEDULED' ||
    Boolean(String(task.rescheduledFrom || '').trim()) ||
    Boolean(String(task.rescheduledFromDate || '').trim())
  ) {
    return 'Rescheduled';
  }

  if (source === 'SALES_FORECASTING' || task.taskType === 'Sales Visit') {
    return 'Sales Forecasting';
  }

  if (isUrgentTask(task.planningCategory)) {
    return 'Urgent Task';
  }

  return 'Daily Planner';
}

export function getWizardReviewIndicator(task: DailyPlannerTask): WizardReviewIndicator {
  if (task.status === 'Verified Complete' || task.verificationStatus === 'VERIFIED') {
    return 'verified';
  }
  if (task.status === 'Needs Revision') {
    return 'revision';
  }
  if (
    task.status === 'Approved' ||
    task.approvalStatus === 'APPROVED' ||
    task.approved
  ) {
    return 'approved';
  }
  return 'pending';
}

/** True when the manager has recorded Approve, Verify, or Request Revision for this task. */
export function isTaskManagerReviewed(task: DailyPlannerTask): boolean {
  const indicator = getWizardReviewIndicator(task);
  if (indicator !== 'pending') return true;

  if (task.status === 'Awaiting Verification' || task.status === 'Completed') {
    return false;
  }

  if (
    task.status === 'Rescheduled' ||
    task.status === 'Terminated' ||
    task.status === 'Not Completed' ||
    task.status === 'Rejected'
  ) {
    return true;
  }

  return false;
}

export function countReviewedTasks(tasks: DailyPlannerTask[]): number {
  return tasks.filter(isTaskManagerReviewed).length;
}

export function formatReviewDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function getPreviousRevisionCount(task: DailyPlannerTask): number {
  return task.parentTaskId ? 1 : 0;
}

export function getCompletionTime(task: DailyPlannerTask): string | null {
  if (
    task.status === 'Awaiting Verification' ||
    task.status === 'Completed' ||
    task.status === 'Verified Complete'
  ) {
    return task.updatedAt || null;
  }
  return null;
}
