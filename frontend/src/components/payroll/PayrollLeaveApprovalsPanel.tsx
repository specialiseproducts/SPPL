import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import type { PayrollLeaveRequest } from '../../types/payroll';
import { usePendingLeaveApprovalsQuery } from '../../hooks/payroll/usePayrollQueries';
import { payrollQueryKeys } from '../../hooks/payroll/payrollQueryKeys';
import { leaveCalendarLabel } from '../../utils/payrollLeaveDates';
import LeaveApprovalDetailDialog from './LeaveApprovalDetailDialog';

type Props = {
  onDecided?: () => void;
};

/**
 * Team Calendar — Pending Leave Approval list (mirrors Daily Planner
 * Pending Completion Approval panel layout).
 */
export default function PayrollLeaveApprovalsPanel({ onDecided }: Props) {
  const queryClient = useQueryClient();
  const pendingQuery = usePendingLeaveApprovalsQuery(true);
  const rows = useMemo(() => {
    return (pendingQuery.data || []).filter(
      (r) =>
        r &&
        typeof r === 'object' &&
        String((r as PayrollLeaveRequest).leaveRequestId || '').trim() &&
        String((r as PayrollLeaveRequest).employeeCode || '').trim() &&
        String((r as PayrollLeaveRequest).status || '').trim() === 'Pending',
    );
  }, [pendingQuery.data]);
  const count = rows.length;

  const [detailOpen, setDetailOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<PayrollLeaveRequest | null>(null);

  const openView = (row: PayrollLeaveRequest) => {
    setActiveRequest(row);
    setDetailOpen(true);
  };

  const closeView = () => {
    setDetailOpen(false);
    setActiveRequest(null);
  };

  const refreshPending = () => {
    void queryClient.invalidateQueries({
      queryKey: payrollQueryKeys.pendingLeaveApprovals(),
    });
    void queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
    onDecided?.();
  };

  return (
    <>
      <div className="mb-4 rounded-md border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-[#212529]">Pending Leave Approval</div>
          <Badge className="border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            Pending Leave Approval ({count})
          </Badge>
        </div>

        {pendingQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : count === 0 ? (
          <div className="text-sm text-muted-foreground">No pending leave approvals.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3 py-2">Employee</TableHead>
                  <TableHead className="px-3 py-2">Dates</TableHead>
                  <TableHead className="px-3 py-2">Type</TableHead>
                  <TableHead className="px-3 py-2">Submitted</TableHead>
                  <TableHead className="px-3 py-2">Current Status</TableHead>
                  <TableHead className="px-3 py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const typeLabel = leaveCalendarLabel({
                    leaveType: r.leaveType,
                    durationDays: r.durationDays,
                    halfDayPeriod: r.halfDayPeriod,
                  });
                  const dateLabel =
                    r.endDate && r.endDate !== r.startDate
                      ? `${r.startDate} – ${r.endDate}`
                      : r.startDate || '—';
                  return (
                    <TableRow
                      key={r.leaveRequestId}
                      className="cursor-pointer"
                      onDoubleClick={() => openView(r)}
                    >
                      <TableCell className="px-3 py-2 text-sm">
                        <div>{r.employeeName || '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.employeeCode || ''}</div>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-sm">{dateLabel}</TableCell>
                      <TableCell className="px-3 py-2 text-sm">{typeLabel}</TableCell>
                      <TableCell className="px-3 py-2 text-sm">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <Badge className="border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                          {r.status || 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="px-3 py-2 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 bg-[#007BFF] hover:bg-[#0056b3]"
                          onClick={() => openView(r)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <LeaveApprovalDetailDialog
        open={detailOpen}
        request={activeRequest}
        onClose={closeView}
        onDecided={refreshPending}
      />
    </>
  );
}
