import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../services/api';
import type { UserMaster } from '../../types/userMaster';
import { mapApiEmployee } from '../../utils/mapApiEmployee';
import { employeesQueryKeys } from './employeesQueryKeys';

const EMPLOYEES_LIST_STALE_MS = 60 * 1000;

export async function fetchEmployeesList(): Promise<UserMaster[]> {
  const data = await apiFetch('/api/employees');
  const apiEmployees = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.data?.items)
      ? data.data.items
      : [];
  return apiEmployees.map((emp: Record<string, unknown>) => mapApiEmployee(emp));
}

export function useEmployeesListQuery() {
  return useQuery({
    queryKey: employeesQueryKeys.list(),
    queryFn: fetchEmployeesList,
    staleTime: EMPLOYEES_LIST_STALE_MS,
    placeholderData: (previous) => previous,
  });
}

export function useInvalidateEmployeesList() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: employeesQueryKeys.list() });
}
