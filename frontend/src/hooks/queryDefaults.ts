/** Shared TanStack Query options — keeps cache behavior consistent across modules. */
export const queryDefaults = {
  /** List endpoints (expenses, sales forecasts, purchases) */
  list: {
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
  /** Reference / master data */
  reference: {
    staleTime: 8 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
  /** Employees directory */
  employees: {
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
} as const;
