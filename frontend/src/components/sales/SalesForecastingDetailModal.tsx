import { useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import type { SalesOpportunity, SalesWorkflowStatus } from '../../types/salesForecast';

const taRead = 'min-h-[72px] max-h-[100px] resize-none';

function workflowBadge(ws: SalesWorkflowStatus) {
  switch (ws) {
    case 'approved':
      return <Badge className="border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">Approved</Badge>;
    case 'rejected':
      return <Badge className="border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">Rejected</Badge>;
    case 'pending_approval':
      return <Badge className="border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Pending approval</Badge>;
    default:
      return (
        <Badge variant="outline" className="border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700">
          Draft
        </Badge>
      );
    }
}

function disp(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  return String(v);
}

function ReadField({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) {
  const s = disp(value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input readOnly tabIndex={-1} className={mono ? 'bg-muted font-mono text-sm tabular-nums' : 'bg-muted text-sm'} value={s || '—'} />
    </div>
  );
}

function ReadArea({ label, value, className }: { label: string; value: unknown; className?: string }) {
  const s = disp(value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea readOnly tabIndex={-1} className={className ?? taRead} rows={2} value={s || '—'} />
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="border-b border-border pb-2 text-sm font-semibold text-[#212529]">{children}</h3>;
}

interface SalesForecastingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: SalesOpportunity | null;
  canModerate: boolean;
  canEdit: boolean;
  onApprove: () => Promise<void>;
  onReject: (remarks: string) => Promise<void>;
  onEdit: () => void;
}

export default function SalesForecastingDetailModal({
  isOpen,
  onClose,
  record,
  canModerate,
  canEdit,
  onApprove,
  onReject,
  onEdit,
}: SalesForecastingDetailModalProps) {
  const [rejectNotes, setRejectNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!record) return null;

  const showModeration = canModerate && record.workflowStatus === 'pending_approval';
  const grid2 = 'grid grid-cols-1 gap-4 md:grid-cols-2';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-[min(1100px,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1100px,calc(100%-2rem))]">
        <DialogHeader className="shrink-0 space-y-2 border-b px-6 py-4 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Quotation review</DialogTitle>
            {workflowBadge(record.workflowStatus)}
          </div>
          <DialogDescription className="space-y-1 text-left">
            <span className="block font-mono text-sm font-medium text-[#007BFF]">{record.quotationRef || '—'}</span>
            <span className="block text-sm">
              {record.customerOrganization || 'Customer not specified'}
              {record.principal ? ` · ${record.principal}` : ''}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-5">
            <div className="space-y-4">
              <SectionTitle>Basic information</SectionTitle>
              <div className={grid2}>
                <ReadField label="Owner" value={record.ownerEmployeeName || record.ownerEmployeeCode} />
                <ReadField label="Status" value={record.opportunityStatus} />
                <ReadField label="Quotation ref #" value={record.quotationRef} mono />
                <ReadField label="Probability %" value={record.probabilityLabel || record.probabilityPercent} />
                <ReadField label="Quotation Date" value={record.quotationDate} />
                <ReadField label="Decision Expected By" value={record.decisionExpectedBy} />
                <ReadField label="Next Action Date" value={record.nextActionDate} />
              </div>
            </div>

            <div className="space-y-4">
              <SectionTitle>Customer information</SectionTitle>
              <ReadField label="Customer Organization" value={record.customerOrganization} />
              <div className={grid2}>
                <ReadField label="Title" value={record.contactTitle} />
                <ReadField label="Full name" value={record.contactFullName} />
              </div>
              <ReadArea label="Address" value={record.contactAddress} />
              <div className={grid2}>
                <ReadField label="Phone" value={record.contactNumber} />
                <ReadField label="Email" value={record.contactEmail} />
              </div>
              {record.contactPersonDetails ? (
                <ReadArea label="Legacy contact notes" value={record.contactPersonDetails} />
              ) : null}
              <div className={grid2}>
                <ReadField label="Customer Segment" value={record.customerSegment} />
                <ReadField label="Enquiry Type" value={record.enquiryType} />
              </div>
            </div>

            <div className="space-y-4">
              <SectionTitle>Product & commercial</SectionTitle>
              <div className={grid2}>
                <ReadField label="Principal" value={record.principal} />
                <ReadField label="Principal Short Code" value={record.principalShortCode} mono />
                <ReadField label="Model Number" value={record.modelNumber} />
                <ReadField label="Currency" value={record.currency} />
                <ReadField label="Unit Price" value={record.unitPrice} mono />
                <ReadField label="Quantity" value={record.quantity} mono />
                <ReadField label="Total Value" value={record.totalValue != null ? Number(record.totalValue).toFixed(2) : ''} mono />
                <ReadField
                  label="INR Value excl. GST"
                  value={record.inrValueExclGst != null ? Number(record.inrValueExclGst).toFixed(2) : ''}
                  mono
                />
                <ReadField label="Delivery (Days)" value={record.deliveryDays} />
                <ReadField label="Warranty" value={record.warranty} />
              </div>
              <ReadArea
                label="Product Description"
                value={record.productDescription}
                className="min-h-[88px] max-h-[120px] resize-none"
              />
            </div>

            <div className="space-y-4">
              <SectionTitle>Technical details</SectionTitle>
              <ReadArea label="Application Details" value={record.applicationDetails} />
              <ReadArea label="Technical Specifications" value={record.technicalSpecifications} />
              <ReadArea label="Competition" value={record.competition} />
              <ReadArea label="Technical Challenges" value={record.technicalChallenges} />
              <ReadArea label="Key Decision Criteria" value={record.keyDecisionCriteria} />
            </div>

            <div className="space-y-4">
              <SectionTitle>Follow-up</SectionTitle>
              <ReadArea label="Follow-up Actions Required" value={record.followUpActionsRequired} />
              <ReadArea label="Remarks" value={record.remarks} />
              {record.workflowStatus === 'rejected' && record.approval_comments ? (
                <ReadArea label="Rejection remarks" value={record.approval_comments} />
              ) : null}
            </div>
          </div>
        </div>

        <div className="shrink-0 space-y-3 border-t bg-background px-6 py-4">
          {showModeration ? (
            <div className="rounded-md border border-amber-200/80 bg-amber-50/80 p-3">
              <p className="text-xs font-medium text-amber-900 sm:text-sm">Pending your decision</p>
              <p className="mt-1 text-xs text-amber-900/80">Approve to finalize the quotation reference, or reject to return it to the owner.</p>
              <Separator className="my-3 bg-amber-200/60" />
              <div className="space-y-2">
                <Label htmlFor="reject-remarks" className="text-xs">
                  Rejection remarks <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="reject-remarks"
                  rows={2}
                  className="min-h-[72px] resize-y bg-white text-sm"
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Reason for rejection…"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Close
            </Button>
            {canEdit ? (
              <Button type="button" variant="outline" onClick={onEdit} disabled={busy}>
                Edit
              </Button>
            ) : null}
            {showModeration ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  disabled={busy}
                  onClick={() => run(() => onReject(rejectNotes))}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy} onClick={() => run(onApprove)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
