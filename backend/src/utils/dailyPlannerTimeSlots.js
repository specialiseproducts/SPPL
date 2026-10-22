/**
 * Factory Daily Planner: validate and aggregate up to 3 completion time slots.
 * Times stored as HH:mm (24h). Durations aggregated in whole minutes.
 */

export const MAX_COMPLETION_TIME_SLOTS = 3;

function parseTimeToMinutes(value) {
  const raw = String(value || '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function normalizeClockTime(value) {
  const mins = parseTimeToMinutes(value);
  if (mins == null) return String(value || '').trim();
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * @param {unknown} rawSlots
 * @param {{ startTime?: string, endTime?: string, completionStartTime?: string, completionEndTime?: string }} fallback
 */
export function normalizeCompletionTimeSlots(rawSlots, fallback = {}) {
  const list = Array.isArray(rawSlots) ? rawSlots : null;
  if (list && list.length > 0) {
    if (list.length > MAX_COMPLETION_TIME_SLOTS) {
      const err = new Error(`A maximum of ${MAX_COMPLETION_TIME_SLOTS} time slots is allowed`);
      err.statusCode = 400;
      throw err;
    }
    const slots = list.map((slot, index) => {
      const startTime = normalizeClockTime(slot?.startTime ?? slot?.start);
      const endTime = normalizeClockTime(slot?.endTime ?? slot?.end);
      const startMins = parseTimeToMinutes(startTime);
      const endMins = parseTimeToMinutes(endTime);
      if (startMins == null || endMins == null) {
        const err = new Error(`Time slot ${index + 1}: startTime and endTime are required in HH:mm format`);
        err.statusCode = 400;
        throw err;
      }
      if (endMins <= startMins) {
        const err = new Error(`Time slot ${index + 1}: endTime must be after startTime (same day)`);
        err.statusCode = 400;
        throw err;
      }
      return {
        startTime,
        endTime,
        durationMinutes: endMins - startMins,
      };
    });

    const sorted = [...slots].sort(
      (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
    );
    for (let i = 1; i < sorted.length; i += 1) {
      const prevEnd = parseTimeToMinutes(sorted[i - 1].endTime);
      const curStart = parseTimeToMinutes(sorted[i].startTime);
      if (prevEnd != null && curStart != null && curStart < prevEnd) {
        const err = new Error('Time slots must not overlap');
        err.statusCode = 400;
        throw err;
      }
    }

    const totalMinutes = slots.reduce((sum, s) => sum + s.durationMinutes, 0);
    const completionDurationHours = Math.round((totalMinutes / 60) * 100) / 100;
    return {
      timeSlots: slots.map(({ startTime, endTime, durationMinutes }) => ({
        startTime,
        endTime,
        durationMinutes,
      })),
      completionStartTime: slots[0].startTime,
      completionEndTime: slots[slots.length - 1].endTime,
      completionDurationHours,
      totalMinutes,
    };
  }

  const startRaw = fallback.startTime ?? fallback.completionStartTime;
  const endRaw = fallback.endTime ?? fallback.completionEndTime;
  const startTime = normalizeClockTime(startRaw);
  const endTime = normalizeClockTime(endRaw);
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  if (startMins == null || endMins == null) {
    const err = new Error('startTime and endTime are required in HH:mm format');
    err.statusCode = 400;
    throw err;
  }
  if (endMins < startMins) {
    const err = new Error('endTime must be on or after startTime (same day)');
    err.statusCode = 400;
    throw err;
  }
  const durationMinutes = endMins - startMins;
  return {
    timeSlots: [{ startTime, endTime, durationMinutes }],
    completionStartTime: startTime,
    completionEndTime: endTime,
    completionDurationHours: Math.round((durationMinutes / 60) * 100) / 100,
    totalMinutes: durationMinutes,
  };
}

/** Prefer stored timeSlots sum; fall back to start/end. */
export function reportedMinutesFromTask(task) {
  const slots = Array.isArray(task?.timeSlots) ? task.timeSlots : [];
  if (slots.length > 0) {
    let total = 0;
    for (const slot of slots) {
      if (Number.isFinite(Number(slot.durationMinutes)) && Number(slot.durationMinutes) > 0) {
        total += Number(slot.durationMinutes);
        continue;
      }
      const start = parseTimeToMinutes(slot.startTime);
      const end = parseTimeToMinutes(slot.endTime);
      if (start == null || end == null || end <= start) return null;
      total += end - start;
    }
    return total;
  }
  // Step-based completion: sum of per-step actual minutes (rescheduled steps excluded).
  const steps = Array.isArray(task?.procedureSteps) ? task.procedureSteps : [];
  const stepMinutes = steps.reduce((sum, s) => {
    if (String(s?.status || '').trim() === 'rescheduled') return sum;
    const n = Number(s?.actualMinutes);
    return sum + (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
  }, 0);
  if (stepMinutes > 0) return stepMinutes;
  const start = parseTimeToMinutes(task?.completionStartTime);
  const end = parseTimeToMinutes(task?.completionEndTime);
  if (start == null || end == null || end < start) return null;
  return end - start;
}
