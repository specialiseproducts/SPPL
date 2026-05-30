import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import type { SalesOpportunity } from '../../types/salesForecast';
import type { ExchangeRatesMap } from '../../types/salesForecast';
import type { UserMaster } from '../UserCreationTab';
import { MasterCombobox } from './MasterCombobox';
import { computeInrValue, computeTotalValue } from '../../utils/salesForecastCalculations';
import { principalNameToId } from '../../utils/principalId';
import { useModelsByPrincipalQuery } from '../../hooks/sales/useSalesQueries';
import type { SalesPrincipalModelRow } from '../../types/salesForecast';

export interface MastersState {
  STATUS: string[];
  PRINCIPAL: string[];
  CURRENCY: string[];
  PROBABILITY_OPTION: string[];
  CUSTOMER_SEGMENT: string[];
  ENQUIRY_TYPE: string[];
  DELIVERY_DAYS: string[];
  WARRANTY: string[];
  CONTACT_TITLE: string[];
}

const emptyForm = (): Record<string, string> => ({
  quotationDate: '',
  decisionExpectedBy: '',
  opportunityStatus: '',
  customerOrganization: '',
  contactTitle: '',
  contactFullName: '',
  contactAddress: '',
  contactNumber: '',
  contactEmail: '',
  customerSegment: '',
  enquiryType: '',
  applicationDetails: '',
  technicalSpecifications: '',
  competition: '',
  principal: '',
  modelNumber: '',
  productDescription: '',
  currency: '',
  unitPrice: '',
  quantity: '',
  deliveryDays: '',
  warranty: '',
  probabilityLabel: '',
  technicalChallenges: '',
  keyDecisionCriteria: '',
  followUpActionsRequired: '',
  nextActionDate: '',
  remarks: '',
});

function opportunityToForm(o: SalesOpportunity | null): Record<string, string> {
  if (!o) return emptyForm();
  const legacyAddr =
    o.contactAddress ||
    (o.contactPersonDetails && !o.contactFullName ? String(o.contactPersonDetails) : '') ||
    '';
  return {
    quotationDate: o.quotationDate || '',
    decisionExpectedBy: o.decisionExpectedBy || '',
    opportunityStatus: o.opportunityStatus || '',
    customerOrganization: o.customerOrganization || '',
    contactTitle: o.contactTitle || '',
    contactFullName: o.contactFullName || '',
    contactAddress: legacyAddr,
    contactNumber: o.contactNumber || '',
    contactEmail: o.contactEmail || '',
    customerSegment: o.customerSegment || '',
    enquiryType: o.enquiryType || '',
    applicationDetails: o.applicationDetails || '',
    technicalSpecifications: o.technicalSpecifications || '',
    competition: o.competition || '',
    principal: o.principal || '',
    modelNumber: o.modelNumber || '',
    productDescription: o.productDescription || '',
    currency: o.currency || '',
    unitPrice: o.unitPrice != null ? String(o.unitPrice) : '',
    quantity: o.quantity != null ? String(o.quantity) : '',
    deliveryDays: o.deliveryDays != null ? String(o.deliveryDays) : '',
    warranty: o.warranty || '',
    probabilityLabel: o.probabilityLabel || '',
    technicalChallenges: o.technicalChallenges || '',
    keyDecisionCriteria: o.keyDecisionCriteria || '',
    followUpActionsRequired: o.followUpActionsRequired || '',
    nextActionDate: o.nextActionDate || '',
    remarks: o.remarks || '',
  };
}

export function formToPayload(f: Record<string, string>) {
  const unitPrice = f.unitPrice.trim() === '' ? null : Number(f.unitPrice);
  const quantity = f.quantity.trim() === '' ? null : Number(f.quantity);
  return {
    quotationDate: f.quotationDate,
    decisionExpectedBy: f.decisionExpectedBy,
    opportunityStatus: f.opportunityStatus,
    customerOrganization: f.customerOrganization,
    contactTitle: f.contactTitle,
    contactFullName: f.contactFullName,
    contactAddress: f.contactAddress,
    contactNumber: f.contactNumber,
    contactEmail: f.contactEmail,
    customerSegment: f.customerSegment,
    enquiryType: f.enquiryType,
    applicationDetails: f.applicationDetails,
    technicalSpecifications: f.technicalSpecifications,
    competition: f.competition,
    principal: f.principal,
    modelNumber: f.modelNumber,
    productDescription: f.productDescription,
    currency: f.currency,
    unitPrice: Number.isFinite(unitPrice as number) ? unitPrice : null,
    quantity: Number.isFinite(quantity as number) ? quantity : null,
    deliveryDays: f.deliveryDays,
    warranty: f.warranty,
    probabilityLabel: f.probabilityLabel,
    technicalChallenges: f.technicalChallenges,
    keyDecisionCriteria: f.keyDecisionCriteria,
    followUpActionsRequired: f.followUpActionsRequired,
    nextActionDate: f.nextActionDate,
    remarks: f.remarks,
  };
}

