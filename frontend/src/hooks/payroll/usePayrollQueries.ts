import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryDefaults } from '../queryDefaults';
import {
  fetchMyLeaveRequests,
  fetchPendingLeaveApprovals,
  fetchPayrollEmployeesList,
  fetchPayrollTeamMappings,
  fetchTeamMemberLeaveRequests,
} from './payrollApi';
import { payrollQueryKeys } from './payrollQueryKeys';

/** Full employee directory for Payroll Team assign/transfer — payroll auth, not User Management. */
export function usePayrollEmployeesListQuery(enabled = true) {
  return useQuery({
    queryKey: payrollQueryKeys.employees(),
    queryFn: fetchPayrollEmployeesList,
    enabled,
    ...queryDefaults.reference,
  });
}

export function usePayrollTeamMappingsQuery(enabled = true) {
  return useQuery({
    queryKey: payrollQueryKeys.mappings(),
    queryFn: fetchPayrollTeamMappings,
    enabled,
    ...queryDefaults.reference,
  });
}

export function useMyLeaveRequestsQuery(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: payrollQueryKeys.myLeaveRequests(year, month),
    queryFn: () => fetchMyLeaveRequests({ year, month }),
    enabled: enabled && year > 0 && month >= 1 && month <= 12,
    ...queryDefaults.list,
    refetchOnMount: 'always',
  });
}

export function usePendingLeaveApprovalsQuery(enabled = true) {
  return useQuery({
    queryKey: payrollQueryKeys.pendingLeaveApprovals(),
    queryFn: fetchPendingLeaveApprovals,
    enabled,
    ...queryDefaults.list,
    refetchOnMount: 'always',
  });
}

export function useTeamMemberLeaveRequestsQuery(
  employeeCode: string,
  year: number,
  month: number,
  enabled = true,
) {
  const code = String(employeeCode || '').trim();
  return useQuery({
    queryKey: payrollQueryKeys.teamMemberLeaveRequests(code, year, month),
    queryFn: () => fetchTeamMemberLeaveRequests({ employeeCode: code, year, month }),
    enabled: enabled && Boolean(code) && year > 0 && month >= 1 && month <= 12,
    ...queryDefaults.list,
    refetchOnMount: 'always',
  });
}

export function useInvalidatePayrollQueries() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
  };
}
