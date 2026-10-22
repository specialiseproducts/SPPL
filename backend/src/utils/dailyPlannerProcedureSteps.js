/**
 * Step-by-step procedure helpers for Daily Planner (server-side).
 */

import { randomUUID } from 'crypto';

export function plannedMinutesFromParts(hours, minutes) {
  const h = Math.max(0, Math.floor(Number(hours) || 0));
  let m = Number(minutes);
  if (!Number.isFinite(m)) m = 0;
  m = Math.max(0, Math.min(59, Math.round(m)));
  return h * 60 + m;
}

export function partsFromPlannedMinutes(totalMinutes) {
  const safe = Math.max(0, Math.round(Number(totalMinutes) || 0));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export function decimalHoursFromMinutes(totalMinutes) {
  const { hours, minutes } = partsFromPlannedMinutes(totalMinutes);
  return Math.round((hours + minutes / 60) * 100) / 100;
}

function parseBulletLines(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return [];
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*•\s*/, '').trim())
    .filter(Boolean);
  return lines;
}

export function descriptionFromSteps(steps) {
  return (steps || [])
    .map((s) => String(s?.description || '').trim())
    .filter(Boolean)
    .map((p) => `• ${p}`)
    .join('\n');
}

/** Task-level Work Done from per-step reports; falls back to planned descriptions. */
export function workDoneFromSteps(steps) {
  const active = (steps || []).filter((s) => s?.status !== 'rescheduled');
  const reported = active
    .map((s) => String(s?.workDone || '').trim())
    .filter(Boolean)
    .map((p) => `• ${p}`)
    .join('\n');
  if (reported) return reported;
  return descriptionFromSteps(active);
}

export function normalizeProcedureStep(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const description = String(raw.description || '').trim();
  if (!description) return null;
  let plannedMinutes = Number(raw.plannedMinutes);
  if (!Number.isFinite(plannedMinutes) || plannedMinutes < 0) {
    plannedMinutes = plannedMinutesFromParts(raw.plannedHours || 0, raw.plannedMinutesPart ?? raw.minutes ?? 0);
  }
  plannedMinutes = Math.max(0, Math.round(plannedMinutes));
  const statusRaw = String(raw.status || '').trim().toLowerCase();
  const status =
    statusRaw === 'completed' || statusRaw === 'rescheduled' ? statusRaw : 'pending';
  const completed = Boolean(raw.completed) || status === 'completed';
  return {
    stepId: String(raw.stepId || '').trim() || randomUUID(),
    description,
    plannedMinutes,
    startTime: raw.startTime != null ? String(raw.startTime).trim() : null,
    endTime: raw.endTime != null ? String(raw.endTime).trim() : null,
    actualMinutes:
      raw.actualMinutes === undefined || raw.actualMinutes === null || raw.actualMinutes === ''
        ? null
        : Number(raw.actualMinutes),
    // Optional per-step Work Done (Mark Completed); empty string when unset.
    workDone: raw.workDone != null ? String(raw.workDone).trim() : '',
    status: completed ? 'completed' : status,
    completed,
    rescheduledToDate: raw.rescheduledToDate != null ? String(raw.rescheduledToDate).trim() : null,
    managerComment: String(raw.managerComment || '').trim(),
  };
}

export function normalizeProcedureSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) return [];
  return rawSteps.map(normalizeProcedureStep).filter(Boolean);
}

export function resolveProcedureSteps(task) {
  const normalized = normalizeProcedureSteps(task?.procedureSteps);
  if (normalized.length > 0) return normalized;

  const bullets = parseBulletLines(task?.description);
  const totalMins = Math.max(0, Math.round((Number(task?.hoursRequired) || 0) * 60));
  if (bullets.length === 0) {
    if (totalMins <= 0) return [];
    return [
      {
        stepId: randomUUID(),
        description: String(task?.description || '').trim() || 'Task work',
        plannedMinutes: totalMins,
        status: 'pending',
        completed: false,
        startTime: null,
        endTime: null,
        actualMinutes: null,
        rescheduledToDate: null,
        managerComment: '',
      },
    ];
  }
  const per = Math.floor(totalMins / bullets.length);
  let rem = totalMins - per * bullets.length;
  return bullets.map((description, index) => {
    const plannedMinutes = per + (index === 0 ? rem : 0);
    return {
      stepId: randomUUID(),
      description,
      plannedMinutes: plannedMinutes > 0 ? plannedMinutes : Math.max(1, per),
      status: 'pending',
      completed: false,
      startTime: null,
      endTime: null,
      actualMinutes: null,
      rescheduledToDate: null,
      managerComment: '',
    };
  });
}

export function sumPlannedMinutes(steps) {
  return (steps || []).reduce(
    (sum, s) => sum + Math.max(0, Math.round(Number(s.plannedMinutes) || 0)),
    0,
  );
}

export function progressFromProcedureSteps(steps) {
  const active = (steps || []).filter((s) => s.status !== 'rescheduled');
  const total = sumPlannedMinutes(active);
  if (total <= 0) return 0;
  const done = active
    .filter((s) => s.completed || s.status === 'completed')
    .reduce((sum, s) => sum + Math.max(0, Math.round(Number(s.plannedMinutes) || 0)), 0);
  return Math.round((done / total) * 10000) / 100;
}

