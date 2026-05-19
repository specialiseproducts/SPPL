import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExchangeRatesMap, SalesMasterAdminItem, SalesPrincipalAdminRow } from '../../types/salesForecast';
import { apiFetch } from '../../services/api';
import {
  DEFAULT_EXCHANGE_RATES,
  fetchSalesForecasts,
  fetchSalesMasters,
  fetchSalesRates,
} from './salesApi';
import { queryDefaults } from '../queryDefaults';
import { salesQueryKeys } from './salesQueryKeys';

export function useSalesForecastsQuery() {
  return useQuery({
    queryKey: salesQueryKeys.forecasts(),
    queryFn: fetchSalesForecasts,
    ...queryDefaults.list,
  });
}

export function useSalesMastersQuery() {
  return useQuery({
    queryKey: salesQueryKeys.masters(),
    queryFn: fetchSalesMasters,
    ...queryDefaults.reference,
  });
}

export function useSalesRatesQuery() {
  return useQuery({
    queryKey: salesQueryKeys.rates(),
    queryFn: fetchSalesRates,
    ...queryDefaults.reference,
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
    ...queryDefaults.reference,
  });
}

export function useMasterAdminPrincipalsQuery(enabled = true) {
  return useQuery({
    queryKey: salesQueryKeys.masterAdminPrincipals(),
    queryFn: fetchMasterAdminPrincipals,
    enabled,
    ...queryDefaults.reference,
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
