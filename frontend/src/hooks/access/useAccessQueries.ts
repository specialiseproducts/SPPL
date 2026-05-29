import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryDefaults } from '../queryDefaults';
import { fetchAccessRules } from './accessApi';
import { accessQueryKeys } from './accessQueryKeys';

export function useAccessRulesQuery() {
  return useQuery({
    queryKey: accessQueryKeys.all,
    queryFn: fetchAccessRules,
    ...queryDefaults.reference,
  });
}

export function useInvalidateAccessRules() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: accessQueryKeys.all });
}
