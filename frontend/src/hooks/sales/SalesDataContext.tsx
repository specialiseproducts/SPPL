import { createContext, useContext, type ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ExchangeRatesMap, SalesOpportunity } from '../../types/salesForecast';
import type { MastersState } from '../../components/sales/SalesForecastingOpportunityFormModal';
import {
  useSalesBootstrapQuery,
  useSalesForecastsListRows,
} from './useSalesQueries';
import { emptyMastersState, DEFAULT_EXCHANGE_RATES } from './salesApi';
import { isQueryColdLoading } from '../../utils/queryLoading';

type BootstrapData = {
  masters: MastersState;
  rates: ExchangeRatesMap;
};

type ForecastsListQuery = ReturnType<typeof useSalesForecastsListRows>;

export type SalesDataContextValue = {
  bootstrapQuery: UseQueryResult<BootstrapData>;
  forecastsQuery: ForecastsListQuery;
  opportunities: SalesOpportunity[];
  masters: MastersState;
  rates: ExchangeRatesMap;
  isColdLoading: boolean;
};

const SalesDataContext = createContext<SalesDataContextValue | null>(null);

/** Single subscription for bootstrap + forecasts (shared across My/Team tabs). */
export function SalesDataProvider({ children }: { children: ReactNode }) {
  const bootstrapQuery = useSalesBootstrapQuery();
  const forecastsQuery = useSalesForecastsListRows();

  const opportunities = forecastsQuery.opportunities;
  const masters = bootstrapQuery.data?.masters ?? emptyMastersState();
  const rates = bootstrapQuery.data?.rates ?? DEFAULT_EXCHANGE_RATES;
  const isColdLoading =
    isQueryColdLoading(bootstrapQuery) ||
    (forecastsQuery.isPending && !forecastsQuery.data);

  const value: SalesDataContextValue = {
    bootstrapQuery,
    forecastsQuery,
    opportunities,
    masters,
    rates,
    isColdLoading,
  };

  return <SalesDataContext.Provider value={value}>{children}</SalesDataContext.Provider>;
}

export function useSalesData(): SalesDataContextValue {
  const ctx = useContext(SalesDataContext);
  if (!ctx) {
    throw new Error('useSalesData must be used within SalesDataProvider');
  }
  return ctx;
}
