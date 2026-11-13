/** Inclusive calendar-day leave helpers (YYYY-MM-DD, date-only). */

import { isCompanyWorkingDay } from './companyWorkingDays';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type PayrollLeaveType = 'one_day' | 'multiple_day' | 'half_day';
export type PayrollHalfDayPeriod = 'first_half' | 'second_half';

export function todayIstDateKey(reference = new Date()): string {
  const ist = new Date(reference.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(value?: string | null): Date | null {
  const raw = String(value ?? '').trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function inclusiveCalendarDays(startDateKey: string, endDateKey: string): number | null {
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);
  if (!start || !end) return null;
  if (end.getTime() < start.getTime()) return null;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

/** Enumerate YYYY-MM-DD keys from start..end inclusive. */
export function enumerateDateKeys(startDateKey: string, endDateKey: string): string[] {
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);
  if (!start || !end || end.getTime() < start.getTime()) return [];
  const keys: string[] = [];
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime()) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

/**
 * Count working days in an inclusive date range for the employee's location.
 * Mirrors backend `countWorkingDaysInRange` (Sundays + location holidays excluded).
 */
export function countWorkingDaysInRange(
  startDateKey: string,
  endDateKey: string,
  location?: string | null,
): number | null {
  const keys = enumerateDateKeys(startDateKey, endDateKey);
  if (keys.length === 0) return null;
  let count = 0;
  for (const key of keys) {
    if (isCompanyWorkingDay(key, location)) count += 1;
  }
  return count;
}

export function calendarDaysUntilStart(
  applicationDateKey: string,
  startDateKey: string,
): number | null {
  const app = parseDateKey(applicationDateKey);
  const start = parseDateKey(startDateKey);
  if (!app || !start) return null;
  return Math.floor((start.getTime() - app.getTime()) / 86400000);
}

export function requiresAdvanceNoticeWarning(
  durationDays: number,
  applicationDateKey: string,
  startDateKey: string,
): boolean {
  if (!Number.isFinite(durationDays) || durationDays <= 2) return false;
  const daysAway = calendarDaysUntilStart(applicationDateKey, startDateKey);
  if (daysAway == null) return false;
  return daysAway < 15;
}

export function leaveCalendarLabel(input: {
  leaveType: PayrollLeaveType | string;
  durationDays?: number;
  halfDayPeriod?: PayrollHalfDayPeriod | string | null;
}): string {
  const type = String(input.leaveType || '').trim();
  if (type === 'half_day') {
    return input.halfDayPeriod === 'second_half' ? '2nd Half Leave' : '1st Half Leave';
  }
  if (type === 'multiple_day') {
    const n = Number(input.durationDays) || 0;
    return `Leave (${n} days)`;
  }
  return 'Leave';
}

export function leaveCoversDate(
  startDate: string,
  endDate: string,
  dateIso: string,
): boolean {
  const day = String(dateIso || '').trim().slice(0, 10);
  const start = String(startDate || '').trim().slice(0, 10);
  const end = String(endDate || '').trim().slice(0, 10);
  if (!day || !start || !end) return false;
  return day >= start && day <= end;
}

/** Expand approved leave requests onto each covered calendar day (deduped by leaveRequestId). */
export function groupLeaveRequestsByDate<T extends {
  leaveRequestId: string;
  startDate: string;
  endDate: string;
  status?: string | null;
}>(
  leaveRequests: T[],
  options?: { approvedOnly?: boolean },
): Map<string, T[]> {
  const approvedOnly = options?.approvedOnly !== false;
  const map = new Map<string, T[]>();
  for (const request of leaveRequests || []) {
    if (approvedOnly && !isApprovedLeaveStatus(request.status)) continue;
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
}

export function dateRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const aStart = String(startA || '').trim().slice(0, 10);
  const aEnd = String(endA || '').trim().slice(0, 10);
  const bStart = String(startB || '').trim().slice(0, 10);
  const bEnd = String(endB || '').trim().slice(0, 10);
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

export function isPendingLeaveStatus(status?: string | null): boolean {
  return String(status || '').trim() === 'Pending';
}

export function isApprovedLeaveStatus(status?: string | null): boolean {
  return String(status || '').trim() === 'Approved';
}

/** Visual treatment for My Calendar leave blocks. */
export function leaveEventColors(status?: string | null): {
  backgroundColor: string;
  borderColor: string;
  color: string;
} {
  if (isApprovedLeaveStatus(status)) {
    return {
      backgroundColor: '#DC2626',
      borderColor: '#B91C1C',
      color: '#FFFFFF',
    };
  }
  if (String(status || '').trim() === 'Rejected') {
    return {
      backgroundColor: '#9CA3AF',
      borderColor: '#6B7280',
      color: '#FFFFFF',
    };
  }
  // Pending / unapproved (default)
  return {
    backgroundColor: '#EA580C',
    borderColor: '#C2410C',
    color: '#FFFFFF',
  };
}
