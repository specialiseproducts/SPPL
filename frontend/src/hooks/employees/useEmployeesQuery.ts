import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPaginatedList } from '../../utils/paginatedFetch';
import { apiFetch } from '../../services/api';
import type { EmployeeListDto } from '../../types/employeeListDto';
import type { UserMaster } from '../../types/userMaster';
import { mapApiEmployee } from '../../utils/mapApiEmployee';
import { queryDefaults } from '../queryDefaults';
import { employeesQueryKeys } from './employeesQueryKeys';

async function fetchEmployeesPage(cursor?: string) {
  const page = await fetchPaginatedList<EmployeeListDto>('/api/employees', cursor);
  return {
    data: page.data.map((emp) => mapApiEmployee(emp)),
    nextCursor: page.nextCursor,
  };
}

/** Loads all employee pages (for filter dropdowns / modals). */
export async function fetchEmployeesList(): Promise<UserMaster[]> {
  const all: UserMaster[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchEmployeesPage(cursor);
    all.push(...page.data);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

export function useEmployeesInfiniteQuery() {
  return useInfiniteQuery({
    queryKey: employeesQueryKeys.infinite(),
    queryFn: ({ pageParam }) => fetchEmployeesPage(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    ...queryDefaults.employees,
  });
}

/** Full directory for dropdowns — cached reference query. */
export function useEmployeesListQuery() {
  return useQuery({
    queryKey: employeesQueryKeys.all,
    queryFn: fetchEmployeesList,
    ...queryDefaults.employees,
  });
}

export function useEmployeesDirectoryRows() {
  const query = useEmployeesInfiniteQuery();
  const employees = query.data?.pages.flatMap((p) => p.data) ?? [];
  return { ...query, employees };
}

/** Alias for shared employees query — same cache as `useEmployeesListQuery`. */
export const useEmployeesQuery = useEmployeesListQuery;

export function useInvalidateEmployeesList() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: employeesQueryKeys.all });
    void queryClient.invalidateQueries({ queryKey: employeesQueryKeys.infinite() });
  };
}
