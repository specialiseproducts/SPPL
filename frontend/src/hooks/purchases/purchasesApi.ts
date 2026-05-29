import { fetchPaginatedList } from '../../utils/paginatedFetch';
import type { PaginatedResponse } from '../paginationTypes';
import type { PurchaseRecord } from '../../components/PurchasesTab';

function mapBackendLineItemToRecord(header: Record<string, unknown>, item: Record<string, unknown>): PurchaseRecord {
  return {
    id: String(item.purchaseLineItemId ?? item.lineItemId ?? item.id ?? ''),
    record_type: String(header.recordType ?? header.record_type ?? ''),
    po_number: String(header.poNumber ?? header.po_number ?? ''),
    date: String(header.date ?? ''),
    principal: String(header.principal ?? ''),
    invoice_number: String(header.invoiceNumber ?? header.invoice_number ?? ''),
    invoice_date: String(header.invoiceDate ?? header.invoice_date ?? ''),
    boe_number: String(header.boeNumber ?? header.boe_number ?? ''),
    boe_date: String(header.boeDate ?? header.boe_date ?? ''),
    hs_code: '',
    item_details: String(item.itemDetails ?? item.item_details ?? ''),
    part_number: String(item.partNumber ?? item.part_number ?? ''),
    unit_price: Number(item.unitPrice ?? item.unit_price ?? 0),
    qty: Number(item.quantity ?? item.qty ?? 0),
    freight_charges_international: Number(item.freightCharges ?? 0),
    gst_on_freight_charges: 0,
    total_price_in_fe_inr: 0,
    exchange_rate_as_per_boe: 0,
    equivalent_inr_as_per_boe: 0,
    actual_bank_transfer_amount: 0,
    bank_charges: 0,
    gst_on_bank_charges: 0,
    basic_custom_duty: 0,
    surcharge: 0,
    gst_on_import_cgst_sgst_igst_local: Number(item.gst ?? 0),
    interest_or_fine_on_custom_duty: 0,
    custom_clearance_charges: 0,
    igst_gst_on_custom_clearance: 0,
    total_custom_clearance_charges: 0,
    total_landed_price: Number(item.totalLandedPrice ?? item.total_landed_price ?? 0),
    landed_unit_price: 0,
    customer: '',
    customer_po: '',
    po_date: '',
    po_price: 0,
    quantity: Number(item.quantity ?? item.qty ?? 0),
    total_po_price: 0,
    igst_gst_percentage: 0,
    gst_igst_amount: 0,
    price_to_customer: 0,
    customer_invoice_number: '',
    customer_invoice_date: '',
    shipping_charges_to_customer: 0,
    cgst_sgst: 0,
    price_to_sppl: Number(item.priceToSPPL ?? item.price_to_sppl ?? 0),
    gm_percentage: Number(item.gmPercentage ?? item.gm_percentage ?? 0),
    margin: Number(item.margin ?? 0),
    created_by: '',
    created_at: String(item.createdAt ?? item.created_at ?? ''),
    updated_at: String(item.updatedAt ?? item.updated_at ?? ''),
  };
}

function flattenPurchasePage(
  entries: { header?: Record<string, unknown>; lineItems?: unknown[] }[],
): PurchaseRecord[] {
  return entries.flatMap((purchase) => {
    const header = purchase.header || {};
    const lineItems = Array.isArray(purchase.lineItems) ? purchase.lineItems : [];
    return lineItems.map((item) =>
      mapBackendLineItemToRecord(header, item as Record<string, unknown>),
    );
  });
}

export async function fetchPurchasesPage(cursor?: string): Promise<PaginatedResponse<PurchaseRecord>> {
  const page = await fetchPaginatedList<{ header?: Record<string, unknown>; lineItems?: unknown[] }>(
    '/api/purchases',
    cursor,
  );
  return {
    data: flattenPurchasePage(page.data),
    nextCursor: page.nextCursor,
  };
}

/** @deprecated Use fetchPurchasesPage */
export async function fetchPurchasesList(): Promise<PurchaseRecord[]> {
  const all: PurchaseRecord[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPurchasesPage(cursor);
    all.push(...page.data);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return all;
}
