import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../services/api';
import type { UserMaster } from '../../types/userMaster';
import { mapApiEmployee } from '../../utils/mapApiEmployee';
import { queryDefaults } from '../queryDefaults';
import { employeesQueryKeys } from './employeesQueryKeys';

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
    ...queryDefaults.employees,
  });
}

export function useInvalidateEmployeesList() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: employeesQueryKeys.list() });
}
