import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, CheckCheck, ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { DailyPlannerPriority, DailyPlannerTask } from '../../types/dailyPlanner';
import {
  approveDailyPlannerTask,
  requestNeedsRevisionDailyPlannerTask,
  reopenApprovedDailyPlannerTask,
  rescheduleDailyPlannerTaskBySuperAdmin,
  deleteDailyPlannerTaskBySuperAdmin,
  saveDailyPlannerManagerComments,
  verifyDailyPlannerCompletion,
  createDailyPlannerTaskForEmployee,
  finalizeEmployeeDailyPlan,
  updateDailyPlannerTaskForEmployee,
  reviewDailyPlannerTaskCompletion,
  submitDayCompletionReview,
  raiseDailyPlannerTaskFlag,
  uploadDailyPlannerTaskDocument,
  submitSuperadminReviewComment,
} from '../../hooks/dailyPlanner/dailyPlannerApi';
import {
  sortDailyPlannerTasksByPriority,
  sumAllTaskDurationHours,
  sumPlannedHoursForDate,
} from './dailyPlannerUtils';
import BulletPointEditor, { type BulletPointEditorHandle } from './BulletPointEditor';
import BulletPointList from './BulletPointList';
import { hasBulletContent, parseBulletPoints } from './bulletPointUtils';
import DailyPlannerCreateTaskModal from './DailyPlannerCreateTaskModal';
import DailyPlannerTaskDocumentsList from './DailyPlannerTaskDocumentsList';
import HoursMinutesFields from './HoursMinutesFields';
import { isEnhancedDailyPlannerEligible } from '../../utils/dailyPlannerEnhancedEligibility';
import { isFactoryDailyPlannerEligible } from '../../utils/dailyPlannerFactoryEligibility';
import {
  descriptionFromProcedureSteps,
  formatMinutesLabel,
  partsFromPlannedMinutes,
  partsToDecimalHours,
  plannedMinutesFromParts,
  resolveProcedureSteps,
  sumActualMinutes,
  sumPlannedMinutes,
  type DailyPlannerProcedureStep,
} from '../../utils/dailyPlannerProcedureSteps';
import { hhMmTo12hParts } from './TwelveHourTimeInput';
import ProjectPastDataDialog from './ProjectPastDataDialog';
import {
  countCompletionReviewedTasks,
  countReviewedTasks,
  formatReviewDate,
  getPreviousRevisionCount,
  getTaskOriginLabel,
  getWizardReviewIndicator,
  isTaskCompletionReviewed,
  isTaskManagerReviewed,
  type WizardReviewIndicator,
} from './todayTaskReviewWizardUtils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { cn } from '../ui/utils';
import {
  formatDurationLabel,
  getMinPlannedHours,
} from '../../utils/planningRecognition';
import { usePlanningConfigQuery } from '../../hooks/dailyPlanner/useDailyPlannerQueries';
import { canManageDailyPlannerTeam } from '../../utils/accessControl';
import { todayIso } from './dailyPlannerUtils';

function displayCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

function formatDateCell(iso: string | undefined | null): string {
  if (!iso || String(iso).trim() === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return displayCell(iso);
  return d.toLocaleString('en-GB');
}

/** Display HH:mm as 12-hour clock for Work Done rows (existing time convention). */
function formatReviewTime12h(hhmm: string | null | undefined): string {
  const parts = hhMmTo12hParts(String(hhmm || ''));
  if (!parts.hour12) return '';
  return `${parts.hour12}:${parts.minute} ${parts.period}`;
}

function ViewField({
  label,
  value,
  compact,
}: {
  label: string;
  value: ReactNode;
  /** Tighter label/value gap (Task Summary only). */
  compact?: boolean;
}) {
  return (
    <div className={cn('min-w-0', compact ? 'space-y-0.5' : 'space-y-1.5')}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="text-sm text-[#212529] break-words">{value}</div>
    </div>
  );
}

function ViewSection({
  title,
  children,
  headerRight,
  className,
}: {
  title: string;
  children: ReactNode;
  /** Optional control aligned with the section heading (e.g. Past Data). */
  headerRight?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-lg border border-gray-200 bg-white p-4 shadow-sm',
        className,
      )}
    >
      <div
        data-slot="section-heading"
        className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2"
      >
        <h3 className="text-sm font-semibold text-[#212529]">{title}</h3>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ViewBulletField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="min-h-[2.5rem] rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
        <BulletPointList text={value} />
      </div>
    </div>
  );
}

const INDICATOR_STYLES: Record<
  WizardReviewIndicator,
  { icon: ReactNode; label: string; className: string }
> = {
  approved: {
    icon: <Check className="h-3 w-3" />,
    label: 'Approved',
    className: 'border-green-500 bg-green-50 text-green-700',
  },
  verified: {
    icon: <CheckCheck className="h-3 w-3" />,
    label: 'Verified',
    className: 'border-green-700 bg-green-100 text-green-900',
  },
  revision: {
    icon: <span className="text-[10px] font-bold leading-none">!</span>,
    label: 'Revision',
    className: 'border-orange-500 bg-orange-50 text-orange-700',
  },
  pending: {
    icon: <span className="text-[10px] leading-none">○</span>,
    label: 'Pending',
    className: 'border-gray-300 bg-gray-50 text-gray-500',
  },
};

export interface TodayReviewEmployeeInfo {
  employeeCode: string;
  employeeName: string;
  department?: string;
  designation?: string;
  location?: string;
  /** Server-resolved enhanced Daily Planner eligibility for this employee. */
  enhancedEligible?: boolean;
}

interface TodayTaskReviewWizardProps {
  open: boolean;
  tasks: DailyPlannerTask[];
  employee: TodayReviewEmployeeInfo;
  reviewDate: string;
  initialTaskIndex?: number;
  /** When true, wizard runs completion-review stage (not plan finalize). */
  completionReviewMode?: boolean;
  /**
   * Historical Team Daily Planner viewing — full task details, no plan edits /
   * finalize / add-task actions. Super Admin past-date review stays editable.
   */
  readOnly?: boolean;
  /**
   * Super Admin viewing an employee outside their own team: view + permanent
   * review comment only (no task mutations).
   */
  outOfTeamReviewOnly?: boolean;
  /** Daily Planner module effective role — used for Super Admin correction privileges. */
  moduleRole?: string;
  /** Approved leave kind for reviewDate (full → 0h, half → half requirement). */
  leaveKind?: 'none' | 'full' | 'half';
  onClose: () => void;
  onFinish: () => void;
  onTasksUpdated: (
    updatedTasks?: DailyPlannerTask[],
    options?: { replaceEmployeeDate?: boolean; removeTaskIds?: string[] },
  ) => Promise<void> | void;
}

