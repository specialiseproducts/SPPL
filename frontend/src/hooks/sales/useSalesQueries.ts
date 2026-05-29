import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExchangeRatesMap, SalesMasterAdminItem, SalesPrincipalAdminRow } from '../../types/salesForecast';
import { apiFetch } from '../../services/api';
import {
  fetchSalesBootstrap,
  fetchSalesForecasts,
  fetchSalesForecastsPage,
  fetchSalesMasters,
  fetchSalesRates,
} from './salesApi';
import { queryDefaults } from '../queryDefaults';
import { salesQueryKeys, type SalesBootstrapViewMode } from './salesQueryKeys';
import { measureAsync } from '../../lib/observability/performance';

function hydrateSalesCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  data: Awaited<ReturnType<typeof fetchSalesBootstrap>>
) {
  queryClient.setQueryData(salesQueryKeys.masters(), data.masters);
  queryClient.setQueryData(salesQueryKeys.rates(), data.rates);
}

/** Masters + rates only (opportunities loaded via paginated list). */
export function useSalesBootstrapQuery(_viewMode: SalesBootstrapViewMode = 'user') {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: salesQueryKeys.bootstrap(),
    queryFn: () =>
      measureAsync('sales_bootstrap', 'sales-bootstrap', async () => {
        const data = await fetchSalesBootstrap();
        hydrateSalesCaches(queryClient, data);
        return data;
      }),
    ...queryDefaults.salesBootstrap,
  });
}

export function useSalesForecastsInfiniteQuery() {
  return useInfiniteQuery({
    queryKey: salesQueryKeys.forecastsInfinite(),
    queryFn: ({ pageParam }) =>
      measureAsync('pagination', 'sales-forecasts-page', () =>
        fetchSalesForecastsPage(pageParam as string | undefined),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    ...queryDefaults.salesForecasts,
  });
}

export function useSalesForecastsListRows() {
  const query = useSalesForecastsInfiniteQuery();
  const opportunities = query.data?.pages.flatMap((p) => p.data) ?? [];
  return { ...query, opportunities };
}

/** @deprecated Prefer useSalesBootstrapQuery — kept for master admin / incremental refresh. */
export function useSalesForecastsQuery(enabled = true) {
  const queryClient = useQueryClient();
  const hasBootstrap = queryClient.getQueryData(salesQueryKeys.bootstrap());

  return useQuery({
    queryKey: salesQueryKeys.forecasts(),
    queryFn: fetchSalesForecasts,
    enabled: enabled && !hasBootstrap,
    ...queryDefaults.list,
  });
}

/** @deprecated Prefer useSalesBootstrapQuery — kept for master admin. */
export function useSalesMastersQuery(enabled = true) {
  const queryClient = useQueryClient();
  const hasBootstrap = queryClient.getQueryData(salesQueryKeys.bootstrap());

  return useQuery({
    queryKey: salesQueryKeys.masters(),
    queryFn: fetchSalesMasters,
    enabled: enabled && !hasBootstrap,
    ...queryDefaults.reference,
  });
}

/** @deprecated Prefer useSalesBootstrapQuery — kept for master admin rates tab. */
export function useSalesRatesQuery(enabled = true) {
  const queryClient = useQueryClient();
  const hasBootstrap = queryClient.getQueryData(salesQueryKeys.bootstrap());

  return useQuery({
    queryKey: salesQueryKeys.rates(),
    queryFn: fetchSalesRates,
    enabled: enabled && !hasBootstrap,
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

function invalidateBootstrapAndSlices(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: salesQueryKeys.bootstrap() });
  void queryClient.invalidateQueries({ queryKey: salesQueryKeys.masters() });
  void queryClient.invalidateQueries({ queryKey: salesQueryKeys.rates() });
}

/** Invalidate quotation dropdown masters after master-data admin changes. */
export function useInvalidateSalesMasters() {
  const queryClient = useQueryClient();
  return () => invalidateBootstrapAndSlices(queryClient);
}

/** Invalidate forecasts list after CRUD / workflow actions (masters/bootstrap unchanged). */
export function useInvalidateSalesForecasts() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: salesQueryKeys.forecasts() });
    void queryClient.invalidateQueries({ queryKey: salesQueryKeys.forecastsInfinite() });
  };
}

export function useInvalidateSalesRates() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: salesQueryKeys.rates() });
    void queryClient.invalidateQueries({ queryKey: salesQueryKeys.bootstrap() });
  };
}

export function useInvalidateSalesBootstrap() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: salesQueryKeys.bootstrap() });
}

export type { ExchangeRatesMap };
