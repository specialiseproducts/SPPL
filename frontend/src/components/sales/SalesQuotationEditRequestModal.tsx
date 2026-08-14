import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import type { MastersState } from './SalesForecastingOpportunityFormModal';
import { MasterCombobox } from './MasterCombobox';
import { SearchableCombobox, comboboxOptionsWithCurrent } from './SearchableCombobox';
import { principalNameToId } from '../../utils/principalId';
import {
  useEditRequestsForQuotationQuery,
  useInvalidateSalesForecasts,
  useModelsByPrincipalQuery,
} from '../../hooks/sales/useSalesQueries';
import { createQuotationEditRequest } from '../../hooks/sales/salesApi';
import type {
  QuotationEditRequest,
  QuotationEditRequestType,
  SalesOpportunity,
  SalesPrincipalModelRow,
} from '../../types/salesForecast';

const REQUEST_TYPES: QuotationEditRequestType[] = [
  'Price',
  'Warranty',
  'Decision Expected By',
  'Part Number',
  'Probability',
];

const FIELD_LABELS: Record<string, string> = {
  unitPrice: 'Unit Price',
  quantity: 'Quantity',
  warranty: 'Warranty',
  decisionExpectedBy: 'Decision Expected By',
  principal: 'Principle',
  modelNumber: 'Model Number',
  productDescription: 'Product Description',
  probabilityLabel: 'Probability %',
  probabilityPercent: 'Probability %',
};

