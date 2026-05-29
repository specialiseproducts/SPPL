import { keepPreviousData } from '@tanstack/react-query';

/** Shared TanStack Query options — keeps cache behavior consistent across modules. */
export const queryDefaults = {
  /** List endpoints (expenses, sales forecasts, purchases) */
  list: {
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  },
  /** Reference / master data */
  reference: {
    staleTime: 8 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  },
  /** Employees directory — single shared cache key: ['employees'] */
  employees: {
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  },
  /** Sales bootstrap (masters + rates) — long-lived cache */
  salesBootstrap: {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  },
  /** Sales opportunities list (infinite query) */
  salesForecasts: {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  },
} as const;
