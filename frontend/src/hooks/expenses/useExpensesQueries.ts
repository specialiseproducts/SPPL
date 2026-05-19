import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryDefaults } from '../queryDefaults';
import { fetchExpensesList, fetchExpenseTravelRates } from './expensesApi';
import { expensesQueryKeys } from './expensesQueryKeys';

export function useExpensesListQuery() {
  return useQuery({
    queryKey: expensesQueryKeys.list(),
    queryFn: fetchExpensesList,
    ...queryDefaults.list,
  });
}

export function useExpenseTravelRatesQuery(enabled: boolean) {
  return useQuery({
    queryKey: expensesQueryKeys.travelRates(),
    queryFn: fetchExpenseTravelRates,
    enabled,
    ...queryDefaults.reference,
  });
}

export function useInvalidateExpensesList() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: expensesQueryKeys.list() });
}

export function useInvalidateExpenseTravelRates() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: expensesQueryKeys.travelRates() });
}
