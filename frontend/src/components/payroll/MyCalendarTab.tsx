import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import HolidayMonthCalendar from '../calendar/HolidayMonthCalendar';
import type { HolidayCalendarDayCell } from '../calendar/holidayMonthGrid';
import { deletePayrollLeaveRequest } from '../../hooks/payroll/payrollApi';
import {
  useInvalidatePayrollQueries,
  useMyLeaveRequestsQuery,
} from '../../hooks/payroll/usePayrollQueries';
import type { PayrollLeaveRequest } from '../../types/payroll';
import { todayIstDateKey } from '../../utils/payrollLeaveDates';
import { isQueryColdLoading } from '../../utils/queryLoading';
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
import LeaveCalendarEventBlock from './LeaveCalendarEventBlock';
import LeaveDetailDialog from './LeaveDetailDialog';
import LeaveRequestDialog from './LeaveRequestDialog';

/**
 * Payroll → My Calendar.
 * Leave create/edit/delete for Pending requests; leave events fill remaining cell height.
 */
export default function MyCalendarTab() {
  const { user } = useAuth();
  const employeeLocation = user?.location || 'Office';
  const now = new Date();
  const [view, setView] = useState({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  });
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [detailRequest, setDetailRequest] = useState<PayrollLeaveRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<PayrollLeaveRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PayrollLeaveRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  /** Stable id for the in-flight delete (survives AlertDialog close races). */
  const deleteIdRef = useRef<string | null>(null);
  const invalidate = useInvalidatePayrollQueries();

  const leaveQuery = useMyLeaveRequestsQuery(view.year, view.month);
  const leaveRequests = leaveQuery.data ?? [];
  const loading = isQueryColdLoading(leaveQuery);

  const refreshLeaves = useCallback(() => {
    invalidate();
    void leaveQuery.refetch({ cancelRefetch: false });
  }, [invalidate, leaveQuery]);

  const handleConfirmDelete = useCallback(async () => {
    if (deletingRef.current) return;
    const leaveRequestId = String(
      deleteIdRef.current || deleteTarget?.leaveRequestId || '',
    ).trim();
    if (!leaveRequestId) {
      toast.error('Leave request id is missing');
      setDeleteTarget(null);
      deleteIdRef.current = null;
      return;
    }

    deletingRef.current = true;
    setDeleting(true);
    try {
      await deletePayrollLeaveRequest(leaveRequestId);
      toast.success('Leave request deleted');
      setDeleteTarget(null);
      deleteIdRef.current = null;
      refreshLeaves();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }, [deleteTarget, refreshLeaves]);

  const leavesByDate = useMemo(() => {
    const map = new Map<string, PayrollLeaveRequest[]>();
    for (const request of leaveRequests) {
      const start = String(request.startDate || '').slice(0, 10);
      const end = String(request.endDate || '').slice(0, 10);
      if (!start || !end || end < start) continue;
      const cursor = new Date(`${start}T00:00:00.000Z`);
      const last = new Date(`${end}T00:00:00.000Z`);
      while (cursor.getTime() <= last.getTime()) {
        const key = cursor.toISOString().slice(0, 10);
        if (!map.has(key)) map.set(key, []);
        // Deduplicate by leaveRequestId within a cell (defensive).
        const bucket = map.get(key)!;
        if (!bucket.some((r) => r.leaveRequestId === request.leaveRequestId)) {
          bucket.push(request);
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    return map;
  }, [leaveRequests]);

  const handleDayDoubleClick = useCallback((iso: string, cell: HolidayCalendarDayCell) => {
    if (!cell.inMonth) return;
    const today = todayIstDateKey();
    if (iso < today) {
      toast.error('Cannot request leave for a past date');
      return;
    }
    setEditingRequest(null);
    setCreateDate(iso);
  }, []);

  const renderDayContent = useCallback(
    (cell: HolidayCalendarDayCell) => {
      if (!cell.inMonth) return null;
      const dayLeaves = leavesByDate.get(cell.iso) ?? [];
      if (dayLeaves.length === 0) return null;
      const hasConflict = dayLeaves.length > 1;
      // Must fill the cell's flex-1 content area so LeaveEventBlock can grow vertically.
      return (
        <div
          className="flex min-h-0 w-full min-w-0 flex-col items-stretch gap-1"
          style={{ flex: '1 1 0', height: '100%' }}
        >
          {hasConflict ? (
            <p
              className="shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-medium text-red-700 bg-red-50"
              style={{ flex: '0 0 auto' }}
            >
              Conflict — edit or delete pending leave
            </p>
          ) : null}
          {dayLeaves.map((request) => (
            <LeaveCalendarEventBlock
              key={`${request.leaveRequestId}-${cell.iso}`}
              request={request}
              onOpen={setDetailRequest}
            />
          ))}
        </div>
      );
    },
    [leavesByDate],
  );

  const formOpen = Boolean(createDate) || Boolean(editingRequest);

  return (
    <div className="w-full space-y-4 pb-6">
      <HolidayMonthCalendar
        year={view.year}
        month={view.month}
        location={employeeLocation}
        onViewChange={setView}
        loading={loading}
        loadingLabel="Loading leave calendar…"
        onDayDoubleClick={handleDayDoubleClick}
        renderDayContent={renderDayContent}
      />
      <p className="text-xs text-muted-foreground">
        Double-click today or a future date to request leave. Click a leave event to view details.
        Pending leave is orange; approved leave is red.
      </p>

      <LeaveRequestDialog
        open={formOpen}
        initialDate={
          editingRequest?.startDate?.slice(0, 10) || createDate || todayIstDateKey()
        }
        editingRequest={editingRequest}
        onClose={() => {
          setCreateDate(null);
          setEditingRequest(null);
        }}
        onSaved={refreshLeaves}
      />

      <LeaveDetailDialog
        open={Boolean(detailRequest)}
        request={detailRequest}
        onClose={() => setDetailRequest(null)}
        onEdit={(request) => {
          setDetailRequest(null);
          setCreateDate(null);
          setEditingRequest(request);
        }}
        onRequestDelete={(request) => {
          // Close details first so AlertDialog is never nested inside Dialog.
          const id = String(request.leaveRequestId || '').trim();
          deleteIdRef.current = id || null;
          setDetailRequest(null);
          setDeleteTarget(request);
        }}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setDeleteTarget(null);
            deleteIdRef.current = null;
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete leave request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete your pending leave request for {deleteTarget?.startDate}
              {deleteTarget && deleteTarget.endDate !== deleteTarget.startDate
                ? ` – ${deleteTarget.endDate}`
                : ''}
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
