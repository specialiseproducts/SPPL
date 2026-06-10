import { type ReactNode } from 'react';
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
import type { SalesOpportunity, SalesWorkflowStatus } from '../../types/salesForecast';
import type { SalesForecastingViewScope } from '../SalesForecastingTab';

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
  viewScope: SalesForecastingViewScope;
  canEdit: boolean;
  onEdit: () => void;
}

export default function SalesForecastingDetailModal({
  isOpen,
  onClose,
  record,
  viewScope,
  canEdit,
  onEdit,
}: SalesForecastingDetailModalProps) {
  if (!record) return null;

  const isTeamView = viewScope === 'team';
  const isOwnerPendingOrRejected =
    !isTeamView &&
    (record.workflowStatus === 'pending_approval' || record.workflowStatus === 'rejected');
  const showEditInFooter = !isTeamView && canEdit && (isOwnerPendingOrRejected || record.workflowStatus === 'draft');
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

        <div className="shrink-0 border-t bg-background px-6 py-4">
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            {showEditInFooter ? (
              <Button type="button" variant="outline" onClick={onEdit}>
                Edit
              </Button>
            ) : null}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
