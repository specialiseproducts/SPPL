import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
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
  fetchSalesOpportunityById,
  rejectQuotationEditRequest,
} from '../../hooks/sales/salesApi';
import type { QuotationEditRequest, SalesOpportunity } from '../../types/salesForecast';

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

function firstDisplayValue(values: Record<string, unknown> | undefined): unknown {
  const entries = Object.entries(values || {}).filter(([k]) => k !== 'probabilityPercent');
  if (entries.length === 0) return '';
  return entries[0][1];
}

function QuotationReadField({ label, value }: { label: string; value: unknown }) {
  const s = value === null || value === undefined ? '' : String(value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input readOnly tabIndex={-1} className="bg-muted text-sm" value={s || '—'} />
    </div>
  );
}

function getQuotationDisplayFields(record: SalesOpportunity): { label: string; value: unknown }[] {
  return [
    { label: 'Quotation Ref', value: record.quotationRef },
    { label: 'Owner', value: record.ownerEmployeeName || record.ownerEmployeeCode },
    { label: 'Status', value: record.opportunityStatus },
    { label: 'Probability %', value: record.probabilityLabel || record.probabilityPercent },
    { label: 'Quotation Date', value: record.quotationDate },
    { label: 'Decision Expected By', value: record.decisionExpectedBy },
    { label: 'Customer Organization', value: record.customerOrganization },
    { label: 'Title', value: record.contactTitle },
    { label: 'Full name', value: record.contactFullName },
    { label: 'Address', value: record.contactAddress },
    { label: 'Phone', value: record.contactNumber },
    { label: 'Email', value: record.contactEmail },
    { label: 'Customer Segment', value: record.customerSegment },
    { label: 'Enquiry Type', value: record.enquiryType },
    { label: 'Principle', value: record.principal },
    { label: 'Principle Short Code', value: record.principalShortCode },
    { label: 'Model Number', value: record.modelNumber },
    { label: 'Product Description', value: record.productDescription },
    { label: 'Currency', value: record.currency },
    { label: 'Unit Price', value: record.unitPrice },
    { label: 'Quantity', value: record.quantity },
    {
      label: 'Total Value',
      value: record.totalValue != null ? Number(record.totalValue).toFixed(2) : '',
    },
    {
      label: 'INR Value excl. GST',
      value: record.inrValueExclGst != null ? Number(record.inrValueExclGst).toFixed(2) : '',
    },
    { label: 'Delivery (Days)', value: record.deliveryDays },
    { label: 'Warranty', value: record.warranty },
    { label: 'Application Details', value: record.applicationDetails },
    { label: 'Technical Specifications', value: record.technicalSpecifications },
    { label: 'Competition', value: record.competition },
    { label: 'Technical Challenges', value: record.technicalChallenges },
    { label: 'Key Decision Criteria', value: record.keyDecisionCriteria },
    { label: 'Follow-up Actions Required', value: record.followUpActionsRequired },
    { label: 'Remarks', value: record.remarks },
  ];
}

export default function SalesQuotationEditRequestsPanel() {
  const invalidateForecasts = useInvalidateSalesForecasts();
  const pendingQuery = usePendingEditRequestsQuery(true);
  const rows = pendingQuery.data || [];
  const count = rows.length;

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<QuotationEditRequest | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<QuotationEditRequest | null>(null);
  const [detailQuotation, setDetailQuotation] = useState<SalesOpportunity | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailRequest(null);
    setDetailQuotation(null);
  };

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveQuotationEditRequest(requestId),
    onSuccess: () => {
      toast.success('Edit request approved — quotation updated');
      closeDetail();
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
      closeDetail();
      void invalidateForecasts();
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Could not reject edit request');
    },
  });

  const busy = approveMutation.isPending || rejectMutation.isPending;

  const openDetail = async (row: QuotationEditRequest) => {
    setDetailRequest(row);
    setDetailQuotation(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const quotation = await fetchSalesOpportunityById(row.quotationId);
      setDetailQuotation(quotation);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load quotation details');
    } finally {
      setDetailLoading(false);
    }
  };

  const openReject = (row: QuotationEditRequest) => {
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
                  <TableRow
                    key={r.requestId}
                    className="cursor-pointer"
                    onDoubleClick={() => void openDetail(r)}
                  >
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
                    <TableCell
                      className="px-3 py-2 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
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
                          onClick={() => openReject(r)}
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
            <DialogTitle>Quotation Edit Request</DialogTitle>
            <DialogDescription>
              Review the quotation record and the requested change before approving or rejecting.
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
              <div className="text-sm font-semibold text-[#212529]">Quotation Details</div>
              {detailLoading ? (
                <p className="text-sm text-muted-foreground">Loading quotation details…</p>
              ) : detailQuotation ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {getQuotationDisplayFields(detailQuotation).map((field) => (
                    <QuotationReadField key={field.label} label={field.label} value={field.value} />
                  ))}
                  {detailRequest ? (
                    <>
                      <QuotationReadField label="Request Type" value={detailRequest.requestType} />
                      <QuotationReadField
                        label="Old Value"
                        value={firstDisplayValue(detailRequest.oldValues)}
                      />
                      <QuotationReadField
                        label="Requested Value"
                        value={firstDisplayValue(detailRequest.requestedValues)}
                      />
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Quotation could not be loaded.</p>
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
