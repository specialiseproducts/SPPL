import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import {
  createPayrollLeaveRequest,
  updatePayrollLeaveRequest,
} from '../../hooks/payroll/payrollApi';
import type {
  CreatePayrollLeaveRequestBody,
  PayrollHalfDayPeriod,
  PayrollLeaveRequest,
  PayrollLeaveType,
} from '../../types/payroll';
import {
  countWorkingDaysInRange,
  requiresAdvanceNoticeWarning,
  todayIstDateKey,
} from '../../utils/payrollLeaveDates';
import { useAuth } from '../../context/AuthContext';

type LeaveRequestDialogProps = {
  open: boolean;
  initialDate: string;
  /** When set, dialog updates this pending request instead of creating. */
  editingRequest?: PayrollLeaveRequest | null;
  onClose: () => void;
  onSaved: () => void;
};

const LEAVE_TYPE_OPTIONS: Array<{ value: PayrollLeaveType; label: string }> = [
  { value: 'one_day', label: 'One day leave' },
  { value: 'multiple_day', label: 'Multiple day leave' },
  { value: 'half_day', label: 'Half day leave' },
];

const HALF_DAY_OPTIONS: Array<{ value: PayrollHalfDayPeriod; label: string }> = [
  { value: 'first_half', label: '1st Half' },
  { value: 'second_half', label: '2nd Half' },
];

