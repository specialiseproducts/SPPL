export const payrollQueryKeys = {
  all: ['payroll'] as const,
  employees: () => [...payrollQueryKeys.all, 'employees'] as const,
  mappings: () => [...payrollQueryKeys.all, 'mappings'] as const,
  myLeaveRequests: (year: number, month: number) =>
    [...payrollQueryKeys.all, 'leaveRequests', 'me', year, month] as const,
  pendingLeaveApprovals: () =>
    [...payrollQueryKeys.all, 'leaveRequests', 'pendingApprovals'] as const,
  teamMemberLeaveRequests: (employeeCode: string, year: number, month: number) =>
    [...payrollQueryKeys.all, 'leaveRequests', 'team', employeeCode, year, month] as const,
};
