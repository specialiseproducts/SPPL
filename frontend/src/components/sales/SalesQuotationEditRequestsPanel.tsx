import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import { toast } from 'sonner';
import {
  useInvalidateSalesForecasts,
  usePendingEditRequestsQuery,
} from '../../hooks/sales/useSalesQueries';
import {
  approveQuotationEditRequest,
  rejectQuotationEditRequest,
} from '../../hooks/sales/salesApi';
import type { QuotationEditRequest } from '../../types/salesForecast';

const FIELD_LABELS: Record<string, string> = {
  unitPrice: 'Unit Price',
  quantity: 'Quantity',
  warranty: 'Warranty',
  decisionExpectedBy: 'Decision Expected By',
  principal: 'Principle',
  modelNumber: 'Model Number',
  productDescription: 'Product Description',
  probabilityLabel: 'Probability %',
};

function formatValues(values: Record<string, unknown> | undefined): string {
  const entries = Object.entries(values || {}).filter(([k]) => k !== 'probabilityPercent');
  if (entries.length === 0) return '—';
  return entries
    .map(([k, v]) => `${FIELD_LABELS[k] || k}: ${v == null || v === '' ? '—' : String(v)}`)
    .join('; ');
}

export default function SalesQuotationEditRequestsPanel() {
  const invalidateForecasts = useInvalidateSalesForecasts();
  const pendingQuery = usePendingEditRequestsQuery(true);
  const rows = pendingQuery.data || [];
  const count = rows.length;

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<QuotationEditRequest | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveQuotationEditRequest(requestId),
    onSuccess: () => {
      toast.success('Edit request approved — quotation updated');
      void invalidateForecasts();
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Could not approve edit request');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, adminRemark }: { requestId: string; adminRemark: string }) =>
      rejectQuotationEditRequest(requestId, adminRemark),
    onSuccess: () => {
      toast.success('Edit request rejected');
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectRemark('');
      void invalidateForecasts();
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Could not reject edit request');
    },
  });

  const busy = approveMutation.isPending || rejectMutation.isPending;

  return (
    <>
      <div className="mb-4 rounded-md border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-[#212529]">Pending Edit Requests</div>
          <Badge className="border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            Pending Edit Requests ({count})
          </Badge>
        </div>

        {pendingQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : count === 0 ? (
          <div className="text-sm text-muted-foreground">No pending edit requests.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3 py-2">Employee</TableHead>
                  <TableHead className="px-3 py-2">Quotation Ref</TableHead>
                  <TableHead className="px-3 py-2">Request Type</TableHead>
                  <TableHead className="px-3 py-2">Request Date</TableHead>
                  <TableHead className="px-3 py-2">Current Status</TableHead>
                  <TableHead className="px-3 py-2">Old Values</TableHead>
                  <TableHead className="px-3 py-2">Requested Values</TableHead>
                  <TableHead className="px-3 py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.requestId}>
                    <TableCell className="px-3 py-2 text-sm">
                      <div>{r.employeeName || '—'}</div>
                      <div className="text-xs text-muted-foreground">{r.employeeCode || ''}</div>
                    </TableCell>
                    <TableCell className="px-3 py-2 font-mono text-sm font-semibold text-[#007BFF]">
                      {r.quotationRef || '—'}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-sm">{r.requestType || '—'}</TableCell>
                    <TableCell className="px-3 py-2 text-sm">
                      {r.requestedAt ? new Date(r.requestedAt).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Badge className="border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {r.status || 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] px-3 py-2 text-xs text-[#212529]">
                      {formatValues(r.oldValues)}
                    </TableCell>
                    <TableCell className="max-w-[220px] px-3 py-2 text-xs text-[#212529]">
                      {formatValues(r.requestedValues)}
                    </TableCell>
                    <TableCell className="px-3 py-2 whitespace-nowrap">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 bg-[#007BFF] hover:bg-[#0056b3]"
                          disabled={busy}
                          onClick={() => approveMutation.mutate(r.requestId)}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={busy}
                          onClick={() => {
                            setRejectTarget(r);
                            setRejectRemark('');
                            setRejectOpen(true);
                          }}
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
              A remark is required when rejecting an edit permission request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="edit-reject-remark">Admin Remark</Label>
            <Textarea
              id="edit-reject-remark"
              rows={3}
              value={rejectRemark}
              disabled={busy}
              onChange={(e) => setRejectRemark(e.target.value)}
              placeholder="Enter reason for rejection"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#007BFF] hover:bg-[#0056b3]"
              disabled={busy || !rejectRemark.trim() || !rejectTarget}
              onClick={() => {
                if (!rejectTarget || !rejectRemark.trim()) return;
                rejectMutation.mutate({
                  requestId: rejectTarget.requestId,
                  adminRemark: rejectRemark.trim(),
                });
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
