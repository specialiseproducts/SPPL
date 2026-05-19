import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExchangeRatesMap, SalesMasterAdminItem, SalesPrincipalAdminRow } from '../../types/salesForecast';
import { apiFetch } from '../../services/api';
import {
  DEFAULT_EXCHANGE_RATES,
  fetchSalesForecasts,
  fetchSalesMasters,
  fetchSalesRates,
} from './salesApi';
import { salesQueryKeys } from './salesQueryKeys';

const FORECASTS_STALE_MS = 60 * 1000;
const MASTERS_STALE_MS = 8 * 60 * 1000;
const RATES_STALE_MS = 5 * 60 * 1000;

export function useSalesForecastsQuery() {
  return useQuery({
    queryKey: salesQueryKeys.forecasts(),
    queryFn: fetchSalesForecasts,
    staleTime: FORECASTS_STALE_MS,
    placeholderData: (previous) => previous,
  });
}

export function useSalesMastersQuery() {
  return useQuery({
    queryKey: salesQueryKeys.masters(),
    queryFn: fetchSalesMasters,
    staleTime: MASTERS_STALE_MS,
    placeholderData: (previous) => previous,
  });
}

export function useSalesRatesQuery() {
  return useQuery({
    queryKey: salesQueryKeys.rates(),
    queryFn: fetchSalesRates,
    staleTime: RATES_STALE_MS,
    placeholderData: (previous) => previous ?? DEFAULT_EXCHANGE_RATES,
  });
}

export async function fetchMasterAdminList(category: string): Promise<SalesMasterAdminItem[]> {
  const res = (await apiFetch(`/api/sales-forecasts/master-admin/${encodeURIComponent(category)}`)) as {
    data?: { items?: SalesMasterAdminItem[] };
  };
  return res?.data?.items ?? [];
}

export async function fetchMasterAdminPrincipals(): Promise<SalesPrincipalAdminRow[]> {
  const res = (await apiFetch('/api/sales-forecasts/master-admin/PRINCIPAL_MAP')) as {
    data?: { principals?: SalesPrincipalAdminRow[] };
  };
  return res?.data?.principals ?? [];
}

export function useMasterAdminListQuery(category: string, enabled: boolean) {
  return useQuery({
    queryKey: salesQueryKeys.masterAdminList(category),
    queryFn: () => fetchMasterAdminList(category),
    enabled,
    staleTime: MASTERS_STALE_MS,
    placeholderData: (previous) => previous,
  });
}

export function useMasterAdminPrincipalsQuery(enabled = true) {
  return useQuery({
    queryKey: salesQueryKeys.masterAdminPrincipals(),
    queryFn: fetchMasterAdminPrincipals,
    enabled,
    staleTime: MASTERS_STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Invalidate quotation dropdown masters after master-data admin changes. */
export function useInvalidateSalesMasters() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: salesQueryKeys.masters() });
}

/** Invalidate forecasts list after CRUD / workflow actions. */
export function useInvalidateSalesForecasts() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: salesQueryKeys.forecasts() });
}

export function useInvalidateSalesRates() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: salesQueryKeys.rates() });
}

export type { ExchangeRatesMap };
