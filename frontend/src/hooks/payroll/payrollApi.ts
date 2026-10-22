import { apiFetch } from '../../services/api';
import type {
  CreatePayrollLeaveRequestBody,
  PayrollLeaveRequest,
  PayrollTeamMapping,
} from '../../types/payroll';
import type { EmployeeListDto } from '../../types/employeeListDto';
import type { UserMaster } from '../../types/userMaster';
import { mapApiEmployee } from '../../utils/mapApiEmployee';
import { fetchPaginatedList } from '../../utils/paginatedFetch';

/** Loads all employee pages via payroll-scoped directory (not User Management). */
export async function fetchPayrollEmployeesList(): Promise<UserMaster[]> {
  const all: UserMaster[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPaginatedList<EmployeeListDto>('/api/payroll/employees', cursor);
    all.push(...page.data.map((emp) => mapApiEmployee(emp)));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

export async function fetchPayrollTeamMappings(): Promise<PayrollTeamMapping[]> {
  const res = (await apiFetch('/api/payroll/team-mappings')) as {
    data?: { mappings?: PayrollTeamMapping[] };
  };
  return res?.data?.mappings ?? [];
}

export async function assignPayrollTeamMapping(body: {
  managerCode: string;
  managerName: string;
  employeeCode: string;
  employeeName: string;
}): Promise<PayrollTeamMapping> {
  const res = (await apiFetch('/api/payroll/team-mappings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })) as { data?: { mapping?: PayrollTeamMapping } };
  if (!res?.data?.mapping) throw new Error('Assign failed');
  return res.data.mapping;
}

export async function removePayrollTeamMapping(mappingId: string): Promise<void> {
  await apiFetch(`/api/payroll/team-mappings/${encodeURIComponent(mappingId)}`, {
    method: 'DELETE',
  });
}

export async function transferPayrollTeamMapping(
  mappingId: string,
  managerCode: string,
  managerName: string,
): Promise<PayrollTeamMapping> {
  const res = (await apiFetch(
    `/api/payroll/team-mappings/${encodeURIComponent(mappingId)}/transfer`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerCode, managerName }),
    },
  )) as { data?: { mapping?: PayrollTeamMapping } };
  if (!res?.data?.mapping) throw new Error('Transfer failed');
  return res.data.mapping;
}

export async function fetchMyLeaveRequests(params: {
  year: number;
  month: number;
}): Promise<PayrollLeaveRequest[]> {
  const qs = new URLSearchParams({
    year: String(params.year),
    month: String(params.month),
  });
  const res = (await apiFetch(`/api/payroll/leave-requests/me?${qs.toString()}`)) as {
    data?: { leaveRequests?: PayrollLeaveRequest[] };
  };
  return res?.data?.leaveRequests ?? [];
}

export async function createPayrollLeaveRequest(
  body: CreatePayrollLeaveRequestBody,
): Promise<PayrollLeaveRequest> {
  const res = (await apiFetch('/api/payroll/leave-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })) as { data?: { leaveRequest?: PayrollLeaveRequest } };
  if (!res?.data?.leaveRequest) throw new Error('Leave request failed');
  return res.data.leaveRequest;
}

export async function updatePayrollLeaveRequest(
  leaveRequestId: string,
  body: CreatePayrollLeaveRequestBody,
): Promise<PayrollLeaveRequest> {
  const res = (await apiFetch(
    `/api/payroll/leave-requests/${encodeURIComponent(leaveRequestId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )) as { data?: { leaveRequest?: PayrollLeaveRequest } };
  if (!res?.data?.leaveRequest) throw new Error('Leave update failed');
  return res.data.leaveRequest;
}

export async function deletePayrollLeaveRequest(leaveRequestId: string): Promise<void> {
  await apiFetch(`/api/payroll/leave-requests/${encodeURIComponent(leaveRequestId)}`, {
    method: 'DELETE',
  });
}

export async function fetchPendingLeaveApprovals(): Promise<PayrollLeaveRequest[]> {
  const res = (await apiFetch('/api/payroll/leave-requests/pending-approvals')) as {
    data?: { leaveRequests?: PayrollLeaveRequest[] };
  };
  return res?.data?.leaveRequests ?? [];
}

export async function fetchTeamMemberLeaveRequests(params: {
  employeeCode: string;
  year: number;
  month: number;
}): Promise<PayrollLeaveRequest[]> {
  const qs = new URLSearchParams({
    year: String(params.year),
    month: String(params.month),
  });
  const res = (await apiFetch(
    `/api/payroll/leave-requests/team/${encodeURIComponent(params.employeeCode)}?${qs.toString()}`,
  )) as { data?: { leaveRequests?: PayrollLeaveRequest[] } };
  return res?.data?.leaveRequests ?? [];
}

export async function approvePayrollLeaveRequest(
  leaveRequestId: string,
): Promise<PayrollLeaveRequest> {
  const res = (await apiFetch(
    `/api/payroll/leave-requests/${encodeURIComponent(leaveRequestId)}/approve`,
    { method: 'POST' },
  )) as { data?: { leaveRequest?: PayrollLeaveRequest } };
  if (!res?.data?.leaveRequest) throw new Error('Leave approval failed');
  return res.data.leaveRequest;
}

export async function rejectPayrollLeaveRequest(
  leaveRequestId: string,
  reason: string,
): Promise<PayrollLeaveRequest> {
  const res = (await apiFetch(
    `/api/payroll/leave-requests/${encodeURIComponent(leaveRequestId)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  )) as { data?: { leaveRequest?: PayrollLeaveRequest } };
  if (!res?.data?.leaveRequest) throw new Error('Leave rejection failed');
  return res.data.leaveRequest;
}
