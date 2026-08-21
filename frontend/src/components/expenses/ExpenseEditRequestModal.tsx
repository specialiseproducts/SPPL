import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { createExpenseEditRequest, fetchExpenseEditRequests } from '../../hooks/expenses/expensesApi';
import type { ExpenseRecord } from '../../types/expenses';
import { useInvalidateExpensesList } from '../../hooks/expenses/useExpensesQueries';
import {
  getEditableExpenseFields,
  getExpenseFieldValue,
} from '../../utils/expenseEditFields';

export default function ExpenseEditRequestModal({
  isOpen,
  onClose,
  record,
}: {
  isOpen: boolean;
  onClose: () => void;
  record: ExpenseRecord | null;
}) {
  const queryClient = useQueryClient();
  const invalidateExpenses = useInvalidateExpensesList();
  const expenseId = String(record?.expenseId || '').trim();
  const fieldOptions = useMemo(() => getEditableExpenseFields(record), [record]);
  const requestsQuery = useQuery({
    queryKey: ['expenses', 'edit-requests', expenseId],
    enabled: isOpen && !!expenseId,
    queryFn: () => fetchExpenseEditRequests(expenseId),
  });
  const history = requestsQuery.data || [];
  const latest = history[0] || null;

  const [requestType, setRequestType] = useState('');
  const [requestedValue, setRequestedValue] = useState('');

  const selectedField = fieldOptions.find((opt) => opt.label === requestType) || null;

  useEffect(() => {
    if (!isOpen) return;
    setRequestType('');
    setRequestedValue('');
  }, [isOpen, expenseId]);

  useEffect(() => {
    if (!selectedField) return;
    setRequestedValue(getExpenseFieldValue(record, selectedField.key));
  }, [record, selectedField]);

  const createMutation = useMutation({
    mutationFn: (payload: { requestType: string; requestedValue: string }) =>
      createExpenseEditRequest(expenseId, payload),
    onSuccess: () => {
      toast.success('Edit permission request submitted');
      void invalidateExpenses();
      void queryClient.invalidateQueries({ queryKey: ['expenses', 'edit-requests'] });
      onClose();
    },
    onError: (e: Error & { status?: number }) => {
      toast.error(e.message || 'Could not submit edit request');
    },
  });

  const pending = String(latest?.status || '').trim() === 'Pending';
  const approved = String(latest?.status || '').trim() === 'Approved';
  const rejected = String(latest?.status || '').trim() === 'Rejected';
  const busy = createMutation.isPending || requestsQuery.isLoading;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[min(72vh,540px)] max-w-lg flex-col gap-2 overflow-hidden p-4 sm:max-w-lg">
        <DialogHeader className="space-y-1">
          <DialogTitle>Request Edit Permission</DialogTitle>
          <DialogDescription>
            Submit a change request for admin approval. The approved expense stays locked until approved.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {pending ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
              <Badge className="border border-amber-200 bg-amber-100 text-amber-900">Pending</Badge>
              <div className="mt-1">Your edit request is awaiting admin approval.</div>
            </div>
          ) : approved ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-900">Approved</Badge>
              <div className="mt-1">Your previous request was approved. You can submit a new request.</div>
            </div>
          ) : rejected ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
              <Badge className="border border-red-200 bg-red-100 text-red-900">Rejected</Badge>
              <div className="mt-1">Admin Remark: {latest?.adminRemark || '—'}</div>
            </div>
          ) : null}

          {!pending ? (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label>What would you like to edit?</Label>
                <Select
                  value={requestType || undefined}
                  onValueChange={setRequestType}
                  disabled={busy}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select field group" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((opt) => (
                      <SelectItem key={opt.key} value={opt.label}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {requestType ? (
                <>
                  <div className="space-y-1 rounded-md border px-3 py-2">
                    <div className="text-sm text-muted-foreground">Current {requestType}</div>
                    <div className="text-sm font-semibold text-[#212529]">
                      {selectedField ? getExpenseFieldValue(record, selectedField.key) || '—' : '—'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Requested {requestType}</Label>
                    <Input
                      className="h-9"
                      value={requestedValue}
                      onChange={(e) => setRequestedValue(e.target.value)}
                      placeholder={`Enter new ${requestType.toLowerCase()}`}
                      disabled={busy}
                    />
                  </div>
                </>
              ) : null}

              {history.length > 0 ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-[#212529]">Request History</div>
                  <div className="max-h-24 space-y-1 overflow-y-auto rounded-md border px-2 py-1">
                    {history.map((row) => (
                      <div key={row.requestId} className="text-xs leading-5 text-[#212529]">
                        {row.requestType} · {row.status} ·{' '}
                        {row.requestedAt ? new Date(row.requestedAt).toLocaleString() : '—'}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Close
          </Button>
          {!pending ? (
            <Button
              type="button"
              className="bg-[#007BFF] hover:bg-[#0056b3]"
              disabled={busy || !requestType || !String(requestedValue).trim()}
              onClick={() => createMutation.mutate({ requestType, requestedValue })}
            >
              Submit
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
