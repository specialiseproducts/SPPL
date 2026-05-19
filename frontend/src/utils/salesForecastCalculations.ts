import type { ExchangeRatesMap, SalesOpportunity } from '../types/salesForecast';

/** Finalized after approval when a quotation reference has been issued. */
export function isQuotationLocked(row: Pick<SalesOpportunity, 'workflowStatus' | 'quotationRef'>): boolean {
  return row.workflowStatus === 'approved' && String(row.quotationRef || '').trim() !== '';
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
