import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import type { OrderProcessingRecord, OrderAttachment } from '../../types/orderProcessing';

function displayCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return displayCell(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ViewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="text-sm text-[#212529] break-words">{value}</div>
    </div>
  );
}

function ViewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-[#212529]">{title}</h3>
      {children}
    </section>
  );
}

function AttachmentList({ files }: { files: OrderAttachment[] }) {
  if (!files.length) return <span className="text-sm text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f, i) => (
        <a
          key={i}
          href={f.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-[#007BFF] hover:underline"
        >
          {f.fileName} <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
}

interface Props {
  open: boolean;
  order: OrderProcessingRecord | null;
  onClose: () => void;
}

export default function OrderViewModal({ open, order, onClose }: Props) {
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="!flex !h-[92vh] !max-h-[92vh] !w-[min(96vw,1100px)] !max-w-[1100px] !flex-col gap-0 overflow-hidden !p-0 sm:!max-w-[1100px]"
        style={{ width: 'min(96vw, 1100px)', maxWidth: '1100px', height: '92vh', maxHeight: '92vh' }}
      >
        <DialogHeader className="shrink-0 border-b border-gray-200 bg-white px-6 py-4 text-left">
          <DialogTitle className="text-lg font-semibold text-[#212529]">
            Order Details
          </DialogTitle>
          <p className="text-sm text-gray-600">
            {order.spplReferenceNumber} · {order.organizationName || 'N/A'}
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#F8F9FA] px-6 py-5">
          <ViewSection title="SPPL Reference">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ViewField label="SPPL Reference Number" value={displayCell(order.spplReferenceNumber)} />
              <ViewField label="Reference Date" value={formatDate(order.referenceDate)} />
              <ViewField label="Checklist" value={displayCell(order.checklist)} />
            </div>
          </ViewSection>

          <ViewSection title="Enquiry Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ViewField label="Source of Enquiry" value={displayCell(order.sourceOfEnquiry)} />
              <ViewField label="Tender Reference Number" value={displayCell(order.tenderReferenceNumber)} />
              <ViewField label="EMD Submitted" value={displayCell(order.emdSubmitted)} />
            </div>
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Tender Document</p>
              <AttachmentList files={order.tenderDocument || []} />
            </div>
          </ViewSection>

          <ViewSection title="Customer Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ViewField label="Organization Name" value={displayCell(order.organizationName)} />
              <ViewField label="Contract / PO Number" value={displayCell(order.customerContractPONumber)} />
              <ViewField label="PO Date" value={formatDate(order.poDate)} />
              <ViewField label="Customer GST Number" value={displayCell(order.customerGSTNumber)} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Bill To</p>
                <div className="space-y-2">
                  <ViewField label="Address" value={displayCell(order.billToAddress)} />
                  <ViewField label="Contact Person" value={displayCell(order.billContactPerson)} />
                  <ViewField label="Mobile" value={displayCell(order.billContactMobile)} />
                  <ViewField label="Email" value={displayCell(order.billEmail)} />
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Ship To</p>
                <div className="space-y-2">
                  <ViewField label="Address" value={displayCell(order.shipToAddress)} />
                  <ViewField label="Contact Person" value={displayCell(order.shipContactPerson)} />
                  <ViewField label="Mobile" value={displayCell(order.shipContactMobile)} />
                  <ViewField label="Email" value={displayCell(order.shipEmail)} />
                </div>
              </div>
            </div>
          </ViewSection>

          <ViewSection title="Ordered Parts">
            {order.orderedParts?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                      <th className="pb-2 pr-4">#</th>
                      <th className="pb-2 pr-4">Part Number</th>
                      <th className="pb-2 pr-4">Description</th>
                      <th className="pb-2 pr-4 text-right">Unit Price</th>
                      <th className="pb-2 pr-4 text-right">Qty</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.orderedParts.map((p, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                        <td className="py-2 pr-4">{displayCell(p.partNumber)}</td>
                        <td className="py-2 pr-4">{displayCell(p.description)}</td>
                        <td className="py-2 pr-4 text-right">{p.unitPrice != null ? p.unitPrice : '—'}</td>
                        <td className="py-2 pr-4 text-right">{p.quantity != null ? p.quantity : '—'}</td>
                        <td className="py-2 text-right">{p.total != null ? p.total : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No parts added.</p>
            )}
          </ViewSection>

          <ViewSection title="Principal Details">
            <ViewField label="Principal Name" value={displayCell(order.principalName)} />
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Principal Communication</p>
              <AttachmentList files={order.principalCommunication || []} />
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mt-2">Quotation from Principal</p>
              <AttachmentList files={order.quotationFromPrincipal || []} />
            </div>
          </ViewSection>

          <ViewSection title="Terms & Conditions">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ViewField label="Expected Delivery Date" value={formatDate(order.expectedDeliveryDate)} />
              <ViewField label="Delivery Terms" value={displayCell(order.deliveryTerms)} />
              <ViewField label="LD Charges" value={displayCell(order.ldCharges)} />
              <ViewField label="Payment Terms" value={displayCell(order.paymentTerms)} />
              <ViewField label="Warranty" value={displayCell(order.warranty)} />
              <ViewField label="PBG %" value={displayCell(order.pbgPercentageAmount)} />
            </div>
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">PBG Format</p>
              <AttachmentList files={order.pbgFormat || []} />
            </div>
            <div className="mt-3">
              <ViewField label="Concerned Person" value={displayCell(order.concernedPerson)} />
            </div>
          </ViewSection>

          <ViewSection title="Additional Information">
            <ViewField label="Important Points" value={displayCell(order.importantPoints)} />
          </ViewSection>

          <ViewSection title="Record Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ViewField label="Created By" value={displayCell(order.created_by_name)} />
              <ViewField label="Created At" value={formatDate(order.created_at)} />
              <ViewField label="Last Updated" value={formatDate(order.updated_at)} />
              <ViewField label="Status" value={displayCell(order.status)} />
            </div>
          </ViewSection>
        </div>

        <DialogFooter className="shrink-0 border-t border-gray-200 bg-white px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