interface SalesForecastingOpportunityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editing: SalesOpportunity | null;
  masters: MastersState;
  rates: ExchangeRatesMap;
  availableUsers?: UserMaster[];
  onSaveDraft: (payload: ReturnType<typeof formToPayload>) => Promise<void>;
  onSubmitForApproval: (payload: ReturnType<typeof formToPayload>) => Promise<void>;
}

const taCompact = 'min-h-[72px] max-h-[100px] resize-y';
const taAddress = 'min-h-[72px] max-h-[120px] resize-y';

export default function SalesForecastingOpportunityFormModal({
  isOpen,
  onClose,
  editing,
  masters,
  rates,
  availableUsers: _availableUsers,
  onSaveDraft,
  onSubmitForApproval,
}: SalesForecastingOpportunityFormModalProps) {
  const [f, setF] = useState<Record<string, string>>(emptyForm());
  const [busy, setBusy] = useState(false);

  const principalId = useMemo(() => principalNameToId(f.principal), [f.principal]);
  const modelsQuery = useModelsByPrincipalQuery(principalId, isOpen);
  const principalModels = modelsQuery.data ?? [];

  const modelOptions = useMemo(
    () => principalModels.map((m) => m.modelNumber).filter(Boolean),
    [principalModels],
  );

  const modelsByNumber = useMemo(() => {
    const map = new Map<string, SalesPrincipalModelRow>();
    for (const row of principalModels) {
      const key = row.modelNumber.trim();
      if (key) map.set(key, row);
    }
    return map;
  }, [principalModels]);

  useEffect(() => {
    if (isOpen) {
      setF(opportunityToForm(editing));
    }
  }, [isOpen, editing]);

  const handlePrincipalChange = (principal: string) => {
    setF((prev) => ({
      ...prev,
      principal,
      modelNumber: '',
      productDescription: '',
    }));
  };

  const handleModelChange = (modelNumber: string) => {
    const master = modelsByNumber.get(modelNumber.trim());
    setF((prev) => ({
      ...prev,
      modelNumber,
      productDescription: master?.productDescription ?? '',
    }));
  };

  const totalValue = useMemo(
    () => computeTotalValue(f.unitPrice === '' ? null : Number(f.unitPrice), f.quantity === '' ? null : Number(f.quantity)),
    [f.unitPrice, f.quantity]
  );

  const inrValue = useMemo(
    () => computeInrValue(f.currency, totalValue, rates),
    [f.currency, totalValue, rates]
  );

  const setField = (key: string, v: string) => setF((prev) => ({ ...prev, [key]: v }));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const payload = formToPayload(f);
  const grid2 = 'grid grid-cols-1 gap-4 md:grid-cols-2';
  const showRef = editing?.workflowStatus === 'approved' && !!editing?.quotationRef?.trim();

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit opportunity' : 'New opportunity'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update quotation details, then save a draft or submit for approval.'
              : 'Enter opportunity and quotation details. Quotation reference is assigned only after approval.'}
            {showRef ? (
              <span className="mt-1 block font-mono text-sm font-medium text-[#007BFF]">{editing?.quotationRef}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className={grid2}>
            <MasterCombobox
              label="Status"
              value={f.opportunityStatus}
              onChange={(v) => setField('opportunityStatus', v)}
              options={masters.STATUS}
              placeholder="Select status"
            />
            <div />
          </div>

          <div className={grid2}>
            <div className="space-y-2">
              <Label htmlFor="sf-qd">Quotation Date</Label>
              <Input id="sf-qd" type="date" value={f.quotationDate} onChange={(e) => setField('quotationDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-deb">Decision Expected By</Label>
              <Input id="sf-deb" type="date" value={f.decisionExpectedBy} onChange={(e) => setField('decisionExpectedBy', e.target.value)} />
            </div>
          </div>

          <div className={grid2}>
            <MasterCombobox
              label="Customer Segment"
              value={f.customerSegment}
              onChange={(v) => setField('customerSegment', v)}
              options={masters.CUSTOMER_SEGMENT}
              placeholder="Select segment"
            />
            <MasterCombobox
              label="Enquiry Type"
              value={f.enquiryType}
              onChange={(v) => setField('enquiryType', v)}
              options={masters.ENQUIRY_TYPE}
              placeholder="Select enquiry type"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-org">Customer Organization</Label>
            <Input
              id="sf-org"
              value={f.customerOrganization}
              onChange={(e) => setField('customerOrganization', e.target.value)}
              placeholder="Organization name"
            />
          </div>

          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
            <h3 className="text-sm font-semibold text-[#212529]">Contact person</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <MasterCombobox
                label="Title"
                value={f.contactTitle}
                onChange={(v) => setField('contactTitle', v)}
                options={masters.CONTACT_TITLE}
                placeholder="Select title"
              />
              <div className="space-y-2">
                <Label htmlFor="sf-cfn">Full name</Label>
                <Input id="sf-cfn" value={f.contactFullName} onChange={(e) => setField('contactFullName', e.target.value)} placeholder="Full name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-cad">Address</Label>
              <Textarea
                id="sf-cad"
                className={taAddress}
                rows={3}
                value={f.contactAddress}
                onChange={(e) => setField('contactAddress', e.target.value)}
                placeholder="Street, city, postal code…"
              />
            </div>
            <div className={grid2}>
              <div className="space-y-2">
                <Label htmlFor="sf-cnum">Phone number</Label>
                <Input id="sf-cnum" type="tel" value={f.contactNumber} onChange={(e) => setField('contactNumber', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sf-cem">Email</Label>
                <Input id="sf-cem" type="email" value={f.contactEmail} onChange={(e) => setField('contactEmail', e.target.value)} />
              </div>
            </div>
          </div>

          <div className={grid2}>
            <MasterCombobox
              label="Principal"
              value={f.principal}
              onChange={handlePrincipalChange}
              options={masters.PRINCIPAL}
              placeholder="Select principal"
            />
            <MasterCombobox
              label="Model Number"
              value={f.modelNumber}
              onChange={handleModelChange}
              options={modelOptions}
              placeholder={principalId ? 'Select model' : 'Select Principal First'}
              disabled={!principalId}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-pd">Product Description</Label>
            <Textarea id="sf-pd" className={taCompact} rows={2} value={f.productDescription} onChange={(e) => setField('productDescription', e.target.value)} />
          </div>

          <div className={grid2}>
            <MasterCombobox
              label="Currency"
              value={f.currency}
              onChange={(v) => setField('currency', v)}
              options={masters.CURRENCY}
              placeholder="Select currency"
            />
            <MasterCombobox
              label="Probability %"
              value={f.probabilityLabel}
              onChange={(v) => setField('probabilityLabel', v)}
              options={masters.PROBABILITY_OPTION}
              placeholder="Select probability"
            />
          </div>

          <div className={grid2}>
            <div className="space-y-2">
              <Label htmlFor="sf-up">Unit Price</Label>
              <Input id="sf-up" type="number" step="0.01" value={f.unitPrice} onChange={(e) => setField('unitPrice', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-qty">Quantity</Label>
              <Input id="sf-qty" type="number" step="1" value={f.quantity} onChange={(e) => setField('quantity', e.target.value)} />
            </div>
          </div>

          <div className={grid2}>
            <div className="space-y-2">
              <Label htmlFor="sf-total">Total Value (calculated)</Label>
              <Input id="sf-total" readOnly tabIndex={-1} className="bg-muted font-mono text-sm tabular-nums" value={totalValue.toFixed(2)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-inr">INR Value excl. GST (calculated)</Label>
              <Input id="sf-inr" readOnly tabIndex={-1} className="bg-muted font-mono text-sm tabular-nums" value={inrValue.toFixed(2)} />
            </div>
          </div>

          <div className={grid2}>
            <MasterCombobox
              label="Delivery (Days)"
              value={f.deliveryDays}
              onChange={(v) => setField('deliveryDays', v)}
              options={masters.DELIVERY_DAYS}
              placeholder="Select delivery"
            />
            <MasterCombobox
              label="Warranty"
              value={f.warranty}
              onChange={(v) => setField('warranty', v)}
              options={masters.WARRANTY}
              placeholder="Select warranty"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-app">Application Details</Label>
            <Textarea id="sf-app" className={taCompact} rows={2} value={f.applicationDetails} onChange={(e) => setField('applicationDetails', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-spec">Technical Specifications</Label>
            <Textarea id="sf-spec" className={taCompact} rows={2} value={f.technicalSpecifications} onChange={(e) => setField('technicalSpecifications', e.target.value)} />
          </div>

          <div className={grid2}>
            <div className="space-y-2">
              <Label htmlFor="sf-comp">Competition (if any)</Label>
              <Textarea id="sf-comp" className={taCompact} rows={2} value={f.competition} onChange={(e) => setField('competition', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-chal">Technical Challenges</Label>
              <Textarea id="sf-chal" className={taCompact} rows={2} value={f.technicalChallenges} onChange={(e) => setField('technicalChallenges', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-kdc">Key Decision Criteria</Label>
            <Textarea id="sf-kdc" className={taCompact} rows={2} value={f.keyDecisionCriteria} onChange={(e) => setField('keyDecisionCriteria', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-fu">Follow-up Actions Required</Label>
            <Textarea id="sf-fu" className={taCompact} rows={2} value={f.followUpActionsRequired} onChange={(e) => setField('followUpActionsRequired', e.target.value)} />
          </div>

          <div className={grid2}>
            <div className="space-y-2">
              <Label htmlFor="sf-nad">Next Action Date</Label>
              <Input id="sf-nad" type="date" value={f.nextActionDate} onChange={(e) => setField('nextActionDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-rem">Remarks</Label>
              <Textarea id="sf-rem" className={taCompact} rows={2} value={f.remarks} onChange={(e) => setField('remarks', e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => onSaveDraft(payload))}>
              {editing?.workflowStatus === 'pending_approval' ? 'Save changes' : 'Save draft'}
            </Button>
            {(!editing?.workflowStatus || editing.workflowStatus === 'draft' || editing.workflowStatus === 'rejected') && (
              <Button type="button" className="bg-[#007BFF] hover:bg-[#0056b3]" disabled={busy} onClick={() => run(() => onSubmitForApproval(payload))}>
                Submit for approval
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