export default function TodayTaskReviewWizard({
  open,
  tasks,
  employee,
  reviewDate,
  initialTaskIndex = 0,
  completionReviewMode = false,
  readOnly = false,
  outOfTeamReviewOnly = false,
  moduleRole,
  leaveKind = 'none',
  onClose,
  onFinish,
  onTasksUpdated,
}: TodayTaskReviewWizardProps) {
  /** Admin / Super Admin / Developer — backend still enforces team scope for Admin. */
  const canCorrectTeamTask = canManageDailyPlannerTeam(String(moduleRole || ''));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingPriority, setEditingPriority] = useState(false);
  const [stagedPriority, setStagedPriority] = useState<DailyPlannerPriority>('Medium');
  const [editingHours, setEditingHours] = useState(false);
  const [stagedHours, setStagedHours] = useState<number | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const descriptionEditorRef = useRef<BulletPointEditorHandle>(null);
  /** Draft Manager Comments keyed by plannerTaskId — survives Previous/Next navigation. */
  const [managerCommentsByTaskId, setManagerCommentsByTaskId] = useState<Record<string, string>>(
    {},
  );
  const managerCommentsByTaskIdRef = useRef(managerCommentsByTaskId);
  managerCommentsByTaskIdRef.current = managerCommentsByTaskId;
  /** Super Admin out-of-team review comment drafts (separate from managerComments). */
  const [outOfTeamCommentByTaskId, setOutOfTeamCommentByTaskId] = useState<Record<string, string>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [savePhase, setSavePhase] = useState<'idle' | 'saved'>('idle');
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [replacementName, setReplacementName] = useState('');
  const [replacementDescription, setReplacementDescription] = useState('');
  const [replacementPriority, setReplacementPriority] = useState<DailyPlannerPriority>('Medium');
  const [replacementHours, setReplacementHours] = useState<number | null>(null);
  const [replacementOutcome, setReplacementOutcome] = useState('');
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [planModified, setPlanModified] = useState(false);
  const [stagedName, setStagedName] = useState('');
  const [stagedDescription, setStagedDescription] = useState('');
  const [stagedInstructions, setStagedInstructions] = useState('');
  /** Super Admin correction dialogs */
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenAction, setReopenAction] = useState<'revision' | 'reschedule' | 'delete' | ''>('');
  const [reopenReason, setReopenReason] = useState('');
  const [reopenTaskName, setReopenTaskName] = useState('');
  const [reopenTaskDescription, setReopenTaskDescription] = useState('');
  const [reopenTaskPriority, setReopenTaskPriority] = useState<DailyPlannerPriority>('Medium');
  const [reopenTaskHours, setReopenTaskHours] = useState<number | null>(null);
  const [reopenInstruction, setReopenInstruction] = useState('');
  const [reopenRescheduleDate, setReopenRescheduleDate] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleInstruction, setRescheduleInstruction] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagInstruction, setFlagInstruction] = useState('');
  /** Compact plan-review: edit one step field at a time (description or duration). */
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStepField, setEditingStepField] = useState<'description' | 'duration' | null>(
    null,
  );
  const [stepDescDraft, setStepDescDraft] = useState('');
  const [stepHoursDraft, setStepHoursDraft] = useState('0');
  const [stepMinutesDraft, setStepMinutesDraft] = useState('0');
  const [pastDataOpen, setPastDataOpen] = useState(false);
  const [uploadingManagerDoc, setUploadingManagerDoc] = useState(false);
  const managerDocInputRef = useRef<HTMLInputElement>(null);
  const planningConfigQuery = usePlanningConfigQuery();
  /** Always use the reviewed employee's location — never the manager's planning-config minimum. */
  const minPlannedHours = getMinPlannedHours(null, employee.location, leaveKind);
  /** Prefer server-enriched flag for the task owner; fall back to location+viewer role. */
  const showEnhancedTaskUi =
    typeof employee.enhancedEligible === 'boolean'
      ? employee.enhancedEligible
      : isEnhancedDailyPlannerEligible(employee.location, moduleRole);
  const minRescheduleDate = planningConfigQuery.data?.todayIst ?? todayIso();

  const sortedTasks = useMemo(
    () => sortDailyPlannerTasksByPriority(tasks),
    [tasks],
  );

  /** Header total: exact sum of every task's Hours Required (minutes-accurate). */
  const planTotalHours = useMemo(() => sumAllTaskDurationHours(sortedTasks), [sortedTasks]);

  /** Finalize / minimum check: existing countable planned hours only (unchanged rules). */
  const planHoursTowardMinimum = useMemo(
    () => sumPlannedHoursForDate(sortedTasks, reviewDate),
    [sortedTasks, reviewDate],
  );

  const planFinalized = useMemo(
    () => sortedTasks.some((t) => Boolean(t.planFinalizedAt)),
    [sortedTasks],
  );
  const commentDraftChanged = sortedTasks.some((reviewTask) => {
    const draft = managerCommentsByTaskId[reviewTask.plannerTaskId];
    if (draft === undefined) return false;
    return String(draft).trim() !== String(reviewTask.managerComments || '').trim();
  });
  const canRefinalize = planModified || (editMode && commentDraftChanged);
  const fieldsReadOnly = readOnly || (planFinalized && !editMode);

  const task = sortedTasks[currentIndex] ?? null;
  const total = sortedTasks.length;
  const reviewedCount = completionReviewMode
    ? countCompletionReviewedTasks(sortedTasks)
    : countReviewedTasks(sortedTasks);
  const allReviewed = total > 0 && reviewedCount === total;
  const progressPct = total > 0 ? Math.round((reviewedCount / total) * 100) : 0;

  const managerComments = task
    ? (managerCommentsByTaskId[task.plannerTaskId] ?? task.managerComments ?? '')
    : '';
  const outOfTeamCommentDraft = task
    ? (outOfTeamCommentByTaskId[task.plannerTaskId] ?? '')
    : '';
  const savedOutOfTeamComments = task?.superadminReviewComments ?? [];

  const handleSubmitOutOfTeamReviewComment = async () => {
    if (!task || !outOfTeamReviewOnly) return;
    const text = String(outOfTeamCommentDraft || '').trim();
    if (!text) {
      toast.error('Review comment is required');
      return;
    }
    setBusy(true);
    try {
      const submissionId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `sa-review-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await submitSuperadminReviewComment(task.plannerTaskId, {
        comment: text,
        submissionId,
      });
      await onTasksUpdated([result.task]);
      setOutOfTeamCommentByTaskId((prev) => ({
        ...prev,
        [task.plannerTaskId]: '',
      }));

      const empOk = Boolean(result.email?.employee?.ok);
      const empSkipped = Boolean(result.email?.employee?.skipped);
      const mgrResults = result.email?.reportingPersons || [];
      const mgrOk = mgrResults.filter((r) => r.ok).length;
      const mgrAttempted = mgrResults.filter((r) => !r.skipped).length;

      if (result.duplicate) {
        toast.message('Review comment was already saved');
      } else if (empOk && (mgrOk === mgrAttempted || mgrAttempted === 0)) {
        toast.success(
          mgrAttempted === 0
            ? 'Review comment saved. Employee notified (no reporting person email found).'
            : 'Review comment saved. Employee and reporting person notified.',
        );
      } else if (empOk || mgrOk > 0) {
        toast.message(
          'Review comment saved, but some email notifications could not be sent. Check server logs.',
        );
      } else if (empSkipped && mgrAttempted === 0) {
        toast.message(
          'Review comment saved. No recipient emails were available for notifications.',
        );
      } else {
        toast.message(
          'Review comment saved, but email notifications could not be sent.',
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save review comment');
    } finally {
      setBusy(false);
    }
  };

  const getDraftCommentsForTask = useCallback((taskId: string, fallbackTask?: DailyPlannerTask | null) => {
    const drafts = managerCommentsByTaskIdRef.current;
    if (Object.prototype.hasOwnProperty.call(drafts, taskId)) {
      return String(drafts[taskId] ?? '').trim();
    }
    return String(fallbackTask?.managerComments ?? '').trim();
  }, []);

  const setManagerCommentsForCurrentTask = (value: string) => {
    if (!task) return;
    const taskId = task.plannerTaskId;
    setManagerCommentsByTaskId((prev) => ({ ...prev, [taskId]: value }));
  };

  useEffect(() => {
    if (!open) return;
    const safeIndex = Math.min(Math.max(0, initialTaskIndex), Math.max(0, total - 1));
    setCurrentIndex(safeIndex);
    setSavePhase('idle');
    setEditingPriority(false);
    setEditingHours(false);
    setEditingDescription(false);
    setEditMode(false);
    setPlanModified(false);
    setManagerCommentsByTaskId({});
    setRevisionOpen(false);
    setEditingStepId(null);
    setEditingStepField(null);
    setPastDataOpen(false);
  }, [open, initialTaskIndex, total, employee.employeeCode]);

  useEffect(() => {
    if (!task) return;
    setEditingPriority(false);
    setStagedPriority((task.currentPriority || task.priority || 'Medium') as DailyPlannerPriority);
    setEditingHours(false);
    setEditingDescription(false);
    setEditingStepId(null);
    setEditingStepField(null);
    setStagedHours(
      task.hoursRequired != null && Number.isFinite(Number(task.hoursRequired))
        ? Number(task.hoursRequired)
        : null,
    );
    setStagedName(task.taskName || '');
    setStagedDescription(task.description || '');
    setStagedInstructions(task.managerInstructions || '');
    setRevisionOpen(false);
    setRevisionReason('');
    setReplacementName('');
    setReplacementDescription('');
    setReplacementPriority('Medium');
    setReplacementHours(null);
    setReplacementOutcome('');
    setSavePhase('idle');
  }, [task?.plannerTaskId]);

  const currentPriority = task
    ? ((task.currentPriority || task.priority || 'Medium') as DailyPlannerPriority)
    : 'Medium';
  const displayPriority = editingPriority ? stagedPriority : currentPriority;
  const priorityChanged = editingPriority && stagedPriority !== currentPriority;
  const currentHours =
    task?.hoursRequired != null && Number.isFinite(Number(task.hoursRequired))
      ? Number(task.hoursRequired)
      : null;
  const stagedHoursNumber = Number(stagedHours);
  const hoursChanged =
    editingHours &&
    stagedHours != null &&
    Number.isFinite(stagedHoursNumber) &&
    stagedHoursNumber > 0 &&
    stagedHoursNumber !== currentHours;
  const awaitingVerification =
    task?.status === 'Awaiting Verification' || task?.status === 'Completed';
  const showApprove =
    !completionReviewMode &&
    !planFinalized &&
    (task?.status === 'Pending' ||
      (editingPriority && priorityChanged) ||
      (editingHours && hoursChanged));
  const showVerify = awaitingVerification;
  const showRequestRevision =
    !completionReviewMode &&
    !planFinalized &&
    (task?.status === 'Pending' ||
      task?.status === 'Approved' ||
      awaitingVerification);
  const showReopenTask =
    canCorrectTeamTask && !completionReviewMode && task?.status === 'Approved';
  const showSuperAdminReschedule =
    canCorrectTeamTask &&
    Boolean(task) &&
    task?.status !== 'Rescheduled' &&
    task?.status !== 'Verified Complete';

  /**
   * Compact Task Summary + steps table for both plan review and Pending Completion Approval.
   * Edit mode keeps the full form.
   */
  const compactReview = !editMode;
  const procedureSteps = useMemo(() => (task ? resolveProcedureSteps(task) : []), [task]);
  const procedureActualMinutes = useMemo(
    () =>
      sumActualMinutes(procedureSteps.filter((s) => s.status !== 'rescheduled')),
    [procedureSteps],
  );
  const summaryActualTimeLabel = useMemo(() => {
    if (procedureActualMinutes > 0) return formatMinutesLabel(procedureActualMinutes);
    const stored = Number(task?.completionDurationHours);
    if (Number.isFinite(stored) && stored >= 0) return formatDurationLabel(stored);
    return '—';
  }, [procedureActualMinutes, task?.completionDurationHours]);

  const advanceAfterSave = useCallback(() => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    }
    setSavePhase('idle');
  }, [currentIndex, total]);

  const runSaveFlow = useCallback(
    async (saveFn: () => Promise<DailyPlannerTask | void>) => {
      setBusy(true);
      try {
        const updated = await saveFn();
        setSavePhase('saved');
        await onTasksUpdated(updated ? [updated] : undefined);
        advanceAfterSave();
      } catch (err) {
        setSavePhase('idle');
        toast.error(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setBusy(false);
      }
    },
    [advanceAfterSave, onTasksUpdated],
  );

  const handleSaveEditedTask = () => {
    if (!task || !editMode) return;
    const name = stagedName.trim();
    if (!name) {
      toast.error('Task Name is required');
      return;
    }
    if (!stagedDescription.trim()) {
      toast.error('Task Description is required');
      return;
    }
    const hoursValue = Number(stagedHours);
    if (stagedHours == null || !Number.isFinite(hoursValue) || hoursValue <= 0) {
      toast.error('Hours Required to Complete must be greater than 0');
      return;
    }
    const taskId = task.plannerTaskId;
    const comments = getDraftCommentsForTask(taskId, task);
    void runSaveFlow(async () => {
      const updated = await updateDailyPlannerTaskForEmployee(taskId, {
        taskName: name,
        description: stagedDescription.trim(),
        priority: stagedPriority,
        hoursRequired: Math.round(hoursValue * 100) / 100,
        managerInstructions: stagedInstructions.trim(),
        managerComments: comments,
        allowFinalizedEdit: true,
        skipRevisedEmail: true,
      });
      setPlanModified(true);
      setEditingPriority(false);
      setEditingHours(false);
      return updated;
    });
  };

  const handleSaveDescription = () => {
    if (!task || !editingDescription) return;
    const formatted = String(
      descriptionEditorRef.current?.getFormattedValue() || stagedDescription || '',
    ).trim();
    if (!hasBulletContent(parseBulletPoints(formatted))) {
      toast.error('Task Description is required');
      return;
    }
    const taskId = task.plannerTaskId;
    setBusy(true);
    void (async () => {
      try {
        const updated = await updateDailyPlannerTaskForEmployee(taskId, {
          description: formatted,
          allowFinalizedEdit: Boolean(task.planFinalizedAt),
          skipRevisedEmail: true,
        });
        setStagedDescription(formatted);
        setEditingDescription(false);
        if (task.planFinalizedAt) setPlanModified(true);
        await onTasksUpdated([updated]);
        toast.success('Description updated');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update description');
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleCancelDescription = () => {
    setEditingDescription(false);
    setStagedDescription(task?.description || '');
  };

  /** Persist procedureSteps via the existing for-employee update (description + hours re-synced server-side). */
  const persistProcedureSteps = async (
    nextSteps: DailyPlannerProcedureStep[],
    options: { preserveStatus?: boolean; successMessage: string },
  ): Promise<boolean> => {
    if (!task) return false;
    const taskId = task.plannerTaskId;
    const parts = partsFromPlannedMinutes(sumPlannedMinutes(nextSteps));
    setBusy(true);
    try {
      const updated = await updateDailyPlannerTaskForEmployee(taskId, {
        procedureSteps: nextSteps,
        description: descriptionFromProcedureSteps(nextSteps),
        hoursRequired: partsToDecimalHours(parts.hours, parts.minutes),
        allowFinalizedEdit: Boolean(task.planFinalizedAt),
        skipRevisedEmail: true,
        preserveStatus: options.preserveStatus,
      });
      if (task.planFinalizedAt) setPlanModified(true);
      await onTasksUpdated([updated]);
      toast.success(options.successMessage);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update steps');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const cancelStepEdit = () => {
    setEditingStepId(null);
    setEditingStepField(null);
  };

  const startEditStepDescription = (step: DailyPlannerProcedureStep) => {
    if (fieldsReadOnly) return;
    setEditingStepId(step.stepId);
    setEditingStepField('description');
    setStepDescDraft(step.description);
  };

  const startEditStepDuration = (step: DailyPlannerProcedureStep) => {
    if (fieldsReadOnly) return;
    const parts = partsFromPlannedMinutes(step.plannedMinutes);
    setEditingStepId(step.stepId);
    setEditingStepField('duration');
    setStepHoursDraft(String(parts.hours));
    setStepMinutesDraft(String(parts.minutes));
  };

  const handleSaveStepDescription = async (stepId: string) => {
    const description = stepDescDraft.trim();
    if (!description) {
      toast.error('Step description is required');
      return;
    }
    const nextSteps = procedureSteps.map((s) =>
      s.stepId === stepId ? { ...s, description } : s,
    );
    const ok = await persistProcedureSteps(nextSteps, { successMessage: 'Step description updated' });
    if (ok) cancelStepEdit();
  };

  const handleSaveStepDuration = async (stepId: string) => {
    const minutes = plannedMinutesFromParts(Number(stepHoursDraft), Number(stepMinutesDraft));
    if (!(minutes > 0)) {
      toast.error('Step duration must be greater than 0');
      return;
    }
    const nextSteps = procedureSteps.map((s) =>
      s.stepId === stepId ? { ...s, plannedMinutes: minutes } : s,
    );
    const ok = await persistProcedureSteps(nextSteps, { successMessage: 'Step duration updated' });
    if (ok) cancelStepEdit();
  };

  const handleApprove = () => {
    if (!task) return;
    if (editingHours) {
      const hoursValue = Number(stagedHours);
      if (stagedHours == null || !Number.isFinite(hoursValue) || hoursValue <= 0) {
        toast.error('Hours Required to Complete must be greater than 0');
        return;
      }
    }
    const taskId = task.plannerTaskId;
    const comments = getDraftCommentsForTask(taskId, task);
    void runSaveFlow(async () => {
      const hoursValue = Number(stagedHours);
      const updated = await approveDailyPlannerTask(taskId, {
        comments,
        priority: priorityChanged || editingPriority ? stagedPriority : undefined,
        hoursRequired:
          editingHours && Number.isFinite(hoursValue) && hoursValue > 0
            ? Math.round(hoursValue * 100) / 100
            : undefined,
      });
      setEditingPriority(false);
      setEditingHours(false);
      return updated;
    });
  };

  const handleVerify = () => {
    if (!task) return;
    const taskId = task.plannerTaskId;
    const comments = getDraftCommentsForTask(taskId, task);
    void runSaveFlow(async () => {
      return verifyDailyPlannerCompletion(taskId, comments);
    });
  };

  const handleManagerDocumentSelected = async (files: File[]) => {
    if (!task || files.length === 0 || !showEnhancedTaskUi || readOnly) return;
    const documentType = completionReviewMode ? 'managerApproval' : 'managerReview';
    setUploadingManagerDoc(true);
    try {
      const payload = files.length === 1 ? files[0] : files;
      const updated = await uploadDailyPlannerTaskDocument(
        task.plannerTaskId,
        payload,
        documentType,
      );
      await onTasksUpdated([updated]);
      toast.success(
        documentType === 'managerApproval'
          ? files.length > 1
            ? 'Manager Approval Document uploaded (combined PDF)'
            : 'Manager Approval Document uploaded'
          : files.length > 1
            ? 'Manager Review Document uploaded (combined PDF)'
            : 'Manager Review Document uploaded',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Document upload failed');
    } finally {
      setUploadingManagerDoc(false);
      if (managerDocInputRef.current) managerDocInputRef.current.value = '';
    }
  };

  const handleFinishReview = async () => {
    if (!allReviewed || busy) return;
    if (completionReviewMode) {
      setBusy(true);
      try {
        const updated = await submitDayCompletionReview(employee.employeeCode, reviewDate);
        if (updated.length) await onTasksUpdated(updated);
        toast.success('Completion review submitted');
        onFinish();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to submit completion review');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (planFinalized && !canRefinalize) return;
    if (leaveKind === 'full') {
      toast.error(
        'This employee is on approved full-day leave for this date. Daily Planner tasks are not required and cannot be created.',
      );
      return;
    }
    if (minPlannedHours > 0 && planHoursTowardMinimum < minPlannedHours) {
      toast.error(
        `Final plan must total at least ${formatDurationLabel(minPlannedHours)} (currently ${formatDurationLabel(planHoursTowardMinimum)}).`,
      );
      return;
    }
    setBusy(true);
    try {
      const drafts = managerCommentsByTaskIdRef.current;
      const updatedTasks: DailyPlannerTask[] = [];
      for (const reviewTask of sortedTasks) {
        const taskId = reviewTask.plannerTaskId;
        if (!Object.prototype.hasOwnProperty.call(drafts, taskId)) continue;
        const nextComments = String(drafts[taskId] ?? '').trim();
        const existingComments = String(reviewTask.managerComments ?? '').trim();
        if (nextComments === existingComments) continue;
        const saved = await saveDailyPlannerManagerComments(taskId, nextComments);
        updatedTasks.push(saved);
      }
      if (updatedTasks.length > 0) {
        await onTasksUpdated(updatedTasks);
      }
      const finalized = await finalizeEmployeeDailyPlan(employee.employeeCode, reviewDate, {
        refinalize: planFinalized && canRefinalize,
      });
      if (finalized.tasks.length) {
        await onTasksUpdated(finalized.tasks, { replaceEmployeeDate: true });
      }
      toast.success(
        finalized.emailSent
          ? planFinalized && canRefinalize
            ? 'Updated plan finalized and email sent to employee'
            : 'Plan finalized and email sent to employee'
          : 'Plan finalized',
      );
      onFinish();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to finalize plan');
    } finally {
      setBusy(false);
    }
  };

  const handleReviewCompletionOutcome = () => {
    if (!task) return;
    const taskId = task.plannerTaskId;
    const comments = getDraftCommentsForTask(taskId, task);
    void runSaveFlow(async () => {
      return reviewDailyPlannerTaskCompletion(taskId, comments);
    });
  };

  const handleSubmitRevision = () => {
    if (!task) return;
    if (!revisionReason.trim()) {
      toast.error('Reason is required');
      return;
    }
    if (!replacementName.trim()) {
      toast.error('Replacement task name is required');
      return;
    }
    if (!replacementDescription.trim()) {
      toast.error('Replacement task description is required');
      return;
    }
    const hoursValue = Number(replacementHours);
    if (replacementHours == null || !Number.isFinite(hoursValue) || hoursValue <= 0) {
      toast.error('Hours Required to Complete must be greater than 0');
      return;
    }
    void runSaveFlow(async () => {
      const result = await requestNeedsRevisionDailyPlannerTask(task.plannerTaskId, {
        reason: revisionReason.trim(),
        replacementTask: {
          taskName: replacementName.trim(),
          description: replacementDescription.trim(),
          priority: replacementPriority,
          hoursRequired: Math.round(hoursValue * 100) / 100,
          expectedOutcome: replacementOutcome.trim(),
          instruction: replacementOutcome.trim(),
        },
      });
      setRevisionOpen(false);
      setReopenOpen(false);
      const updates = [result.task, result.revisedTask].filter(Boolean) as DailyPlannerTask[];
      if (updates.length) await onTasksUpdated(updates);
      return result.revisedTask || result.task;
    });
  };

  const resetReopenForm = () => {
    setReopenAction('');
    setReopenReason('');
    setReopenTaskName('');
    setReopenTaskDescription('');
    setReopenTaskPriority('Medium');
    setReopenTaskHours(null);
    setReopenInstruction('');
    setReopenRescheduleDate('');
  };

  const openReopenDialog = () => {
    if (!task) return;
    setReopenAction('');
    setReopenReason('');
    setReopenTaskName(task.taskName || '');
    setReopenTaskDescription(task.description || '');
    setReopenTaskPriority(
      (task.currentPriority || task.priority || 'Medium') as DailyPlannerPriority,
    );
    setReopenTaskHours(
      task.hoursRequired != null && Number.isFinite(Number(task.hoursRequired))
        ? Number(task.hoursRequired)
        : null,
    );
    setReopenInstruction('');
    setReopenRescheduleDate('');
    setReopenOpen(true);
  };

  const handleSubmitReopenCorrection = () => {
    if (!task || busy) return;
    if (!reopenAction) {
      toast.error('Select a corrective action');
      return;
    }

    if (reopenAction === 'revision') {
      if (!reopenReason.trim()) {
        toast.error('Reason is required');
        return;
      }
      if (!reopenTaskName.trim()) {
        toast.error('Task Name is required');
        return;
      }
      if (!reopenTaskDescription.trim()) {
        toast.error('Description is required');
        return;
      }
      const hoursValue = Number(reopenTaskHours);
      if (reopenTaskHours == null || !Number.isFinite(hoursValue) || hoursValue <= 0) {
        toast.error('Hours Required to Complete must be greater than 0');
        return;
      }
      void runSaveFlow(async () => {
        // Stamp reopen history first (silent), then reuse existing revision workflow.
        await reopenApprovedDailyPlannerTask(task.plannerTaskId, {
          reason: reopenReason.trim(),
          skipNotification: true,
        });
        const result = await requestNeedsRevisionDailyPlannerTask(task.plannerTaskId, {
          reason: reopenReason.trim(),
          replacementTask: {
            taskName: reopenTaskName.trim(),
            description: reopenTaskDescription.trim(),
            priority: reopenTaskPriority,
            hoursRequired: Math.round(hoursValue * 100) / 100,
            expectedOutcome: reopenInstruction.trim(),
            instruction: reopenInstruction.trim(),
          },
        });
        setReopenOpen(false);
        resetReopenForm();
        const updates = [result.task, result.revisedTask].filter(Boolean) as DailyPlannerTask[];
        if (updates.length) await onTasksUpdated(updates);
        toast.success('Task revised');
        return result.revisedTask || result.task;
      });
      return;
    }

    if (reopenAction === 'reschedule') {
      const nextDate = String(reopenRescheduleDate || '').trim().slice(0, 10);
      if (!nextDate) {
        toast.error('New date is required');
        return;
      }
      if (nextDate < minRescheduleDate) {
        toast.error('Past dates are not allowed');
        return;
      }
      if (nextDate === String(task.date || '').trim().slice(0, 10)) {
        toast.error('New date must be different from the current task date');
        return;
      }
      void runSaveFlow(async () => {
        await reopenApprovedDailyPlannerTask(task.plannerTaskId, {
          reason: reopenInstruction.trim() || reopenReason.trim(),
          skipNotification: true,
        });
        const result = await rescheduleDailyPlannerTaskBySuperAdmin(task.plannerTaskId, {
          newDate: nextDate,
          instruction: reopenInstruction.trim(),
        });
        setReopenOpen(false);
        resetReopenForm();
        const updates = [result.task, result.rescheduledTask].filter(Boolean) as DailyPlannerTask[];
        if (updates.length) await onTasksUpdated(updates);
        toast.success('Task rescheduled');
        return result.task;
      });
      return;
    }

    // delete
    const taskId = task.plannerTaskId;
    void (async () => {
      setBusy(true);
      try {
        await reopenApprovedDailyPlannerTask(taskId, {
          reason: reopenReason.trim() || 'Deleted by Super Admin',
          skipNotification: true,
        });
        await deleteDailyPlannerTaskBySuperAdmin(taskId, {
          reason: reopenReason.trim() || 'Deleted by Super Admin',
        });
        setReopenOpen(false);
        resetReopenForm();
        await onTasksUpdated(undefined, { removeTaskIds: [taskId] });
        toast.success('Task deleted');
        if (sortedTasks.length <= 1) {
          onClose();
        } else {
          setCurrentIndex((i) => Math.min(i, Math.max(0, sortedTasks.length - 2)));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed');
      } finally {
        setBusy(false);
      }
    })();
  };

  const openRescheduleDialog = () => {
    setRescheduleDate('');
    setRescheduleInstruction('');
    setRescheduleOpen(true);
  };

  const handleSubmitReschedule = () => {
    if (!task) return;
    const nextDate = String(rescheduleDate || '').trim().slice(0, 10);
    if (!nextDate) {
      toast.error('New date is required');
      return;
    }
    if (nextDate < minRescheduleDate) {
      toast.error('Past dates are not allowed');
      return;
    }
    if (nextDate === String(task.date || '').trim().slice(0, 10)) {
      toast.error('New date must be different from the current task date');
      return;
    }
    void runSaveFlow(async () => {
      const result = await rescheduleDailyPlannerTaskBySuperAdmin(task.plannerTaskId, {
        newDate: nextDate,
        instruction: rescheduleInstruction.trim(),
      });
      setRescheduleOpen(false);
      setReopenOpen(false);
      const updates = [result.task, result.rescheduledTask].filter(Boolean) as DailyPlannerTask[];
      if (updates.length) await onTasksUpdated(updates);
      toast.success('Task rescheduled');
      return result.task;
    });
  };

  const handleConfirmDelete = () => {
    if (!task) return;
    const taskId = task.plannerTaskId;
    void (async () => {
      setBusy(true);
      try {
        await deleteDailyPlannerTaskBySuperAdmin(taskId, {
          reason: reopenReason.trim() || 'Deleted by Super Admin',
        });
        setDeleteOpen(false);
        setReopenOpen(false);
        await onTasksUpdated(undefined, { removeTaskIds: [taskId] });
        toast.success('Task deleted');
        if (sortedTasks.length <= 1) {
          onClose();
        } else {
          setCurrentIndex((i) => Math.min(i, Math.max(0, sortedTasks.length - 2)));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed');
      } finally {
        setBusy(false);
      }
    })();
  };

  if (!task) {
    return (
      <DailyPlannerCreateTaskModal
        open={addTaskOpen}
        date={reviewDate}
        elevated
        forEmployeeCode={employee.employeeCode}
        skipPlanningWindowAssert
        enhancedEligible={showEnhancedTaskUi}
        factoryEligible={isFactoryDailyPlannerEligible(employee.location)}
        leaveKind={leaveKind}
        existingTasksForDate={sortedTasks.filter(
          (t) => String(t.date || '').trim().slice(0, 10) === reviewDate,
        )}
        onClose={() => setAddTaskOpen(false)}
        onSave={async (drafts) => {
          const created: DailyPlannerTask[] = [];
          for (const draft of drafts) {
            const createdTask = await createDailyPlannerTaskForEmployee({
              ...draft,
              employeeCode: employee.employeeCode,
              skipRevisedEmail: planFinalized || editMode,
            });
            created.push(createdTask);
          }
          toast.success(
            created.length === 1
              ? 'Task added for employee'
              : `${created.length} tasks added for employee`,
          );
          await onTasksUpdated(created);
          if (planFinalized || editMode) setPlanModified(true);
          setAddTaskOpen(false);
          return created;
        }}
      />
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="!flex !h-[92vh] !max-h-[92vh] !w-[min(96vw,1200px)] !max-w-[1200px] !flex-col !gap-0 overflow-hidden !p-0 sm:!max-w-[1200px] [&>button]:top-2.5 [&>button]:right-2.5"
          style={{
            width: 'min(96vw, 1200px)',
            maxWidth: '1200px',
            height: '92vh',
            maxHeight: '92vh',
          }}
        >
          {/* Plain header — avoid DialogHeader's default flex-col gap-2 which inflates height */}
          <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-1.5 pr-11 text-left sm:px-5">
            <div className="flex w-full flex-row items-center gap-3">
              <div className="min-w-0 flex-1 leading-none">
                <DialogTitle className="text-base font-semibold leading-none text-[#212529]">
                  {completionReviewMode
                    ? 'Pending Completion Approval'
                    : 'Task Review'}
                </DialogTitle>
                <p className="mt-0.5 text-sm font-medium leading-none text-[#212529]">
                  {employee.employeeName}
                </p>
                <p className="mt-0.5 text-xs leading-none text-gray-600">
                  {employee.employeeCode}
                  {employee.department ? ` · ${employee.department}` : ''}
                  {employee.designation ? ` · ${employee.designation}` : ''}
                </p>
              </div>
              <div className="min-w-0 flex-1 text-center leading-none">
                <p className="text-[9px] font-medium uppercase tracking-wide text-gray-500 leading-none">
                  Total Planned Hours
                </p>
                <p
                  className={cn(
                    'mt-0.5 text-sm font-medium leading-none',
                    planTotalHours >= minPlannedHours
                      ? 'text-green-700'
                      : 'text-amber-700',
                  )}
                >
                  {formatDurationLabel(planTotalHours)} / {formatDurationLabel(minPlannedHours)}
                </p>
              </div>
              <div className="min-w-0 flex-1 text-right leading-none">
                <p className="text-[9px] font-medium uppercase tracking-wide text-gray-500 leading-none">
                  Date
                </p>
                <p className="mt-0.5 text-xs font-medium leading-none text-[#212529]">
                  {formatReviewDate(reviewDate)}
                </p>
                <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-500 leading-none">
                  Task {currentIndex + 1} of {total}
                </p>
                <p className="mt-0.5 text-[10px] leading-none text-gray-600">
                  Progress {progressPct}%
                </p>
                {/* Explicit track color: bg-primary/20 on white is nearly invisible at 0% */}
                <Progress
                  value={progressPct}
                  className="mt-1 h-1.5 w-full bg-gray-200 [&>[data-slot=progress-indicator]]:bg-[#007BFF]"
                />
              </div>
            </div>
            {savePhase === 'saved' ? (
              <div className="mt-1 flex items-center gap-3 text-xs">
                <span className="font-medium text-green-700">Task Saved ✓</span>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto scroll-smooth bg-[#F8F9FA] px-4 py-2 overscroll-contain sm:px-5">
            {compactReview ? (
              <>
                <ViewSection
                  title="Task Summary"
                  className="px-2 py-1.5 [&_[data-slot=section-heading]]:mb-1.5 [&_[data-slot=section-heading]]:pb-1"
                  headerRight={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!String(task.projectName || '').trim()}
                      title={
                        String(task.projectName || '').trim()
                          ? 'View completed tasks for this project'
                          : 'Not a project task'
                      }
                      onClick={() => setPastDataOpen(true)}
                    >
                      Past Data
                    </Button>
                  }
                >
                  <div className="grid grid-cols-1 items-start gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    <ViewField
                      compact
                      label="Project Name"
                      value={displayCell(task.projectName)}
                    />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Priority
                      </p>
                      <div className="flex items-center gap-2">
                        {editingPriority ? (
                          <Select
                            value={stagedPriority}
                            onValueChange={(v) => setStagedPriority(v as DailyPlannerPriority)}
                            disabled={fieldsReadOnly || busy || completionReviewMode}
                          >
                            <SelectTrigger
                              className="w-[140px]"
                              disabled={fieldsReadOnly || busy || completionReviewMode}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Urgent">Urgent</SelectItem>
                              <SelectItem value="High">High</SelectItem>
                              <SelectItem value="Medium">Medium</SelectItem>
                              <SelectItem value="Low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-sm text-[#212529]">{displayPriority}</div>
                        )}
                        {!completionReviewMode ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Edit priority"
                            className="h-8 w-8"
                            disabled={busy || fieldsReadOnly}
                            onClick={() => {
                              if (fieldsReadOnly) return;
                              setEditingPriority((v) => !v);
                              setStagedPriority(currentPriority);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                      {priorityChanged && !completionReviewMode ? (
                        <p className="text-xs text-amber-700">
                          Priority change will be saved when you click Approve Task.
                        </p>
                      ) : null}
                    </div>
                    <ViewField
                      compact
                      label="Actual Time"
                      value={summaryActualTimeLabel}
                    />
                    <ViewField
                      compact
                      label="Task Name"
                      value={displayCell(task.taskName)}
                    />
                  </div>
                </ViewSection>

                <ViewSection
                  title="Steps"
                  className="px-2 py-1.5 [&_[data-slot=section-heading]]:mb-1.5 [&_[data-slot=section-heading]]:pb-1"
                >
                  <input
                    ref={managerDocInputRef}
                    type="file"
                    multiple
                    accept=".doc,.docx,.pdf,.jpg,.jpeg,.png,.xls,.xlsx,.ppt,.pptx"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      void handleManagerDocumentSelected(files);
                    }}
                  />
                  <div className="overflow-x-auto">
                    <Table className="table-fixed w-full min-w-[640px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[28%]">Steps</TableHead>
                          <TableHead className="w-[32%]">Work Done</TableHead>
                          <TableHead className="w-[18%]">Action</TableHead>
                          <TableHead className="w-[22%]">Comment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {procedureSteps.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-sm text-gray-600">
                              No steps recorded for this task.
                            </TableCell>
                          </TableRow>
                        ) : (
                          procedureSteps.map((step, idx) => {
                            const editingDesc =
                              !completionReviewMode &&
                              editingStepId === step.stepId &&
                              editingStepField === 'description';
                            const editingDur =
                              !completionReviewMode &&
                              editingStepId === step.stepId &&
                              editingStepField === 'duration';
                            const isFirst = idx === 0;
                            const rowSpan = procedureSteps.length;
                            const workDoneText = String(step.workDone || '').trim();
                            const startLabel = formatReviewTime12h(step.startTime);
                            const endLabel = formatReviewTime12h(step.endTime);
                            const stepActual =
                              step.actualMinutes != null &&
                              Number.isFinite(Number(step.actualMinutes)) &&
                              Number(step.actualMinutes) > 0
                                ? formatMinutesLabel(Number(step.actualMinutes))
                                : '';
                            return (
                              <TableRow key={step.stepId} className="align-top">
                                <TableCell className="whitespace-normal align-top">
                                  {editingDesc ? (
                                    <div className="space-y-2">
                                      <Textarea
                                        rows={2}
                                        value={stepDescDraft}
                                        disabled={busy}
                                        onChange={(e) => setStepDescDraft(e.target.value)}
                                        aria-label={`Step ${idx + 1} description`}
                                      />
                                      <div className="flex gap-1">
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={busy}
                                          onClick={() =>
                                            void handleSaveStepDescription(step.stepId)
                                          }
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={busy}
                                          onClick={cancelStepEdit}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="flex items-start gap-1">
                                        <div className="flex min-w-0 flex-1 gap-2 text-sm text-[#212529]">
                                          <span className="shrink-0 font-medium text-gray-500">
                                            {idx + 1}.
                                          </span>
                                          <span className="break-words font-medium">
                                            {step.description}
                                          </span>
                                        </div>
                                        {!completionReviewMode ? (
                                          <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            title="Edit step description"
                                            className="h-7 w-7 shrink-0"
                                            disabled={busy || fieldsReadOnly}
                                            onClick={() => startEditStepDescription(step)}
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </Button>
                                        ) : null}
                                      </div>
                                      {editingDur ? (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-1 text-xs text-gray-600">
                                            <Input
                                              type="number"
                                              min={0}
                                              step={1}
                                              className="h-8 w-14 px-2"
                                              value={stepHoursDraft}
                                              disabled={busy}
                                              aria-label="Step hours"
                                              onChange={(e) => setStepHoursDraft(e.target.value)}
                                            />
                                            h
                                            <Input
                                              type="number"
                                              min={0}
                                              max={59}
                                              step={1}
                                              className="h-8 w-14 px-2"
                                              value={stepMinutesDraft}
                                              disabled={busy}
                                              aria-label="Step minutes"
                                              onChange={(e) => setStepMinutesDraft(e.target.value)}
                                            />
                                            m
                                          </div>
                                          <div className="flex gap-1">
                                            <Button
                                              type="button"
                                              size="sm"
                                              disabled={busy}
                                              onClick={() =>
                                                void handleSaveStepDuration(step.stepId)
                                              }
                                            >
                                              Save
                                            </Button>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              disabled={busy}
                                              onClick={cancelStepEdit}
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <p className="text-xs text-gray-500">
                                            Planned: {formatMinutesLabel(step.plannedMinutes)}
                                          </p>
                                          {!completionReviewMode ? (
                                            <Button
                                              type="button"
                                              size="icon"
                                              variant="ghost"
                                              title="Edit step duration"
                                              className="h-6 w-6 shrink-0"
                                              disabled={busy || fieldsReadOnly}
                                              onClick={() => startEditStepDuration(step)}
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                          ) : null}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="align-top whitespace-normal">
                                  <div className="space-y-1">
                                    <p className="break-words text-sm text-[#212529]">
                                      {workDoneText || '—'}
                                    </p>
                                    {startLabel || endLabel || stepActual ? (
                                      <p className="text-xs text-gray-600">
                                        {startLabel && endLabel
                                          ? `${startLabel} – ${endLabel}`
                                          : startLabel || endLabel || ''}
                                        {stepActual
                                          ? `${startLabel || endLabel ? ' · ' : ''}${stepActual}`
                                          : ''}
                                      </p>
                                    ) : null}
                                  </div>
                                </TableCell>
                                {isFirst ? (
                                  <TableCell
                                    rowSpan={rowSpan}
                                    className="align-top whitespace-normal border-l border-gray-100 bg-white"
                                  >
                                    {readOnly ? (
                                      <p className="text-sm text-gray-600">
                                        Historical view (read only).
                                      </p>
                                    ) : (
                                      <div className="flex flex-col gap-1.5 py-0.5">
                                        {completionReviewMode ? (
                                          <>
                                            {awaitingVerification ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                disabled={
                                                  busy || isTaskCompletionReviewed(task)
                                                }
                                                className="w-full justify-start bg-green-600 text-white hover:bg-green-700"
                                                onClick={() => void handleVerify()}
                                              >
                                                Verify Completion
                                              </Button>
                                            ) : !isTaskCompletionReviewed(task) ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                disabled={busy}
                                                className="w-full justify-start bg-green-600 text-white hover:bg-green-700"
                                                onClick={() =>
                                                  void handleReviewCompletionOutcome()
                                                }
                                              >
                                                Mark Reviewed
                                              </Button>
                                            ) : null}
                                            {showEnhancedTaskUi ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                  busy ||
                                                  String(task.flagStatus || '').trim() ===
                                                    'Raised'
                                                }
                                                className="w-full justify-start"
                                                onClick={() => {
                                                  setFlagInstruction('');
                                                  setFlagOpen(true);
                                                }}
                                              >
                                                Raise Flag
                                              </Button>
                                            ) : null}
                                            {showEnhancedTaskUi ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={busy || uploadingManagerDoc}
                                                className="w-full justify-start"
                                                onClick={() =>
                                                  managerDocInputRef.current?.click()
                                                }
                                              >
                                                {uploadingManagerDoc
                                                  ? 'Uploading…'
                                                  : 'Upload Document'}
                                              </Button>
                                            ) : null}
                                            {showSuperAdminReschedule ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={busy}
                                                className="w-full justify-start"
                                                onClick={openRescheduleDialog}
                                              >
                                                Reschedule Task
                                              </Button>
                                            ) : null}
                                            {isTaskCompletionReviewed(task) ? (
                                              <p className="text-xs text-gray-600">
                                                This completion result has been reviewed.
                                              </p>
                                            ) : null}
                                          </>
                                        ) : (
                                          <>
                                            {showApprove ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                disabled={busy}
                                                className="w-full justify-start bg-green-600 text-white hover:bg-green-700"
                                                onClick={() => void handleApprove()}
                                              >
                                                Approve Task
                                              </Button>
                                            ) : null}
                                            {showRequestRevision ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="destructive"
                                                disabled={busy}
                                                className="w-full justify-start"
                                                onClick={() => setRevisionOpen(true)}
                                              >
                                                Request Revision
                                              </Button>
                                            ) : null}
                                            {showEnhancedTaskUi ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={busy || uploadingManagerDoc}
                                                className="w-full justify-start"
                                                onClick={() =>
                                                  managerDocInputRef.current?.click()
                                                }
                                              >
                                                {uploadingManagerDoc
                                                  ? 'Uploading…'
                                                  : 'Upload Document'}
                                              </Button>
                                            ) : null}
                                            {showEnhancedTaskUi ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                  busy ||
                                                  String(task.flagStatus || '').trim() ===
                                                    'Raised'
                                                }
                                                className="w-full justify-start"
                                                onClick={() => {
                                                  setFlagInstruction('');
                                                  setFlagOpen(true);
                                                }}
                                              >
                                                Raise Flag
                                              </Button>
                                            ) : null}
                                            {showSuperAdminReschedule ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={busy}
                                                className="w-full justify-start"
                                                onClick={openRescheduleDialog}
                                              >
                                                Reschedule Task
                                              </Button>
                                            ) : null}
                                            {showVerify ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                disabled={busy}
                                                className="w-full justify-start bg-green-600 text-white hover:bg-green-700"
                                                onClick={() => void handleVerify()}
                                              >
                                                Verify Completion
                                              </Button>
                                            ) : null}
                                            {showReopenTask ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={busy}
                                                className="w-full justify-start"
                                                onClick={openReopenDialog}
                                              >
                                                Reopen Task
                                              </Button>
                                            ) : null}
                                            {isTaskManagerReviewed(task) &&
                                            !showApprove &&
                                            !showVerify &&
                                            !showRequestRevision &&
                                            !showReopenTask &&
                                            !showSuperAdminReschedule ? (
                                              <p className="text-sm text-gray-600">
                                                Already reviewed (
                                                {getWizardReviewIndicator(task)}).
                                              </p>
                                            ) : null}
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                ) : null}
                                {isFirst ? (
                                  <TableCell
                                    rowSpan={rowSpan}
                                    className="align-top whitespace-normal border-l border-gray-100 bg-white"
                                  >
                                    {outOfTeamReviewOnly ? (
                                      <div className="space-y-1.5">
                                        <Label
                                          htmlFor="superadmin-out-of-team-comment-compact"
                                          className="text-xs font-medium"
                                        >
                                          Review comment
                                        </Label>
                                        {savedOutOfTeamComments.length > 0 ? (
                                          <div className="max-h-20 space-y-1 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-1.5 text-[11px] text-gray-700">
                                            {savedOutOfTeamComments.map((c) => (
                                              <p key={c.commentId} className="whitespace-pre-wrap">
                                                <span className="font-medium">
                                                  {c.reviewerName || c.reviewerCode}:
                                                </span>{' '}
                                                {c.commentText}
                                              </p>
                                            ))}
                                          </div>
                                        ) : null}
                                        <Textarea
                                          id="superadmin-out-of-team-comment-compact"
                                          rows={Math.max(3, rowSpan)}
                                          value={outOfTeamCommentDraft}
                                          disabled={busy}
                                          onChange={(e) => {
                                            if (!task) return;
                                            const id = task.plannerTaskId;
                                            const value = e.target.value;
                                            setOutOfTeamCommentByTaskId((prev) => ({
                                              ...prev,
                                              [id]: value,
                                            }));
                                          }}
                                          placeholder="Enter a review comment for this task / date"
                                          className="min-h-[5rem] resize-y"
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="h-7 w-full bg-[#007BFF] hover:bg-[#0056b3]"
                                          disabled={
                                            busy || !String(outOfTeamCommentDraft || '').trim()
                                          }
                                          onClick={() => void handleSubmitOutOfTeamReviewComment()}
                                        >
                                          Submit review comment
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="space-y-1.5">
                                        <Label
                                          htmlFor="manager-comments-compact"
                                          className="sr-only"
                                        >
                                          {completionReviewMode
                                            ? 'Review Comment'
                                            : 'Manager Comments'}
                                        </Label>
                                        <Textarea
                                          id="manager-comments-compact"
                                          rows={Math.max(4, rowSpan * 2)}
                                          value={managerComments}
                                          disabled={
                                            busy ||
                                            readOnly ||
                                            (!completionReviewMode && fieldsReadOnly) ||
                                            (completionReviewMode &&
                                              isTaskCompletionReviewed(task))
                                          }
                                          onChange={(e) =>
                                            setManagerCommentsForCurrentTask(e.target.value)
                                          }
                                          placeholder={
                                            completionReviewMode
                                              ? 'Add a review comment for this completion decision'
                                              : 'Add comments for this review decision'
                                          }
                                          className="min-h-[6rem] resize-y"
                                        />
                                      </div>
                                    )}
                                  </TableCell>
                                ) : null}
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </ViewSection>
              </>
            ) : (
              <>
            <ViewSection title="Employee Information">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ViewField label="Employee Name" value={displayCell(employee.employeeName)} />
                <ViewField label="Employee Code" value={displayCell(employee.employeeCode)} />
                <ViewField label="Designation" value={displayCell(employee.designation)} />
              </div>
            </ViewSection>

            <ViewSection title="Task Progress">
              <div className="space-y-2">
                <p className="text-sm text-[#212529]">
                  Task {currentIndex + 1} of {total} · {reviewedCount} reviewed
                </p>
                <Progress value={progressPct} className="h-2.5" />
                <p className="text-xs text-gray-600">{progressPct}% complete</p>
              </div>
            </ViewSection>

            <ViewSection title="Task Information">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {editMode ? (
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="review-task-name">Task Name</Label>
                    <Input
                      id="review-task-name"
                      value={stagedName}
                      disabled={busy}
                      onChange={(e) => setStagedName(e.target.value)}
                    />
                  </div>
                ) : (
                  <ViewField label="Task Name" value={displayCell(task.taskName)} />
                )}
                <ViewField label="Date" value={displayCell(task.date)} />
                <ViewField label="Task Origin" value={getTaskOriginLabel(task)} />
                <ViewField
                  label="Previous Revision Count"
                  value={String(getPreviousRevisionCount(task))}
                />
                <div className="min-w-0 space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Priority
                  </p>
                  <div className="flex items-center gap-2">
                    {completionReviewMode ? (
                      <div className="text-sm text-[#212529]">{displayPriority}</div>
                    ) : editMode || editingPriority ? (
                      <Select
                        value={editMode ? stagedPriority : stagedPriority}
                        onValueChange={(v) => setStagedPriority(v as DailyPlannerPriority)}
                        disabled={fieldsReadOnly || busy}
                      >
                        <SelectTrigger className="w-[160px]" disabled={fieldsReadOnly || busy}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm text-[#212529]">{displayPriority}</div>
                    )}
                    {!editMode && !completionReviewMode ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Edit priority"
                        className="h-8 w-8"
                        disabled={busy || fieldsReadOnly}
                        onClick={() => {
                          if (fieldsReadOnly) return;
                          setEditingPriority((v) => !v);
                          setStagedPriority(currentPriority);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                  {priorityChanged && !editMode && !completionReviewMode ? (
                    <p className="text-xs text-amber-700">
                      Priority change will be saved when you click Approve Task.
                    </p>
                  ) : null}
                </div>
                <div className="min-w-0 space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Hours Required to Complete
                  </p>
                  <div className="flex items-center gap-2">
                    {completionReviewMode ? (
                      <div className="text-sm text-[#212529]">
                        {currentHours != null ? formatDurationLabel(currentHours) : '—'}
                      </div>
                    ) : editMode || editingHours ? (
                      <div className="w-[220px]">
                        <HoursMinutesFields
                          idPrefix="review-hours"
                          value={stagedHours}
                          onChange={setStagedHours}
                          disabled={fieldsReadOnly || busy}
                        />
                      </div>
                    ) : (
                      <div className="text-sm text-[#212529]">
                        {currentHours != null ? formatDurationLabel(currentHours) : '—'}
                      </div>
                    )}
                    {!editMode && !completionReviewMode ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Edit hours required"
                        className="h-8 w-8"
                        disabled={busy || fieldsReadOnly}
                        onClick={() => {
                          if (fieldsReadOnly) return;
                          setEditingHours((v) => !v);
                          setStagedHours(currentHours);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                  {hoursChanged && !editMode && !completionReviewMode ? (
                    <p className="text-xs text-amber-700">
                      Hours change will be saved when you click Approve Task.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-4">
                {editMode ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="review-task-description">Description</Label>
                    <Textarea
                      id="review-task-description"
                      rows={4}
                      value={stagedDescription}
                      disabled={busy}
                      onChange={(e) => setStagedDescription(e.target.value)}
                    />
                  </div>
                ) : editingDescription ? (
                  <div className="space-y-2">
                    <BulletPointEditor
                      key={`review-desc-${task.plannerTaskId}`}
                      ref={descriptionEditorRef}
                      id="review-inline-description"
                      label="Description *"
                      required
                      defaultValue={task.description || ''}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || fieldsReadOnly}
                        onClick={handleSaveDescription}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={handleCancelDescription}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Description
                      </p>
                      {!completionReviewMode ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Edit description"
                          className="h-8 w-8"
                          disabled={busy || fieldsReadOnly}
                          onClick={() => {
                            if (fieldsReadOnly) return;
                            setEditingDescription(true);
                            setStagedDescription(task.description || '');
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                    <BulletPointList text={displayCell(task.description)} />
                  </div>
                )}
              </div>
              {task.isProjectBased ? (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ViewField label="Project Based" value="Yes" />
                  <ViewField label="Project Name" value={displayCell(task.projectName)} />
                  {showEnhancedTaskUi ? (
                    <ViewField
                      label="Progress Done (%)"
                      value={
                        task.progressDone != null && Number.isFinite(Number(task.progressDone))
                          ? `${Number(task.progressDone)}%`
                          : '—'
                      }
                    />
                  ) : null}
                </div>
              ) : null}
              {showEnhancedTaskUi ? (
                <div className="mt-4 space-y-3">
                  {task.needsDocument != null ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <ViewField
                        label="Document Required"
                        value={task.needsDocument ? 'Yes' : 'No'}
                      />
                    </div>
                  ) : null}
                  <DailyPlannerTaskDocumentsList task={task} />
                </div>
              ) : null}
              {editMode || task.managerInstructions ? (
                <div className="mt-4">
                  {editMode ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="review-task-instructions">Instructions / Special Remarks</Label>
                      <Textarea
                        id="review-task-instructions"
                        rows={3}
                        value={stagedInstructions}
                        disabled={busy}
                        onChange={(e) => setStagedInstructions(e.target.value)}
                      />
                    </div>
                  ) : (
                    <ViewBulletField
                      label="Instructions / Special Remarks"
                      value={displayCell(task.managerInstructions)}
                    />
                  )}
                </div>
              ) : null}
            </ViewSection>

              </>
            )}

            {/*
              Compact review (plan + Pending Completion Approval): task-level actions +
              comment live in the shared Action/Comment table cells (rowSpan). Keep this
              Manager Review section for edit mode and tasks with no procedure steps.
            */}
            {(!compactReview || procedureSteps.length === 0) ? (
            <ViewSection title="Manager Review">
              <p className="mb-3 text-sm text-gray-600">
                {completionReviewMode ? 'Completion Decision' : 'Manager Decision'}
              </p>
              <input
                ref={managerDocInputRef}
                type="file"
                multiple
                accept=".doc,.docx,.pdf,.jpg,.jpeg,.png,.xls,.xlsx,.ppt,.pptx"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  void handleManagerDocumentSelected(files);
                }}
              />
              <div className="mb-4 flex flex-wrap gap-2">
                {completionReviewMode ? (
                  <>
                    {showEnhancedTaskUi && !readOnly ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || uploadingManagerDoc}
                        onClick={() => managerDocInputRef.current?.click()}
                      >
                        {uploadingManagerDoc ? 'Uploading…' : 'Upload Document'}
                      </Button>
                    ) : null}
                    {showEnhancedTaskUi && !readOnly ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || String(task.flagStatus || '').trim() === 'Raised'}
                        onClick={() => {
                          setFlagInstruction('');
                          setFlagOpen(true);
                        }}
                      >
                        Raise Flag
                      </Button>
                    ) : null}
                    {!readOnly && awaitingVerification ? (
                      <Button
                        type="button"
                        disabled={busy || isTaskCompletionReviewed(task)}
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={() => void handleVerify()}
                      >
                        Verify Completion
                      </Button>
                    ) : null}
                    {!readOnly && !awaitingVerification && !isTaskCompletionReviewed(task) ? (
                      <Button
                        type="button"
                        disabled={busy}
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={() => void handleReviewCompletionOutcome()}
                      >
                        Mark Reviewed
                      </Button>
                    ) : null}
                    {!readOnly && showSuperAdminReschedule ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={openRescheduleDialog}
                      >
                        Reschedule Task
                      </Button>
                    ) : null}
                    {isTaskCompletionReviewed(task) ? (
                      <p className="text-sm text-gray-600">
                        This completion result has been reviewed.
                      </p>
                    ) : null}
                  </>
                ) : readOnly ? (
                  <p className="text-sm text-gray-600">
                    Historical view (read only). Manager decisions cannot be changed for past dates.
                  </p>
                ) : (
                  <>
                    {editMode ? (
                      <Button
                        type="button"
                        disabled={busy}
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={() => void handleSaveEditedTask()}
                      >
                        Save Task Changes
                      </Button>
                    ) : null}
                    {showApprove ? (
                      <Button
                        type="button"
                        disabled={busy}
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={() => void handleApprove()}
                      >
                        Approve Task
                      </Button>
                    ) : null}
                    {showVerify ? (
                      <Button
                        type="button"
                        disabled={busy}
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={() => void handleVerify()}
                      >
                        Verify Completion
                      </Button>
                    ) : null}
                    {showRequestRevision ? (
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => setRevisionOpen(true)}
                      >
                        Request Revision
                      </Button>
                    ) : null}
                    {showEnhancedTaskUi ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || uploadingManagerDoc}
                        onClick={() => managerDocInputRef.current?.click()}
                      >
                        {uploadingManagerDoc ? 'Uploading…' : 'Upload Document'}
                      </Button>
                    ) : null}
                    {showEnhancedTaskUi ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || String(task.flagStatus || '').trim() === 'Raised'}
                        onClick={() => {
                          setFlagInstruction('');
                          setFlagOpen(true);
                        }}
                      >
                        Raise Flag
                      </Button>
                    ) : null}
                    {showReopenTask ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={openReopenDialog}
                      >
                        Reopen Task
                      </Button>
                    ) : null}
                    {showSuperAdminReschedule ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={openRescheduleDialog}
                      >
                        Reschedule Task
                      </Button>
                    ) : null}
                    {isTaskManagerReviewed(task) &&
                    !showApprove &&
                    !showVerify &&
                    !showRequestRevision &&
                    !showReopenTask &&
                    !showSuperAdminReschedule ? (
                      <p className="text-sm text-gray-600">
                        This task has already been reviewed ({getWizardReviewIndicator(task)}).
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              {outOfTeamReviewOnly ? (
                <div className="space-y-2">
                  <Label htmlFor="superadmin-out-of-team-comment">Review comment</Label>
                  {savedOutOfTeamComments.length > 0 ? (
                    <div className="max-h-28 space-y-1.5 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
                      {savedOutOfTeamComments.map((c) => (
                        <div key={c.commentId} className="border-b border-gray-200 pb-1.5 last:border-b-0 last:pb-0">
                          <p className="font-medium text-gray-800">
                            {c.reviewerName || c.reviewerCode}
                            {c.submittedAt
                              ? ` · ${new Date(c.submittedAt).toLocaleString('en-GB')}`
                              : ''}
                          </p>
                          <p className="whitespace-pre-wrap">{c.commentText}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <Textarea
                    id="superadmin-out-of-team-comment"
                    rows={2}
                    value={outOfTeamCommentDraft}
                    disabled={busy}
                    onChange={(e) => {
                      if (!task) return;
                      const id = task.plannerTaskId;
                      const value = e.target.value;
                      setOutOfTeamCommentByTaskId((prev) => ({ ...prev, [id]: value }));
                    }}
                    placeholder="Enter a review comment for this task / date"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 bg-[#007BFF] hover:bg-[#0056b3]"
                    disabled={busy || !String(outOfTeamCommentDraft || '').trim()}
                    onClick={() => void handleSubmitOutOfTeamReviewComment()}
                  >
                    Submit review comment
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Out-of-team access is view and comment only. Task create, edit, approve, and
                    completion actions are disabled.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="manager-comments">
                    {completionReviewMode ? 'Review Comment' : 'Manager Comments (optional)'}
                  </Label>
                  <Textarea
                    id="manager-comments"
                    rows={2}
                    value={managerComments}
                    disabled={
                      busy ||
                      readOnly ||
                      (!completionReviewMode && fieldsReadOnly) ||
                      (completionReviewMode && isTaskCompletionReviewed(task))
                    }
                    onChange={(e) => setManagerCommentsForCurrentTask(e.target.value)}
                    placeholder={
                      completionReviewMode
                        ? 'Add a review comment for this completion decision'
                        : 'Add comments for this review decision'
                    }
                  />
                </div>
              )}
            </ViewSection>
            ) : null}
          </div>

          {/* Compact footer: Jump To Task left; Prev/Next before Close on the right */}
          <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-1.5 sm:px-5">
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-[9px] font-medium uppercase leading-none tracking-wide text-gray-500">
                  Jump To Task
                </p>
                <div className="flex flex-wrap gap-1">
                  {sortedTasks.map((t, idx) => {
                    const completionChecked = isTaskCompletionReviewed(t);
                    const indicator = completionReviewMode
                      ? completionChecked
                        ? 'approved'
                        : 'pending'
                      : getWizardReviewIndicator(t);
                    const style = INDICATOR_STYLES[indicator];
                    return (
                      <button
                        key={t.plannerTaskId}
                        type="button"
                        title={
                          completionReviewMode
                            ? completionChecked
                              ? 'Reviewed'
                              : 'Pending review'
                            : style.label
                        }
                        disabled={busy}
                        onClick={() => setCurrentIndex(idx)}
                        className={cn(
                          'inline-flex h-7 min-w-[1.75rem] items-center justify-center gap-0.5 rounded-md border px-1.5 text-xs font-medium transition-colors',
                          style.className,
                          idx === currentIndex && 'ring-2 ring-[#007BFF] ring-offset-1',
                        )}
                      >
                        {style.icon}
                        <span>{idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={busy || currentIndex <= 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={busy || currentIndex >= total - 1}
                  onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
                >
                  Next
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={busy}
                  onClick={onClose}
                >
                  Close
                </Button>
                {!readOnly && !completionReviewMode && planFinalized ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={busy || editMode}
                    onClick={() => {
                      setEditMode(true);
                      setStagedName(task?.taskName || '');
                      setStagedDescription(task?.description || '');
                      setStagedInstructions(task?.managerInstructions || '');
                      setStagedPriority(currentPriority);
                      setStagedHours(currentHours);
                    }}
                  >
                    Edit
                  </Button>
                ) : null}
                {!readOnly && !completionReviewMode ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={busy || fieldsReadOnly}
                    onClick={() => setAddTaskOpen(true)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Task
                  </Button>
                ) : null}
                {!readOnly ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 bg-[#007BFF] hover:bg-[#0056b3]"
                    disabled={
                      busy ||
                      (completionReviewMode
                        ? !allReviewed
                        : canRefinalize
                          ? false
                          : !allReviewed || planFinalized)
                    }
                    onClick={() => void handleFinishReview()}
                  >
                    {completionReviewMode
                      ? 'Submit'
                      : planFinalized && !canRefinalize
                        ? 'Finalized'
                        : 'Finalize Plan'}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DailyPlannerCreateTaskModal
        open={addTaskOpen}
        date={reviewDate}
        elevated
        forEmployeeCode={employee.employeeCode}
        skipPlanningWindowAssert
        enhancedEligible={showEnhancedTaskUi}
        factoryEligible={isFactoryDailyPlannerEligible(employee.location)}
        leaveKind={leaveKind}
        existingTasksForDate={sortedTasks.filter(
          (t) => String(t.date || '').trim().slice(0, 10) === reviewDate,
        )}
        onClose={() => setAddTaskOpen(false)}
        onSave={async (drafts) => {
          const created: DailyPlannerTask[] = [];
          for (const draft of drafts) {
            const task = await createDailyPlannerTaskForEmployee({
              ...draft,
              employeeCode: employee.employeeCode,
              skipRevisedEmail: planFinalized || editMode,
            });
            created.push(task);
          }
          toast.success(
            created.length === 1
              ? 'Task added for employee'
              : `${created.length} tasks added for employee`,
          );
          await onTasksUpdated(created);
          if (planFinalized || editMode) setPlanModified(true);
          setAddTaskOpen(false);
          return created;
        }}
      />

      <ProjectPastDataDialog
        open={pastDataOpen}
        projectName={String(task.projectName || '')}
        onClose={() => setPastDataOpen(false)}
      />

      <Dialog open={flagOpen} onOpenChange={(v) => !v && setFlagOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Raise Flag</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Send an urgent instruction for this specific task. The employee will see it on My Daily
              Planner and receive an email.
            </p>
            <div className="space-y-1">
              <Label htmlFor="flag-instruction">Instruction *</Label>
              <Textarea
                id="flag-instruction"
                rows={4}
                value={flagInstruction}
                disabled={busy}
                onChange={(e) => setFlagInstruction(e.target.value)}
                placeholder="Need detailed discussion on this task."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFlagOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!task) return;
                const instruction = flagInstruction.trim();
                if (!instruction) {
                  toast.error('Instruction is required');
                  return;
                }
                void (async () => {
                  setBusy(true);
                  try {
                    const updated = await raiseDailyPlannerTaskFlag(task.plannerTaskId, instruction);
                    toast.success('Flag raised and employee notified');
                    setFlagOpen(false);
                    setFlagInstruction('');
                    await onTasksUpdated([updated]);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to raise flag');
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revisionOpen} onOpenChange={(v) => !v && setRevisionOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="revision-reason">Reason *</Label>
              <Textarea
                id="revision-reason"
                rows={3}
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="Explain what needs improvement"
              />
            </div>
            <p className="text-sm font-medium text-[#212529]">Replacement Task</p>
            <div className="space-y-1">
              <Label htmlFor="replacement-name">Task Name *</Label>
              <Input
                id="replacement-name"
                value={replacementName}
                onChange={(e) => setReplacementName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="replacement-description">Description *</Label>
              <Textarea
                id="replacement-description"
                rows={3}
                value={replacementDescription}
                onChange={(e) => setReplacementDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Priority *</Label>
              <Select
                value={replacementPriority}
                onValueChange={(v) => setReplacementPriority(v as DailyPlannerPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Hours Required To Complete *</Label>
              <HoursMinutesFields
                idPrefix="replacement-hours"
                value={replacementHours}
                onChange={setReplacementHours}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="replacement-outcome">Instruction (optional)</Label>
              <Textarea
                id="replacement-outcome"
                rows={2}
                value={replacementOutcome}
                onChange={(e) => setReplacementOutcome(e.target.value)}
                placeholder="What is missing, what to correct, or any specific requirement"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setRevisionOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleSubmitRevision()}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reopenOpen}
        onOpenChange={(v) => {
          if (!v) {
            setReopenOpen(false);
            resetReopenForm();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reopen Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Previous approval is preserved. Choose a corrective action and submit.
            </p>
            {task?.approvedByName || task?.approvedAt || task?.approvedDate ? (
              <p className="text-sm text-gray-700">
                Previously approved
                {task.approvedByName ? ` by ${task.approvedByName}` : ''}
                {task.approvedAt || task.approvedDate
                  ? ` on ${formatDateCell(task.approvedAt || task.approvedDate)}`
                  : ''}
                .
              </p>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[#212529]">Corrective Action *</legend>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="reopen-action"
                  checked={reopenAction === 'revision'}
                  disabled={busy}
                  onChange={() => setReopenAction('revision')}
                />
                Revision
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="reopen-action"
                  checked={reopenAction === 'reschedule'}
                  disabled={busy}
                  onChange={() => setReopenAction('reschedule')}
                />
                Reschedule
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="reopen-action"
                  checked={reopenAction === 'delete'}
                  disabled={busy}
                  onChange={() => setReopenAction('delete')}
                />
                Delete
              </label>
            </fieldset>

            {reopenAction === 'revision' ? (
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <div className="space-y-1">
                  <Label htmlFor="reopen-revision-reason">Reason *</Label>
                  <Textarea
                    id="reopen-revision-reason"
                    rows={3}
                    value={reopenReason}
                    disabled={busy}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="Explain what needs improvement"
                  />
                </div>
                <p className="text-sm font-medium text-[#212529]">Replacement Task</p>
                <div className="space-y-1">
                  <Label htmlFor="reopen-task-name">Task Name *</Label>
                  <Input
                    id="reopen-task-name"
                    value={reopenTaskName}
                    disabled={busy}
                    onChange={(e) => setReopenTaskName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reopen-task-description">Description *</Label>
                  <Textarea
                    id="reopen-task-description"
                    rows={3}
                    value={reopenTaskDescription}
                    disabled={busy}
                    onChange={(e) => setReopenTaskDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Priority *</Label>
                  <Select
                    value={reopenTaskPriority}
                    onValueChange={(v) => setReopenTaskPriority(v as DailyPlannerPriority)}
                    disabled={busy}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Hours Required To Complete *</Label>
                  <HoursMinutesFields
                    idPrefix="reopen-hours"
                    value={reopenTaskHours}
                    onChange={setReopenTaskHours}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reopen-instruction">Instruction (optional)</Label>
                  <Textarea
                    id="reopen-instruction"
                    rows={2}
                    value={reopenInstruction}
                    disabled={busy}
                    onChange={(e) => setReopenInstruction(e.target.value)}
                    placeholder="What is missing, what to correct, or any specific requirement"
                  />
                </div>
              </div>
            ) : null}

            {reopenAction === 'reschedule' ? (
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <div className="space-y-1">
                  <Label htmlFor="reopen-reschedule-date">New date *</Label>
                  <Input
                    id="reopen-reschedule-date"
                    type="date"
                    min={minRescheduleDate}
                    value={reopenRescheduleDate}
                    disabled={busy}
                    onChange={(e) => setReopenRescheduleDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reopen-reschedule-instruction">Instruction (optional)</Label>
                  <Textarea
                    id="reopen-reschedule-instruction"
                    rows={3}
                    value={reopenInstruction}
                    disabled={busy}
                    onChange={(e) => setReopenInstruction(e.target.value)}
                    placeholder="Tell the employee what is missing or what to do on the new date"
                  />
                </div>
              </div>
            ) : null}

            {reopenAction === 'delete' ? (
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <p className="text-sm text-gray-700">
                  Are you sure you want to delete this approved task? Previous approval history is
                  preserved in the audit record.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="reopen-delete-reason">Reason / instruction (optional)</Label>
                  <Textarea
                    id="reopen-delete-reason"
                    rows={2}
                    value={reopenReason}
                    disabled={busy}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="Why this task is being deleted"
                  />
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setReopenOpen(false);
                resetReopenForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={reopenAction === 'delete' ? 'destructive' : 'default'}
              disabled={busy || !reopenAction}
              onClick={() => void handleSubmitReopenCorrection()}
            >
              {reopenAction === 'revision'
                ? 'Submit Revision'
                : reopenAction === 'reschedule'
                  ? 'Reschedule Task'
                  : reopenAction === 'delete'
                    ? 'Delete Task'
                    : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rescheduleOpen} onOpenChange={(v) => !v && setRescheduleOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reschedule Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="reschedule-date">New date *</Label>
              <Input
                id="reschedule-date"
                type="date"
                min={minRescheduleDate}
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reschedule-instruction">Instruction (optional)</Label>
              <Textarea
                id="reschedule-instruction"
                rows={3}
                value={rescheduleInstruction}
                onChange={(e) => setRescheduleInstruction(e.target.value)}
                placeholder="Tell the employee what is missing or what to do on the new date"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setRescheduleOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleSubmitReschedule()}>
              Reschedule Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(v) => !v && setDeleteOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-gray-700">
            Are you sure you want to delete this task?
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void handleConfirmDelete()}
            >
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
