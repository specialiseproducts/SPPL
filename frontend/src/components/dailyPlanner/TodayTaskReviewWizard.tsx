import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, CheckCheck, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { DailyPlannerPriority, DailyPlannerTask } from '../../types/dailyPlanner';
import {
  approveDailyPlannerTask,
  requestNeedsRevisionDailyPlannerTask,
  verifyDailyPlannerCompletion,
} from '../../hooks/dailyPlanner/dailyPlannerApi';
import { getDailyTaskStatusLabel } from './dailyPlannerUtils';
import BulletPointList from './BulletPointList';
import {
  countReviewedTasks,
  formatReviewDate,
  getCompletionTime,
  getPreviousRevisionCount,
  getTaskOriginLabel,
  getWizardReviewIndicator,
  isTaskManagerReviewed,
  type WizardReviewIndicator,
} from './todayTaskReviewWizardUtils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
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

const STATUS_BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Pending: { bg: '#FEF9C3', text: '#A16207', border: '#FDE047' },
  Approved: { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
  Completed: { bg: '#ECFDF3', text: '#027A48', border: '#A6F4C5' },
  'Verified Complete': { bg: '#ECFDF3', text: '#027A48', border: '#A6F4C5' },
  'Awaiting Verification': { bg: '#FFEDD5', text: '#C2410C', border: '#FDBA74' },
  'Needs Revision': { bg: '#FEF3F2', text: '#B42318', border: '#FECDCA' },
  'Not Completed': { bg: '#FEF3F2', text: '#B42318', border: '#FECDCA' },
  Rescheduled: { bg: '#FFFAEB', text: '#B54708', border: '#FEDF89' },
  Terminated: { bg: '#FEF3F2', text: '#B42318', border: '#FECDCA' },
};

function statusBadge(status: string) {
  const colors = STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.Pending;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      {getDailyTaskStatusLabel(status as DailyPlannerTask['status'])}
    </span>
  );
}

function ViewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="text-sm text-[#212529] break-words">{value}</div>
    </div>
  );
}

function ViewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-[#212529]">
        {title}
      </h3>
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
}

interface TodayTaskReviewWizardProps {
  open: boolean;
  tasks: DailyPlannerTask[];
  employee: TodayReviewEmployeeInfo;
  reviewDate: string;
  initialTaskIndex?: number;
  onClose: () => void;
  onFinish: () => void;
  onTasksUpdated: (updatedTasks?: DailyPlannerTask[]) => Promise<void> | void;
}

