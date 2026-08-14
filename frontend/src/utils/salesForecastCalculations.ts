import type { ExchangeRatesMap, SalesOpportunity } from '../types/salesForecast';

/** Finalized after approval when a quotation reference has been issued. */
export function isQuotationLocked(row: Pick<SalesOpportunity, 'workflowStatus' | 'quotationRef'>): boolean {
  const ws = row.workflowStatus;
  const ref = String(row.quotationRef || '').trim();
  if (!ref) return false;
  return ws === 'approved' || ws === 'in_progress' || ws === 'closed';
}

/** Owner may update business status while quotation is in the sales lifecycle. */
export function canUpdateQuotationProgress(
  row: Pick<SalesOpportunity, 'workflowStatus' | 'quotationRef' | 'ownerEmployeeCode' | 'createdByEmployeeCode'>,
  employeeCode: string,
): boolean {
  const code = String(employeeCode || '').trim();
  if (!code) return false;
  const own =
    String(row.ownerEmployeeCode || '').trim() === code ||
    String(row.createdByEmployeeCode || '').trim() === code;
  if (!own) return false;
  const ref = String(row.quotationRef || '').trim();
  if (!ref) return false;
  const ws = row.workflowStatus;
  return ws === 'in_progress' || ws === 'approved';
}

export function computeTotalValue(unitPrice: number | null | undefined, quantity: number | null | undefined): number {
  const u = Number(unitPrice ?? 0);
  const q = Number(quantity ?? 0);
  return parseFloat((u * q).toFixed(2));
}

export function computeInrValue(
  currency: string,
  totalValue: number,
  rates: ExchangeRatesMap
): number {
  const c = String(currency || 'INR').trim();
  if (!c || c === 'INR') return parseFloat(totalValue.toFixed(2));
  const rate = Number(rates[c] ?? rates['US$'] ?? rates.USD ?? 0);
  if (!rate) return parseFloat(totalValue.toFixed(2));
  return parseFloat((totalValue * rate).toFixed(2));
}
