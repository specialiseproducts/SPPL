import { apiFetch } from '../../services/api';
import { fetchPaginatedList } from '../../utils/paginatedFetch';
import type { PaginatedResponse } from '../paginationTypes';
import type { ExchangeRatesMap, SalesOpportunity } from '../../types/salesForecast';
import type { MastersState } from '../../components/sales/SalesForecastingOpportunityFormModal';
import { sanitizeSelectOptions } from '../../utils/sanitizeSelectOptions';

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

export function sanitizeMastersState(masters: MastersState): MastersState {
  return {
    STATUS: sanitizeSelectOptions(masters.STATUS),
    PRINCIPAL: sanitizeSelectOptions(masters.PRINCIPAL),
    CURRENCY: sanitizeSelectOptions(masters.CURRENCY),
    PROBABILITY_OPTION: sanitizeSelectOptions(masters.PROBABILITY_OPTION),
    CUSTOMER_SEGMENT: sanitizeSelectOptions(masters.CUSTOMER_SEGMENT),
    ENQUIRY_TYPE: sanitizeSelectOptions(masters.ENQUIRY_TYPE),
    DELIVERY_DAYS: sanitizeSelectOptions(masters.DELIVERY_DAYS),
    WARRANTY: sanitizeSelectOptions(masters.WARRANTY),
    CONTACT_TITLE: sanitizeSelectOptions(masters.CONTACT_TITLE),
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

export interface SalesBootstrapPayload {
  masters: MastersState;
  rates: ExchangeRatesMap;
}

function mapBootstrapMasters(raw: Record<string, unknown> | null | undefined): MastersState {
  const base = emptyMastersState();
  if (!raw || typeof raw !== 'object') return base;
  const keys = Object.keys(base) as (keyof MastersState)[];
  for (const key of keys) {
    const arr = raw[key];
    if (Array.isArray(arr)) {
      base[key] = sanitizeSelectOptions(arr as string[]);
    }
  }
  return sanitizeMastersState(base);
}

export async function fetchSalesBootstrap(): Promise<SalesBootstrapPayload> {
  const res = await apiFetch('/api/sales-forecasts/bootstrap');
  const data = (res?.data || {}) as {
    masters?: Record<string, string[]>;
    rates?: ExchangeRatesMap;
  };
  return {
    masters: mapBootstrapMasters(data.masters),
    rates: { INR: 1, ...(data.rates || {}) },
  };
}

export async function fetchSalesForecastsPage(
  cursor?: string,
): Promise<PaginatedResponse<SalesOpportunity>> {
  return fetchPaginatedList<SalesOpportunity>('/api/sales-forecasts', cursor);
}

export async function fetchSalesOpportunityById(forecastId: string): Promise<SalesOpportunity> {
  const res = await apiFetch(`/api/sales-forecasts/${encodeURIComponent(forecastId)}`);
  return (res?.data || res) as SalesOpportunity;
}

/** @deprecated Use fetchSalesForecastsPage */
export async function fetchSalesForecasts(): Promise<SalesOpportunity[]> {
  const all: SalesOpportunity[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchSalesForecastsPage(cursor);
    all.push(...page.data);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return all;
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
          next[mk] = sanitizeSelectOptions(data.data as string[]);
        }
      } catch {
        /* ignore per-category failures — same as legacy loadMasters */
      }
    }),
  );
  return sanitizeMastersState(next);
}
