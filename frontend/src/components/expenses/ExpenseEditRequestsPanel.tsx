import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  approveExpenseEditRequest,
  fetchExpenseDetail,
  rejectExpenseEditRequest,
  fetchPendingExpenseEditRequests,
} from '../../hooks/expenses/expensesApi';
import { useInvalidateExpensesList } from '../../hooks/expenses/useExpensesQueries';
import type { ExpenseEditRequest, ExpenseRecord } from '../../types/expenses';
import {
  getExpenseDisplayFields,
  getExpenseFieldLabel,
} from '../../utils/expenseEditFields';
import { ExpenseReadField } from './expenseDetailsUi';

const HIDDEN_DETAIL_FIELD_LABELS = new Set([
  'Expense Ref',
  'Employee Code',
  'Status',
]);

function formatValues(values: Record<string, unknown> | undefined): string {
  const entries = Object.entries(values || {});
  if (entries.length === 0) return '—';
  return entries
    .map(([key, value]) => `${getExpenseFieldLabel(key)}: ${value == null || value === '' ? '—' : String(value)}`)
    .join('; ');
}

export default function ExpenseEditRequestsPanel() {
  const queryClient = useQueryClient();
  const invalidateExpenses = useInvalidateExpensesList();
  const pendingQuery = useQuery({
    queryKey: ['expenses', 'edit-requests', 'pending'],
    queryFn: fetchPendingExpenseEditRequests,
  });
  const rows = pendingQuery.data || [];

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ExpenseEditRequest | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<ExpenseEditRequest | null>(null);
  const [detailExpense, setDetailExpense] = useState<ExpenseRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refreshRequests = () => {
    void invalidateExpenses();
    void queryClient.invalidateQueries({ queryKey: ['expenses', 'edit-requests'] });
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailRequest(null);
    setDetailExpense(null);
  };

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveExpenseEditRequest(requestId),
    onSuccess: () => {
      toast.success('Expense edit request approved');
      closeDetail();
      refreshRequests();
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Could not approve expense edit request');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, remark }: { requestId: string; remark: string }) =>
      rejectExpenseEditRequest(requestId, remark),
    onSuccess: () => {
      toast.success('Expense edit request rejected');
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectRemark('');
      closeDetail();
      refreshRequests();
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Could not reject expense edit request');
    },
  });

  const busy = approveMutation.isPending || rejectMutation.isPending;

  const openDetail = async (row: ExpenseEditRequest) => {
    setDetailRequest(row);
    setDetailExpense(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const expense = await fetchExpenseDetail(row.expenseId);
      setDetailExpense(expense);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load expense details');
    } finally {
      setDetailLoading(false);
    }
  };

  const openReject = (row: ExpenseEditRequest) => {
    setRejectTarget(row);
    setRejectRemark('');
    setRejectOpen(true);
  };

  return (
    <>
      <div className="mb-4 rounded-md border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-[#212529]">Pending Edit Requests</div>
          <Badge className="border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            Pending Edit Requests ({rows.length})
          </Badge>
        </div>

        {pendingQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No pending edit requests.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Request Type</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Old Values</TableHead>
                  <TableHead>Requested Values</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.requestId}
                    className="cursor-pointer"
                    onDoubleClick={() => void openDetail(row)}
                  >
                    <TableCell className="text-sm">
                      <div>{row.employeeName || '—'}</div>
                      <div className="text-xs text-muted-foreground">{row.employeeCode || ''}</div>
                    </TableCell>
                    <TableCell className="text-sm">{row.requestType || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {row.requestedAt ? new Date(row.requestedAt).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className="border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {row.status || 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] text-xs">{formatValues(row.oldValues)}</TableCell>
                    <TableCell className="max-w-[220px] text-xs">{formatValues(row.requestedValues)}</TableCell>
                    <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-8 bg-[#007BFF] hover:bg-[#0056b3]"
                          disabled={busy}
                          onClick={() => approveMutation.mutate(row.requestId)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={busy}
                          onClick={() => openReject(row)}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (busy) return;
          if (!open) closeDetail();
        }}
      >
        <DialogContent
          className="max-w-3xl sm:max-w-3xl"
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh',
            overflow: 'hidden',
          }}
        >
          <DialogHeader className="shrink-0" style={{ flexShrink: 0 }}>
            <DialogTitle>Expense Edit Request</DialogTitle>
            <DialogDescription>
              Review the complete expense record and the requested change before approving or rejecting.
            </DialogDescription>
          </DialogHeader>

          <div
            className="space-y-4"
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            <div className="space-y-3">
              <div className="text-sm font-semibold text-[#212529]">Expense Details</div>
              {detailLoading ? (
                <p className="text-sm text-muted-foreground">Loading expense details…</p>
              ) : detailExpense ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {getExpenseDisplayFields(detailExpense)
                    .filter((field) => !HIDDEN_DETAIL_FIELD_LABELS.has(field.label))
                    .map((field) => (
                      <ExpenseReadField key={field.label} label={field.label} value={field.value} />
                    ))}
                  {detailRequest ? (
                    <>
                      <ExpenseReadField
                        label="Request Type"
                        value={detailRequest.requestType}
                      />
                      <ExpenseReadField
                        label="Old Value"
                        value={Object.values(detailRequest.oldValues || {})[0]}
                      />
                      <ExpenseReadField
                        label="Requested Value"
                        value={Object.values(detailRequest.requestedValues || {})[0]}
                      />
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Expense could not be loaded.</p>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 sm:justify-end" style={{ flexShrink: 0 }}>
            <Button type="button" variant="outline" disabled={busy} onClick={closeDetail}>
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !detailRequest}
              onClick={() => detailRequest && openReject(detailRequest)}
            >
              Reject
            </Button>
            <Button
              type="button"
              className="bg-[#007BFF] hover:bg-[#0056b3]"
              disabled={busy || !detailRequest}
              onClick={() => detailRequest && approveMutation.mutate(detailRequest.requestId)}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (busy) return;
          setRejectOpen(open);
          if (!open) {
            setRejectTarget(null);
            setRejectRemark('');
          }
        }}
      >
        <DialogContent className="max-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject Edit Request</DialogTitle>
            <DialogDescription>
              A remark is required when rejecting an expense edit request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="expense-edit-reject-remark">Admin Remark</Label>
            <Textarea
              id="expense-edit-reject-remark"
              rows={3}
              value={rejectRemark}
              disabled={busy}
              onChange={(e) => setRejectRemark(e.target.value)}
              placeholder="Enter reason for rejection"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end sm:gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#007BFF] hover:bg-[#0056b3]"
              disabled={busy || !rejectRemark.trim() || !rejectTarget}
              onClick={() => {
                if (!rejectTarget || !rejectRemark.trim()) return;
                rejectMutation.mutate({ requestId: rejectTarget.requestId, remark: rejectRemark.trim() });
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
