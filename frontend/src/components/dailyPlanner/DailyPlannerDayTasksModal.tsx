import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import type {
  DailyPlannerNotCompletedAction,
  DailyPlannerTask,
} from '../../types/dailyPlanner';
import type { PlanningConfig } from '../../utils/planningRecognition';
import {
  buildMinimumHoursRequirementMessage,
  canUpdateTasksOnDate,
  formatDurationLabel,
  getMinPlannedHours,
  partsToDecimalHours,
  TASK_UPDATES_READONLY_MESSAGE,
} from '../../utils/planningRecognition';
import { classifyApprovedLeaveForDate } from '../../utils/dailyPlannerLeaveRules';
import type { PayrollLeaveRequest } from '../../types/payroll';
import { cn } from '../ui/utils';
import {
  getDailyTaskChipStyle,
  getDailyTaskStatusLabel,
  getDailyTaskVisualKey,
  isPermanentlyClosedTask,
  isRescheduledTask,
  sortDailyPlannerTasksByPriority,
  visibleEmployeePlannerTasks,
} from './dailyPlannerUtils';
import {
  canCompleteTasksOnDate,
  FUTURE_COMPLETION_BLOCKED_MESSAGE,
  getDailyPlannerDateMode,
  PAST_DATE_READONLY_MESSAGE,
} from './dailyPlannerDateRules';
import {
  acceptDailyPlannerRevision,
  acceptDailyPlannerTaskFlag,
  batchCompleteDailyPlannerTasks,
  completeDailyPlannerTask,
  deleteDailyPlannerTask,
  notCompletedDailyPlannerTask,
  rescheduleDailyPlannerTaskSteps,
  rescheduleDailyPlannerTaskToDate,
  submitDayCompletion,
  uploadDailyPlannerTaskDocument,
} from '../../hooks/dailyPlanner/dailyPlannerApi';
import BulletPointEditor, { type BulletPointEditorHandle } from './BulletPointEditor';
import BulletPointList from './BulletPointList';
import { parseBulletPoints } from './bulletPointUtils';
import { todayIso } from './dailyPlannerUtils';
import { useAuth } from '../../context/AuthContext';
import {
  canShowDeleteOrRescheduleTaskAction,
  canShowEditTaskAction,
  hasEmployeeCompletionOutcome,
} from './todayTaskReviewWizardUtils';
import DailyPlannerEnhancedTaskFields, {
  resolveDocumentFiles,
  resolveDocumentUploadPayload,
} from './DailyPlannerEnhancedTaskFields';
import TwelveHourTimeInput, { hhMmTo12hParts } from './TwelveHourTimeInput';
import { isFactoryDailyPlannerEligible } from '../../utils/dailyPlannerFactoryEligibility';
import {
  completionTimingMessage,
  createEmptyTimeSlot,
  MAX_COMPLETION_TIME_SLOTS,
  minutesToDecimalHours,
  parseHhMmToMinutes,
  slotDurationMinutes,
  totalSlotsDecimalHours,
  totalSlotsDurationMinutes,
  validateCompletionTimeSlots,
  type CompletionTimeSlot,
} from '../../utils/dailyPlannerTimeSlots';
import DailyPlannerTaskDocumentsList from './DailyPlannerTaskDocumentsList';
import {
  formatMinutesLabel,
  minutesBetweenHhMm,
  progressFromProcedureSteps,
  resolveProcedureSteps,
  sumActualMinutes,
  sumPlannedMinutes,
  workDoneFromProcedureSteps,
  type DailyPlannerProcedureStep,
} from '../../utils/dailyPlannerProcedureSteps';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

const MISSING_STEP_TIMES_PROMPT =
  'Some steps do not have complete time entries. Would you like to enter the missing times now?';

/** Step-based Mark Completed: per-step Start/End (HH:mm) + Work Done text. */
type StepTimeEntry = { startTime: string; endTime: string; workDone: string };

/** Minutes reported by completed steps on a server task (rescheduled steps excluded). */
function serverStepReportedMinutes(task: DailyPlannerTask): number {
  const steps = Array.isArray(task.procedureSteps) ? task.procedureSteps : [];
  return sumActualMinutes(steps.filter((s) => s.status !== 'rescheduled'));
}

/** Display-only message for the day-tasks modal (does not change global planning rules). */
const DAY_TASK_UPDATES_READONLY_DISPLAY_MESSAGE =
  'Task updates are only allowed during the planning windows (5:30 PM–11:00 AM next day).';

function calcDurationFromTimes(startTime: string, endTime: string): number | null {
  const start = String(startTime || '').trim();
  const end = String(endTime || '').trim();
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return null;
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (endMins < startMins) return null;
  const diff = endMins - startMins;
  return partsToDecimalHours(Math.floor(diff / 60), diff % 60);
}

/** Factory: locally saved Mark Completed / Not Completed result, submitted in one batch. */
type CompletionDraft = {
  outcome: 'completed' | 'not_completed';
  workDone?: string;
  timeSlots?: CompletionTimeSlot[];
  startTime?: string;
  endTime?: string;
  needsDocument?: boolean;
  progressDone?: number | null;
  documentFiles?: File[];
  hasObservation?: boolean;
  observationText?: string;
  observationId?: string | null;
  notCompletedAction?: DailyPlannerNotCompletedAction;
  rescheduleDate?: string;
  reason?: string;
  /** Step-based completion (preferred over timeSlots when present). */
  procedureSteps?: DailyPlannerProcedureStep[];
};

const EMPTY_DRAFTS: Record<string, CompletionDraft> = {};

const SERVER_DONE_STATUSES = new Set(['Completed', 'Awaiting Verification', 'Verified Complete']);

function formatHhMm12(hhmm: string | null | undefined): string {
  const parts = hhMmTo12hParts(String(hhmm || ''));
  if (!parts.hour12) return String(hhmm || '—');
  return `${parts.hour12}:${parts.minute} ${parts.period}`;
}

function draftReportedMinutes(draft: CompletionDraft): number | null {
  if (draft.outcome !== 'completed') return null;
  if (draft.procedureSteps?.length) return sumActualMinutes(draft.procedureSteps);
  return totalSlotsDurationMinutes(draft.timeSlots ?? []);
}

/** Minutes reported on a server task (steps, then timeSlots, then legacy start/end, then stored hours). */
function serverTaskReportedMinutes(task: DailyPlannerTask): number {
  const stepMinutes = serverStepReportedMinutes(task);
  if (stepMinutes > 0) return stepMinutes;
  if (task.timeSlots?.length) {
    let total = 0;
    let ok = true;
    for (const slot of task.timeSlots) {
      const stored = Number(slot.durationMinutes);
      const mins = Number.isFinite(stored) && stored > 0 ? stored : slotDurationMinutes(slot);
      if (mins == null) {
        ok = false;
        break;
      }
      total += mins;
    }
    if (ok) return total;
  }
  const start = parseHhMmToMinutes(String(task.completionStartTime || ''));
  const end = parseHhMmToMinutes(String(task.completionEndTime || ''));
  if (start != null && end != null && end >= start) return end - start;
  const stored = Number(task.completionDurationHours);
  if (Number.isFinite(stored) && stored >= 0) return Math.round(stored * 60);
  return 0;
}

function plannerTaskLabel(task: DailyPlannerTask | undefined, fallbackId: string): string {
  if (!task) return fallbackId;
  return task.isProjectBased && task.projectName
    ? `${task.projectName} — ${task.taskName}`
    : task.taskName || fallbackId;
}

interface DailyPlannerDayTasksModalProps {
  open: boolean;
  date: string;
  tasks: DailyPlannerTask[];
  planningConfig?: PlanningConfig | null;
  /** Approved Payroll leave covering this date (for hours + half-day reporting). */
  approvedLeavesForDate?: PayrollLeaveRequest[];
  onClose: () => void;
  onChanged: (patch?: {
    upsert?: DailyPlannerTask[];
    removeIds?: string[];
    hideRevisionParentId?: string;
  }) => void;
  onAddTask: (revisesTaskId?: string) => void;
  /** Log unplanned work already done during today's Mark Completed flow. */
  onExtraTask?: () => void;
  /** Open Create Task form in edit mode for this task. */
  onEditTask?: (task: DailyPlannerTask) => void;
  onViewFinalPlan?: () => void;
}

