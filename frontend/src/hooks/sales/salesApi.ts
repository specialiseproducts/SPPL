import { apiFetch } from '../../services/api';
import type { ExchangeRatesMap, SalesOpportunity } from '../../types/salesForecast';
import type { MastersState } from '../../components/sales/SalesForecastingOpportunityFormModal';

export const SALES_MASTER_KEYS = [
  'STATUS',
  'PRINCIPAL',
  'CURRENCY',
  'PROBABILITY_OPTION',
  'CUSTOMER_SEGMENT',
  'ENQUIRY_TYPE',
  'DELIVERY_DAYS',
  'WARRANTY',
  'CONTACT_TITLE',
] as const;

export const DEFAULT_EXCHANGE_RATES: ExchangeRatesMap = {
  INR: 1,
  Euro: 95,
  'US$': 86,
  GBP: 110,
};

export function emptyMastersState(): MastersState {
  return {
    STATUS: [],
    PRINCIPAL: [],
    CURRENCY: [],
    PROBABILITY_OPTION: [],
    CUSTOMER_SEGMENT: [],
    ENQUIRY_TYPE: [],
    DELIVERY_DAYS: [],
    WARRANTY: [],
    CONTACT_TITLE: [],
  };
}

function mapKeyToMastersState(k: string): keyof MastersState | null {
  const map: Record<string, keyof MastersState> = {
    STATUS: 'STATUS',
    PRINCIPAL: 'PRINCIPAL',
    CURRENCY: 'CURRENCY',
    PROBABILITY_OPTION: 'PROBABILITY_OPTION',
    CUSTOMER_SEGMENT: 'CUSTOMER_SEGMENT',
    ENQUIRY_TYPE: 'ENQUIRY_TYPE',
    DELIVERY_DAYS: 'DELIVERY_DAYS',
    WARRANTY: 'WARRANTY',
    CONTACT_TITLE: 'CONTACT_TITLE',
  };
  return map[k] || null;
}

export async function fetchSalesForecasts(): Promise<SalesOpportunity[]> {
  const data = await apiFetch('/api/sales-forecasts');
  return (data?.data || []) as SalesOpportunity[];
}

export async function fetchSalesRates(): Promise<ExchangeRatesMap> {
  const data = await apiFetch('/api/sales-forecasts/rates');
  const raw = (data?.data || {}) as ExchangeRatesMap;
  return { INR: 1, ...raw };
}

export async function fetchSalesMasters(): Promise<MastersState> {
  const next = emptyMastersState();
  await Promise.all(
    SALES_MASTER_KEYS.map(async (key) => {
      try {
        const data = await apiFetch(`/api/sales-forecasts/master/${key}`);
        const mk = mapKeyToMastersState(key);
        if (mk && Array.isArray(data.data)) {
          next[mk] = data.data as string[];
        }
      } catch {
        /* ignore per-category failures — same as legacy loadMasters */
      }
    }),
  );
  return next;
}
