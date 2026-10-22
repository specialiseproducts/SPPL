/** Payroll-specific team mapping (isolated from DailyPlannerTeamMapping). */
export interface PayrollTeamMapping {
  mappingId: string;
  managerCode: string;
  managerName: string;
  employeeCode: string;
  employeeName: string;
  /** Canonical EmployeeMaster location (Office | Factory) for holiday rules. */
  location?: string;
  status: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PayrollLeaveType = 'one_day' | 'multiple_day' | 'half_day';
export type PayrollHalfDayPeriod = 'first_half' | 'second_half';
export type PayrollLeaveStatus = 'Pending' | 'Approved' | 'Rejected' | string;

/** Employee leave request (My Calendar + Team Calendar approvals). */
export interface PayrollLeaveRequest {
  leaveRequestId: string;
  employeeCode: string;
  employeeName: string;
  leaveType: PayrollLeaveType | string;
  startDate: string;
  endDate: string;
  halfDayPeriod?: PayrollHalfDayPeriod | string | null;
  reason: string;
  durationDays: number;
  status: PayrollLeaveStatus;
  advanceNoticeAcknowledged?: boolean;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
}

export interface CreatePayrollLeaveRequestBody {
  leaveType: PayrollLeaveType;
  startDate: string;
  endDate?: string;
  halfDayPeriod?: PayrollHalfDayPeriod;
  reason: string;
  advanceNoticeAcknowledged?: boolean;
}
