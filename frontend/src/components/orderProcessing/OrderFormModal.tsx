import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Plus, Trash2, Upload, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type {
  OrderProcessingRecord,
  OrderFormData,
  OrderPart,
  OrderAttachment,
} from '../../types/orderProcessing';
import { createOrder, updateOrder, uploadOrderFile } from '../../hooks/orderProcessing/orderProcessingApi';

const EMPTY_PART: OrderPart = { partNumber: '', description: '', unitPrice: null, quantity: null, total: null };
const SOURCE_OPTIONS = ['Sales', 'Principal', 'Tender', 'Subscription', 'Others'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editOrder?: OrderProcessingRecord | null;
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg bg-gray-50 p-3 text-left transition-colors hover:bg-gray-100"
      >
        <span className="font-medium text-gray-900">{title}</span>
        {open ? (
          <ChevronUp className="h-5 w-5 text-gray-600" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-600" />
        )}
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function FileField({
  label,
  files,
  onUpload,
  onRemove,
  uploading,
}: {
  label: string;
  files: OrderAttachment[];
  onUpload: (file: File) => void;
  onRemove: (index: number) => void;
  uploading: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm"
            >
              <span className="max-w-[220px] truncate text-gray-700">{f.fileName}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="shrink-0 text-red-500 hover:text-red-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
        <Upload className="h-4 w-4" />
        {uploading ? 'Uploading…' : 'Upload'}
        <input
          type="file"
          className="hidden"
          disabled={uploading}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

export default function OrderFormModal({ open, onClose, onSaved, editOrder }: Props) {
  const isEdit = !!editOrder;
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const blankForm = (): OrderFormData => ({
    spplReferenceNumber: '',
    referenceDate: '',
    checklist: 'No',
    sourceOfEnquiry: '',
    tenderReferenceNumber: '',
    tenderDocument: [],
    emdSubmitted: 'No',
    organizationName: '',
    customerContractPONumber: '',
    poDate: '',
    customerGSTNumber: '',
    billToAddress: '',
    billContactPerson: '',
    billContactMobile: '',
    billEmail: '',
    shipToAddress: '',
    shipContactPerson: '',
    shipContactMobile: '',
    shipEmail: '',
    orderedParts: [{ ...EMPTY_PART }],
    principalName: '',
    principalCommunication: [],
    quotationFromPrincipal: [],
    expectedDeliveryDate: '',
    ldCharges: '',
    deliveryTerms: '',
    paymentTerms: '',
    warranty: '',
    pbgPercentageAmount: '',
    pbgFormat: [],
    concernedPerson: '',
    importantPoints: '',
  });

  const [form, setForm] = useState<OrderFormData>(blankForm());

  useEffect(() => {
    if (!open) return;
    if (editOrder) {
      setForm({
        spplReferenceNumber: editOrder.spplReferenceNumber || '',
        referenceDate: editOrder.referenceDate || '',
        checklist: editOrder.checklist || 'No',
        sourceOfEnquiry: editOrder.sourceOfEnquiry || '',
        tenderReferenceNumber: editOrder.tenderReferenceNumber || '',
        tenderDocument: editOrder.tenderDocument || [],
        emdSubmitted: editOrder.emdSubmitted || 'No',
        organizationName: editOrder.organizationName || '',
        customerContractPONumber: editOrder.customerContractPONumber || '',
        poDate: editOrder.poDate || '',
        customerGSTNumber: editOrder.customerGSTNumber || '',
        billToAddress: editOrder.billToAddress || '',
        billContactPerson: editOrder.billContactPerson || '',
        billContactMobile: editOrder.billContactMobile || '',
        billEmail: editOrder.billEmail || '',
        shipToAddress: editOrder.shipToAddress || '',
        shipContactPerson: editOrder.shipContactPerson || '',
        shipContactMobile: editOrder.shipContactMobile || '',
        shipEmail: editOrder.shipEmail || '',
        orderedParts:
          editOrder.orderedParts?.length ? editOrder.orderedParts : [{ ...EMPTY_PART }],
        principalName: editOrder.principalName || '',
        principalCommunication: editOrder.principalCommunication || [],
        quotationFromPrincipal: editOrder.quotationFromPrincipal || [],
        expectedDeliveryDate: editOrder.expectedDeliveryDate || '',
        ldCharges: editOrder.ldCharges || '',
        deliveryTerms: editOrder.deliveryTerms || '',
        paymentTerms: editOrder.paymentTerms || '',
        warranty: editOrder.warranty || '',
        pbgPercentageAmount: editOrder.pbgPercentageAmount || '',
        pbgFormat: editOrder.pbgFormat || [],
        concernedPerson: editOrder.concernedPerson || '',
        importantPoints: editOrder.importantPoints || '',
      });
    } else {
      setForm(blankForm());
    }
  }, [open, editOrder]);

  const set = useCallback(
    <K extends keyof OrderFormData>(key: K, value: OrderFormData[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const handleFileUpload = async (
    field: 'tenderDocument' | 'principalCommunication' | 'quotationFromPrincipal' | 'pbgFormat',
    file: File,
  ) => {
    setUploading(true);
    try {
      const attachment = await uploadOrderFile(file);
      setForm((prev) => ({ ...prev, [field]: [...(prev[field] as OrderAttachment[]), attachment] }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (
    field: 'tenderDocument' | 'principalCommunication' | 'quotationFromPrincipal' | 'pbgFormat',
    index: number,
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: (prev[field] as OrderAttachment[]).filter((_, i) => i !== index),
    }));
  };

  const updatePart = (index: number, key: keyof OrderPart, value: string) => {
    setForm((prev) => {
      const parts = [...prev.orderedParts];
      const numericKeys: (keyof OrderPart)[] = ['unitPrice', 'quantity', 'total'];
      if (numericKeys.includes(key)) {
        (parts[index] as unknown as Record<string, unknown>)[key] =
          value === '' ? null : Number(value);
      } else {
        (parts[index] as unknown as Record<string, unknown>)[key] = value;
      }
      return { ...prev, orderedParts: parts };
    });
  };

  const addPart = () =>
    setForm((prev) => ({ ...prev, orderedParts: [...prev.orderedParts, { ...EMPTY_PART }] }));
  const removePart = (index: number) =>
    setForm((prev) => ({
      ...prev,
      orderedParts:
        prev.orderedParts.length <= 1
          ? prev.orderedParts
          : prev.orderedParts.filter((_, i) => i !== index),
    }));

  const handleSubmit = async () => {
    if (!form.spplReferenceNumber.trim()) {
      toast.error('SPPL Reference Number is required');
      return;
    }
    if (!form.referenceDate.trim()) {
      toast.error('Reference Date is required');
      return;
    }

    setBusy(true);
    try {
      if (isEdit && editOrder) {
        await updateOrder(editOrder.orderId, form);
        toast.success('Order updated successfully');
      } else {
        await createOrder(form);
        toast.success('Order created successfully');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 flex max-h-[90vh] w-full max-w-6xl flex-col rounded-lg bg-white">
        {/* Header — matches Purchases */}
        <div className="sticky top-0 z-10 flex-shrink-0 rounded-t-lg border-b bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-[#212529]">{isEdit ? 'Edit Order' : 'Create New Order'}</h2>
              <p className="mt-1 text-sm text-gray-600">
                Enter order processing details. Required fields are marked with *.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Scrollable body — matches Purchases */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
            <CollapsibleSection title="SPPL Reference" defaultOpen>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>
                    SPPL Reference Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.spplReferenceNumber}
                    onChange={(e) => set('spplReferenceNumber', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Reference Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.referenceDate}
                    onChange={(e) => set('referenceDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Checklist</Label>
                  <Select value={form.checklist} onValueChange={(v) => set('checklist', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Enquiry Details">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Source of Enquiry</Label>
                  <Select
                    value={form.sourceOfEnquiry}
                    onValueChange={(v) => set('sourceOfEnquiry', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tender Reference Number</Label>
                  <Input
                    value={form.tenderReferenceNumber}
                    onChange={(e) => set('tenderReferenceNumber', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>EMD Submitted</Label>
                  <Select value={form.emdSubmitted} onValueChange={(v) => set('emdSubmitted', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <FileField
                  label="Tender Document"
                  files={form.tenderDocument}
                  onUpload={(f) => void handleFileUpload('tenderDocument', f)}
                  onRemove={(i) => removeFile('tenderDocument', i)}
                  uploading={uploading}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Customer Details">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Organization Name</Label>
                  <Input
                    value={form.organizationName}
                    onChange={(e) => set('organizationName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer Contract / PO Number</Label>
                  <Input
                    value={form.customerContractPONumber}
                    onChange={(e) => set('customerContractPONumber', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PO Date</Label>
                  <Input
                    type="date"
                    value={form.poDate}
                    onChange={(e) => set('poDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Customer GST Number</Label>
                  <Input
                    value={form.customerGSTNumber}
                    onChange={(e) => set('customerGSTNumber', e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <p className="font-medium text-gray-900">Bill To</p>
                <div className="space-y-2">
                  <Label>Bill To Address</Label>
                  <Textarea
                    rows={3}
                    value={form.billToAddress}
                    onChange={(e) => set('billToAddress', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input
                      value={form.billContactPerson}
                      onChange={(e) => set('billContactPerson', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Mobile</Label>
                    <Input
                      value={form.billContactMobile}
                      onChange={(e) => set('billContactMobile', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.billEmail}
                      onChange={(e) => set('billEmail', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <p className="font-medium text-gray-900">Ship To</p>
                <div className="space-y-2">
                  <Label>Ship To Address</Label>
                  <Textarea
                    rows={3}
                    value={form.shipToAddress}
                    onChange={(e) => set('shipToAddress', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input
                      value={form.shipContactPerson}
                      onChange={(e) => set('shipContactPerson', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Mobile</Label>
                    <Input
                      value={form.shipContactMobile}
                      onChange={(e) => set('shipContactMobile', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.shipEmail}
                      onChange={(e) => set('shipEmail', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Ordered Parts">
              <div className="space-y-4">
                {form.orderedParts.map((part, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 items-end gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-12"
                  >
                    <div className="space-y-2 md:col-span-3">
                      <Label>Part Number</Label>
                      <Input
                        value={part.partNumber}
                        onChange={(e) => updatePart(idx, 'partNumber', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-3">
                      <Label>Description</Label>
                      <Input
                        value={part.description}
                        onChange={(e) => updatePart(idx, 'description', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Unit Price</Label>
                      <Input
                        type="number"
                        value={part.unitPrice ?? ''}
                        onChange={(e) => updatePart(idx, 'unitPrice', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={part.quantity ?? ''}
                        onChange={(e) => updatePart(idx, 'quantity', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Total</Label>
                      <Input
                        type="number"
                        value={part.total ?? ''}
                        onChange={(e) => updatePart(idx, 'total', e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end md:col-span-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-red-500 hover:bg-red-50 hover:text-red-700"
                        onClick={() => removePart(idx)}
                        disabled={form.orderedParts.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addPart} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Add Part
                </Button>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Principal Details">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Principal Name</Label>
                  <Input
                    value={form.principalName}
                    onChange={(e) => set('principalName', e.target.value)}
                  />
                </div>
                <FileField
                  label="Principal Communication"
                  files={form.principalCommunication}
                  onUpload={(f) => void handleFileUpload('principalCommunication', f)}
                  onRemove={(i) => removeFile('principalCommunication', i)}
                  uploading={uploading}
                />
                <FileField
                  label="Quotation from Principal"
                  files={form.quotationFromPrincipal}
                  onUpload={(f) => void handleFileUpload('quotationFromPrincipal', f)}
                  onRemove={(i) => removeFile('quotationFromPrincipal', i)}
                  uploading={uploading}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Terms & Conditions">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Expected Delivery Date</Label>
                  <Input
                    type="date"
                    value={form.expectedDeliveryDate}
                    onChange={(e) => set('expectedDeliveryDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Delivery Terms</Label>
                  <Input
                    value={form.deliveryTerms}
                    onChange={(e) => set('deliveryTerms', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>LD Charges</Label>
                  <Textarea
                    rows={3}
                    value={form.ldCharges}
                    onChange={(e) => set('ldCharges', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Payment Terms</Label>
                  <Textarea
                    rows={3}
                    value={form.paymentTerms}
                    onChange={(e) => set('paymentTerms', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Warranty</Label>
                  <Textarea
                    rows={3}
                    value={form.warranty}
                    onChange={(e) => set('warranty', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PBG Percentage / Amount</Label>
                  <Input
                    value={form.pbgPercentageAmount}
                    onChange={(e) => set('pbgPercentageAmount', e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4">
                <FileField
                  label="PBG Format"
                  files={form.pbgFormat}
                  onUpload={(f) => void handleFileUpload('pbgFormat', f)}
                  onRemove={(i) => removeFile('pbgFormat', i)}
                  uploading={uploading}
                />
              </div>
              <div className="mt-4 space-y-2">
                <Label>Concerned Person</Label>
                <Textarea
                  rows={3}
                  value={form.concernedPerson}
                  onChange={(e) => set('concernedPerson', e.target.value)}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Additional Information">
              <div className="space-y-2">
                <Label>Important Points</Label>
                <Textarea
                  rows={5}
                  value={form.importantPoints}
                  onChange={(e) => set('importantPoints', e.target.value)}
                />
              </div>
            </CollapsibleSection>
          </div>
        </div>

        {/* Footer — matches Purchases */}
        <div className="flex-shrink-0 border-t bg-gray-50 p-6">
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#007BFF] hover:bg-[#0056b3]"
              disabled={busy || uploading}
              onClick={() => void handleSubmit()}
            >
              {busy ? 'Saving…' : 'Save Order'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