export default function DailyPlannerDayTasksModal({
  open,
  date,
  tasks,
  planningConfig,
  approvedLeavesForDate = [],
  onClose,
  onChanged,
  onAddTask,
  onExtraTask,
  onEditTask,
  onViewFinalPlan,
}: DailyPlannerDayTasksModalProps) {
  const { user } = useAuth();
  const employeeLocation = user?.location || 'Office';
  const enhancedEligible = Boolean(planningConfig?.enhancedEligible);
  const factoryMode =
    typeof planningConfig?.factoryEligible === 'boolean'
      ? planningConfig.factoryEligible
      : isFactoryDailyPlannerEligible(employeeLocation);
  const visibleTasks = useMemo(
    () => sortDailyPlannerTasksByPriority(visibleEmployeePlannerTasks(tasks)),
    [tasks],
  );
  const raisedFlags = useMemo(
    () => visibleTasks.filter((t) => String(t.flagStatus || '').trim() === 'Raised'),
    [visibleTasks],
  );
  const [reasonTaskId, setReasonTaskId] = useState<string | null>(null);
  const [notCompletedAction, setNotCompletedAction] = useState<DailyPlannerNotCompletedAction>('terminate');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [completeTaskId, setCompleteTaskId] = useState<string | null>(null);
  const [completeStartTime, setCompleteStartTime] = useState('');
  const [completeEndTime, setCompleteEndTime] = useState('');
  const [completeNeedsDocument, setCompleteNeedsDocument] = useState<'Yes' | 'No'>('No');
  const [completeProgressDone, setCompleteProgressDone] = useState<number | null>(null);
  const [completeDocumentFile, setCompleteDocumentFile] = useState<File | null>(null);
  const [completeDocumentFiles, setCompleteDocumentFiles] = useState<File[]>([]);
  const [completeSlots, setCompleteSlots] = useState<CompletionTimeSlot[]>(() => [
    createEmptyTimeSlot(),
  ]);
  const [completeHasObservation, setCompleteHasObservation] = useState<'Yes' | 'No'>('No');
  /** Step-based Mark Completed: Start/End by stepId (HH:mm). */
  const [completeStepTimes, setCompleteStepTimes] = useState<Record<string, StepTimeEntry>>({});
  const [highlightStepIds, setHighlightStepIds] = useState<string[]>([]);
  const [missingTimesPromptOpen, setMissingTimesPromptOpen] = useState(false);
  const [rescheduleStepsOpen, setRescheduleStepsOpen] = useState(false);
  const [rescheduleStepsDate, setRescheduleStepsDate] = useState('');
  const [draftsByDate, setDraftsByDate] = useState<Record<string, Record<string, CompletionDraft>>>(
    {},
  );
  const [notCompletedNeedsDocument, setNotCompletedNeedsDocument] = useState<'Yes' | 'No'>('No');
  const [notCompletedProgressDone, setNotCompletedProgressDone] = useState<number | null>(null);
  const [notCompletedDocumentFile, setNotCompletedDocumentFile] = useState<File | null>(null);
  const [notCompletedDocumentFiles, setNotCompletedDocumentFiles] = useState<File[]>([]);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null);
  const [rescheduleOnlyDate, setRescheduleOnlyDate] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submittingDay, setSubmittingDay] = useState(false);
  const workDoneEditorRef = useRef<BulletPointEditorHandle>(null);
  const observationEditorRef = useRef<BulletPointEditorHandle>(null);
  const reasonEditorRef = useRef<BulletPointEditorHandle>(null);
  const completionDrafts = draftsByDate[date] ?? EMPTY_DRAFTS;
  const draftsRef = useRef<Record<string, CompletionDraft>>(EMPTY_DRAFTS);
  draftsRef.current = completionDrafts;

  const saveDraft = (taskId: string, draft: CompletionDraft) => {
    setDraftsByDate((prev) => ({
      ...prev,
      [date]: { ...(prev[date] ?? {}), [taskId]: draft },
    }));
  };

  const clearDrafts = (taskIds: string[]) => {
    if (taskIds.length === 0) return;
    setDraftsByDate((prev) => {
      const current = { ...(prev[date] ?? {}) };
      for (const id of taskIds) delete current[id];
      return { ...prev, [date]: current };
    });
  };

  const dateMode = useMemo(() => getDailyPlannerDateMode(date), [date]);
  const isPastDate = dateMode === 'past';
  const leaveClassification = useMemo(
    () => classifyApprovedLeaveForDate(approvedLeavesForDate, date),
    [approvedLeavesForDate, date],
  );
  const halfDayLeave = leaveClassification.kind === 'half';
  const fullDayLeave = leaveClassification.kind === 'full';
  const canCompleteByDate = canCompleteTasksOnDate(date);
  const canModifyTasks = useMemo(
    () =>
      canCompleteByDate &&
      canUpdateTasksOnDate(date, planningConfig, { halfDayLeave }),
    [canCompleteByDate, date, planningConfig, halfDayLeave],
  );
  const isReadOnlyWindow = canCompleteByDate && !canModifyTasks;
  // Past-date Edit/Delete/Reschedule are gated via allowPastDateActions + lifecycle helpers.
  /** Extra Task uses the same 5:30 PM → 11:00 AM employee planning window as other today updates. */
  const canCreateExtraTask = Boolean(
    canCompleteByDate && onExtraTask && canModifyTasks && !fullDayLeave,
  );

  const completeDurationPreview = useMemo(
    () => calcDurationFromTimes(completeStartTime, completeEndTime),
    [completeStartTime, completeEndTime],
  );

  const minRequiredHours = useMemo(
    () => getMinPlannedHours(undefined, employeeLocation, leaveClassification.kind),
    [employeeLocation, leaveClassification.kind],
  );

  const completeSlotsValidation = useMemo(
    () => validateCompletionTimeSlots(completeSlots),
    [completeSlots],
  );
  const completeTaskForDialog = completeTaskId
    ? tasks.find((t) => t.plannerTaskId === completeTaskId)
    : undefined;

  /**
   * Step-based reporting when the task has procedure steps or a legacy description/hours
   * that resolveProcedureSteps can expand. Empty tasks keep the old Start/End / slot UI.
   * Steps already rescheduled to another date are excluded.
   */
  const completeBaseSteps = useMemo<DailyPlannerProcedureStep[]>(() => {
    const t = completeTaskForDialog;
    if (!t) return [];
    return resolveProcedureSteps(t).filter((s) => s.status !== 'rescheduled');
  }, [completeTaskForDialog]);
  const stepMode = completeBaseSteps.length > 0;

  const completeStepRows = useMemo(
    () =>
      completeBaseSteps.map((step) => {
        const times = completeStepTimes[step.stepId] ?? {
          startTime: '',
          endTime: '',
          workDone: '',
        };
        const startTime = times.startTime || '';
        const endTime = times.endTime || '';
        const workDone = times.workDone || '';
        const hasBoth = Boolean(startTime && endTime);
        const actual = hasBoth ? minutesBetweenHhMm(startTime, endTime) : null;
        // Allow cross-midnight (minutesBetweenHhMm adds 24h); reject only empty/zero/invalid ranges.
        const invalid = hasBoth && (actual == null || actual <= 0);
        const complete = hasBoth && !invalid;
        return {
          ...step,
          startTime,
          endTime,
          workDone,
          invalid,
          complete,
          actualMinutes: complete ? actual : null,
        };
      }),
    [completeBaseSteps, completeStepTimes],
  );
  const stepTotalPlannedMinutes = useMemo(
    () => sumPlannedMinutes(completeBaseSteps),
    [completeBaseSteps],
  );
  const stepTotalActualMinutes = useMemo(
    () =>
      completeStepRows.reduce(
        (sum, row) => sum + (row.complete && row.actualMinutes != null ? row.actualMinutes : 0),
        0,
      ),
    [completeStepRows],
  );
  const stepsAllComplete = completeStepRows.length > 0 && completeStepRows.every((r) => r.complete);
  /** Duration-weighted live progress (all steps complete → 100%). */
  const stepProgressPercent = useMemo(
    () =>
      progressFromProcedureSteps(
        completeStepRows.map((r) => ({
          stepId: r.stepId,
          description: r.description,
          plannedMinutes: r.plannedMinutes,
          completed: r.complete,
          status: r.complete ? ('completed' as const) : ('pending' as const),
        })),
      ),
    [completeStepRows],
  );

  /** Factory: reported minutes from drafts + submitted server tasks without a draft override. */
  const factoryReportedMinutes = useMemo(() => {
    if (!factoryMode) return 0;
    let total = 0;
    for (const task of visibleTasks) {
      const id = task.plannerTaskId;
      if (completeTaskId === id) {
        if (stepMode) total += stepTotalActualMinutes;
        else if (completeSlotsValidation.ok) total += completeSlotsValidation.totalMinutes;
        continue;
      }
      const draft = completionDrafts[id];
      if (draft) {
        // Terminated / rescheduled (not_completed) drafts never count toward the current day.
        const mins = draftReportedMinutes(draft);
        if (mins != null) total += mins;
        continue;
      }
      if (!SERVER_DONE_STATUSES.has(String(task.status || '').trim())) continue;
      total += serverTaskReportedMinutes(task);
    }
    return total;
  }, [
    factoryMode,
    visibleTasks,
    completeTaskId,
    completeSlotsValidation,
    completionDrafts,
    stepMode,
    stepTotalActualMinutes,
  ]);

  /** Live reported hours from Start/End (completed tasks + open Mark Completed preview). */
  const officeReportedHours = useMemo(() => {
    const done = SERVER_DONE_STATUSES;
    let total = 0;
    for (const task of visibleTasks) {
      if (completeTaskId && task.plannerTaskId === completeTaskId) {
        if (stepMode) total += stepTotalActualMinutes / 60;
        else if (completeDurationPreview != null) total += completeDurationPreview;
        continue;
      }
      if (!done.has(String(task.status || '').trim())) continue;
      const stepMinutes = serverStepReportedMinutes(task);
      if (stepMinutes > 0) {
        total += stepMinutes / 60;
        continue;
      }
      const fromTimes = calcDurationFromTimes(
        String(task.completionStartTime || ''),
        String(task.completionEndTime || ''),
      );
      if (fromTimes != null) {
        total += fromTimes;
        continue;
      }
      const stored = Number(task.completionDurationHours);
      if (Number.isFinite(stored) && stored >= 0) total += stored;
    }
    return Math.round(total * 100) / 100;
  }, [visibleTasks, completeTaskId, completeDurationPreview, stepMode, stepTotalActualMinutes]);

  const liveReportedHours = factoryMode
    ? minutesToDecimalHours(factoryReportedMinutes)
    : officeReportedHours;

  const meetsMinReportedHours = liveReportedHours >= minRequiredHours;

  useEffect(() => {
    if (!completeTaskId) {
      setCompleteStartTime('');
      setCompleteEndTime('');
      setCompleteNeedsDocument('No');
      setCompleteProgressDone(null);
      setCompleteDocumentFile(null);
      setCompleteDocumentFiles([]);
      return;
    }
    const task = tasks.find((t) => t.plannerTaskId === completeTaskId);
    if (task) {
      setCompleteNeedsDocument(task.needsDocument ? 'Yes' : 'No');
      setCompleteProgressDone(
        (factoryMode || task.isProjectBased) &&
          task.progressDone != null &&
          Number.isFinite(Number(task.progressDone))
          ? Number(task.progressDone)
          : null,
      );
    }
  }, [completeTaskId, tasks, factoryMode]);

  /** Factory: time slots / observation / draft prefill when the Mark Completed dialog opens. */
  useEffect(() => {
    if (!factoryMode) return;
    if (!completeTaskId) {
      setCompleteSlots([createEmptyTimeSlot()]);
      setCompleteHasObservation('No');
      return;
    }
    const draft = draftsRef.current[completeTaskId];
    if (draft?.outcome === 'completed') {
      setCompleteSlots(
        draft.timeSlots?.length
          ? draft.timeSlots.map((slot) => ({ ...slot }))
          : [createEmptyTimeSlot()],
      );
      setCompleteHasObservation(draft.hasObservation ? 'Yes' : 'No');
      setCompleteNeedsDocument(draft.needsDocument ? 'Yes' : 'No');
      setCompleteProgressDone(draft.progressDone ?? null);
      setCompleteDocumentFiles(draft.documentFiles ?? []);
      setCompleteDocumentFile(draft.documentFiles?.[0] ?? null);
    } else {
      setCompleteSlots([createEmptyTimeSlot()]);
      setCompleteHasObservation('No');
    }
  }, [completeTaskId, factoryMode]);

  /** Step-based Mark Completed: seed Start/End per step when the dialog opens (keeps drafts / saved times). */
  useEffect(() => {
    setHighlightStepIds([]);
    setMissingTimesPromptOpen(false);
    setRescheduleStepsOpen(false);
    setRescheduleStepsDate('');
    if (!completeTaskId) {
      setCompleteStepTimes({});
      return;
    }
    const task = tasks.find((t) => t.plannerTaskId === completeTaskId);
    const base = task
      ? resolveProcedureSteps(task).filter((s) => s.status !== 'rescheduled')
      : [];
    const draftSteps = factoryMode ? draftsRef.current[completeTaskId]?.procedureSteps : undefined;
    const next: Record<string, StepTimeEntry> = {};
    for (const step of base) {
      const fromDraft = draftSteps?.find((d) => d.stepId === step.stepId);
      next[step.stepId] = {
        startTime: fromDraft?.startTime ?? step.startTime ?? '',
        endTime: fromDraft?.endTime ?? step.endTime ?? '',
        workDone: fromDraft?.workDone ?? step.workDone ?? '',
      };
    }
    setCompleteStepTimes(next);
    // Seed only when the dialog opens/closes — later task refreshes must not clobber typed times.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeTaskId]);

  /** Factory: restore not-completed draft when the dialog opens. */
  useEffect(() => {
    if (!factoryMode || !reasonTaskId) return;
    const draft = draftsRef.current[reasonTaskId];
    if (draft?.outcome === 'not_completed') {
      setNotCompletedAction(draft.notCompletedAction ?? 'terminate');
      setRescheduleDate(draft.rescheduleDate ?? '');
      setNotCompletedNeedsDocument(draft.needsDocument ? 'Yes' : 'No');
      setNotCompletedDocumentFiles(draft.documentFiles ?? []);
      setNotCompletedDocumentFile(draft.documentFiles?.[0] ?? null);
    }
  }, [reasonTaskId, factoryMode]);

  useEffect(() => {
    if (!reasonTaskId) {
      setNotCompletedNeedsDocument('No');
      setNotCompletedProgressDone(null);
      setNotCompletedDocumentFile(null);
      setNotCompletedDocumentFiles([]);
      return;
    }
    const task = tasks.find((t) => t.plannerTaskId === reasonTaskId);
    if (task) {
      setNotCompletedNeedsDocument(task.needsDocument ? 'Yes' : 'No');
      setNotCompletedProgressDone(
        task.isProjectBased &&
          task.progressDone != null &&
          Number.isFinite(Number(task.progressDone))
          ? Number(task.progressDone)
          : null,
      );
    }
  }, [reasonTaskId, tasks]);

  /** Factory: tasks with a local draft that still lack a server-side employee outcome. */
  const pendingDraftTasks = useMemo(
    () =>
      factoryMode
        ? visibleTasks.filter(
            (t) =>
              Boolean(completionDrafts[t.plannerTaskId]) &&
              !isPermanentlyClosedTask(t) &&
              !hasEmployeeCompletionOutcome(t),
          )
        : [],
    [factoryMode, visibleTasks, completionDrafts],
  );
  const allHaveCompletionOutcomes = factoryMode
    ? visibleTasks.length > 0 &&
      visibleTasks.every(
        (t) =>
          isPermanentlyClosedTask(t) ||
          Boolean(completionDrafts[t.plannerTaskId]) ||
          hasEmployeeCompletionOutcome(t),
      )
    : visibleTasks.length > 0 && visibleTasks.every(hasEmployeeCompletionOutcome);
  const completionAlreadySubmitted = visibleTasks.some((t) => Boolean(t.dayCompletionSubmittedAt));
  const canSubmitDayCompletion =
    canCompleteByDate &&
    allHaveCompletionOutcomes &&
    !completionAlreadySubmitted &&
    !submittingDay &&
    meetsMinReportedHours &&
    (pendingDraftTasks.length === 0 || canModifyTasks);

  const confirmDeleteTask = async () => {
    if (!deleteTaskId) return;
    setBusyId(deleteTaskId);
    try {
      await deleteDailyPlannerTask(deleteTaskId);
      toast.success('Task deleted');
      onChanged({ removeIds: [deleteTaskId] });
      setDeleteTaskId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const confirmRescheduleOnly = async () => {
    if (!rescheduleTaskId) return;
    const target = String(rescheduleOnlyDate || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
      toast.error('Select a new date');
      return;
    }
    if (target === date) {
      toast.error('New date must be different from the current task date');
      return;
    }
    setBusyId(rescheduleTaskId);
    try {
      const result = await rescheduleDailyPlannerTaskToDate(
        rescheduleTaskId,
        target,
        'Rescheduled by employee',
      );
      toast.success(`Task rescheduled to ${target}`);
      const upsert = [result.task];
      if (result.rescheduledTask) upsert.push(result.rescheduledTask);
      onChanged({ upsert });
      setRescheduleTaskId(null);
      setRescheduleOnlyDate('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reschedule failed');
    } finally {
      setBusyId(null);
    }
  };

  /** Factory: batch-submit all drafts, upload documents, then submit the day if everything succeeded. */
  const submitFactoryDrafts = async () => {
    const pending = pendingDraftTasks.map((task) => ({
      task,
      draft: completionDrafts[task.plannerTaskId]!,
    }));
    const completions: NonNullable<Parameters<typeof batchCompleteDailyPlannerTasks>[0]['completions']> = [];
    const notCompleted: NonNullable<Parameters<typeof batchCompleteDailyPlannerTasks>[0]['notCompleted']> = [];
    for (const { task, draft } of pending) {
      const taskId = task.plannerTaskId;
      if (draft.outcome === 'completed') {
        completions.push({
          taskId,
          workDone: draft.workDone ?? '',
          ...(draft.procedureSteps?.length
            ? { procedureSteps: draft.procedureSteps }
            : {
                timeSlots: (draft.timeSlots ?? []).map((s) => ({
                  startTime: s.startTime,
                  endTime: s.endTime,
                })),
              }),
          ...(enhancedEligible
            ? {
                needsDocument: Boolean(draft.needsDocument),
                // Step-based tasks: progress is derived server-side from the steps.
                ...(draft.procedureSteps?.length ? {} : { progressDone: draft.progressDone ?? null }),
              }
            : {}),
          hasObservation: Boolean(draft.hasObservation),
          ...(draft.hasObservation
            ? {
                observationText: draft.observationText ?? '',
                observationId: draft.observationId ?? task.observationId ?? null,
              }
            : {}),
        });
      } else {
        const action = draft.notCompletedAction ?? 'terminate';
        notCompleted.push({
          taskId,
          reason: draft.reason ?? '',
          action,
          newDate: action === 'next_date' ? draft.rescheduleDate : undefined,
        });
      }
    }

    setSubmittingDay(true);
    try {
      const batch = await batchCompleteDailyPlannerTasks({ date, completions, notCompleted });
      const succeededIds = batch.succeeded.map((row) => row.taskId);
      const upserts = new Map<string, DailyPlannerTask>();
      const removeIds: string[] = [];
      for (const row of batch.succeeded) {
        if (row.task) upserts.set(row.task.plannerTaskId, row.task);
        if (row.rescheduledTask) upserts.set(row.rescheduledTask.plannerTaskId, row.rescheduledTask);
        for (const cancelled of row.cancelledRescheduledTasks || []) {
          const id = String(
            (cancelled as DailyPlannerTask)?.plannerTaskId ||
              (cancelled as { plannerTaskId?: string })?.plannerTaskId ||
              '',
          ).trim();
          if (id) removeIds.push(id);
        }
      }

      for (const row of batch.succeeded) {
        const draft = completionDrafts[row.taskId];
        if (!draft?.needsDocument || !draft.documentFiles?.length || !enhancedEligible) continue;
        try {
          const updated = await uploadDailyPlannerTaskDocument(
            row.taskId,
            draft.documentFiles.length === 1 ? draft.documentFiles[0] : draft.documentFiles,
            'employee',
          );
          upserts.set(updated.plannerTaskId, updated);
        } catch (uploadErr) {
          toast.error(
            `Document upload failed for ${plannerTaskLabel(
              pending.find((p) => p.task.plannerTaskId === row.taskId)?.task,
              row.taskId,
            )}: ${uploadErr instanceof Error ? uploadErr.message : 'Upload failed'}`,
          );
        }
      }

      clearDrafts(succeededIds);
      if (upserts.size > 0 || removeIds.length > 0) {
        onChanged({
          upsert: Array.from(upserts.values()),
          removeIds: removeIds.length ? removeIds : undefined,
        });
      }

      if (batch.failed.length > 0) {
        const lines = batch.failed.map(
          (f) =>
            `${plannerTaskLabel(
              pending.find((p) => p.task.plannerTaskId === f.taskId)?.task,
              f.taskId,
            )}: ${f.message}`,
        );
        toast.error(
          `${batch.failed.length} task${batch.failed.length === 1 ? '' : 's'} could not be saved. Fix and submit again. ${lines.join(' | ')}`,
          { duration: 10000 },
        );
        return;
      }

      const succeededSet = new Set(succeededIds);
      const allOutcomesPresent = visibleTasks.every(
        (t) =>
          isPermanentlyClosedTask(t) ||
          succeededSet.has(t.plannerTaskId) ||
          hasEmployeeCompletionOutcome(t),
      );
      if (!allOutcomesPresent) {
        toast.error('Some tasks still need a Completed / Not Completed outcome before submitting.');
        return;
      }

      const submitted = await submitDayCompletion(date);
      toast.success('Completion submitted for manager review');
      onChanged({ upsert: submitted });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmittingDay(false);
    }
  };

  const handleSubmitDayCompletion = async () => {
    if (!allHaveCompletionOutcomes) {
      toast.error(
        'Mark every task as Completed, Not Completed, or Rescheduled before submitting.',
      );
      return;
    }
    if (!meetsMinReportedHours) {
      toast.error(
        buildMinimumHoursRequirementMessage(
          undefined,
          employeeLocation,
          leaveClassification.kind,
        ),
      );
      return;
    }
    if (!canSubmitDayCompletion) return;
    if (factoryMode && pendingDraftTasks.length > 0) {
      await submitFactoryDrafts();
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

  /** Factory: validate and store the Mark Completed dialog as a local draft (no API call). */
  const saveFactoryCompletedDraft = () => {
    if (!completeTaskId) return;
    if (!completeSlotsValidation.ok) {
      toast.error(completeSlotsValidation.message);
      return;
    }
    const editor = workDoneEditorRef.current;
    if (!editor?.hasContent()) {
      toast.error('Work done is required');
      return;
    }
    const hasObservation = completeHasObservation === 'Yes';
    let observationText = '';
    if (hasObservation) {
      const obsEditor = observationEditorRef.current;
      if (!obsEditor?.hasContent()) {
        toast.error('Observation is required when you select Yes');
        return;
      }
      observationText = obsEditor.getFormattedValue();
    }
    const task = tasks.find((t) => t.plannerTaskId === completeTaskId);
    const sortedStarts = completeSlots.map((s) => s.startTime).sort();
    const sortedEnds = completeSlots.map((s) => s.endTime).sort();
    saveDraft(completeTaskId, {
      outcome: 'completed',
      workDone: editor.getFormattedValue(),
      timeSlots: completeSlots.map((s) => ({ ...s })),
      startTime: sortedStarts[0],
      endTime: sortedEnds[sortedEnds.length - 1],
      needsDocument: completeNeedsDocument === 'Yes',
      progressDone: completeProgressDone,
      documentFiles:
        completeNeedsDocument === 'Yes'
          ? resolveDocumentFiles({
              documentFile: completeDocumentFile,
              documentFiles: completeDocumentFiles,
            })
          : [],
      hasObservation,
      observationText,
      observationId:
        draftsRef.current[completeTaskId]?.observationId ?? task?.observationId ?? null,
    });
    toast.success('Saved to draft — submit when ready');
    setCompleteTaskId(null);
  };

  // ---- Step-based Mark Completed (Factory + Office) ----

  const setStepTime = (stepId: string, field: keyof StepTimeEntry, value: string) => {
    setCompleteStepTimes((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] ?? { startTime: '', endTime: '', workDone: '' }),
        [field]: value,
      },
    }));
  };

  /** Steps as persisted: timed steps are completed (with actualMinutes), the rest stay pending. */
  const buildEvaluatedSteps = (): DailyPlannerProcedureStep[] =>
    completeStepRows.map((row) => ({
      stepId: row.stepId,
      description: row.description,
      plannedMinutes: row.plannedMinutes,
      startTime: row.startTime || null,
      endTime: row.endTime || null,
      actualMinutes: row.complete ? row.actualMinutes : null,
      workDone: String(row.workDone || '').trim(),
      completed: row.complete,
      status: row.complete ? 'completed' : 'pending',
    }));

  /** Factory observation validation (unchanged rules); returns null after toasting on failure. */
  const readFactoryObservation = (): { hasObservation: boolean; observationText: string } | null => {
    const hasObservation = factoryMode && completeHasObservation === 'Yes';
    if (!hasObservation) return { hasObservation: false, observationText: '' };
    const obsEditor = observationEditorRef.current;
    if (!obsEditor?.hasContent()) {
      toast.error('Observation is required when you select Yes');
      return null;
    }
    return { hasObservation: true, observationText: obsEditor.getFormattedValue() };
  };

  const showStepTimingToast = (plannedMinutes: number, actualMinutes: number) => {
    const message = completionTimingMessage(plannedMinutes / 60, actualMinutes);
    if (!message) return;
    if (actualMinutes > plannedMinutes) toast.error(message);
    else toast.success(message);
  };

  /**
   * Persist a step-based completion. `steps` are the steps being reported as done
   * (already-rescheduled steps are not part of this dialog).
   * Factory saves a local draft (batch-submitted later); Office calls the complete API,
   * which still lands in Awaiting Verification.
   */
  const finalizeStepCompletion = async (
    steps: DailyPlannerProcedureStep[],
    options: { showTiming: boolean },
  ) => {
    if (!completeTaskId) return;
    const task = tasks.find((t) => t.plannerTaskId === completeTaskId);
    const observation = readFactoryObservation();
    if (!observation) return;
    const workDone = workDoneFromProcedureSteps(steps);
    const plannedMinutes = sumPlannedMinutes(steps);
    const actualMinutes = sumActualMinutes(steps);
    const progressDone = progressFromProcedureSteps(steps);

    if (factoryMode) {
      const starts = steps.map((s) => s.startTime || '').filter(Boolean).sort();
      const ends = steps.map((s) => s.endTime || '').filter(Boolean).sort();
      saveDraft(completeTaskId, {
        outcome: 'completed',
        workDone,
        procedureSteps: steps,
        timeSlots: [],
        startTime: starts[0],
        endTime: ends[ends.length - 1],
        needsDocument: completeNeedsDocument === 'Yes',
        progressDone,
        documentFiles:
          completeNeedsDocument === 'Yes'
            ? resolveDocumentFiles({
                documentFile: completeDocumentFile,
                documentFiles: completeDocumentFiles,
              })
            : [],
        hasObservation: observation.hasObservation,
        observationText: observation.observationText,
        observationId:
          draftsRef.current[completeTaskId]?.observationId ?? task?.observationId ?? null,
      });
      toast.success('Saved to draft — submit when ready');
      if (options.showTiming) showStepTimingToast(plannedMinutes, actualMinutes);
      setCompleteTaskId(null);
      return;
    }

    setBusyId(completeTaskId);
    try {
      const result = await completeDailyPlannerTask(
        completeTaskId,
        workDone,
        task?.date ?? date,
        planningConfig ?? undefined,
        {
          procedureSteps: steps,
          halfDayLeave,
          ...(enhancedEligible ? { needsDocument: completeNeedsDocument === 'Yes' } : {}),
        },
      );
      const completeUploadPayload = resolveDocumentUploadPayload({
        documentFile: completeDocumentFile,
        documentFiles: completeDocumentFiles,
      });
      if (enhancedEligible && completeNeedsDocument === 'Yes' && completeUploadPayload) {
        try {
          await uploadDailyPlannerTaskDocument(
            result.task.plannerTaskId,
            completeUploadPayload,
            'employee',
          );
        } catch (uploadErr) {
          toast.error(uploadErr instanceof Error ? uploadErr.message : 'Document upload failed');
        }
      }
      const taskDuration =
        result.completionDurationHours ??
        result.task.completionDurationHours ??
        Math.round((actualMinutes / 60) * 100) / 100;
      const dayTotal = result.dayCompletedHours;
      toast.success(
        dayTotal != null
          ? `Task duration ${formatDurationLabel(taskDuration)}. Day total ${formatDurationLabel(dayTotal)}.`
          : `Task duration ${formatDurationLabel(taskDuration)}.`,
      );
      if (options.showTiming) showStepTimingToast(plannedMinutes, actualMinutes);
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

  /** Submit from the step-based dialog: Case A (all timed) vs Case B (missing times). */
  const submitStepCompleted = async () => {
    const observation = readFactoryObservation();
    if (!observation) return;

    const invalidIds = completeStepRows.filter((r) => r.invalid).map((r) => r.stepId);
    if (invalidIds.length > 0) {
      setHighlightStepIds(invalidIds);
      toast.error('End Time must be after Start Time for the highlighted steps.');
      return;
    }
    const incompleteIds = completeStepRows.filter((r) => !r.complete).map((r) => r.stepId);
    if (incompleteIds.length > 0) {
      // Case B: keep entered data, highlight the incomplete steps, and ask.
      setHighlightStepIds(incompleteIds);
      setMissingTimesPromptOpen(true);
      return;
    }
    // Case A: every step has Start + End.
    setHighlightStepIds([]);
    await finalizeStepCompletion(buildEvaluatedSteps(), { showTiming: true });
  };

  /** Case B → "No": reschedule ONLY the incomplete steps, then complete the timed ones. */
  const confirmRescheduleIncompleteSteps = async () => {
    if (!completeTaskId) return;
    const task = tasks.find((t) => t.plannerTaskId === completeTaskId);
    const newDate = rescheduleStepsDate.trim();
    if (!newDate) {
      toast.error('New date is required');
      return;
    }
    if (newDate < minRescheduleDate) {
      toast.error('Past dates are not allowed');
      return;
    }
    if (newDate === (task?.date ?? date)) {
      toast.error('New date must be different from the current task date');
      return;
    }
    const evaluated = buildEvaluatedSteps();
    const completedSteps = evaluated.filter((s) => s.completed);
    const unfinishedCount = evaluated.length - completedSteps.length;
    if (completedSteps.length === 0) {
      toast.error(
        'Enter Start and End Time for at least one step, or use Not Completed → Next Date to reschedule the whole task.',
      );
      return;
    }
    if (unfinishedCount === 0) {
      setRescheduleStepsOpen(false);
      await finalizeStepCompletion(completedSteps, { showTiming: true });
      return;
    }
    if (!readFactoryObservation()) return;

    setBusyId(completeTaskId);
    try {
      const result = await rescheduleDailyPlannerTaskSteps(
        completeTaskId,
        { newDate, procedureSteps: evaluated },
        task?.date ?? date,
        planningConfig ?? undefined,
        { halfDayLeave },
      );
      onChanged({ upsert: [result.task, result.rescheduledTask] });
      toast.success(
        `${unfinishedCount} incomplete step${unfinishedCount === 1 ? '' : 's'} rescheduled to ${newDate}`,
      );
      setRescheduleStepsOpen(false);
      setRescheduleStepsDate('');
      setHighlightStepIds([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reschedule failed');
      setBusyId(null);
      return;
    }
    setBusyId(null);
    // The original task now holds only the timed steps — complete it through the normal flow.
    await finalizeStepCompletion(completedSteps, { showTiming: false });
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
    if (stepMode) {
      await submitStepCompleted();
      return;
    }
    if (factoryMode) {
      saveFactoryCompletedDraft();
      return;
    }
    if (!completeStartTime.trim() || !completeEndTime.trim()) {
      toast.error('Start Time and End Time are required');
      return;
    }
    const duration = calcDurationFromTimes(completeStartTime, completeEndTime);
    if (duration == null) {
      toast.error('End Time must be the same as or after Start Time');
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
        {
          startTime: completeStartTime.trim(),
          endTime: completeEndTime.trim(),
          halfDayLeave,
          ...(enhancedEligible
            ? {
                needsDocument: completeNeedsDocument === 'Yes',
                ...(task?.isProjectBased ? { progressDone: completeProgressDone } : {}),
              }
            : {}),
        },
      );
      const completeUploadPayload = resolveDocumentUploadPayload({
        documentFile: completeDocumentFile,
        documentFiles: completeDocumentFiles,
      });
      if (enhancedEligible && completeNeedsDocument === 'Yes' && completeUploadPayload) {
        try {
          await uploadDailyPlannerTaskDocument(
            result.task.plannerTaskId,
            completeUploadPayload,
            'employee',
          );
        } catch (uploadErr) {
          toast.error(
            uploadErr instanceof Error ? uploadErr.message : 'Document upload failed',
          );
        }
      }
      const taskDuration =
        result.completionDurationHours ?? result.task.completionDurationHours ?? duration;
      const dayTotal = result.dayCompletedHours;
      toast.success(
        dayTotal != null
          ? `Task duration ${formatDurationLabel(taskDuration)}. Day total ${formatDurationLabel(dayTotal)}.`
          : `Task duration ${formatDurationLabel(taskDuration)}.`,
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
    setNotCompletedNeedsDocument('No');
    setNotCompletedProgressDone(null);
    setNotCompletedDocumentFile(null);
    setNotCompletedDocumentFiles([]);
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
      if (nextDate === (task?.date ?? date)) {
        toast.error('New date must be different from the current task date');
        return;
      }
    }

    const reason = editor.getFormattedValue();
    if (factoryMode) {
      saveDraft(reasonTaskId, {
        outcome: 'not_completed',
        reason,
        notCompletedAction,
        rescheduleDate: notCompletedAction === 'next_date' ? rescheduleDate.trim() : undefined,
        needsDocument: notCompletedNeedsDocument === 'Yes',
        documentFiles:
          notCompletedNeedsDocument === 'Yes'
            ? resolveDocumentFiles({
                documentFile: notCompletedDocumentFile,
                documentFiles: notCompletedDocumentFiles,
              })
            : [],
      });
      toast.success('Saved to draft — submit when ready');
      resetNotCompletedDialog();
      return;
    }
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
        { halfDayLeave },
      );
      let updatedTask = result.task;
      const notCompletedUploadPayload = resolveDocumentUploadPayload({
        documentFile: notCompletedDocumentFile,
        documentFiles: notCompletedDocumentFiles,
      });
      if (enhancedEligible && notCompletedNeedsDocument === 'Yes' && notCompletedUploadPayload) {
        try {
          updatedTask = await uploadDailyPlannerTaskDocument(
            result.task.plannerTaskId,
            notCompletedUploadPayload,
            'employee',
          );
        } catch (uploadErr) {
          toast.error(
            uploadErr instanceof Error ? uploadErr.message : 'Document upload failed',
          );
        }
      }
      resetNotCompletedDialog();
      onChanged({
        upsert: [updatedTask, ...(result.rescheduledTask ? [result.rescheduledTask] : [])],
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

  const allowPastDateActions = dateMode !== 'past';

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="!flex !h-[92vh] !max-h-[92vh] !w-[min(96vw,1200px)] !max-w-[1200px] !flex-col !gap-0 overflow-hidden !p-0 sm:!max-w-[1200px]"
          style={{
            width: 'min(96vw, 1200px)',
            maxWidth: '1200px',
            height: '92vh',
            maxHeight: '92vh',
          }}
        >
          <DialogHeader className="shrink-0 border-b border-gray-200 px-6 py-4 text-left">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
              <DialogTitle className="min-w-0 shrink">Tasks for {date}</DialogTitle>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                {canCompleteByDate && visibleTasks.length > 0 && !completionAlreadySubmitted ? (
                  <div
                    className={cn(
                      'rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-[#212529] shrink-0 text-right',
                      !meetsMinReportedHours && allHaveCompletionOutcomes && 'border-amber-300 bg-amber-50',
                    )}
                  >
                    Reported Hours: {formatDurationLabel(liveReportedHours)}
                    <span className="mt-0.5 block text-xs font-normal text-gray-500">
                      Minimum Required: {formatDurationLabel(minRequiredHours)}
                    </span>
                  </div>
                ) : null}
                {onViewFinalPlan && visibleTasks.some((t) => Boolean(t.planFinalizedAt)) ? (
                  <Button type="button" variant="outline" size="sm" onClick={onViewFinalPlan}>
                    View Final Plan
                  </Button>
                ) : null}
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-smooth overscroll-contain px-6 py-4">
            {raisedFlags.length > 0 ? (
              <div className="mb-4 space-y-2">
                {raisedFlags.map((flagTask) => (
                  <div
                    key={flagTask.plannerTaskId}
                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-[#212529]"
                  >
                    <p className="font-semibold">🚩 Flag Raised</p>
                    <p className="mt-1">
                      Task:{' '}
                      {flagTask.isProjectBased && flagTask.projectName
                        ? `${flagTask.projectName} — ${flagTask.taskName}`
                        : flagTask.taskName}
                    </p>
                    <p className="mt-1 text-gray-700">
                      Manager Instruction: {flagTask.flagInstruction || '—'}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2"
                      disabled={busyId === flagTask.plannerTaskId}
                      onClick={() => {
                        void (async () => {
                          setBusyId(flagTask.plannerTaskId);
                          try {
                            const updated = await acceptDailyPlannerTaskFlag(flagTask.plannerTaskId);
                            toast.success('Flag accepted');
                            onChanged({ upsert: [updated] });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Accept failed');
                          } finally {
                            setBusyId(null);
                          }
                        })();
                      }}
                    >
                      Accept
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
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
                  const taskDraft = factoryMode ? completionDrafts[task.plannerTaskId] : undefined;
                  const hasActiveDraft =
                    Boolean(taskDraft) && !isClosed && !hasEmployeeCompletionOutcome(task);
                  const draftCompleted = hasActiveDraft && taskDraft?.outcome === 'completed';
                  const progressDoneValue =
                    typeof task.progressDone === 'number' && Number.isFinite(task.progressDone)
                      ? task.progressDone
                      : null;
                  const procedureSteps = resolveProcedureSteps(task);
                  const isReportedTask = hasEmployeeCompletionOutcome(task);
                  const isExtraTaskCard =
                    String(task.source || '').trim().toUpperCase() === 'EXTRA';
                  const reportedSteps = procedureSteps.filter(
                    (s) => String(s.status || '').trim() !== 'rescheduled',
                  );
                  // After Mark Completed (draft or submitted), hide Edit / Delete / Reschedule.
                  const showEdit =
                    allowPastDateActions &&
                    !draftCompleted &&
                    canShowEditTaskAction(task);
                  const showDeleteOrReschedule =
                    allowPastDateActions &&
                    !draftCompleted &&
                    canShowDeleteOrRescheduleTaskAction(task);
                  /** Prefer draft step completion data while Draft — not submitted. */
                  const stepsForCard: DailyPlannerProcedureStep[] = (() => {
                    if (draftCompleted && taskDraft?.procedureSteps?.length) {
                      const byId = new Map(
                        taskDraft.procedureSteps.map((s) => [String(s.stepId || ''), s]),
                      );
                      return reportedSteps.map((base) => {
                        const draftStep = byId.get(String(base.stepId || ''));
                        if (!draftStep) return base;
                        return {
                          ...base,
                          description: base.description,
                          plannedMinutes: base.plannedMinutes,
                          workDone: draftStep.workDone ?? base.workDone,
                          actualMinutes:
                            draftStep.actualMinutes != null
                              ? draftStep.actualMinutes
                              : base.actualMinutes,
                          startTime: draftStep.startTime ?? base.startTime,
                          endTime: draftStep.endTime ?? base.endTime,
                          status: draftStep.status ?? base.status,
                          completed: draftStep.completed ?? base.completed,
                        };
                      });
                    }
                    return reportedSteps;
                  })();
                  const showPerStepCompletion =
                    isExtraTaskCard ||
                    draftCompleted ||
                    (isReportedTask &&
                      (task.status === 'Awaiting Verification' ||
                        task.status === 'Completed' ||
                        task.status === 'Verified Complete'));
                  const hasPerStepWorkDone = stepsForCard.some((s) => {
                    const work = String(s.workDone || '').trim();
                    const actual = Number(s.actualMinutes) || 0;
                    return work.length > 0 || actual > 0;
                  });
                  const showMarkNotCompleted =
                    canModifyTasks &&
                    !draftCompleted &&
                    task.status !== 'Awaiting Verification' &&
                    task.status !== 'Completed' &&
                    task.status !== 'Verified Complete' &&
                    task.status !== 'Not Completed' &&
                    !(task.status === 'Needs Revision' && !task.revisionOutcome) &&
                    task.status !== 'Terminated' &&
                    task.status !== 'Rescheduled';
                  const statusLabel = getDailyTaskStatusLabel(task.status);
                  const taskNameChipStyle = getDailyTaskChipStyle(getDailyTaskVisualKey(task));
                  const showActionRow =
                    showMarkNotCompleted ||
                    (showEdit && Boolean(onEditTask)) ||
                    showDeleteOrReschedule ||
                    (hasActiveDraft && canModifyTasks && !completionAlreadySubmitted);
                  return (
                  <div
                    key={task.plannerTaskId}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      {showCompletionCheckbox ? (
                      <Checkbox
                        className="mt-1"
                        checked={
                          draftCompleted ||
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
                            return;
                          }
                          if (v === false && draftCompleted) {
                            clearDrafts([task.plannerTaskId]);
                          }
                        }}
                      />
                      ) : null}
                      <div className="min-w-0 flex-1 space-y-3">
                        {/* Top row: Task Name (left) + Status badge (right) */}
                        <div className="flex items-start justify-between gap-3">
                          <div
                            style={taskNameChipStyle}
                            className="min-w-0 max-w-[min(100%,28rem)] px-2 text-sm font-semibold"
                          >
                            {task.taskName}
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0 border-gray-300 bg-gray-50 font-medium text-gray-800"
                            title={
                              task.priorityEdited && task.approvedByName
                                ? `Approved by ${task.approvedByName}`
                                : undefined
                            }
                          >
                            {statusLabel}
                          </Badge>
                        </div>

                        {stepsForCard.length > 0 ? (
                          <div className="space-y-3">
                            {stepsForCard.map((step, idx) => {
                              const workText = String(step.workDone || '').trim();
                              const actualMins = Number(step.actualMinutes);
                              const hasActual =
                                Number.isFinite(actualMins) && actualMins > 0;
                              const fromTimes =
                                !hasActual
                                  ? minutesBetweenHhMm(
                                      String(step.startTime || ''),
                                      String(step.endTime || ''),
                                    )
                                  : null;
                              const stepActualMins =
                                hasActual
                                  ? Math.round(actualMins)
                                  : fromTimes != null && fromTimes > 0
                                    ? fromTimes
                                    : null;
                              const showCompletionBlock =
                                showPerStepCompletion &&
                                (workText.length > 0 || stepActualMins != null);

                              return (
                                <div key={step.stepId || idx} className="space-y-1 text-sm">
                                  <p className="text-gray-700">
                                    <span className="font-medium text-gray-900">
                                      Step {idx + 1}
                                    </span>
                                    {' – '}
                                    {String(step.description || '').trim() || '—'}
                                    {!isExtraTaskCard ? (
                                      <>
                                        {' – '}
                                        <span className="text-gray-500">
                                          {formatMinutesLabel(
                                            Number(step.plannedMinutes) || 0,
                                          )}
                                        </span>
                                      </>
                                    ) : null}
                                  </p>
                                  {showCompletionBlock ? (
                                    <p className="pl-3 text-gray-600">
                                      <span className="font-medium text-gray-700">
                                        Work Done
                                      </span>
                                      {' – '}
                                      {workText || '—'}
                                      {stepActualMins != null
                                        ? ` – ${formatMinutesLabel(stepActualMins)}`
                                        : ''}
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : task.description ? (
                          <div className="text-sm text-gray-600">
                            <BulletPointList text={task.description} />
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No steps recorded.</p>
                        )}

                        {/* Legacy Extra (task-level reason only, no per-step workDone): keep reason once */}
                        {isExtraTaskCard &&
                        !hasPerStepWorkDone &&
                        task.reason ? (
                          <div className="space-y-1 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Work Done
                            </p>
                            <div className="text-gray-700">
                              <BulletPointList text={task.reason} />
                            </div>
                          </div>
                        ) : null}

                        {(() => {
                          if (isExtraTaskCard) {
                            const stepActualTotal = sumActualMinutes(stepsForCard);
                            const actualTotalLabel =
                              stepActualTotal > 0
                                ? formatMinutesLabel(stepActualTotal)
                                : task.completionDurationHours != null
                                  ? formatDurationLabel(task.completionDurationHours)
                                  : serverTaskReportedMinutes(task) > 0
                                    ? formatMinutesLabel(serverTaskReportedMinutes(task))
                                    : '';
                            // Compact Extra meta: Task Name · Priority · Actual Time · Extra Task
                            const metaParts = [
                              String(task.taskName || '').trim(),
                              String(task.currentPriority || task.priority || '').trim(),
                              actualTotalLabel,
                              'Extra Task',
                            ].filter(Boolean);
                            return (
                              <p className="text-sm text-gray-500">{metaParts.join(' · ')}</p>
                            );
                          }

                          const draftActualMinutes =
                            draftCompleted && taskDraft
                              ? draftReportedMinutes(taskDraft)
                              : null;
                          const reportedTotalMinutes = isReportedTask
                            ? (() => {
                                const stepActualTotal = sumActualMinutes(reportedSteps);
                                return stepActualTotal > 0
                                  ? stepActualTotal
                                  : serverTaskReportedMinutes(task);
                              })()
                            : 0;

                          let timeLabel = '';
                          if (draftActualMinutes != null && draftActualMinutes > 0) {
                            timeLabel = `${formatMinutesLabel(draftActualMinutes)} (Actual Time)`;
                          } else if (reportedTotalMinutes > 0) {
                            timeLabel = `${formatMinutesLabel(reportedTotalMinutes)} (Actual Time)`;
                          } else if (isReportedTask && task.completionDurationHours != null) {
                            timeLabel = `${formatDurationLabel(task.completionDurationHours)} (Actual Time)`;
                          } else if (task.hoursRequired != null) {
                            timeLabel = formatDurationLabel(task.hoursRequired);
                          }

                          const metaParts = [
                            String(task.projectName || '').trim(),
                            String(task.currentPriority || task.priority || '').trim(),
                            timeLabel,
                          ].filter(Boolean);
                          if (metaParts.length === 0) return null;
                          return (
                            <p className="text-sm text-gray-500">{metaParts.join(' · ')}</p>
                          );
                        })()}
                        {task.createdByReportingPerson ? (
                          <p className="text-xs font-medium text-slate-600">
                            {String(task.createdByName || '').trim()
                              ? `Created by ${String(task.createdByName).trim()}`
                              : 'Created by Reporting Person'}
                          </p>
                        ) : null}
                        {progressDoneValue != null ? (
                          <p className="text-xs text-gray-600">
                            Progress Done: {progressDoneValue}%
                          </p>
                        ) : null}
                        {hasActiveDraft && taskDraft ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 font-normal text-amber-800"
                            >
                              Draft — not submitted
                            </Badge>
                            <span className="text-gray-600">
                              {taskDraft.outcome === 'completed'
                                ? `Completed${
                                    totalSlotsDecimalHours(taskDraft.timeSlots ?? []) != null
                                      ? ` · ${formatDurationLabel(
                                          totalSlotsDecimalHours(taskDraft.timeSlots ?? []) as number,
                                        )}`
                                      : ''
                                  }`
                                : taskDraft.notCompletedAction === 'next_date'
                                  ? `Not Completed · Reschedule to ${taskDraft.rescheduleDate || '—'}`
                                  : 'Not Completed · Terminate'}
                            </span>
                          </div>
                        ) : null}
                        {enhancedEligible ? (
                          <DailyPlannerTaskDocumentsList task={task} />
                        ) : null}

                        {/* Action buttons: one horizontal row, right-aligned, compact */}
                        {showActionRow ? (
                          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                            {showMarkNotCompleted ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                                disabled={busyId === task.plannerTaskId}
                                onClick={() => setReasonTaskId(task.plannerTaskId)}
                              >
                                Mark Not Completed
                              </Button>
                            ) : null}
                            {showEdit && onEditTask ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                                disabled={busyId === task.plannerTaskId}
                                onClick={() => onEditTask(task)}
                              >
                                Edit Task
                              </Button>
                            ) : null}
                            {showDeleteOrReschedule ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                                disabled={busyId === task.plannerTaskId}
                                onClick={() => setDeleteTaskId(task.plannerTaskId)}
                              >
                                Delete Task
                              </Button>
                            ) : null}
                            {showDeleteOrReschedule ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                                disabled={busyId === task.plannerTaskId}
                                onClick={() => {
                                  setRescheduleTaskId(task.plannerTaskId);
                                  setRescheduleOnlyDate('');
                                }}
                              >
                                Reschedule Task
                              </Button>
                            ) : null}
                            {hasActiveDraft && canModifyTasks && !completionAlreadySubmitted ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="shrink-0"
                                  disabled={submittingDay}
                                  onClick={() =>
                                    taskDraft?.outcome === 'completed'
                                      ? setCompleteTaskId(task.plannerTaskId)
                                      : setReasonTaskId(task.plannerTaskId)
                                  }
                                >
                                  Edit Draft
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="shrink-0"
                                  disabled={submittingDay}
                                  onClick={() => clearDrafts([task.plannerTaskId])}
                                >
                                  Discard Draft
                                </Button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3">
                        {/* Per-step Work Done is shown under each step above when available. */}
                        {!hasPerStepWorkDone &&
                        !isExtraTaskCard &&
                        (task.status === 'Awaiting Verification' ||
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
                            {task.timeSlots && task.timeSlots.length > 0 ? (
                              <div className="mt-1 space-y-0.5 text-gray-600">
                                {task.timeSlots.map((slot, idx) => (
                                  <p key={`${slot.startTime}-${slot.endTime}-${idx}`}>
                                    Slot {idx + 1}: {formatHhMm12(slot.startTime)} –{' '}
                                    {formatHhMm12(slot.endTime)}
                                  </p>
                                ))}
                                {task.completionDurationHours != null ? (
                                  <p>Total: {formatDurationLabel(task.completionDurationHours)}</p>
                                ) : null}
                              </div>
                            ) : task.completionStartTime && task.completionEndTime ? (
                              <p className="mt-1 text-gray-600">
                                {task.completionStartTime} – {task.completionEndTime}
                                {task.completionDurationHours != null
                                  ? ` · ${formatDurationLabel(task.completionDurationHours)}`
                                  : ''}
                              </p>
                            ) : null}
                            {task.hasObservation && task.observationText ? (
                              <div className="mt-2">
                                <p className="font-medium text-gray-700">Observation</p>
                                <BulletPointList text={task.observationText} />
                              </div>
                            ) : null}
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
                                    {formatDurationLabel(task.replacementTask.hoursRequired)}
                                  </p>
                                ) : null}
                                {task.replacementTask.expectedOutcome ? (
                                  <div>
                                    <p className="font-medium">Instruction:</p>
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
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busyId === task.plannerTaskId}
                                onClick={() => onAddTask(task.plannerTaskId)}
                              >
                                Revision
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
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter
            className={`shrink-0 gap-2 border-t border-gray-200 bg-white px-6 py-4 ${
              canCompleteByDate && onExtraTask ? 'sm:justify-between' : 'sm:justify-end'
            }`}
          >
            {canCompleteByDate && onExtraTask ? (
              <Button
                type="button"
                variant="outline"
                disabled={!canCreateExtraTask}
                onClick={() => {
                  if (!canCreateExtraTask) {
                    toast.error(TASK_UPDATES_READONLY_MESSAGE);
                    return;
                  }
                  onExtraTask();
                }}
              >
                + Extra Task
              </Button>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {completionAlreadySubmitted ? (
                <p className="text-xs text-green-700 sm:mr-2">Completion submitted.</p>
              ) : factoryMode && pendingDraftTasks.length > 0 ? (
                <p className="text-xs text-amber-700 sm:mr-2">
                  {pendingDraftTasks.length} draft{pendingDraftTasks.length === 1 ? '' : 's'} saved
                  locally — click Submit to send.
                </p>
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
        <DialogContent
          className={cn(
            stepMode
              ? // Match Create Task exactly: override DialogContent defaults (incl. sm:max-w-lg)
                // with utilities + inline styles so width cannot collapse to max-w-md/lg.
                '!flex !h-[92vh] !max-h-[92vh] !w-[min(96vw,1200px)] !max-w-[1200px] !flex-col !gap-0 overflow-hidden !p-0 sm:!max-w-[1200px]'
              : // Legacy (no steps) — Factory: slightly wider for Start|End; Office stays max-w-md.
                factoryMode
                ? 'max-w-lg max-h-[90vh] overflow-y-auto'
                : 'max-w-md',
          )}
          style={
            stepMode
              ? {
                  width: 'min(96vw, 1200px)',
                  maxWidth: '1200px',
                  height: '92vh',
                  maxHeight: '92vh',
                }
              : undefined
          }
        >
          <DialogHeader
            className={cn(
              stepMode && 'shrink-0 border-b border-gray-200 px-6 py-3 pr-12 text-left',
            )}
          >
            <DialogTitle>Mark Completed</DialogTitle>
          </DialogHeader>
          <div
            className={cn(
              'min-w-0 space-y-4',
              stepMode && 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4',
            )}
          >
            {stepMode ? (
              <div className="min-w-0 space-y-3">
                {/*
                  ONE parent 2-column grid. Left/right cells are siblings (via Fragment),
                  so Step N always sits beside Work Done N — not stacked in one column.
                  Inline gridTemplateColumns forces 2 cols (modal is 1200px). Narrow viewports
                  fall back to a single column via max-sm override.
                */}
                <div
                  className="grid gap-x-4 gap-y-3 max-sm:[grid-template-columns:minmax(0,1fr)!important]"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    columnGap: '1rem',
                    rowGap: '0.75rem',
                  }}
                >
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
                    Step By Step Procedure
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
                    Work Done
                  </div>

                  {completeStepRows.map((row, idx) => {
                    const highlighted =
                      row.invalid || (highlightStepIds.includes(row.stepId) && !row.complete);
                    const startId = `complete-step-${row.stepId}-startTime`;
                    const endId = `complete-step-${row.stepId}-endTime`;
                    const workDoneId = `complete-step-${row.stepId}-workDone`;
                    return (
                      <Fragment key={row.stepId}>
                        {/* Left column cell — planned step */}
                        <div
                          className={cn(
                            'min-w-0 rounded-lg border border-gray-200 bg-white p-3',
                            highlighted && 'border-red-200 bg-red-50/40',
                          )}
                        >
                          <p className="break-words text-sm font-medium text-gray-900">
                            <span className="mr-1.5 text-gray-500">{idx + 1}.</span>
                            {row.description}
                          </p>
                          <p className="mt-1.5 text-xs text-gray-500">
                            Planned: {formatMinutesLabel(row.plannedMinutes)}
                          </p>
                        </div>

                        {/* Right column cell — Work Done + times */}
                        <div
                          className={cn(
                            'min-w-0 rounded-lg border border-gray-200 bg-white p-3',
                            highlighted && 'border-red-200 bg-red-50/40',
                          )}
                        >
                          <div className="space-y-2">
                            <Label htmlFor={workDoneId} className="text-xs text-gray-600">
                              Work Done
                            </Label>
                            <Textarea
                              id={workDoneId}
                              rows={2}
                              placeholder="Enter what was done..."
                              value={row.workDone}
                              className="min-h-[2.75rem] w-full max-w-full resize-y text-sm"
                              onChange={(e) =>
                                setStepTime(row.stepId, 'workDone', e.target.value)
                              }
                            />
                          </div>
                          <div className="mt-3 flex min-w-0 flex-wrap items-end gap-x-3 gap-y-2">
                            {factoryMode ? (
                              <>
                                <TwelveHourTimeInput
                                  id={startId}
                                  label="Start Time"
                                  required
                                  className="shrink-0"
                                  value={row.startTime}
                                  error={highlighted && !row.startTime}
                                  onChange={(v) => setStepTime(row.stepId, 'startTime', v)}
                                />
                                <TwelveHourTimeInput
                                  id={endId}
                                  label="End Time"
                                  required
                                  className="shrink-0"
                                  value={row.endTime}
                                  error={highlighted && (!row.endTime || row.invalid)}
                                  onChange={(v) => setStepTime(row.stepId, 'endTime', v)}
                                />
                              </>
                            ) : (
                              <>
                                <div className="w-[8.5rem] shrink-0 space-y-1.5">
                                  <Label htmlFor={startId} className="text-xs">
                                    Start Time *
                                  </Label>
                                  <Input
                                    id={startId}
                                    type="time"
                                    value={row.startTime}
                                    className={cn(
                                      'h-9',
                                      highlighted && !row.startTime && 'border-red-500',
                                    )}
                                    aria-invalid={highlighted && !row.startTime}
                                    onChange={(e) =>
                                      setStepTime(row.stepId, 'startTime', e.target.value)
                                    }
                                  />
                                </div>
                                <div className="w-[8.5rem] shrink-0 space-y-1.5">
                                  <Label htmlFor={endId} className="text-xs">
                                    End Time *
                                  </Label>
                                  <Input
                                    id={endId}
                                    type="time"
                                    value={row.endTime}
                                    className={cn(
                                      'h-9',
                                      highlighted &&
                                        (!row.endTime || row.invalid) &&
                                        'border-red-500',
                                    )}
                                    aria-invalid={highlighted && (!row.endTime || row.invalid)}
                                    onChange={(e) =>
                                      setStepTime(row.stepId, 'endTime', e.target.value)
                                    }
                                  />
                                </div>
                              </>
                            )}
                            <div className="min-w-[6.5rem] shrink-0 space-y-1.5">
                              <p className="text-xs font-medium leading-none text-gray-700">
                                Actual Time
                              </p>
                              <p className="flex h-9 items-center text-sm font-medium text-gray-800">
                                {row.actualMinutes != null
                                  ? formatMinutesLabel(row.actualMinutes)
                                  : '—'}
                              </p>
                            </div>
                          </div>
                          {highlighted ? (
                            <p className="mt-2 text-xs text-red-600">
                              {row.invalid
                                ? 'End Time must be after Start Time.'
                                : 'Start Time and End Time are required for this step.'}
                            </p>
                          ) : null}
                        </div>
                      </Fragment>
                    );
                  })}

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-800">
                    Total Planned Time: {formatMinutesLabel(stepTotalPlannedMinutes)}
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-800">
                    Total Actual Time: {formatMinutesLabel(stepTotalActualMinutes)}
                  </div>
                </div>
                {stepsAllComplete
                  ? (() => {
                      const timing = completionTimingMessage(
                        stepTotalPlannedMinutes / 60,
                        stepTotalActualMinutes,
                      );
                      if (!timing) return null;
                      return (
                        <p
                          className={cn(
                            'text-sm font-medium',
                            timing.startsWith('Failed') ? 'text-red-600' : 'text-green-600',
                          )}
                        >
                          {timing}
                        </p>
                      );
                    })()
                  : null}
              </div>
            ) : null}
            {factoryMode && !stepMode ? (
              <div className="min-w-0 space-y-3">
                {completeSlots.map((slot, idx) => (
                  <div
                    key={slot.id}
                    className="min-w-0 space-y-2 rounded-md border border-gray-200 p-3"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-medium text-gray-600">
                        Time Slot {idx + 1}
                      </p>
                      {completeSlots.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs text-gray-500 hover:text-red-600"
                          onClick={() =>
                            setCompleteSlots((prev) => prev.filter((s) => s.id !== slot.id))
                          }
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    {/*
                      Start | End side-by-side at natural control widths (~50+50+68px each).
                      Wrap only on genuinely narrow viewports.
                    */}
                    <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-2">
                      <TwelveHourTimeInput
                        id={`complete-slot-${slot.id}-start`}
                        label="Start Time"
                        required
                        className="shrink-0"
                        value={slot.startTime}
                        onChange={(v) =>
                          setCompleteSlots((prev) =>
                            prev.map((s) => (s.id === slot.id ? { ...s, startTime: v } : s)),
                          )
                        }
                      />
                      <TwelveHourTimeInput
                        id={`complete-slot-${slot.id}-end`}
                        label="End Time"
                        required
                        className="shrink-0"
                        value={slot.endTime}
                        onChange={(v) =>
                          setCompleteSlots((prev) =>
                            prev.map((s) => (s.id === slot.id ? { ...s, endTime: v } : s)),
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={completeSlots.length >= MAX_COMPLETION_TIME_SLOTS}
                  onClick={() =>
                    setCompleteSlots((prev) =>
                      prev.length >= MAX_COMPLETION_TIME_SLOTS
                        ? prev
                        : [...prev, createEmptyTimeSlot()],
                    )
                  }
                >
                  + Add Time Slot
                </Button>
                {completeSlotsValidation.ok ? (
                  <>
                    <p className="text-sm text-gray-600">
                      Duration:{' '}
                      {formatDurationLabel(
                        totalSlotsDecimalHours(completeSlots) ??
                          minutesToDecimalHours(completeSlotsValidation.totalMinutes),
                      )}
                    </p>
                    {(() => {
                      const timing = completionTimingMessage(
                        completeTaskForDialog?.hoursRequired,
                        completeSlotsValidation.totalMinutes,
                      );
                      if (!timing) return null;
                      return (
                        <p
                          className={cn(
                            'text-sm font-medium',
                            timing.startsWith('Failed') ? 'text-red-600' : 'text-green-600',
                          )}
                        >
                          {timing}
                        </p>
                      );
                    })()}
                  </>
                ) : completeSlotsValidation.issue !== 'incomplete' ? (
                  <p className="text-sm text-red-600">{completeSlotsValidation.message}</p>
                ) : null}
              </div>
            ) : null}
            <div className={cn('grid grid-cols-2 gap-3', (factoryMode || stepMode) && 'hidden')}>
              <div className="space-y-2">
                <Label htmlFor="complete-start-time">Start Time *</Label>
                <Input
                  id="complete-start-time"
                  type="time"
                  value={completeStartTime}
                  onChange={(e) => setCompleteStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complete-end-time">End Time *</Label>
                <Input
                  id="complete-end-time"
                  type="time"
                  value={completeEndTime}
                  onChange={(e) => setCompleteEndTime(e.target.value)}
                />
              </div>
            </div>
            {factoryMode || stepMode ? null : completeDurationPreview != null ? (
              <p className="text-sm text-gray-600">
                Duration: {formatDurationLabel(completeDurationPreview)}
              </p>
            ) : completeStartTime && completeEndTime ? (
              <p className="text-sm text-red-600">End Time must be on or after Start Time.</p>
            ) : null}
            {stepMode ? null : (
              <BulletPointEditor
                key={completeTaskId ?? 'complete-closed'}
                ref={workDoneEditorRef}
                id="work-done"
                label="Work Done"
                required
                defaultValue={
                  factoryMode && completeTaskId
                    ? completionDrafts[completeTaskId]?.workDone ?? ''
                    : ''
                }
              />
            )}
            {factoryMode ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="complete-has-observation">
                    Do you have any observation regarding this project/task?
                  </Label>
                  <Select
                    value={completeHasObservation}
                    onValueChange={(v) => setCompleteHasObservation(v as 'Yes' | 'No')}
                  >
                    <SelectTrigger id="complete-has-observation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="Yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {completeHasObservation === 'Yes' ? (
                  <BulletPointEditor
                    key={`observation-${completeTaskId ?? 'closed'}`}
                    ref={observationEditorRef}
                    id="complete-observation"
                    label="Observation"
                    required
                    defaultValue={
                      completeTaskId ? completionDrafts[completeTaskId]?.observationText ?? '' : ''
                    }
                  />
                ) : null}
              </div>
            ) : null}
            {enhancedEligible ? (
              <DailyPlannerEnhancedTaskFields
                idPrefix="complete"
                isProjectBased={Boolean(
                  tasks.find((t) => t.plannerTaskId === completeTaskId)?.isProjectBased,
                )}
                alwaysShowProgressDone={factoryMode}
                progressReadOnly={stepMode}
                values={{
                  needsDocument: completeNeedsDocument,
                  // Step-based: duration-weighted progress derived from completed steps.
                  progressDone: stepMode ? stepProgressPercent : completeProgressDone,
                  documentFile: completeDocumentFile,
                  documentFiles: completeDocumentFiles,
                }}
                onChange={(patch) => {
                  if (patch.needsDocument !== undefined) setCompleteNeedsDocument(patch.needsDocument);
                  if (patch.progressDone !== undefined) setCompleteProgressDone(patch.progressDone);
                  if (patch.documentFile !== undefined) setCompleteDocumentFile(patch.documentFile);
                  if (patch.documentFiles !== undefined) setCompleteDocumentFiles(patch.documentFiles);
                }}
                existingFileName={
                  tasks.find((t) => t.plannerTaskId === completeTaskId)?.documentFileKey
                    ? 'attached'
                    : undefined
                }
              />
            ) : null}
          </div>
          <DialogFooter
            className={cn(stepMode && 'shrink-0 border-t border-gray-200 px-6 py-3')}
          >
            <Button type="button" variant="outline" onClick={() => setCompleteTaskId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitCompleted()} disabled={!!busyId}>
              {factoryMode ? 'Save' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Case B: some steps lack Start/End — offer to enter them now, or reschedule only those steps. */}
      <AlertDialog
        open={missingTimesPromptOpen && !!completeTaskId}
        onOpenChange={(v) => {
          if (!v) setMissingTimesPromptOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Missing step times</AlertDialogTitle>
            <AlertDialogDescription>{MISSING_STEP_TIMES_PROMPT}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                // "No": ask for a date and reschedule only the incomplete steps.
                setMissingTimesPromptOpen(false);
                setRescheduleStepsDate('');
                setRescheduleStepsOpen(true);
              }}
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // "Yes": stay on the form with incomplete steps highlighted; entered data is preserved.
                setMissingTimesPromptOpen(false);
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={rescheduleStepsOpen && !!completeTaskId}
        onOpenChange={(v) => {
          if (!v) setRescheduleStepsOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule incomplete steps</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Only the steps without complete times will move to the new date. Steps with Start and
              End Time stay on this task and are submitted as completed.
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-sm text-gray-800">
              {completeStepRows
                .filter((r) => !r.complete)
                .map((r) => (
                  <li key={r.stepId} className="break-words">
                    {r.description}
                  </li>
                ))}
            </ul>
            <div className="space-y-2">
              <Label htmlFor="reschedule-steps-new-date">New Date</Label>
              <Input
                id="reschedule-steps-new-date"
                type="date"
                min={minRescheduleDate}
                value={rescheduleStepsDate}
                onChange={(event) => setRescheduleStepsDate(event.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRescheduleStepsOpen(false)}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => void confirmRescheduleIncompleteSteps()}
              disabled={!!busyId}
            >
              Reschedule &amp; Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTaskId}
        onOpenChange={(v) => {
          if (!v) setDeleteTaskId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this planned task? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!busyId}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteTask();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!rescheduleTaskId}
        onOpenChange={(v) => {
          if (!v) {
            setRescheduleTaskId(null);
            setRescheduleOnlyDate('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reschedule-task-new-date">New Date</Label>
              <Input
                id="reschedule-task-new-date"
                type="date"
                min={minRescheduleDate}
                value={rescheduleOnlyDate}
                onChange={(event) => setRescheduleOnlyDate(event.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRescheduleTaskId(null);
                setRescheduleOnlyDate('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmRescheduleOnly()}
              disabled={!!busyId}
            >
              Reschedule
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
              defaultValue={
                factoryMode && reasonTaskId ? completionDrafts[reasonTaskId]?.reason ?? '' : ''
              }
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
            {enhancedEligible ? (
              <DailyPlannerEnhancedTaskFields
                idPrefix="not-completed"
                isProjectBased={Boolean(
                  tasks.find((t) => t.plannerTaskId === reasonTaskId)?.isProjectBased,
                )}
                values={{
                  needsDocument: notCompletedNeedsDocument,
                  progressDone: notCompletedProgressDone,
                  documentFile: notCompletedDocumentFile,
                  documentFiles: notCompletedDocumentFiles,
                }}
                onChange={(patch) => {
                  if (patch.needsDocument !== undefined) {
                    setNotCompletedNeedsDocument(patch.needsDocument);
                  }
                  if (patch.progressDone !== undefined) {
                    setNotCompletedProgressDone(patch.progressDone);
                  }
                  if (patch.documentFile !== undefined) {
                    setNotCompletedDocumentFile(patch.documentFile);
                  }
                  if (patch.documentFiles !== undefined) {
                    setNotCompletedDocumentFiles(patch.documentFiles);
                  }
                }}
                existingFileName={
                  tasks.find((t) => t.plannerTaskId === reasonTaskId)?.documentFileKey
                    ? 'attached'
                    : undefined
                }
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetNotCompletedDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitNotCompleted()} disabled={!!busyId}>
              {factoryMode ? 'Save' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
