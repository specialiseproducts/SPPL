import { useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import type { DailyPlannerNotCompletedAction, DailyPlannerTask } from '../../types/dailyPlanner';
import type { PlanningConfig } from '../../utils/planningRecognition';
import { canUpdateTasksOnDate, TASK_UPDATES_READONLY_MESSAGE } from '../../utils/planningRecognition';
import { getDailyTaskChipStyle, getDailyTaskStatusLabel, getDailyTaskVisualKey, isPermanentlyClosedTask, isRescheduledTask, visibleEmployeePlannerTasks } from './dailyPlannerUtils';
import {
  canCompleteTasksOnDate,
  canPlanTasksOnDate,
  FUTURE_COMPLETION_BLOCKED_MESSAGE,
  getDailyPlannerDateMode,
  PAST_DATE_READONLY_MESSAGE,
} from './dailyPlannerDateRules';
import {
  acceptDailyPlannerRevision,
  completeDailyPlannerTask,
  notCompletedDailyPlannerTask,
  submitDayCompletion,
} from '../../hooks/dailyPlanner/dailyPlannerApi';
import BulletPointEditor, { type BulletPointEditorHandle } from './BulletPointEditor';
import BulletPointList from './BulletPointList';
import { parseBulletPoints } from './bulletPointUtils';
import { isCompanyHoliday } from '../../utils/companyWorkingDays';
import { todayIso } from './dailyPlannerUtils';
import { useAuth } from '../../context/AuthContext';
import { hasEmployeeCompletionOutcome } from './todayTaskReviewWizardUtils';

/** Display-only message for the day-tasks modal (does not change global planning rules). */
const DAY_TASK_UPDATES_READONLY_DISPLAY_MESSAGE =
  'Task updates are only allowed during the planning windows (05:30 PM–08:00 PM).';

interface DailyPlannerDayTasksModalProps {
  open: boolean;
  date: string;
  tasks: DailyPlannerTask[];
  planningConfig?: PlanningConfig | null;
  onClose: () => void;
  onChanged: (patch?: {
    upsert?: DailyPlannerTask[];
    removeIds?: string[];
    hideRevisionParentId?: string;
  }) => void;
  onAddTask: (revisesTaskId?: string) => void;
  onViewFinalPlan?: () => void;
}

export default function DailyPlannerDayTasksModal({
  open,
  date,
  tasks,
  planningConfig,
  onClose,
  onChanged,
  onAddTask,
  onViewFinalPlan,
}: DailyPlannerDayTasksModalProps) {
  const { user } = useAuth();
  const employeeLocation = user?.location || 'Office';
  const visibleTasks = useMemo(() => visibleEmployeePlannerTasks(tasks), [tasks]);
  const [reasonTaskId, setReasonTaskId] = useState<string | null>(null);
  const [notCompletedAction, setNotCompletedAction] = useState<DailyPlannerNotCompletedAction>('terminate');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [completeTaskId, setCompleteTaskId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submittingDay, setSubmittingDay] = useState(false);
  const workDoneEditorRef = useRef<BulletPointEditorHandle>(null);
  const reasonEditorRef = useRef<BulletPointEditorHandle>(null);

  const dateMode = useMemo(() => getDailyPlannerDateMode(date), [date]);
  const isPastDate = dateMode === 'past';
  const canPlan = canPlanTasksOnDate(date);
  const canCompleteByDate = canCompleteTasksOnDate(date);
  const canModifyTasks = useMemo(
    () => canCompleteByDate && canUpdateTasksOnDate(date, planningConfig),
    [canCompleteByDate, date, planningConfig],
  );
  const isReadOnlyWindow = canCompleteByDate && !canModifyTasks;

  const allHaveCompletionOutcomes =
    visibleTasks.length > 0 && visibleTasks.every(hasEmployeeCompletionOutcome);
  const completionAlreadySubmitted = visibleTasks.some((t) => Boolean(t.dayCompletionSubmittedAt));
  const canSubmitDayCompletion =
    canCompleteByDate &&
    allHaveCompletionOutcomes &&
    !completionAlreadySubmitted &&
    !submittingDay;

  const handleSubmitDayCompletion = async () => {
    if (!canSubmitDayCompletion) {
      if (!allHaveCompletionOutcomes) {
        toast.error(
          'Mark every task as Completed, Not Completed, or Rescheduled before submitting.',
        );
      }
      return;
    }
    setSubmittingDay(true);
    try {
      const updated = await submitDayCompletion(date);
      toast.success('Completion submitted for manager review');
      onChanged({ upsert: updated });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmittingDay(false);
    }
  };

  const submitCompleted = async () => {
    if (!completeTaskId || !canModifyTasks) {
      toast.error(
        isReadOnlyWindow
          ? TASK_UPDATES_READONLY_MESSAGE
          : isPastDate
            ? PAST_DATE_READONLY_MESSAGE
            : FUTURE_COMPLETION_BLOCKED_MESSAGE,
      );
      return;
    }
    const task = tasks.find((t) => t.plannerTaskId === completeTaskId);
    if (task && isRescheduledTask(task)) {
      toast.error('This task has been rescheduled and cannot be marked complete or incomplete.');
      setCompleteTaskId(null);
      return;
    }
    const editor = workDoneEditorRef.current;
    if (!editor?.hasContent()) {
      toast.error('Work done is required');
      return;
    }
    const workDone = editor.getFormattedValue();
    setBusyId(completeTaskId);
    try {
      const result = await completeDailyPlannerTask(
        completeTaskId,
        workDone,
        task?.date ?? date,
        planningConfig ?? undefined,
      );
      setCompleteTaskId(null);
      onChanged({
        upsert: [result.task],
        removeIds: result.cancelledRescheduledTaskIds,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const minRescheduleDate = planningConfig?.todayIst ?? todayIso();

  const resetNotCompletedDialog = () => {
    setReasonTaskId(null);
    setNotCompletedAction('terminate');
    setRescheduleDate('');
  };

  const submitNotCompleted = async () => {
    if (!reasonTaskId || !canModifyTasks) {
      toast.error(
        isReadOnlyWindow
          ? TASK_UPDATES_READONLY_MESSAGE
          : isPastDate
            ? PAST_DATE_READONLY_MESSAGE
            : FUTURE_COMPLETION_BLOCKED_MESSAGE,
      );
      return;
    }
    const task = tasks.find((t) => t.plannerTaskId === reasonTaskId);
    if (task && isRescheduledTask(task)) {
      toast.error('This task has been rescheduled and cannot be marked complete or incomplete.');
      resetNotCompletedDialog();
      return;
    }
    const editor = reasonEditorRef.current;
    if (!editor?.hasContent()) {
      toast.error('Reason is required');
      return;
    }
    if (notCompletedAction === 'next_date') {
      const nextDate = rescheduleDate.trim();
      if (!nextDate) {
        toast.error('New date is required');
        return;
      }
      if (nextDate < minRescheduleDate) {
        toast.error('Past dates are not allowed');
        return;
      }
      if (isCompanyHoliday(nextDate, employeeLocation)) {
        toast.error('Selected date must be a working day');
        return;
      }
      if (nextDate === (task?.date ?? date)) {
        toast.error('New date must be different from the current task date');
        return;
      }
    }

    const reason = editor.getFormattedValue();
    setBusyId(reasonTaskId);
    try {
      const result = await notCompletedDailyPlannerTask(
        reasonTaskId,
        {
          reason,
          action: notCompletedAction,
          newDate: notCompletedAction === 'next_date' ? rescheduleDate.trim() : undefined,
        },
        task?.date ?? date,
        planningConfig ?? undefined,
      );
      resetNotCompletedDialog();
      onChanged({
        upsert: [result.task, ...(result.rescheduledTask ? [result.rescheduledTask] : [])],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const acceptSuggestion = async (task: DailyPlannerTask) => {
    setBusyId(task.plannerTaskId);
    try {
      const result = await acceptDailyPlannerRevision(task.plannerTaskId);
      toast.success('Manager suggestion accepted');
      onChanged({
        upsert: [result.task, result.revisedTask],
        hideRevisionParentId: task.plannerTaskId,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Accept revision failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="!flex !h-[90vh] !max-h-[90vh] !w-[min(92vw,42rem)] !max-w-2xl !flex-col gap-0 overflow-hidden !p-0 sm:!max-w-2xl"
          style={{ height: '90vh', maxHeight: '90vh' }}
        >
          <DialogHeader className="shrink-0 border-b border-gray-200 px-6 py-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
              <DialogTitle>Tasks for {date}</DialogTitle>
              {onViewFinalPlan && visibleTasks.some((t) => Boolean(t.planFinalizedAt)) ? (
                <Button type="button" variant="outline" size="sm" onClick={onViewFinalPlan}>
                  View Final Plan
                </Button>
              ) : null}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-smooth overscroll-contain px-6 py-4">
            {isPastDate ? (
              <div className="mb-4 space-y-1.5">
                <Badge variant="secondary" className="font-normal">
                  History (Read Only)
                </Badge>
                <p className="text-xs text-muted-foreground">{PAST_DATE_READONLY_MESSAGE}</p>
              </div>
            ) : isReadOnlyWindow ? (
              <div className="mb-4 space-y-1.5">
                <Badge variant="secondary" className="font-normal">
                  Read Only
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {DAY_TASK_UPDATES_READONLY_DISPLAY_MESSAGE}
                </p>
              </div>
            ) : null}
            <div className="space-y-3">
              {visibleTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks for this date.</p>
              ) : (
                visibleTasks.map((task) => {
                  const isClosed = isPermanentlyClosedTask(task);
                  const showCompletionCheckbox = !isRescheduledTask(task);
                  return (
                  <div key={task.plannerTaskId} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start gap-3">
                      {showCompletionCheckbox ? (
                      <Checkbox
                        checked={
                          task.status === 'Awaiting Verification' ||
                          task.status === 'Completed' ||
                          task.status === 'Verified Complete'
                        }
                        disabled={
                          !canModifyTasks ||
                          busyId === task.plannerTaskId ||
                          task.status === 'Awaiting Verification' ||
                          task.status === 'Completed' ||
                          task.status === 'Verified Complete' ||
                          isClosed
                        }
                        onCheckedChange={(v) => {
                          if (!canModifyTasks) {
                            if (isReadOnlyWindow) {
                              toast.error(TASK_UPDATES_READONLY_MESSAGE);
                            }
                            return;
                          }
                          if (
                            v === true &&
                            task.status !== 'Awaiting Verification' &&
                            task.status !== 'Completed' &&
                            task.status !== 'Verified Complete'
                          ) {
                            setCompleteTaskId(task.plannerTaskId);
                          }
                        }}
                      />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div
                          style={getDailyTaskChipStyle(getDailyTaskVisualKey(task))}
                          className="mb-2 w-fit max-w-full px-2"
                        >
                          {task.taskName}
                        </div>
                        {task.description ? (
                          <div className="text-xs text-gray-600">
                            <BulletPointList text={task.description} />
                          </div>
                        ) : (
                          <p className="text-xs text-gray-600">—</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          {task.taskType} · {task.currentPriority} · {getDailyTaskStatusLabel(task.status)}
                          {task.priorityEdited && task.approvedByName
                            ? ` · Approved by ${task.approvedByName}`
                            : ''}
                        </p>
                        {canModifyTasks &&
                        task.status !== 'Awaiting Verification' &&
                        task.status !== 'Completed' &&
                        task.status !== 'Verified Complete' &&
                        task.status !== 'Not Completed' &&
                        !(task.status === 'Needs Revision' && !task.revisionOutcome) &&
                        task.status !== 'Terminated' &&
                        task.status !== 'Rescheduled' ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            disabled={busyId === task.plannerTaskId}
                            onClick={() => setReasonTaskId(task.plannerTaskId)}
                          >
                            Mark Not Completed
                          </Button>
                        ) : null}
                        {(task.status === 'Awaiting Verification' ||
                          task.status === 'Completed' ||
                          task.status === 'Verified Complete') &&
                        task.reason ? (
                          <div className="mt-2 text-xs">
                            <p className="font-medium text-green-700">
                              {task.status === 'Awaiting Verification'
                                ? 'Work Done (Awaiting Verification)'
                                : 'Work Done'}
                            </p>
                            <BulletPointList text={task.reason} />
                          </div>
                        ) : null}
                        {task.managerComments ? (
                          <div className="mt-2 text-xs">
                            <p className="font-medium">Manager Comments</p>
                            <BulletPointList text={task.managerComments} />
                          </div>
                        ) : null}
                        {task.status === 'Not Completed' && task.reason ? (
                          <div className="mt-2 text-xs">
                            <p className="font-medium text-red-600">Reason</p>
                            <BulletPointList text={task.reason} />
                          </div>
                        ) : null}
                        {task.status === 'Rescheduled' ? (
                          <div className="mt-2 space-y-1 text-xs text-amber-700">
                            <p className="font-medium">Rescheduled</p>
                            {task.rescheduledToDate ? (
                              <p>Moved to {task.rescheduledToDate}</p>
                            ) : null}
                            {task.reason ? <BulletPointList text={task.reason} /> : null}
                          </div>
                        ) : null}
                        {task.status === 'Needs Revision' && !task.revisionOutcome ? (
                          <div className="mt-3 space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                            <div>
                              <p className="font-medium">Needs Revision</p>
                              {task.revisionReason ? (
                                <BulletPointList text={task.revisionReason} />
                              ) : null}
                            </div>
                            {task.replacementTask ? (
                              <div className="space-y-1">
                                <p className="font-medium">Reporting Manager Suggestion</p>
                                <p><span className="font-medium">Task Name:</span> {task.replacementTask.taskName || '—'}</p>
                                <div>
                                  <p className="font-medium">Description:</p>
                                  <BulletPointList text={task.replacementTask.description || '—'} />
                                </div>
                                <p><span className="font-medium">Priority:</span> {task.replacementTask.priority || '—'}</p>
                                {task.replacementTask.hoursRequired != null &&
                                Number.isFinite(Number(task.replacementTask.hoursRequired)) ? (
                                  <p>
                                    <span className="font-medium">Hours Required To Complete:</span>{' '}
                                    {task.replacementTask.hoursRequired}
                                  </p>
                                ) : null}
                                {task.replacementTask.expectedOutcome ? (
                                  <div>
                                    <p className="font-medium">Expected Outcome:</p>
                                    <BulletPointList
                                      text={parseBulletPoints(task.replacementTask.expectedOutcome).join('\n')}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                disabled={busyId === task.plannerTaskId}
                                onClick={() => void acceptSuggestion(task)}
                              >
                                Accept Suggestion
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        {isClosed ? (
                          <div className="mt-2 space-y-1 text-xs text-red-700">
                            <p className="font-medium">Permanently Closed</p>
                            {task.reason ? (
                              <div>
                                <p className="font-medium">Termination Reason</p>
                                <BulletPointList text={task.reason} />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter
            className={`shrink-0 gap-2 border-t border-gray-200 bg-white px-6 py-4 ${canPlan ? 'sm:justify-between' : 'sm:justify-end'}`}
          >
            {canPlan ? (
              <Button type="button" variant="outline" onClick={() => onAddTask()}>
                + Add Task
              </Button>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {completionAlreadySubmitted ? (
                <p className="text-xs text-green-700 sm:mr-2">Completion submitted.</p>
              ) : null}
              <Button type="button" variant="outline" onClick={onClose} disabled={submittingDay}>
                Close
              </Button>
              {canCompleteByDate && visibleTasks.length > 0 ? (
                <Button
                  type="button"
                  className="bg-[#007BFF] hover:bg-[#0056b3]"
                  disabled={!canSubmitDayCompletion}
                  onClick={() => void handleSubmitDayCompletion()}
                >
                  {submittingDay ? 'Submitting…' : 'Submit'}
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!completeTaskId && canModifyTasks}
        onOpenChange={(v) => {
          if (!v) setCompleteTaskId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Completed</DialogTitle>
          </DialogHeader>
          <BulletPointEditor
            key={completeTaskId ?? 'complete-closed'}
            ref={workDoneEditorRef}
            id="work-done"
            label="Work Done"
            required
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCompleteTaskId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitCompleted()} disabled={!!busyId}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!reasonTaskId && canModifyTasks}
        onOpenChange={(v) => {
          if (!v) resetNotCompletedDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Not Completed</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <BulletPointEditor
              key={reasonTaskId ?? 'reason-closed'}
              ref={reasonEditorRef}
              id="not-completed-reason"
              label="Reason"
              required
            />
            <div className="space-y-2">
              <Label htmlFor="not-completed-action">Action</Label>
              <Select
                value={notCompletedAction}
                onValueChange={(value) =>
                  setNotCompletedAction(value as DailyPlannerNotCompletedAction)
                }
              >
                <SelectTrigger id="not-completed-action">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="terminate">Terminate</SelectItem>
                  <SelectItem value="next_date">Next Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {notCompletedAction === 'next_date' ? (
              <div className="space-y-2">
                <Label htmlFor="not-completed-new-date">New Date</Label>
                <Input
                  id="not-completed-new-date"
                  type="date"
                  min={minRescheduleDate}
                  value={rescheduleDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                  required
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetNotCompletedDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitNotCompleted()} disabled={!!busyId}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