export default function TodayTaskReviewWizard({
  open,
  tasks,
  employee,
  reviewDate,
  initialTaskIndex = 0,
  onClose,
  onFinish,
  onTasksUpdated,
}: TodayTaskReviewWizardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingPriority, setEditingPriority] = useState(false);
  const [stagedPriority, setStagedPriority] = useState<DailyPlannerPriority>('Medium');
  const [editingHours, setEditingHours] = useState(false);
  const [stagedHours, setStagedHours] = useState('');
  const [managerComments, setManagerComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [savePhase, setSavePhase] = useState<'idle' | 'saved'>('idle');
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [replacementName, setReplacementName] = useState('');
  const [replacementDescription, setReplacementDescription] = useState('');
  const [replacementPriority, setReplacementPriority] = useState<DailyPlannerPriority>('Medium');
  const [replacementHours, setReplacementHours] = useState('');
  const [replacementOutcome, setReplacementOutcome] = useState('');

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => a.taskName.localeCompare(b.taskName)),
    [tasks],
  );

  const task = sortedTasks[currentIndex] ?? null;
  const total = sortedTasks.length;
  const reviewedCount = countReviewedTasks(sortedTasks);
  const allReviewed = total > 0 && reviewedCount === total;
  const progressPct = total > 0 ? Math.round((reviewedCount / total) * 100) : 0;

  useEffect(() => {
    if (!open) return;
    const safeIndex = Math.min(Math.max(0, initialTaskIndex), Math.max(0, total - 1));
    setCurrentIndex(safeIndex);
    setSavePhase('idle');
    setEditingPriority(false);
    setEditingHours(false);
    setManagerComments('');
    setRevisionOpen(false);
  }, [open, initialTaskIndex, total, employee.employeeCode]);

  useEffect(() => {
    if (!task) return;
    setEditingPriority(false);
    setStagedPriority((task.currentPriority || task.priority || 'Medium') as DailyPlannerPriority);
    setEditingHours(false);
    setStagedHours(
      task.hoursRequired != null && Number.isFinite(Number(task.hoursRequired))
        ? String(task.hoursRequired)
        : '',
    );
    setManagerComments('');
    setRevisionOpen(false);
    setRevisionReason('');
    setReplacementName('');
    setReplacementDescription('');
    setReplacementPriority('Medium');
    setReplacementHours('');
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
    Number.isFinite(stagedHoursNumber) &&
    stagedHoursNumber > 0 &&
    stagedHoursNumber !== currentHours;
  const awaitingVerification =
    task?.status === 'Awaiting Verification' || task?.status === 'Completed';
  const showApprove =
    task?.status === 'Pending' ||
    (editingPriority && priorityChanged) ||
    (editingHours && hoursChanged);
  const showVerify = awaitingVerification;
  const showRequestRevision =
    task?.status === 'Pending' ||
    task?.status === 'Approved' ||
    awaitingVerification;

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

  const handleApprove = () => {
    if (!task) return;
    if (editingHours) {
      const hoursValue = Number(stagedHours);
      if (!String(stagedHours).trim() || !Number.isFinite(hoursValue) || hoursValue <= 0) {
        toast.error('Hours Required to Complete must be a number greater than 0');
        return;
      }
    }
    void runSaveFlow(async () => {
      const hoursValue = Number(stagedHours);
      const updated = await approveDailyPlannerTask(task.plannerTaskId, {
        comments: managerComments.trim(),
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
    void runSaveFlow(async () => {
      return verifyDailyPlannerCompletion(task.plannerTaskId, managerComments.trim());
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
    if (!String(replacementHours).trim() || !Number.isFinite(hoursValue) || hoursValue <= 0) {
      toast.error('Hours Required to Complete must be a number greater than 0');
      return;
    }
    void runSaveFlow(async () => {
      const updated = await requestNeedsRevisionDailyPlannerTask(task.plannerTaskId, {
        reason: revisionReason.trim(),
        replacementTask: {
          taskName: replacementName.trim(),
          description: replacementDescription.trim(),
          priority: replacementPriority,
          hoursRequired: Math.round(hoursValue * 100) / 100,
          expectedOutcome: replacementOutcome.trim(),
        },
      });
      setRevisionOpen(false);
      return updated;
    });
  };

  if (!task) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="!flex !h-[92vh] !max-h-[92vh] !w-[min(96vw,1200px)] !max-w-[1200px] !flex-col gap-0 overflow-hidden !p-0 sm:!max-w-[1200px]"
          style={{
            width: 'min(96vw, 1200px)',
            maxWidth: '1200px',
            height: '92vh',
            maxHeight: '92vh',
          }}
        >
          <DialogHeader className="shrink-0 border-b border-gray-200 bg-white px-6 py-4 text-left">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-lg font-semibold text-[#212529]">
                  Today&apos;s Task Review
                </DialogTitle>
                <p className="mt-1 text-base font-medium text-[#212529]">{employee.employeeName}</p>
                <p className="text-sm text-gray-600">
                  {employee.employeeCode}
                  {employee.department ? ` · ${employee.department}` : ''}
                  {employee.designation ? ` · ${employee.designation}` : ''}
                </p>
              </div>
              <div className="min-w-[12rem] space-y-2 text-right">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Date</p>
                  <p className="text-sm font-medium text-[#212529]">{formatReviewDate(reviewDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Task {currentIndex + 1} of {total}
                  </p>
                  <p className="text-xs text-gray-600">Progress {progressPct}%</p>
                  <Progress value={progressPct} className="mt-1 h-2" />
                </div>
              </div>
            </div>
            {savePhase === 'saved' ? (
              <div className="mt-3 flex items-center gap-3 text-sm">
                <span className="font-medium text-green-700">Task Saved ✓</span>
              </div>
            ) : null}
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto scroll-smooth bg-[#F8F9FA] px-6 py-5 overscroll-contain">
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
                <ViewField label="Task Name" value={displayCell(task.taskName)} />
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
                    {editingPriority ? (
                      <Select
                        value={stagedPriority}
                        onValueChange={(v) => setStagedPriority(v as DailyPlannerPriority)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm text-[#212529]">{displayPriority}</div>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Edit priority"
                      className="h-8 w-8"
                      disabled={busy}
                      onClick={() => {
                        setEditingPriority((v) => !v);
                        setStagedPriority(currentPriority);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {priorityChanged ? (
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
                    {editingHours ? (
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0.25}
                        step={0.25}
                        className="w-[160px]"
                        value={stagedHours}
                        onChange={(e) => setStagedHours(e.target.value)}
                      />
                    ) : (
                      <div className="text-sm text-[#212529]">
                        {displayCell(currentHours)}
                      </div>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Edit hours required"
                      className="h-8 w-8"
                      disabled={busy}
                      onClick={() => {
                        setEditingHours((v) => !v);
                        setStagedHours(
                          currentHours != null ? String(currentHours) : '',
                        );
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {hoursChanged ? (
                    <p className="text-xs text-amber-700">
                      Hours change will be saved when you click Approve Task.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-4">
                <ViewBulletField label="Description" value={displayCell(task.description)} />
              </div>
            </ViewSection>

            <ViewSection title="Completion Information">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ViewField label="Employee Status" value={statusBadge(task.status)} />
                <ViewField
                  label="Completion Time"
                  value={formatDateCell(getCompletionTime(task))}
                />
              </div>
              {awaitingVerification ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-[#212529]">
                    Employee marked this task as completed. Manager must verify.
                  </p>
                  <ViewBulletField label="Work Done" value={displayCell(task.reason)} />
                </div>
              ) : null}
              {task.status === 'Verified Complete' ? (
                <div className="mt-4">
                  <ViewBulletField label="Work Done" value={displayCell(task.reason)} />
                </div>
              ) : null}
            </ViewSection>

            <ViewSection title="Manager Review">
              <p className="mb-3 text-sm text-gray-600">Manager Decision</p>
              <div className="mb-4 flex flex-wrap gap-2">
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
                {isTaskManagerReviewed(task) &&
                !showApprove &&
                !showVerify &&
                !showRequestRevision ? (
                  <p className="text-sm text-gray-600">
                    This task has already been reviewed ({getWizardReviewIndicator(task)}).
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manager-comments">Manager Comments (optional)</Label>
                <Textarea
                  id="manager-comments"
                  rows={2}
                  value={managerComments}
                  disabled={busy}
                  onChange={(e) => setManagerComments(e.target.value)}
                  placeholder="Add comments for this review decision"
                />
              </div>
            </ViewSection>
          </div>

          <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Jump To Task
            </p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {sortedTasks.map((t, idx) => {
                const indicator = getWizardReviewIndicator(t);
                const style = INDICATOR_STYLES[indicator];
                return (
                  <button
                    key={t.plannerTaskId}
                    type="button"
                    title={style.label}
                    disabled={busy}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      'inline-flex h-8 min-w-[2rem] items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors',
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

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || currentIndex <= 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || currentIndex >= total - 1}
                  onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                  Close
                </Button>
                <Button
                  type="button"
                  className="bg-[#007BFF] hover:bg-[#0056b3]"
                  disabled={!allReviewed || busy}
                  onClick={onFinish}
                >
                  Finish Review
                </Button>
              </div>
            </div>
          </div>
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
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="replacement-hours">Hours Required To Complete *</Label>
              <Input
                id="replacement-hours"
                type="number"
                inputMode="decimal"
                min={0.25}
                step={0.25}
                placeholder="e.g. 1.5"
                value={replacementHours}
                onChange={(e) => setReplacementHours(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="replacement-outcome">Expected Outcome (optional)</Label>
              <Textarea
                id="replacement-outcome"
                rows={2}
                value={replacementOutcome}
                onChange={(e) => setReplacementOutcome(e.target.value)}
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
    </>
  );
}
