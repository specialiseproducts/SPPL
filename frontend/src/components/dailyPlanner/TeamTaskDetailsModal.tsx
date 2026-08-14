import { useEffect, useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import AuditHistoryModal from '../audit/AuditHistoryModal';
import type { DailyPlannerPriority, DailyPlannerTask } from '../../types/dailyPlanner';
import {
  approveDailyPlannerTask,
  requestNeedsRevisionDailyPlannerTask,
  verifyDailyPlannerCompletion,
} from '../../hooks/dailyPlanner/dailyPlannerApi';
import { getDailyTaskStatusLabel } from './dailyPlannerUtils';
import BulletPointList from './BulletPointList';

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
  Rejected: { bg: '#FEF3F2', text: '#B42318', border: '#FECDCA' },
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

interface TeamTaskDetailsModalProps {
  task: DailyPlannerTask | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export default function TeamTaskDetailsModal({
  task,
  open,
  onClose,
  onUpdated,
}: TeamTaskDetailsModalProps) {
  const [editingPriority, setEditingPriority] = useState(false);
  const [stagedPriority, setStagedPriority] = useState<DailyPlannerPriority>('Medium');
  const [busy, setBusy] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [replacementName, setReplacementName] = useState('');
  const [replacementDescription, setReplacementDescription] = useState('');
  const [replacementPriority, setReplacementPriority] = useState<DailyPlannerPriority>('Medium');
  const [replacementOutcome, setReplacementOutcome] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);

  useEffect(() => {
    if (!task) return;
    setEditingPriority(false);
    setStagedPriority((task.currentPriority || task.priority || 'Medium') as DailyPlannerPriority);
    setRevisionOpen(false);
    setRevisionReason('');
    setReplacementName('');
    setReplacementDescription('');
    setReplacementPriority('Medium');
    setReplacementOutcome('');
  }, [task?.plannerTaskId, open]);

  if (!task) return null;

  const currentPriority = (task.currentPriority || task.priority || 'Medium') as DailyPlannerPriority;
  const displayPriority = editingPriority ? stagedPriority : currentPriority;
  const priorityChanged = editingPriority && stagedPriority !== currentPriority;
  const canApprove = task.status === 'Pending' || task.status === 'Approved' || priorityChanged;
  const awaitingVerification =
    task.status === 'Awaiting Verification' || task.status === 'Completed';
  const showApprove = task.status === 'Pending' || (editingPriority && priorityChanged);
  const showNeedsRevision =
    task.status === 'Pending' ||
    task.status === 'Approved' ||
    awaitingVerification;
  const showVerify = awaitingVerification;

  const handleApprove = async () => {
    setBusy(true);
    try {
      await approveDailyPlannerTask(task.plannerTaskId, {
        priority: priorityChanged || editingPriority ? stagedPriority : undefined,
      });
      toast.success('Task approved');
      setEditingPriority(false);
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    try {
      await verifyDailyPlannerCompletion(task.plannerTaskId);
      toast.success('Completion verified');
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitRevision = async () => {
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
    setBusy(true);
    try {
      await requestNeedsRevisionDailyPlannerTask(task.plannerTaskId, {
        reason: revisionReason.trim(),
        replacementTask: {
          taskName: replacementName.trim(),
          description: replacementDescription.trim(),
          priority: replacementPriority,
          expectedOutcome: replacementOutcome.trim(),
        },
      });
      toast.success('Needs revision sent to employee');
      setRevisionOpen(false);
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Needs revision failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="!flex !h-[90vh] !max-h-[90vh] !w-[min(92vw,1100px)] !max-w-[1100px] !flex-col gap-0 overflow-hidden !p-0 sm:!max-w-[1100px]"
          style={{
            width: 'min(92vw, 1100px)',
            maxWidth: '1100px',
            height: '90vh',
            maxHeight: '90vh',
          }}
        >
          <DialogHeader className="shrink-0 border-b border-gray-200 px-6 py-4 text-left">
            <DialogTitle className="text-lg font-semibold text-[#212529]">
              Task Details
            </DialogTitle>
            {task.employeeName ? (
              <p className="text-sm text-gray-600">
                {task.employeeName}
                {task.employeeCode ? ` · ${task.employeeCode}` : ''}
              </p>
            ) : null}
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto scroll-smooth bg-[#F8F9FA] px-6 py-5 overscroll-contain">
            <ViewSection title="Task Information">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ViewField label="Task Name" value={displayCell(task.taskName)} />
                <ViewField label="Date" value={displayCell(task.date)} />
                <ViewField label="Task Type" value={displayCell(task.taskType)} />
                <ViewField label="Source" value={displayCell(task.source)} />
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
                      Priority change will be saved when you click Approve.
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
                <ViewField label="Last Updated" value={formatDateCell(task.updatedAt)} />
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
                <div className="mt-4 space-y-3">
                  <ViewBulletField label="Work Done" value={displayCell(task.reason)} />
                  <ViewField
                    label="Verified By"
                    value={displayCell(task.verifiedByName || task.verifiedBy)}
                  />
                  <ViewField label="Verified At" value={formatDateCell(task.verifiedAt)} />
                </div>
              ) : null}
              {task.status === 'Needs Revision' ? (
                <div className="mt-4 space-y-3">
                  <ViewBulletField
                    label="Revision Reason"
                    value={displayCell(task.revisionReason || task.managerComments)}
                  />
                </div>
              ) : null}
              {task.status === 'Rescheduled' ? (
                <div className="mt-4 space-y-3">
                  <ViewField label="Rescheduled To" value={displayCell(task.rescheduledToDate)} />
                  <ViewBulletField label="Reschedule Reason" value={displayCell(task.reason)} />
                </div>
              ) : null}
              {task.status === 'Terminated' ? (
                <div className="mt-4">
                  <ViewBulletField label="Termination Reason" value={displayCell(task.reason)} />
                </div>
              ) : null}
            </ViewSection>

            <ViewSection title="History">
              <div className="mb-3 flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setAuditOpen(true)}>
                  Audit History
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ViewField label="Created On" value={formatDateCell(task.createdAt)} />
                <ViewField label="Last Updated" value={formatDateCell(task.updatedAt)} />
                <ViewField
                  label="Approved By"
                  value={displayCell(task.approvedByName || (task.approved ? task.approvedBy : ''))}
                />
                <ViewField
                  label="Approved At"
                  value={formatDateCell(task.approvedAt || task.approvedDate)}
                />
                {task.priorityEdited ? (
                  <>
                    <ViewField
                      label="Priority Edited By"
                      value={displayCell(task.priorityEditedByName || task.priorityEditedBy)}
                    />
                    <ViewField
                      label="Priority Edited At"
                      value={formatDateCell(task.priorityEditedAt)}
                    />
                  </>
                ) : null}
                {task.revisionRequestedAt ? (
                  <>
                    <ViewField
                      label="Revision Requested By"
                      value={displayCell(
                        task.revisionRequestedByName || task.revisionRequestedBy,
                      )}
                    />
                    <ViewField
                      label="Revision Requested At"
                      value={formatDateCell(task.revisionRequestedAt)}
                    />
                  </>
                ) : null}
                {task.verifiedAt ? (
                  <>
                    <ViewField
                      label="Verified By"
                      value={displayCell(task.verifiedByName || task.verifiedBy)}
                    />
                    <ViewField label="Verified At" value={formatDateCell(task.verifiedAt)} />
                  </>
                ) : null}
              </div>
            </ViewSection>
          </div>

          <DialogFooter className="shrink-0 flex-wrap gap-2 border-t border-gray-200 bg-white px-6 py-4 sm:justify-end">
            {showVerify ? (
              <Button type="button" disabled={busy} onClick={() => void handleVerify()}>
                Verify Completion
              </Button>
            ) : null}
            {showApprove || canApprove ? (
              <Button
                type="button"
                disabled={busy}
                className="bg-[#007BFF] hover:bg-[#0056b3]"
                onClick={() => void handleApprove()}
              >
                Approve
              </Button>
            ) : null}
            {showNeedsRevision ? (
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => setRevisionOpen(true)}
              >
                Needs Revision
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revisionOpen} onOpenChange={(v) => !v && setRevisionOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Needs Revision</DialogTitle>
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

      <AuditHistoryModal
        open={auditOpen}
        onOpenChange={setAuditOpen}
        title="Task Audit History"
        entityType="plannerTask"
        entityId={task.plannerTaskId}
        module="dailyPlanner"
      />
    </>
  );
}
