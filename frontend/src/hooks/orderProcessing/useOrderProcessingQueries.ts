import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderProcessingQueryKeys } from './orderProcessingQueryKeys';
import { queryDefaults } from '../queryDefaults';
import { fetchMyOrders, fetchOrderById } from './orderProcessingApi';

export function useMyOrdersQuery(enabled = true) {
  return useQuery({
    queryKey: orderProcessingQueryKeys.myOrders(),
    queryFn: fetchMyOrders,
    enabled,
    ...queryDefaults.list,
  });
}

export function useOrderDetailQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: orderProcessingQueryKeys.detail(id),
    queryFn: () => fetchOrderById(id),
    enabled: enabled && !!id,
    ...queryDefaults.reference,
  });
}

export function useInvalidateOrderProcessing() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orderProcessingQueryKeys.all });
  };
}
