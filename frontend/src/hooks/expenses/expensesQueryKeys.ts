/** Stable query keys for expenses module server state. */
export const expensesQueryKeys = {
  all: ['expenses'] as const,
  list: () => [...expensesQueryKeys.all, 'list'] as const,
  travelRates: () => [...expensesQueryKeys.all, 'travel-rates'] as const,
};
