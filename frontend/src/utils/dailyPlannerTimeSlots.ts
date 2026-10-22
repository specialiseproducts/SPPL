/**
 * Factory Daily Planner: up to 3 time slots per completed task.
 * Durations are computed in whole minutes (exact), then converted to decimal hours.
 */

export const MAX_COMPLETION_TIME_SLOTS = 3;

export type CompletionTimeSlot = {
  id: string;
  startTime: string; // HH:mm (24h storage)
  endTime: string; // HH:mm (24h storage)
};

export function createEmptyTimeSlot(): CompletionTimeSlot {
  return {
    id: crypto.randomUUID(),
    startTime: '',
    endTime: '',
  };
}

/** Parse HH:mm → minutes from midnight, or null if invalid. */
export function parseHhMmToMinutes(value: string): number | null {
  const raw = String(value || '').trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;
  const [h, m] = raw.split(':').map(Number);
  if (![h, m].every((n) => Number.isFinite(n))) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Exact duration in minutes for one slot (same-day; end after start). */
export function slotDurationMinutes(slot: Pick<CompletionTimeSlot, 'startTime' | 'endTime'>): number | null {
  const start = parseHhMmToMinutes(slot.startTime);
  const end = parseHhMmToMinutes(slot.endTime);
  if (start == null || end == null) return null;
  if (end <= start) return null;
  return end - start;
}

export function minutesToDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function totalSlotsDurationMinutes(slots: CompletionTimeSlot[]): number | null {
  if (!slots.length) return null;
  let total = 0;
  for (const slot of slots) {
    const mins = slotDurationMinutes(slot);
    if (mins == null) return null;
    total += mins;
  }
  return total;
}

export function totalSlotsDecimalHours(slots: CompletionTimeSlot[]): number | null {
  const mins = totalSlotsDurationMinutes(slots);
  if (mins == null) return null;
  return minutesToDecimalHours(mins);
}

export type TimeSlotValidationIssue =
  | 'incomplete'
  | 'invalid'
  | 'end_before_start'
  | 'overlap'
  | 'too_many';

export function validateCompletionTimeSlots(
  slots: CompletionTimeSlot[],
): { ok: true; totalMinutes: number } | { ok: false; issue: TimeSlotValidationIssue; message: string } {
  if (!slots.length) {
    return { ok: false, issue: 'incomplete', message: 'At least one time slot is required.' };
  }
  if (slots.length > MAX_COMPLETION_TIME_SLOTS) {
    return { ok: false, issue: 'too_many', message: 'A maximum of three time slots is allowed.' };
  }

  const ranges: Array<{ start: number; end: number }> = [];
  for (const slot of slots) {
    const startRaw = String(slot.startTime || '').trim();
    const endRaw = String(slot.endTime || '').trim();
    if (!startRaw || !endRaw) {
      return { ok: false, issue: 'incomplete', message: 'Start Time and End Time are required for every slot.' };
    }
    const start = parseHhMmToMinutes(startRaw);
    const end = parseHhMmToMinutes(endRaw);
    if (start == null || end == null) {
      return { ok: false, issue: 'invalid', message: 'Enter valid times for every slot.' };
    }
    if (end <= start) {
      return {
        ok: false,
        issue: 'end_before_start',
        message: 'End Time must be after Start Time for every slot.',
      };
    }
    ranges.push({ start, end });
  }

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].start < sorted[i - 1].end) {
      return { ok: false, issue: 'overlap', message: 'Time slots must not overlap.' };
    }
  }

  const totalMinutes = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
  return { ok: true, totalMinutes };
}

/** Planned vs actual completion feedback (Factory). Equal counts as on/before time. */
export function completionTimingMessage(
  plannedHours: number | null | undefined,
  reportedMinutes: number | null,
): string | null {
  if (reportedMinutes == null || reportedMinutes < 0) return null;
  if (plannedHours == null || !Number.isFinite(Number(plannedHours))) return null;
  const plannedMinutes = Math.round(Number(plannedHours) * 60);
  if (plannedMinutes <= 0) return null;
  if (reportedMinutes > plannedMinutes) {
    return 'Failed to complete the task on time.';
  }
  return 'Congratulations! Completed task before time.';
}

export function slotsFromLegacyStartEnd(
  startTime?: string | null,
  endTime?: string | null,
): CompletionTimeSlot[] {
  const start = String(startTime || '').trim();
  const end = String(endTime || '').trim();
  if (start || end) {
    return [{ id: crypto.randomUUID(), startTime: start, endTime: end }];
  }
  return [createEmptyTimeSlot()];
}
