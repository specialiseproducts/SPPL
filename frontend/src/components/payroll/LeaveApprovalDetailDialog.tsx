import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '../ui/textarea';
import {
  approvePayrollLeaveRequest,
  rejectPayrollLeaveRequest,
} from '../../hooks/payroll/payrollApi';
import type { PayrollLeaveRequest } from '../../types/payroll';
import { isPendingLeaveStatus, leaveCalendarLabel } from '../../utils/payrollLeaveDates';
import { leaveIndicatorPalette } from './LeaveCalendarEventBlock';
import { dailyPlannerQueryKeys } from '../../hooks/dailyPlanner/dailyPlannerQueryKeys';

type LeaveApprovalDetailDialogProps = {
  request: PayrollLeaveRequest | null;
  open: boolean;
  onClose: () => void;
  onDecided: () => void;
};

/**
 * Team Calendar — View pending leave: details + Approve / Reject (reason required).
 */
export default function LeaveApprovalDetailDialog({
  request,
  open,
  onClose,
  onDecided,
}: LeaveApprovalDetailDialogProps) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!open || !request) return null;

  const label = leaveCalendarLabel({
    leaveType: request.leaveType,
    durationDays: request.durationDays,
    halfDayPeriod: request.halfDayPeriod,
  });
  const colors = leaveIndicatorPalette(request.status);
  const canDecide = isPendingLeaveStatus(request.status);

  const resetReject = () => {
    setRejectMode(false);
    setRejectReason('');
  };

  const handleClose = () => {
    if (busy) return;
    resetReject();
    onClose();
  };

  const handleApprove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await approvePayrollLeaveRequest(request.leaveRequestId);
      // Refresh Daily Planner leave + task calendars (auto-reschedule may have moved tasks).
      void queryClient.invalidateQueries({ queryKey: dailyPlannerQueryKeys.all });
      toast.success('Leave request approved');
      resetReject();
      onDecided();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (busy) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error('Rejection reason is required');
      return;
    }
    setBusy(true);
    try {
      await rejectPayrollLeaveRequest(request.leaveRequestId, reason);
      toast.success('Leave request rejected');
      resetReject();
      onDecided();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{rejectMode ? 'Reject leave request?' : 'Leave details'}</DialogTitle>
        </DialogHeader>

        {rejectMode ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Provide a reason for rejecting {request.employeeName || request.employeeCode}&apos;s
              leave request ({request.startDate}
              {request.endDate !== request.startDate ? ` – ${request.endDate}` : ''}).
            </p>
            <div className="space-y-2">
              <Label htmlFor="payroll-leave-reject-reason">Reason</Label>
              <Textarea
                id="payroll-leave-reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Reason for rejection"
                disabled={busy}
              />
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  resetReject();
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void handleReject()}
              >
                {busy ? 'Rejecting…' : 'Confirm Reject'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-3 text-sm">
              <div
                className="rounded-md px-3 py-2 text-center text-sm font-semibold"
                style={{
                  backgroundColor: colors.backgroundColor,
                  border: `1px solid ${colors.borderColor}`,
                  color: colors.color,
                }}
              >
                {label}
              </div>
              <p>
                <span className="font-semibold text-[#212529]">Employee:</span>{' '}
                <span className="text-gray-700">
                  {request.employeeName || '—'} ({request.employeeCode})
                </span>
              </p>
              <p>
                <span className="font-semibold text-[#212529]">Status:</span>{' '}
                <span className="text-gray-700">{request.status || 'Pending'}</span>
              </p>
              <p>
                <span className="font-semibold text-[#212529]">Type:</span>{' '}
                <span className="text-gray-700">{label}</span>
              </p>
              <p>
                <span className="font-semibold text-[#212529]">Dates:</span>{' '}
                <span className="text-gray-700">
                  {request.startDate}
                  {request.endDate !== request.startDate ? ` – ${request.endDate}` : ''}
                </span>
              </p>
              {request.leaveType === 'multiple_day' ? (
                <p>
                  <span className="font-semibold text-[#212529]">Duration:</span>{' '}
                  <span className="text-gray-700">
                    {request.durationDays} day{request.durationDays === 1 ? '' : 's'}
                  </span>
                </p>
              ) : null}
              {request.reason ? (
                <div>
                  <p className="font-semibold text-[#212529]">Reason</p>
                  <p className="mt-1 whitespace-pre-wrap text-gray-700">{request.reason}</p>
                </div>
              ) : null}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" disabled={busy} onClick={handleClose}>
                Close
              </Button>
              {canDecide ? (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setRejectMode(true)}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    className="bg-green-600 text-white hover:bg-green-700"
                    disabled={busy}
                    onClick={() => void handleApprove()}
                  >
                    {busy ? 'Approving…' : 'Approve'}
                  </Button>
                </>
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
