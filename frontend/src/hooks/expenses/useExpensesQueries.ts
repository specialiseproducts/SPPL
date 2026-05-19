import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchExpensesList, fetchExpenseTravelRates } from './expensesApi';
import { expensesQueryKeys } from './expensesQueryKeys';

const EXPENSES_LIST_STALE_MS = 60 * 1000;
const TRAVEL_RATES_STALE_MS = 10 * 60 * 1000;

export function useExpensesListQuery() {
  return useQuery({
    queryKey: expensesQueryKeys.list(),
    queryFn: fetchExpensesList,
    staleTime: EXPENSES_LIST_STALE_MS,
    placeholderData: (previous) => previous,
  });
}

export function useExpenseTravelRatesQuery(enabled: boolean) {
  return useQuery({
    queryKey: expensesQueryKeys.travelRates(),
    queryFn: fetchExpenseTravelRates,
    enabled,
    staleTime: TRAVEL_RATES_STALE_MS,
    placeholderData: (previous) => previous,
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
