/**
 * Daily Planner leave-aware working-hours and eligibility helpers.
 * Source of truth for leave records remains PayrollLeaveRequests (Approved only).
 */

import {
  HALF_DAY_PERIODS,
  LEAVE_TYPES,
  enumerateDateKeys,
} from './payrollLeaveDates.js';
import {
  getNextWorkingDayDateKey,
  normalizeEmployeeLocation,
} from './companyWorkingDays.js';

/** Approved first/second half leave: 4 hours (240 minutes) for Office and Factory. */
export const MIN_PLANNED_MINUTES_OFFICE = 450;
export const MIN_PLANNED_MINUTES_FACTORY = 420;
export const MIN_PLANNED_MINUTES_OFFICE_HALF = 240;
export const MIN_PLANNED_MINUTES_FACTORY_HALF = 240;
export const MIN_PLANNED_HOURS_OFFICE = 7.5;
export const MIN_PLANNED_HOURS_FACTORY = 7;

function formatDurationLabelFromHours(decimalHours) {
  const totalMinutes = Math.round((Number(decimalHours) || 0) * 60);
  const safe = Math.max(0, totalMinutes);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  const hLabel = hours === 1 ? '1 Hour' : `${hours} Hours`;
  if (minutes <= 0) return hLabel;
  const mLabel = minutes === 1 ? '1 Minute' : `${minutes} Minutes`;
  if (hours <= 0) return mLabel;
  return `${hLabel} ${mLabel}`;
}

export const FULL_DAY_LEAVE_TASK_BLOCKED_MESSAGE =
  'Cannot create or reschedule tasks onto an approved full-day leave date. Choose the next working day after leave.';

export const FULL_DAY_LEAVE_NO_PLANNING_MESSAGE =
  'This employee is on approved full-day leave for this date. Daily Planner tasks are not required and cannot be created.';

/** @typedef {'none' | 'full' | 'half'} PlannerLeaveKind */

export function isApprovedLeaveStatus(status) {
  return String(status || '').trim() === 'Approved';
}

export function isFullDayLeaveType(leaveType) {
  const type = String(leaveType || '').trim();
  return type === LEAVE_TYPES.ONE_DAY || type === LEAVE_TYPES.MULTIPLE_DAY;
}

export function isHalfDayLeaveType(leaveType) {
  return String(leaveType || '').trim() === LEAVE_TYPES.HALF_DAY;
}

export function leaveCoversDate(startDate, endDate, dateIso) {
  const day = String(dateIso || '').trim().slice(0, 10);
  const start = String(startDate || '').trim().slice(0, 10);
  const end = String(endDate || '').trim().slice(0, 10);
  if (!day || !start || !end) return false;
  return day >= start && day <= end;
}

/**
 * Classify approved leave covering a single date.
 * Full-day leave takes precedence over half-day when both exist.
 */
export function classifyApprovedLeaveForDate(leaveRequests, dateIso) {
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
    const period =
      String(half.halfDayPeriod || '').trim() === HALF_DAY_PERIODS.SECOND
        ? HALF_DAY_PERIODS.SECOND
        : HALF_DAY_PERIODS.FIRST;
    return { kind: 'half', halfPeriod: period, request: half };
  }

  return { kind: 'none', halfPeriod: null, request: null };
}

export function getMinPlannedMinutesForLocation(location, leaveKind = 'none') {
  const kind = String(leaveKind || 'none').trim();
  if (kind === 'full') return 0;
  const loc = normalizeEmployeeLocation(location);
  if (kind === 'half') {
    return loc === 'Factory' ? MIN_PLANNED_MINUTES_FACTORY_HALF : MIN_PLANNED_MINUTES_OFFICE_HALF;
  }
  return loc === 'Factory' ? MIN_PLANNED_MINUTES_FACTORY : MIN_PLANNED_MINUTES_OFFICE;
}

/** Decimal hours from exact minutes (half-day leave = 4.0 for Office and Factory). */
export function getMinPlannedHoursForLeaveAwareLocation(location, leaveKind = 'none') {
  return getMinPlannedMinutesForLocation(location, leaveKind) / 60;
}

export function buildLeaveAwareMinimumHoursRequirementMessage(location, leaveKind = 'none') {
  const kind = String(leaveKind || 'none').trim();
  if (kind === 'full') {
    return FULL_DAY_LEAVE_NO_PLANNING_MESSAGE;
  }
  const minHours = getMinPlannedHoursForLeaveAwareLocation(location, kind);
  if (kind === 'half') {
    return `Your minimum total hours planning is not completed. Please plan ${formatDurationLabelFromHours(minHours)}.`;
  }
  if (minHours === MIN_PLANNED_HOURS_OFFICE) {
    return 'Your minimum total hours planning is not completed. Please plan 7 Hours 30 Minutes.';
  }
  if (minHours === MIN_PLANNED_HOURS_FACTORY) {
    return 'Your minimum total hours planning is not completed. Please plan 7 Hours.';
  }
  return `Your minimum total hours planning is not completed. Please plan ${formatDurationLabelFromHours(minHours)}.`;
}

/**
 * Next eligible Daily Planner working day strictly after `afterDateKey`.
 * Skips weekends/holidays (location-aware) and other approved full-day leave dates.
 * Half-day leave dates remain eligible.
 */
export function getNextEligiblePlannerWorkingDayAfter(afterDateKey, location, approvedLeaveRequests) {
  const start = String(afterDateKey || '').trim().slice(0, 10);
  if (!start) return '';

  let cursor = start;
  for (let i = 0; i < 366; i += 1) {
    cursor = getNextWorkingDayDateKey(cursor, location);
    if (!cursor) return '';
    const { kind } = classifyApprovedLeaveForDate(approvedLeaveRequests, cursor);
    if (kind !== 'full') return cursor;
  }
  return '';
}

export function enumerateFullDayLeaveDateKeys(leaveRequest) {
  if (!leaveRequest || !isFullDayLeaveType(leaveRequest.leaveType)) return [];
  if (!isApprovedLeaveStatus(leaveRequest.status) && leaveRequest.status != null) {
    // Allow callers to pass a just-approved row that already has status Approved.
  }
  return enumerateDateKeys(leaveRequest.startDate, leaveRequest.endDate);
}

export function isOpenPlannerTaskForLeaveReschedule(task) {
  const status = String(task?.status || '').trim();
  if (!status) return false;
  if (
    status === 'Rescheduled' ||
    status === 'Terminated' ||
    status === 'Verified Complete' ||
    status === 'Completed' ||
    status === 'Closed'
  ) {
    return false;
  }
  // Extra tasks are completion-side logs — do not auto-move.
  if (String(task?.source || '').trim() === 'EXTRA') return false;
  return true;
}
