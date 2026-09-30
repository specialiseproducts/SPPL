/** Stable query keys for expenses module server state. */
export const expensesQueryKeys = {
  all: ['expenses'] as const,
  list: () => [...expensesQueryKeys.all, 'list'] as const,
  listInfinite: () => [...expensesQueryKeys.all, 'list', 'infinite'] as const,
  auditListInfinite: () => [...expensesQueryKeys.all, 'audit', 'infinite'] as const,
  auditList: () => [...expensesQueryKeys.all, 'audit', 'list'] as const,
  auditEmployees: () => [...expensesQueryKeys.all, 'audit', 'employees'] as const,
  auditFiltered: (filters: { employeeId: string; month: string; year: string }) =>
    [...expensesQueryKeys.all, 'audit', 'filtered', filters] as const,
  auditApprovedTotal: (filters: { employeeId: string; month: string; year: string }) =>
    [...expensesQueryKeys.all, 'audit', 'approved-total', filters] as const,
  serviceProviderMasters: () =>
    [...expensesQueryKeys.all, 'masters', 'service-providers'] as const,
  locationMasters: () => [...expensesQueryKeys.all, 'masters', 'locations'] as const,
  travelRates: () => [...expensesQueryKeys.all, 'travel-rates'] as const,
  companyOverview: (range?: {
    from: string;
    to: string;
    employeeCode?: string;
    location?: string;
  }) =>
    [
      ...expensesQueryKeys.all,
      'dashboard',
      'company-overview',
      range?.from ?? '',
      range?.to ?? '',
      range?.employeeCode ?? '',
      range?.location ?? '',
    ] as const,
  dashboardEmployees: () =>
    [...expensesQueryKeys.all, 'dashboard', 'employees'] as const,
  expenseHeadAnalysis: (params?: {
    from: string;
    to: string;
    expenseHead: string;
    employeeCode?: string;
    location?: string;
  }) =>
    [
      ...expensesQueryKeys.all,
      'dashboard',
      'expense-head-analysis',
      params?.from ?? '',
      params?.to ?? '',
      params?.expenseHead ?? '',
      params?.employeeCode ?? '',
      params?.location ?? '',
    ] as const,
  expenseSubcategoryAnalysis: (params?: {
    from: string;
    to: string;
    expenseHead: string;
    subCategory: string;
    employeeCode?: string;
    location?: string;
  }) =>
    [
      ...expensesQueryKeys.all,
      'dashboard',
      'expense-subcategory-analysis',
      params?.from ?? '',
      params?.to ?? '',
      params?.expenseHead ?? '',
      params?.subCategory ?? '',
      params?.employeeCode ?? '',
      params?.location ?? '',
    ] as const,
};