export function minutesBetweenHhMm(startTime, endTime) {
  const start = String(startTime || '').trim();
  const end = String(endTime || '').trim();
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return null;
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) endMins += 24 * 60;
  return endMins - startMins;
}

function normalizeStepClockTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function clockToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** A step is "timed" when both Start and End are present (and valid). */
function resetStepTiming(step, status = 'pending') {
  return {
    ...step,
    startTime: null,
    endTime: null,
    actualMinutes: null,
    completed: false,
    status,
  };
}

/**
 * Merge client-entered step times onto the task's persisted steps.
 * - Persisted steps are authoritative for description / plannedMinutes / rescheduled state.
 * - Legacy tasks with no persisted steps use the client's steps as the base.
 */
export function mergeStepsForCompletion(task, bodySteps) {
  const persisted = normalizeProcedureSteps(task?.procedureSteps);
  const incoming = normalizeProcedureSteps(bodySteps);
  if (persisted.length === 0) {
    return incoming.map((s) => (s.status === 'rescheduled' ? resetStepTiming(s) : s));
  }
  const incomingById = new Map(incoming.map((s) => [s.stepId, s]));
  return persisted.map((p) => {
    if (p.status === 'rescheduled') return p;
    const inc = incomingById.get(p.stepId);
    if (!inc) return p;
    return {
      ...p,
      startTime: inc.startTime,
      endTime: inc.endTime,
      // Preserve per-step Work Done independently of planned description.
      workDone: inc.workDone != null ? String(inc.workDone).trim() : p.workDone || '',
    };
  });
}

/**
 * Evaluate step timings: steps with a valid Start + End become completed (actualMinutes set);
 * all other non-rescheduled steps stay pending. Throws on malformed / non-increasing times.
 */
export function evaluateStepTimings(steps) {
  const evaluated = [];
  const incompleteStepIds = [];
  let activeIndex = 0;
  for (const step of steps || []) {
    if (step.status === 'rescheduled') {
      evaluated.push(step);
      continue;
    }
    activeIndex += 1;
    const start = normalizeStepClockTime(step.startTime);
    const end = normalizeStepClockTime(step.endTime);
    if (start === null || end === null) {
      throw httpError(`Step ${activeIndex}: Start Time and End Time must be in HH:mm format`);
    }
    if (!start || !end) {
      incompleteStepIds.push(step.stepId);
      evaluated.push({
        ...resetStepTiming(step),
        startTime: start || null,
        endTime: end || null,
      });
      continue;
    }
    const actualMinutes = minutesBetweenHhMm(start, end);
    if (actualMinutes == null || actualMinutes <= 0) {
      throw httpError(`Step ${activeIndex}: End Time must be after Start Time`);
    }
    evaluated.push({
      ...step,
      startTime: start,
      endTime: end,
      actualMinutes,
      completed: true,
      status: 'completed',
    });
  }
  return { steps: evaluated, incompleteStepIds };
}

export function sumActualMinutes(steps) {
  return (steps || []).reduce((sum, s) => {
    if (s.status === 'rescheduled') return sum;
    const n = Number(s.actualMinutes);
    return sum + (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
  }, 0);
}

/** Earliest Start / latest End across timed (non-rescheduled) steps. */
export function stepTimeBounds(steps) {
  const timed = (steps || []).filter(
    (s) => s.status !== 'rescheduled' && s.startTime && s.endTime,
  );
  if (timed.length === 0) return { startTime: null, endTime: null };
  const starts = timed.map((s) => s.startTime).sort();
  const ends = timed.map((s) => s.endTime).sort();
  return { startTime: starts[0], endTime: ends[ends.length - 1] };
}

/**
 * Validate and normalize procedureSteps from create/update body.
 * Syncs description + hoursRequired from steps when steps are provided.
 */
export function assertAndNormalizeProcedurePayload(body, { requireSteps = false } = {}) {
  const hasStepsField = body?.procedureSteps !== undefined;
  if (!hasStepsField) {
    if (requireSteps) {
      const err = new Error('Step By Step Procedure is required');
      err.statusCode = 400;
      throw err;
    }
    return null;
  }
  const steps = normalizeProcedureSteps(body.procedureSteps);
  if (steps.length === 0) {
    const err = new Error('Add at least one step with a description');
    err.statusCode = 400;
    throw err;
  }
  for (const step of steps) {
    if (!(step.plannedMinutes > 0)) {
      const err = new Error('Each step needs a planned duration greater than 0');
      err.statusCode = 400;
      throw err;
    }
  }
  const hoursRequired = decimalHoursFromMinutes(sumPlannedMinutes(steps));
  if (!(hoursRequired > 0)) {
    const err = new Error('Total planned hours must be greater than 0');
    err.statusCode = 400;
    throw err;
  }
  return {
    procedureSteps: steps,
    description: descriptionFromSteps(steps),
    hoursRequired,
  };
}