function formatScalar(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

function currentApprovedValues(
  record: SalesOpportunity | null,
  requestType: string,
): Record<string, unknown> {
  if (!record) return {};
  switch (requestType) {
    case 'Price':
      return { unitPrice: record.unitPrice ?? null, quantity: record.quantity ?? null };
    case 'Warranty':
      return { warranty: record.warranty || '' };
    case 'Decision Expected By':
      return { decisionExpectedBy: record.decisionExpectedBy || '' };
    case 'Part Number':
      return {
        principal: record.principal || '',
        modelNumber: record.modelNumber || '',
        productDescription: record.productDescription || '',
      };
    case 'Probability':
      return { probabilityLabel: record.probabilityLabel || '' };
    default:
      return {};
  }
}

function ValuesBlock({ title, values }: { title: string; values: Record<string, unknown> }) {
  const entries = Object.entries(values || {}).filter(([k]) => k !== 'probabilityPercent');
  return (
    <div className="rounded-md border px-4 py-3">
      <div className="text-sm font-medium text-[#212529]">{title}</div>
      <div className="mt-2 space-y-1">
        {entries.length === 0 ? (
          <div className="text-sm text-muted-foreground">—</div>
        ) : (
          entries.map(([k, v]) => (
            <div key={k} className="text-sm text-[#212529]">
              <span className="text-muted-foreground">{FIELD_LABELS[k] || k}: </span>
              {formatScalar(v)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CurrentThenNew({
  label,
  current,
  children,
}: {
  label: string;
  current: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-md border px-4 py-3">
      <div>
        <div className="text-sm text-muted-foreground">Current {label}</div>
        <div className="mt-1 text-sm font-semibold text-[#212529]">{current || '—'}</div>
      </div>
      <div className="space-y-2">
        <Label>Editable {label}</Label>
        {children}
      </div>
    </div>
  );
}

interface SalesQuotationEditRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: SalesOpportunity | null;
  masters: MastersState;
}

export default function SalesQuotationEditRequestModal({
  isOpen,
  onClose,
  record,
  masters,
}: SalesQuotationEditRequestModalProps) {
  const invalidateForecasts = useInvalidateSalesForecasts();
  const forecastId = String(record?.forecastId || '').trim();
  const requestsQuery = useEditRequestsForQuotationQuery(forecastId, isOpen && !!forecastId);
  const history = requestsQuery.data || [];
  const latest = history[0] || null;

  const [phase, setPhase] = useState<'status' | 'form'>('status');
  const [requestType, setRequestType] = useState<QuotationEditRequestType | ''>('');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [warranty, setWarranty] = useState('');
  const [decisionExpectedBy, setDecisionExpectedBy] = useState('');
  const [principal, setPrincipal] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [probabilityLabel, setProbabilityLabel] = useState('');

  const principalId = useMemo(() => principalNameToId(principal), [principal]);
  const modelsQuery = useModelsByPrincipalQuery(principalId, isOpen && requestType === 'Part Number');
  const principalModels = modelsQuery.data ?? [];

  const modelOptions = useMemo(
    () => principalModels.map((m) => m.modelNumber).filter(Boolean),
    [principalModels],
  );
  const modelOptionsForCombobox = useMemo(
    () => comboboxOptionsWithCurrent(modelOptions, modelNumber),
    [modelOptions, modelNumber],
  );
  const modelsByNumber = useMemo(() => {
    const map = new Map<string, SalesPrincipalModelRow>();
    for (const row of principalModels) {
      const key = row.modelNumber.trim();
      if (key) map.set(key, row);
    }
    return map;
  }, [principalModels]);

  const resetFormFromRecord = (seed?: QuotationEditRequest | null) => {
    const seeded = seed?.requestedValues || {};
    setRequestType((seed?.requestType as QuotationEditRequestType) || '');
    setUnitPrice(
      seeded.unitPrice != null && seeded.unitPrice !== ''
        ? String(seeded.unitPrice)
        : record?.unitPrice != null
          ? String(record.unitPrice)
          : '',
    );
    setQuantity(
      seeded.quantity != null && seeded.quantity !== ''
        ? String(seeded.quantity)
        : record?.quantity != null
          ? String(record.quantity)
          : '',
    );
    setWarranty(String(seeded.warranty ?? record?.warranty ?? ''));
    setDecisionExpectedBy(
      String(seeded.decisionExpectedBy ?? record?.decisionExpectedBy ?? ''),
    );
    setPrincipal(String(seeded.principal ?? record?.principal ?? ''));
    setModelNumber(String(seeded.modelNumber ?? record?.modelNumber ?? ''));
    setProductDescription(
      String(seeded.productDescription ?? record?.productDescription ?? ''),
    );
    setProbabilityLabel(String(seeded.probabilityLabel ?? record?.probabilityLabel ?? ''));
  };

  useEffect(() => {
    if (!isOpen || !record) return;
    const latestStatus = String(latest?.status || '').trim();
    if (!latest || latestStatus === 'Approved') {
      setPhase(latestStatus === 'Approved' ? 'status' : 'form');
      resetFormFromRecord(null);
      return;
    }
    if (latestStatus === 'Pending') {
      setPhase('status');
      return;
    }
    if (latestStatus === 'Rejected') {
      setPhase('status');
      return;
    }
    setPhase('form');
    resetFormFromRecord(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal/quotation/latest change
  }, [isOpen, record?.forecastId, latest?.requestId, latest?.status]);

  const createMutation = useMutation({
    mutationFn: (payload: {
      requestType: string;
      requestedValues: Record<string, unknown>;
    }) => createQuotationEditRequest(forecastId, payload),
    onSuccess: () => {
      toast.success('Edit permission request submitted');
      void invalidateForecasts();
      onClose();
    },
    onError: (e: Error & { status?: number }) => {
      if (e.status === 409) {
        toast.error(
          e.message || 'There is already a pending edit request awaiting admin approval.',
        );
        void invalidateForecasts();
        return;
      }
      toast.error(e.message || 'Could not submit edit request');
    },
  });

  const busy = createMutation.isPending || requestsQuery.isLoading;

  const buildRequestedValues = (): Record<string, unknown> | null => {
    switch (requestType) {
      case 'Price':
        if (!String(unitPrice).trim() || !String(quantity).trim()) return null;
        return { unitPrice: Number(unitPrice), quantity: Number(quantity) };
      case 'Warranty':
        if (!String(warranty).trim()) return null;
        return { warranty: String(warranty).trim() };
      case 'Decision Expected By':
        if (!String(decisionExpectedBy).trim()) return null;
        return { decisionExpectedBy: String(decisionExpectedBy).trim() };
      case 'Part Number':
        if (!String(principal).trim() || !String(modelNumber).trim()) return null;
        return {
          principal: String(principal).trim(),
          modelNumber: String(modelNumber).trim(),
          productDescription: String(productDescription).trim(),
        };
      case 'Probability':
        if (!String(probabilityLabel).trim()) return null;
        return { probabilityLabel: String(probabilityLabel).trim() };
      default:
        return null;
    }
  };

  const handleSubmit = () => {
    if (!requestType) {
      toast.error('Please select what you would like to edit');
      return;
    }
    const requestedValues = buildRequestedValues();
    if (!requestedValues) {
      toast.error('Please complete all editable fields');
      return;
    }
    createMutation.mutate({ requestType, requestedValues });
  };

  const latestStatus = String(latest?.status || '').trim();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Edit Permission</DialogTitle>
          <DialogDescription>
            Submit a change request for admin approval. The quotation is not modified until approved.
          </DialogDescription>
        </DialogHeader>

        {record?.quotationRef ? (
          <div className="font-mono text-sm font-semibold text-[#007BFF]">{record.quotationRef}</div>
        ) : null}

        {phase === 'status' && latestStatus === 'Pending' ? (
          <div className="space-y-4 py-1">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <Badge className="border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                Pending
              </Badge>
              <div className="mt-2 text-sm text-[#212529]">
                Your edit request is awaiting admin approval.
              </div>
            </div>
            <ValuesBlock title="Old Values" values={latest?.oldValues || {}} />
            <ValuesBlock title="Requested Values" values={latest?.requestedValues || {}} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {phase === 'status' && latestStatus === 'Approved' ? (
          <div className="space-y-4 py-1">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
              <Badge className="border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                Approved
              </Badge>
              <div className="mt-2 text-sm text-[#212529]">Quotation updated successfully.</div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                type="button"
                className="bg-[#007BFF] hover:bg-[#0056b3]"
                onClick={() => {
                  setPhase('form');
                  resetFormFromRecord(null);
                }}
              >
                Create New Request
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {phase === 'status' && latestStatus === 'Rejected' ? (
          <div className="space-y-4 py-1">
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
              <Badge className="border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
                Rejected
              </Badge>
              <div className="mt-2 text-sm text-[#212529]">
                <span className="text-muted-foreground">Admin Remark: </span>
                {latest?.adminRemark || '—'}
              </div>
            </div>
            <ValuesBlock title="Old Requested Values" values={latest?.requestedValues || {}} />
            <ValuesBlock
              title="Current Approved Values"
              values={currentApprovedValues(record, String(latest?.requestType || ''))}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                type="button"
                className="bg-[#007BFF] hover:bg-[#0056b3]"
                onClick={() => {
                  setPhase('form');
                  resetFormFromRecord(latest);
                }}
              >
                Create New Request
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {phase === 'form' ? (
          <div className="space-y-5 py-1">
            <div className="space-y-2">
              <Label>What would you like to edit?</Label>
              <Select
                value={requestType || undefined}
                onValueChange={(v) => setRequestType(v as QuotationEditRequestType)}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field group" />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {requestType === 'Price' ? (
              <div className="space-y-3">
                <CurrentThenNew label="Unit Price" current={formatScalar(record?.unitPrice)}>
                  <Input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    disabled={busy}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                </CurrentThenNew>
                <CurrentThenNew label="Quantity" current={formatScalar(record?.quantity)}>
                  <Input
                    type="number"
                    step="1"
                    value={quantity}
                    disabled={busy}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </CurrentThenNew>
              </div>
            ) : null}

            {requestType === 'Warranty' ? (
              <CurrentThenNew label="Warranty" current={record?.warranty || ''}>
                <MasterCombobox
                  label=""
                  value={warranty}
                  onChange={setWarranty}
                  options={masters.WARRANTY}
                  placeholder="Select warranty"
                  disabled={busy}
                />
              </CurrentThenNew>
            ) : null}

            {requestType === 'Decision Expected By' ? (
              <CurrentThenNew
                label="Decision Expected By"
                current={record?.decisionExpectedBy || ''}
              >
                <Input
                  type="date"
                  value={decisionExpectedBy}
                  disabled={busy}
                  onChange={(e) => setDecisionExpectedBy(e.target.value)}
                />
              </CurrentThenNew>
            ) : null}

            {requestType === 'Part Number' ? (
              <div className="space-y-3">
                <CurrentThenNew label="Principle" current={record?.principal || ''}>
                  <SearchableCombobox
                    label=""
                    value={principal}
                    onChange={(v) => {
                      setPrincipal(v);
                      setModelNumber('');
                      setProductDescription('');
                    }}
                    options={comboboxOptionsWithCurrent(masters.PRINCIPAL, principal)}
                    placeholder="Search or select principle…"
                    disabled={busy}
                  />
                </CurrentThenNew>
                <CurrentThenNew label="Model Number" current={record?.modelNumber || ''}>
                  <SearchableCombobox
                    label=""
                    value={modelNumber}
                    onChange={(v) => {
                      setModelNumber(v);
                      const row = modelsByNumber.get(v.trim());
                      if (row?.productDescription) {
                        setProductDescription(row.productDescription);
                      }
                    }}
                    options={modelOptionsForCombobox}
                    placeholder={principalId ? 'Search or select model…' : 'Select Principle First'}
                    disabled={busy || !principalId}
                  />
                </CurrentThenNew>
                <CurrentThenNew
                  label="Product Description"
                  current={record?.productDescription || ''}
                >
                  <Textarea
                    rows={2}
                    className="min-h-[72px] max-h-[100px] resize-y"
                    value={productDescription}
                    disabled={busy}
                    onChange={(e) => setProductDescription(e.target.value)}
                  />
                </CurrentThenNew>
              </div>
            ) : null}

            {requestType === 'Probability' ? (
              <CurrentThenNew label="Probability %" current={record?.probabilityLabel || ''}>
                <SearchableCombobox
                  label=""
                  value={probabilityLabel}
                  onChange={setProbabilityLabel}
                  options={comboboxOptionsWithCurrent(
                    masters.PROBABILITY_OPTION,
                    probabilityLabel,
                  )}
                  placeholder="Search or select probability…"
                  disabled={busy}
                />
              </CurrentThenNew>
            ) : null}

            {history.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-[#212529]">Request History</div>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border px-3 py-2">
                  {history.map((h, idx) => (
                    <div key={h.requestId} className="border-b py-2 text-xs last:border-b-0">
                      <div className="font-medium text-[#212529]">
                        Request #{history.length - idx} · Rev {h.revisionNumber ?? 0} ·{' '}
                        {h.requestType} · {h.status}
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        Requested by {h.employeeName || h.employeeCode} ·{' '}
                        {h.requestedAt ? new Date(h.requestedAt).toLocaleString() : '—'}
                      </div>
                      {h.status === 'Approved' || h.status === 'Rejected' ? (
                        <div className="mt-1 text-muted-foreground">
                          {h.status === 'Approved' ? 'Approved' : 'Rejected'} by{' '}
                          {h.reviewedBy || '—'}
                          {h.adminRemark ? ` · Remark: ${h.adminRemark}` : ''}
                        </div>
                      ) : null}
                      <div className="mt-1 text-muted-foreground">
                        Old: {Object.entries(h.oldValues || {})
                          .filter(([k]) => k !== 'probabilityPercent')
                          .map(([k, v]) => `${FIELD_LABELS[k] || k}=${formatScalar(v)}`)
                          .join(', ') || '—'}
                      </div>
                      <div className="text-muted-foreground">
                        New: {Object.entries(h.requestedValues || {})
                          .filter(([k]) => k !== 'probabilityPercent')
                          .map(([k, v]) => `${FIELD_LABELS[k] || k}=${formatScalar(v)}`)
                          .join(', ') || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {Array.isArray(record?.editAuditLog) && record.editAuditLog.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-[#212529]">Audit Log</div>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border px-3 py-2">
                  {record.editAuditLog.map((a, i) => (
                    <div key={`${a.timestamp}-${a.fieldChanged}-${i}`} className="text-xs text-[#212529]">
                      {a.date} {a.time} · {a.fieldChanged}: {a.oldValue || '—'} → {a.newValue || '—'} ·
                      Rev {a.revision}
                      {a.approvedBy ? ` · Approved by ${a.approvedBy}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <DialogFooter className="gap-2 sm:justify-end sm:gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[#007BFF] hover:bg-[#0056b3]"
                disabled={busy || !requestType}
                onClick={handleSubmit}
              >
                Submit
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
