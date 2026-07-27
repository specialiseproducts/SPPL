export const orderProcessingQueryKeys = {
  all: ['orderProcessing'] as const,
  myOrders: () => [...orderProcessingQueryKeys.all, 'my-orders'] as const,
  detail: (id: string) => [...orderProcessingQueryKeys.all, 'detail', id] as const,
};
