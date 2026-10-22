import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  useInvalidatePayrollQueries,
  usePayrollTeamMappingsQuery,
  useTeamMemberLeaveRequestsQuery,
} from '../../hooks/payroll/usePayrollQueries';
import { useInvalidateDailyPlannerQueries } from '../../hooks/dailyPlanner/useDailyPlannerQueries';
import { useEmployeesListQuery } from '../../hooks/employees/useEmployeesQuery';
import {
  getEmployeeExitDate,
  isEmployeeActiveOnDate,
  todayLocalDateKey,
} from '../../utils/employeeActiveStatus';
import { isQueryColdLoading } from '../../utils/queryLoading';
import type { PayrollLeaveRequest } from '../../types/payroll';
import HolidayMonthCalendar from '../calendar/HolidayMonthCalendar';
import type { HolidayCalendarDayCell } from '../calendar/holidayMonthGrid';
import LeaveCalendarEventBlock from './LeaveCalendarEventBlock';
import LeaveApprovalDetailDialog from './LeaveApprovalDetailDialog';
import PayrollLeaveApprovalsPanel from './PayrollLeaveApprovalsPanel';

/**
 * Payroll → Team Calendar.
 * Same calendar chrome as My Calendar for the selected team member, plus a
 * Pending Leave Approval panel (Team Daily Planner pattern).
 */
export default function TeamCalendarTab() {
  const { user } = useAuth();
  const managerCode = String(user?.employeeCode || user?.id || '').trim();
  const now = new Date();
  const [view, setView] = useState({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  });
  const { year, month } = view;
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState('');
  const [detailRequest, setDetailRequest] = useState<PayrollLeaveRequest | null>(null);
  const invalidate = useInvalidatePayrollQueries();
  const invalidateDailyPlanner = useInvalidateDailyPlannerQueries();

  const mappingsQuery = usePayrollTeamMappingsQuery();
  const employeesQuery = useEmployeesListQuery();
  const leaveQuery = useTeamMemberLeaveRequestsQuery(
    selectedEmployeeCode,
    year,
    month,
    Boolean(selectedEmployeeCode),
  );

  const employeeOptions = useMemo(() => {
    const mappings = mappingsQuery.data ?? [];
    const employees = employeesQuery.data ?? [];
    const todayKey = todayLocalDateKey();
    return mappings
      .filter((m) => m.status === 'Active' && m.managerCode === managerCode)
      .filter((m) => {
        const code = String(m.employeeCode || '').trim();
        const emp = employees.find((e) => {
          const empCode = String(e.employee_code || e.employeeCode || '').trim();
          return empCode === code;
        });
        // Active/current selector only — former employees (exit today or earlier) excluded.
        if (!emp) return false;
        return isEmployeeActiveOnDate(getEmployeeExitDate(emp), todayKey);
      })
      .map((m) => ({
        value: m.employeeCode,
        label: m.employeeName || m.employeeCode,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [mappingsQuery.data, managerCode, employeesQuery.data]);

  useEffect(() => {
    if (employeeOptions.length === 0) {
      setSelectedEmployeeCode('');
      return;
    }
    setSelectedEmployeeCode((current) => {
      if (current && employeeOptions.some((option) => option.value === current)) return current;
      return employeeOptions[0].value;
    });
  }, [employeeOptions]);

  const selectedEmployeeLocation = useMemo(() => {
    const code = String(selectedEmployeeCode || '').trim();
    if (!code) return undefined;
    const mapping = (mappingsQuery.data ?? []).find(
      (m) =>
        String(m.employeeCode || '').trim() === code &&
        String(m.managerCode || '').trim() === managerCode,
    );
    if (mapping?.location) return mapping.location;
    const emp = (employeesQuery.data ?? []).find((e) => {
      const empCode = String(e.employee_code || e.employeeCode || '').trim();
      return empCode === code;
    });
    return emp?.location || undefined;
  }, [selectedEmployeeCode, mappingsQuery.data, employeesQuery.data, managerCode]);

  const leaveRequests = leaveQuery.data ?? [];

  const leavesByDate = useMemo(() => {
    const map = new Map<string, PayrollLeaveRequest[]>();
    for (const request of leaveRequests) {
      const start = String(request.startDate || '').slice(0, 10);
      const end = String(request.endDate || '').slice(0, 10);
      if (!start || !end || end < start) continue;
      const cursor = new Date(`${start}T00:00:00.000Z`);
      const last = new Date(`${end}T00:00:00.000Z`);
      while (cursor.getTime() <= last.getTime()) {
        const key = cursor.toISOString().slice(0, 10);
        if (!map.has(key)) map.set(key, []);
        const bucket = map.get(key)!;
        if (!bucket.some((r) => r.leaveRequestId === request.leaveRequestId)) {
          bucket.push(request);
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    return map;
  }, [leaveRequests]);

  const refreshLeaves = useCallback(() => {
    invalidate();
    invalidateDailyPlanner();
    void leaveQuery.refetch({ cancelRefetch: false });
  }, [invalidate, invalidateDailyPlanner, leaveQuery]);

  const renderDayContent = useCallback(
    (cell: HolidayCalendarDayCell) => {
      if (!cell.inMonth) return null;
      const dayLeaves = leavesByDate.get(cell.iso) ?? [];
      if (dayLeaves.length === 0) return null;
      return (
        <div
          className="flex min-h-0 w-full min-w-0 flex-col items-stretch gap-1"
          style={{ flex: '1 1 0', height: '100%' }}
        >
          {dayLeaves.map((request) => (
            <LeaveCalendarEventBlock
              key={`${request.leaveRequestId}-${cell.iso}`}
              request={request}
              onOpen={(req) => {
                // Pending leaves open approval detail; approved/rejected are view-only via same dialog
                // (Approve/Reject only shown while Pending in LeaveApprovalDetailDialog).
                if (String(req.status || '').trim() === 'Pending') {
                  setDetailRequest(req);
                }
              }}
            />
          ))}
        </div>
      );
    },
    [leavesByDate],
  );

  const isLoading =
    isQueryColdLoading(mappingsQuery) ||
    isQueryColdLoading(employeesQuery) ||
    (Boolean(selectedEmployeeCode) && isQueryColdLoading(leaveQuery));

  return (
    <div className="w-full space-y-3 pb-6">
      <PayrollLeaveApprovalsPanel onDecided={refreshLeaves} />

      <HolidayMonthCalendar
        year={year}
        month={month}
        location={selectedEmployeeLocation}
        onViewChange={setView}
        loading={isLoading}
        loadingLabel="Loading team calendar…"
        trailingControls={
          <select
            className="border-input bg-background h-9 min-w-[10rem] rounded-md border px-2 text-sm"
            value={selectedEmployeeCode}
            onChange={(e) => setSelectedEmployeeCode(e.target.value)}
            aria-label="Employee"
            disabled={employeeOptions.length === 0}
          >
            {employeeOptions.length === 0 ? (
              <option value="">No team members</option>
            ) : (
              employeeOptions.map((emp) => (
                <option key={emp.value} value={emp.value}>
                  {emp.label}
                </option>
              ))
            )}
          </select>
        }
        renderDayContent={renderDayContent}
      />

      {!isLoading && employeeOptions.length === 0 ? (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          No active Payroll team members mapped for your account. Assign employees in Payroll Team.
        </p>
      ) : null}

      <LeaveApprovalDetailDialog
        open={Boolean(detailRequest)}
        request={detailRequest}
        onClose={() => setDetailRequest(null)}
        onDecided={refreshLeaves}
      />
    </div>
  );
}
