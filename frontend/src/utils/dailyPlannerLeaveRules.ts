/**
 * Daily Planner leave-aware working-hours and eligibility helpers (client).
 * Leave records come from Payroll via listApprovedLeaveForPlanner.
 */

import type { PayrollHalfDayPeriod, PayrollLeaveRequest } from '../types/payroll';
import { isApprovedLeaveStatus, leaveCoversDate } from './payrollLeaveDates';
import { formatDurationLabel } from './planningRecognition';

export const MIN_PLANNED_MINUTES_OFFICE = 450;
export const MIN_PLANNED_MINUTES_FACTORY = 420;
/** Approved first/second half leave: 4 hours for Office and Factory. */
export const MIN_PLANNED_MINUTES_OFFICE_HALF = 240;
export const MIN_PLANNED_MINUTES_FACTORY_HALF = 240;

export const FULL_DAY_LEAVE_TASK_BLOCKED_MESSAGE =
  'Cannot create or reschedule tasks onto an approved full-day leave date. Choose the next working day after leave.';

export const FULL_DAY_LEAVE_NO_PLANNING_MESSAGE =
  'This employee is on approved full-day leave for this date. Daily Planner tasks are not required and cannot be created.';

export type PlannerLeaveKind = 'none' | 'full' | 'half';

export type PlannerLeaveClassification = {
  kind: PlannerLeaveKind;
  halfPeriod: PayrollHalfDayPeriod | null;
  request: PayrollLeaveRequest | null;
};

export function isFullDayLeaveType(leaveType?: string | null): boolean {
  const type = String(leaveType || '').trim();
  return type === 'one_day' || type === 'multiple_day';
}

export function isHalfDayLeaveType(leaveType?: string | null): boolean {
  return String(leaveType || '').trim() === 'half_day';
}

export function classifyApprovedLeaveForDate(
  leaveRequests: PayrollLeaveRequest[] | null | undefined,
  dateIso: string,
): PlannerLeaveClassification {
  const day = String(dateIso || '').trim().slice(0, 10);
  const covering = (leaveRequests || []).filter(
    (row) =>
      isApprovedLeaveStatus(row?.status) &&
      leaveCoversDate(row.startDate, row.endDate, day),
  );

  const full = covering.find((row) => isFullDayLeaveType(row.leaveType));
  if (full) {
    return { kind: 'full', halfPeriod: null, request: full };
  }

  const half = covering.find((row) => isHalfDayLeaveType(row.leaveType));
  if (half) {
    const period: PayrollHalfDayPeriod =
      String(half.halfDayPeriod || '').trim() === 'second_half' ? 'second_half' : 'first_half';
    return { kind: 'half', halfPeriod: period, request: half };
  }

  return { kind: 'none', halfPeriod: null, request: null };
}

function normalizeLocation(location?: string | null): 'Office' | 'Factory' {
  return String(location || '').trim() === 'Factory' ? 'Factory' : 'Office';
}

export function getMinPlannedMinutesForLocation(
  location?: string | null,
  leaveKind: PlannerLeaveKind = 'none',
): number {
  if (leaveKind === 'full') return 0;
  const loc = normalizeLocation(location);
  if (leaveKind === 'half') {
    return loc === 'Factory' ? MIN_PLANNED_MINUTES_FACTORY_HALF : MIN_PLANNED_MINUTES_OFFICE_HALF;
  }
  return loc === 'Factory' ? MIN_PLANNED_MINUTES_FACTORY : MIN_PLANNED_MINUTES_OFFICE;
}

export function getMinPlannedHoursForLeaveAwareLocation(
  location?: string | null,
  leaveKind: PlannerLeaveKind = 'none',
): number {
  return getMinPlannedMinutesForLocation(location, leaveKind) / 60;
}

export function buildLeaveAwareMinimumHoursRequirementMessage(
  location?: string | null,
  leaveKind: PlannerLeaveKind = 'none',
): string {
  if (leaveKind === 'full') return FULL_DAY_LEAVE_NO_PLANNING_MESSAGE;
  const minHours = getMinPlannedHoursForLeaveAwareLocation(location, leaveKind);
  if (leaveKind === 'half') {
    return `Your minimum total hours planning is not completed. Please plan ${formatDurationLabel(minHours)}.`;
  }
  if (minHours === 7.5) {
    return 'Your minimum total hours planning is not completed. Please plan 7 Hours 30 Minutes.';
  }
  if (minHours === 7) {
    return 'Your minimum total hours planning is not completed. Please plan 7 Hours.';
  }
  return `Your minimum total hours planning is not completed. Please plan ${formatDurationLabel(minHours)}.`;
}

/** Partition leave rows for Daily Planner half-cell layout. */
export function partitionLeavesForPlannerCell(leaves: PayrollLeaveRequest[]): {
  fullDay: PayrollLeaveRequest[];
  firstHalf: PayrollLeaveRequest[];
  secondHalf: PayrollLeaveRequest[];
} {
  const fullDay: PayrollLeaveRequest[] = [];
  const firstHalf: PayrollLeaveRequest[] = [];
  const secondHalf: PayrollLeaveRequest[] = [];
  for (const request of leaves || []) {
    if (isHalfDayLeaveType(request.leaveType)) {
      if (String(request.halfDayPeriod || '').trim() === 'second_half') {
        secondHalf.push(request);
      } else {
        firstHalf.push(request);
      }
    } else {
      fullDay.push(request);
    }
  }
  return { fullDay, firstHalf, secondHalf };
}
