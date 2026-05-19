/** Stable query keys for sales forecasting server state. */
export const salesQueryKeys = {
  all: ['sales'] as const,
  forecasts: () => [...salesQueryKeys.all, 'forecasts'] as const,
  masters: () => [...salesQueryKeys.all, 'masters'] as const,
  rates: () => [...salesQueryKeys.all, 'rates'] as const,
  masterAdminList: (category: string) =>
    [...salesQueryKeys.all, 'master-admin', 'list', category] as const,
  masterAdminPrincipals: () => [...salesQueryKeys.all, 'master-admin', 'principals'] as const,
};