export default function LeaveRequestDialog({
  open,
  initialDate,
  editingRequest = null,
  onClose,
  onSaved,
}: LeaveRequestDialogProps) {
  const { user } = useAuth();
  const employeeLocation = user?.location || 'Office';
  const today = todayIstDateKey();
  const isEdit = Boolean(editingRequest?.leaveRequestId);
  const [leaveType, setLeaveType] = useState<PayrollLeaveType | ''>('');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState('');
  const [halfDayPeriod, setHalfDayPeriod] = useState<PayrollHalfDayPeriod | ''>('');
  const [busy, setBusy] = useState(false);
  const [advanceWarningOpen, setAdvanceWarningOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setAdvanceWarningOpen(false);
    if (editingRequest) {
      const type = String(editingRequest.leaveType || '').trim() as PayrollLeaveType;
      setLeaveType(
        type === 'one_day' || type === 'multiple_day' || type === 'half_day' ? type : '',
      );
      setReason(String(editingRequest.reason || ''));
      setStartDate(String(editingRequest.startDate || initialDate).slice(0, 10));
      setEndDate(
        type === 'multiple_day'
          ? String(editingRequest.endDate || editingRequest.startDate || '').slice(0, 10)
          : '',
      );
      const period = String(editingRequest.halfDayPeriod || '').trim();
      setHalfDayPeriod(
        period === 'first_half' || period === 'second_half' ? period : '',
      );
      return;
    }
    setLeaveType('');
    setReason('');
    setStartDate(initialDate);
    setEndDate('');
    setHalfDayPeriod('');
  }, [open, initialDate, editingRequest]);

  const durationDays = useMemo(() => {
    if (leaveType !== 'multiple_day') return null;
    if (!startDate || !endDate) return null;
    return countWorkingDaysInRange(startDate, endDate, employeeLocation);
  }, [leaveType, startDate, endDate, employeeLocation]);

  const needsAdvanceWarning = useMemo(() => {
    if (leaveType !== 'multiple_day' || durationDays == null) return false;
    return requiresAdvanceNoticeWarning(durationDays, today, startDate);
  }, [leaveType, durationDays, today, startDate]);

  const buildPayload = (
    advanceNoticeAcknowledged = false,
  ): CreatePayrollLeaveRequestBody | null => {
    if (!leaveType) {
      toast.error('Select a leave type');
      return null;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast.error('Reason of Leave is required');
      return null;
    }

    if (leaveType === 'one_day') {
      if (!startDate || startDate < today) {
        toast.error('Leave cannot start on a past date');
        return null;
      }
      return {
        leaveType,
        startDate,
        endDate: startDate,
        reason: trimmedReason,
      };
    }

    if (leaveType === 'half_day') {
      if (!halfDayPeriod) {
        toast.error('Select a half-day period');
        return null;
      }
      if (!startDate || startDate < today) {
        toast.error('Leave cannot start on a past date');
        return null;
      }
      return {
        leaveType,
        startDate,
        endDate: startDate,
        halfDayPeriod,
        reason: trimmedReason,
      };
    }

    if (!startDate) {
      toast.error('Start Date is required');
      return null;
    }
    if (startDate < today) {
      toast.error('Start Date cannot be in the past');
      return null;
    }
    if (!endDate) {
      toast.error('End Date is required');
      return null;
    }
    if (endDate < startDate) {
      toast.error('End Date must be the same as or later than Start Date');
      return null;
    }
    if (durationDays == null) {
      toast.error('Invalid date range');
      return null;
    }
    if (durationDays < 1) {
      toast.error('Selected dates do not include any working days. Adjust the leave date range.');
      return null;
    }

    return {
      leaveType,
      startDate,
      endDate,
      reason: trimmedReason,
      advanceNoticeAcknowledged,
    };
  };

  const submit = async (advanceNoticeAcknowledged: boolean) => {
    const payload = buildPayload(advanceNoticeAcknowledged);
    if (!payload) return;

    if (needsAdvanceWarning && !advanceNoticeAcknowledged) {
      setAdvanceWarningOpen(true);
      return;
    }

    setBusy(true);
    try {
      if (isEdit && editingRequest?.leaveRequestId) {
        await updatePayrollLeaveRequest(editingRequest.leaveRequestId, payload);
        toast.success('Leave request updated');
      } else {
        await createPayrollLeaveRequest(payload);
        toast.success('Leave request submitted');
      }
      onSaved();
      onClose();
    } catch (err) {
      const payloadErr = err as { payload?: { code?: string; message?: string } };
      if (payloadErr?.payload?.code === 'ADVANCE_NOTICE_REQUIRED') {
        setAdvanceWarningOpen(true);
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Leave request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !busy) onClose();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Leave Request' : 'Request Leave'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Leave type</Label>
              <div className="space-y-2" role="radiogroup" aria-label="Leave type">
                {LEAVE_TYPE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50',
                      leaveType === option.value && 'border-blue-300 bg-blue-50',
                    )}
                  >
                    <input
                      type="radio"
                      name="leave-type"
                      className="h-4 w-4 accent-[#007BFF]"
                      checked={leaveType === option.value}
                      onChange={() => {
                        setLeaveType(option.value);
                        setHalfDayPeriod('');
                        if (option.value === 'multiple_day') {
                          setStartDate((prev) => prev || initialDate);
                          setEndDate((prev) => prev || '');
                        } else {
                          setStartDate((prev) => prev || initialDate);
                          setEndDate('');
                        }
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {leaveType === 'multiple_day' ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="leave-start-date">Start Date</Label>
                  <Input
                    id="leave-start-date"
                    type="date"
                    min={today}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="leave-end-date">End Date</Label>
                  <Input
                    id="leave-end-date"
                    type="date"
                    min={startDate || today}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Calculated Leave Duration</Label>
                  <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[#212529]">
                    {durationDays != null
                      ? `${durationDays} working day${durationDays === 1 ? '' : 's'}`
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sundays and applicable holidays for your location are excluded.
                  </p>
                </div>
              </div>
            ) : null}

            {leaveType === 'half_day' ? (
              <div className="space-y-2">
                <Label>Half-Day Period</Label>
                <div className="space-y-2" role="radiogroup" aria-label="Half-day period">
                  {HALF_DAY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50',
                        halfDayPeriod === option.value && 'border-blue-300 bg-blue-50',
                      )}
                    >
                      <input
                        type="radio"
                        name="half-day-period"
                        className="h-4 w-4 accent-[#007BFF]"
                        checked={halfDayPeriod === option.value}
                        onChange={() => setHalfDayPeriod(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {leaveType ? (
              <div className="space-y-1">
                <Label htmlFor="leave-reason">Reason of Leave</Label>
                <Textarea
                  id="leave-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason"
                  rows={3}
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#007BFF] hover:bg-[#0056b3]"
              disabled={busy || !leaveType}
              onClick={() => void submit(false)}
            >
              {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={advanceWarningOpen} onOpenChange={setAdvanceWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Advance notice recommended</AlertDialogTitle>
            <AlertDialogDescription>
              Leave longer than two days should be requested at least 15 days in advance. You can
              still submit this request after acknowledging this notice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                setAdvanceWarningOpen(false);
                void submit(true);
              }}
            >
              Acknowledge and submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
