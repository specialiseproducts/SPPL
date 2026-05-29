export const purchasesQueryKeys = {
  all: ['purchases'] as const,
  list: () => [...purchasesQueryKeys.all, 'list'] as const,
  listInfinite: () => [...purchasesQueryKeys.all, 'list', 'infinite'] as const,
};
