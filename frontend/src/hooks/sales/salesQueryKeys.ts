/**
 * Client view scope (my vs team tab). API returns the same role-scoped payload;
 * filtering by ownership stays on the client.
 */
export type SalesBootstrapViewMode = 'self' | 'team' | 'user';

/** Stable query keys for sales forecasting server state. */
export const salesQueryKeys = {
  all: ['sales'] as const,
  /** Single shared bootstrap cache — avoids duplicate fetches when admin tabs are both mounted. */
  bootstrap: () => [...salesQueryKeys.all, 'bootstrap'] as const,
  forecasts: () => [...salesQueryKeys.all, 'forecasts'] as const,
  forecastsInfinite: () => [...salesQueryKeys.all, 'forecasts', 'infinite'] as const,
  masters: () => [...salesQueryKeys.all, 'masters'] as const,
  rates: () => [...salesQueryKeys.all, 'rates'] as const,
  masterAdminList: (category: string) =>
    [...salesQueryKeys.all, 'master-admin', 'list', category] as const,
  masterAdminPrincipals: () => [...salesQueryKeys.all, 'master-admin', 'principals'] as const,
  masterAdminOrganizations: () => [...salesQueryKeys.all, 'master-admin', 'organizations'] as const,
  masterAdminModels: (principalId: string) =>
    [...salesQueryKeys.all, 'master-admin', 'models', principalId] as const,
  masterAdminParts: (organizationId: string) =>
    [...salesQueryKeys.all, 'master-admin', 'parts', organizationId] as const,
  modelsByPrincipal: (principalId: string, activeOnly: boolean) =>
    [...salesQueryKeys.all, 'models', principalId, activeOnly] as const,
  plannerOrganizations: () => [...salesQueryKeys.all, 'planner', 'organizations'] as const,
  plannerMonth: (year: number, month: number, employeeCode?: string) =>
    [...salesQueryKeys.all, 'planner', 'month', year, month, employeeCode || 'self'] as const,
};
