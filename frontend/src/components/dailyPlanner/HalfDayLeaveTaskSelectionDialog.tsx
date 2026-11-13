import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import type { DailyPlannerTask } from '../../types/dailyPlanner';
import type { PayrollLeaveRequest } from '../../types/payroll';
import { leaveCalendarLabel } from '../../utils/payrollLeaveDates';
import { formatDurationLabel } from '../../utils/planningRecognition';
import { applyHalfDayLeaveTaskSelection } from '../../hooks/dailyPlanner/dailyPlannerApi';

type HalfDayLeaveTaskSelectionDialogProps = {
  open: boolean;
  leaveRequest: PayrollLeaveRequest | null;
  tasks: DailyPlannerTask[];
  onClose: () => void;
  onApplied: (result: {
    moved: DailyPlannerTask[];
    kept: DailyPlannerTask[];
  }) => void;
};

/**
 * After approved first/second half leave: employee chooses which existing planned
 * tasks to reschedule (optional) and the destination working date.
 */
export default function HalfDayLeaveTaskSelectionDialog({
  open,
  leaveRequest,
  tasks,
  onClose,
  onApplied,
}: HalfDayLeaveTaskSelectionDialogProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [targetDate, setTargetDate] = useState('');
  const [busy, setBusy] = useState(false);

  const leaveDate = String(leaveRequest?.startDate || '').trim().slice(0, 10);
  const leaveLabel = leaveRequest
    ? leaveCalendarLabel({
        leaveType: leaveRequest.leaveType,
        durationDays: leaveRequest.durationDays,
        halfDayPeriod: leaveRequest.halfDayPeriod,
      })
    : 'Half-day leave';

  const selectable = useMemo(
    () =>
      (tasks || []).filter((t) => {
        const status = String(t.status || '').trim();
        if (
          status === 'Rescheduled' ||
          status === 'Terminated' ||
          status === 'Verified Complete' ||
          status === 'Completed' ||
          status === 'Closed'
        ) {
          return false;
        }
        if (String(t.source || '').trim() === 'EXTRA') return false;
        return true;
      }),
    [tasks],
  );

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );

  if (!open || !leaveRequest) return null;

  const toggle = (taskId: string) => {
    setSelected((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleSubmit = async () => {
    if (busy) return;
    if (selectedIds.length > 0 && !String(targetDate || '').trim()) {
      toast.error('Select a destination date for the tasks to reschedule');
      return;
    }
    setBusy(true);
    try {
      const result = await applyHalfDayLeaveTaskSelection({
        leaveRequestId: leaveRequest.leaveRequestId,
        rescheduleTaskIds: selectedIds,
        targetDate: selectedIds.length > 0 ? targetDate : undefined,
      });
      toast.success(
        selectedIds.length > 0
          ? `Rescheduled ${selectedIds.length} task(s); remaining tasks stay on ${leaveDate}.`
          : 'All tasks kept on the half-day leave date.',
      );
      onApplied({
        moved: result.moved.map((m) => m.rescheduled),
        kept: result.kept,
      });
      setSelected({});
      setTargetDate('');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not apply selection');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Half-day leave — task selection</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Your {leaveLabel} on <strong>{leaveDate}</strong> was approved. Select any planned
            tasks to reschedule to another working day. Unselected tasks stay on this date
            (minimum planning hours for half-day leave is 4 Hours).
          </p>
          {selectable.length === 0 ? (
            <p className="text-sm text-gray-600">No open planned tasks on this date.</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-2">
              {selectable.map((task) => {
                const id = task.plannerTaskId;
                const hours =
                  task.hoursRequired != null && Number.isFinite(Number(task.hoursRequired))
                    ? formatDurationLabel(Number(task.hoursRequired))
                    : '—';
                return (
                  <li key={id} className="flex items-start gap-2 text-sm">
                    <input
                      id={`half-day-task-${id}`}
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(selected[id])}
                      disabled={busy}
                      onChange={() => toggle(id)}
                    />
                    <label htmlFor={`half-day-task-${id}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="font-medium text-[#212529]">
                        {task.taskName || 'Untitled task'}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-600">
                        {task.projectName ? `${task.projectName} · ` : ''}
                        {hours}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {selectedIds.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="half-day-target-date">Destination date *</Label>
              <Input
                id="half-day-target-date"
                type="date"
                value={targetDate}
                min={leaveDate || undefined}
                disabled={busy}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Later
          </Button>
          <Button type="button" disabled={busy || selectable.length === 0} onClick={() => void handleSubmit()}>
            {selectedIds.length > 0 ? 'Reschedule selected' : 'Keep all on this date'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
