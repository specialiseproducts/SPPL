/** Stable query keys for expenses module server state. */
export const expensesQueryKeys = {
  all: ['expenses'] as const,
  list: () => [...expensesQueryKeys.all, 'list'] as const,
  listInfinite: () => [...expensesQueryKeys.all, 'list', 'infinite'] as const,
  auditListInfinite: () => [...expensesQueryKeys.all, 'audit', 'infinite'] as const,
  auditList: () => [...expensesQueryKeys.all, 'audit', 'list'] as const,
  auditFiltered: (filters: { employeeId: string; month: string; year: string }) =>
    [...expensesQueryKeys.all, 'audit', 'filtered', filters] as const,
  travelRates: () => [...expensesQueryKeys.all, 'travel-rates'] as const,
};
