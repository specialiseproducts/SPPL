import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import type { DailyPlannerTask, PendingCompletionApproval } from '../../types/dailyPlanner';
import { usePendingCompletionApprovalsQuery } from '../../hooks/dailyPlanner/useDailyPlannerQueries';
import { dailyPlannerQueryKeys } from '../../hooks/dailyPlanner/dailyPlannerQueryKeys';
import { useEmployeesListQuery } from '../../hooks/employees/useEmployeesQuery';
import TodayTaskReviewWizard from './TodayTaskReviewWizard';

type Props = {
  moduleRole?: string;
  onTasksUpdated?: (
    updatedTasks?: DailyPlannerTask[],
    options?: { replaceEmployeeDate?: boolean; removeTaskIds?: string[] },
  ) => void;
};

export default function DailyPlannerCompletionApprovalsPanel({
  moduleRole,
  onTasksUpdated,
}: Props) {
  const queryClient = useQueryClient();
  const pendingQuery = usePendingCompletionApprovalsQuery(true);
  const employeesQuery = useEmployeesListQuery();
  const rows = useMemo(() => {
    // Defensive: only render real approval rows (never injected task objects).
    return (pendingQuery.data || []).filter(
      (r) =>
        r &&
        typeof r === 'object' &&
        String((r as PendingCompletionApproval).employeeCode || '').trim() &&
        String((r as PendingCompletionApproval).date || '').trim() &&
        Array.isArray((r as PendingCompletionApproval).tasks),
    );
  }, [pendingQuery.data]);
  const count = rows.length;

  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<PendingCompletionApproval | null>(null);

  const employeeProfile = useMemo(() => {
    if (!activeRow) return null;
    const code = activeRow.employeeCode;
    const emp = (employeesQuery.data ?? []).find((e) => {
      const empCode = String(e.employee_code || e.employeeCode || '').trim();
      return empCode === code;
    });
    return {
      employeeCode: code,
      employeeName: activeRow.employeeName || emp?.name || emp?.employee_name || code,
      department: emp?.department || '',
      designation: emp?.designation || '',
    };
  }, [activeRow, employeesQuery.data]);

  const openReview = (row: PendingCompletionApproval) => {
    setActiveRow(row);
    setReviewOpen(true);
  };

  const closeReview = () => {
    setReviewOpen(false);
    setActiveRow(null);
  };

  const refreshPending = () => {
    void queryClient.invalidateQueries({
      queryKey: dailyPlannerQueryKeys.completionApprovalsPending(),
    });
  };

  const handleTasksUpdated = async (
    updatedTasks?: DailyPlannerTask[],
    options?: { replaceEmployeeDate?: boolean; removeTaskIds?: string[] },
  ) => {
    if (options?.removeTaskIds?.length && activeRow) {
      const removeIds = new Set(options.removeTaskIds);
      setActiveRow((prev) => {
        if (!prev) return prev;
        const tasks = prev.tasks.filter((t) => !removeIds.has(t.plannerTaskId));
        return {
          ...prev,
          tasks,
          taskCount: tasks.length,
        };
      });
    } else if (updatedTasks?.length && activeRow) {
      // Merge verified/reviewed tasks into the existing day list (do not replace with a single task).
      setActiveRow((prev) => {
        if (!prev) return prev;
        const byId = new Map(prev.tasks.map((t) => [t.plannerTaskId, t]));
        for (const task of updatedTasks) {
          if (!task?.plannerTaskId) continue;
          // Rescheduled originals leave the completion queue for this day.
          if (String(task.status || '').trim() === 'Rescheduled') {
            byId.delete(task.plannerTaskId);
            continue;
          }
          byId.set(task.plannerTaskId, task);
        }
        const tasks = Array.from(byId.values());
        return {
          ...prev,
          tasks,
          taskCount: tasks.length,
        };
      });
    }
    await onTasksUpdated?.(updatedTasks, options);
    refreshPending();
  };

  return (
    <>
      <div className="mb-4 rounded-md border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-[#212529]">Pending Completion Approval</div>
          <Badge className="border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            Pending Completion Approval ({count})
          </Badge>
        </div>

        {pendingQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : count === 0 ? (
          <div className="text-sm text-muted-foreground">No pending completion approvals.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3 py-2">Employee</TableHead>
                  <TableHead className="px-3 py-2">Date</TableHead>
                  <TableHead className="px-3 py-2">Tasks</TableHead>
                  <TableHead className="px-3 py-2">Submitted</TableHead>
                  <TableHead className="px-3 py-2">Current Status</TableHead>
                  <TableHead className="px-3 py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={`${r.employeeCode}#${r.date}`}
                    className="cursor-pointer"
                    onDoubleClick={() => openReview(r)}
                  >
                    <TableCell className="px-3 py-2 text-sm">
                      <div>{r.employeeName || '—'}</div>
                      <div className="text-xs text-muted-foreground">{r.employeeCode || ''}</div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-sm">{r.date || '—'}</TableCell>
                    <TableCell className="px-3 py-2 text-sm">{r.taskCount}</TableCell>
                    <TableCell className="px-3 py-2 text-sm">
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
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
                        onClick={() => openReview(r)}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {employeeProfile && activeRow && activeRow.tasks.length > 0 ? (
        <TodayTaskReviewWizard
          open={reviewOpen}
          tasks={activeRow.tasks}
          employee={employeeProfile}
          reviewDate={activeRow.date}
          initialTaskIndex={0}
          completionReviewMode
          moduleRole={moduleRole}
          onClose={closeReview}
          onFinish={() => {
            closeReview();
            refreshPending();
          }}
          onTasksUpdated={handleTasksUpdated}
        />
      ) : null}
    </>
  );
}
