import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import type { PayrollLeaveRequest } from '../../types/payroll';
import {
  isPendingLeaveStatus,
  leaveCalendarLabel,
  leaveEventColors,
} from '../../utils/payrollLeaveDates';

type LeaveDetailDialogProps = {
  request: PayrollLeaveRequest | null;
  open: boolean;
  onClose: () => void;
  onEdit: (request: PayrollLeaveRequest) => void;
  /** Parent must close this dialog, then open a standalone delete confirmation. */
  onRequestDelete: (request: PayrollLeaveRequest) => void;
};

/**
 * Leave details only. Delete confirmation lives in MyCalendarTab as a
 * standalone AlertDialog so it never nests with this Dialog (Radix stacking
 * previously prevented the DELETE request from firing).
 */
export default function LeaveDetailDialog({
  request,
  open,
  onClose,
  onEdit,
  onRequestDelete,
}: LeaveDetailDialogProps) {
  if (!open || !request) return null;

  const label = leaveCalendarLabel({
    leaveType: request.leaveType,
    durationDays: request.durationDays,
    halfDayPeriod: request.halfDayPeriod,
  });
  const colors = leaveEventColors(request.status);
  const canModify = isPendingLeaveStatus(request.status);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Leave details</DialogTitle>
        </DialogHeader>

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
            <span className="font-semibold text-[#212529]">Status:</span>{' '}
            <span className="text-gray-700">{request.status || 'Pending'}</span>
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
          {!canModify ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Only Pending leave requests can be edited or deleted.
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {canModify ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClose();
                  onEdit(request);
                }}
              >
                Edit Leave
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => onRequestDelete(request)}
              >
                Delete Leave
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
