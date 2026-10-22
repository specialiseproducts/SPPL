/**
 * Step-by-step procedure helpers for Daily Planner tasks.
 * Planned duration is stored as integer minutes; hoursRequired remains the decimal sum.
 */

import { formatBulletPoints, parseBulletPoints } from '../components/dailyPlanner/bulletPointUtils';
import {
  decimalHoursToParts,
  formatDurationLabel,
  partsToDecimalHours,
} from './planningRecognition';

export type ProcedureStepStatus = 'pending' | 'completed' | 'rescheduled';

export interface DailyPlannerProcedureStep {
  stepId: string;
  description: string;
  plannedMinutes: number;
  startTime?: string | null;
  endTime?: string | null;
  actualMinutes?: number | null;
  /** Employee-reported work done for this step (Mark Completed). */
  workDone?: string | null;
  status?: ProcedureStepStatus;
  completed?: boolean;
  rescheduledToDate?: string | null;
  managerComment?: string;
}

export interface ProcedureStepDraft {
  stepId: string;
  description: string;
  hours: number;
  minutes: number;
}

export function newProcedureStepDraft(
  partial?: Partial<ProcedureStepDraft>,
): ProcedureStepDraft {
  return {
    stepId: partial?.stepId || crypto.randomUUID(),
    description: partial?.description ?? '',
    hours: partial?.hours ?? 0,
    minutes: partial?.minutes ?? 0,
  };
}

export function plannedMinutesFromParts(hours: number, minutes: number): number {
  const h = Math.max(0, Math.floor(Number(hours) || 0));
  let m = Number(minutes);
  if (!Number.isFinite(m)) m = 0;
  m = Math.max(0, Math.min(59, Math.round(m)));
  return h * 60 + m;
}

export function partsFromPlannedMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(Number(totalMinutes) || 0));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export function draftToPlannedMinutes(draft: ProcedureStepDraft): number {
  return plannedMinutesFromParts(draft.hours, draft.minutes);
}

export function sumDraftPlannedMinutes(drafts: ProcedureStepDraft[]): number {
  return drafts.reduce((sum, d) => sum + draftToPlannedMinutes(d), 0);
}

export function sumDraftDecimalHours(drafts: ProcedureStepDraft[]): number {
  const mins = sumDraftPlannedMinutes(drafts);
  const { hours, minutes } = partsFromPlannedMinutes(mins);
  return partsToDecimalHours(hours, minutes);
}

export function formatMinutesLabel(totalMinutes: number): string {
  const { hours, minutes } = partsFromPlannedMinutes(totalMinutes);
  return formatDurationLabel(partsToDecimalHours(hours, minutes));
}

export function draftsToProcedureSteps(drafts: ProcedureStepDraft[]): DailyPlannerProcedureStep[] {
  return drafts
    .map((d) => ({
      stepId: d.stepId || crypto.randomUUID(),
      description: String(d.description || '').trim(),
      plannedMinutes: draftToPlannedMinutes(d),
      status: 'pending' as const,
      completed: false,
    }))
    .filter((s) => s.description.length > 0);
}

export function descriptionFromProcedureSteps(steps: DailyPlannerProcedureStep[]): string {
  return formatBulletPoints(steps.map((s) => s.description));
}

/**
 * Task-level Work Done from per-step reports.
 * Falls back to planned step descriptions when no work-done text was entered (legacy).
 */
export function workDoneFromProcedureSteps(steps: DailyPlannerProcedureStep[]): string {
  const reported = steps
    .filter((s) => s.status !== 'rescheduled')
    .map((s) => String(s.workDone || '').trim())
    .filter(Boolean);
  if (reported.length > 0) return formatBulletPoints(reported);
  return descriptionFromProcedureSteps(steps.filter((s) => s.status !== 'rescheduled'));
}

export function validateProcedureDrafts(drafts: ProcedureStepDraft[]): {
  ok: boolean;
  error?: string;
  steps: DailyPlannerProcedureStep[];
  hoursRequired: number;
} {
  const nonEmpty = drafts.filter((d) => String(d.description || '').trim().length > 0);
  if (nonEmpty.length === 0) {
    return { ok: false, error: 'Add at least one step with a description', steps: [], hoursRequired: 0 };
  }
  for (const d of nonEmpty) {
    const mins = draftToPlannedMinutes(d);
    if (mins <= 0) {
      return {
        ok: false,
        error: 'Each step needs a planned duration greater than 0',
        steps: [],
        hoursRequired: 0,
      };
    }
  }
  const steps = draftsToProcedureSteps(drafts);
  if (steps.length === 0) {
    return { ok: false, error: 'Add at least one step with a description', steps: [], hoursRequired: 0 };
  }
  const hoursRequired = sumDraftDecimalHours(
    steps.map((s) => {
      const parts = partsFromPlannedMinutes(s.plannedMinutes);
      return { stepId: s.stepId, description: s.description, hours: parts.hours, minutes: parts.minutes };
    }),
  );
  if (!(hoursRequired > 0)) {
    return { ok: false, error: 'Total planned hours must be greater than 0', steps: [], hoursRequired: 0 };
  }
  return { ok: true, steps, hoursRequired };
}

/** Derive display steps from persisted task (legacy description/hours fallback). */
export function resolveProcedureSteps(task: {
  procedureSteps?: DailyPlannerProcedureStep[] | null;
  description?: string;
  hoursRequired?: number | null;
}): DailyPlannerProcedureStep[] {
  const raw = Array.isArray(task.procedureSteps) ? task.procedureSteps : [];
  const normalized = raw
    .map((s) => normalizePersistedStep(s))
    .filter((s): s is DailyPlannerProcedureStep => Boolean(s));
  if (normalized.length > 0) return normalized;

  const bullets = parseBulletPoints(task.description)
    .map((b) => b.trim())
    .filter(Boolean);
  const totalMins = Math.max(0, Math.round((Number(task.hoursRequired) || 0) * 60));
  if (bullets.length === 0) {
    if (totalMins <= 0) return [];
    return [
      {
        stepId: 'legacy-1',
        description: String(task.description || '').trim() || 'Task work',
        plannedMinutes: totalMins,
        status: 'pending',
        completed: false,
      },
    ];
  }
  const per = Math.floor(totalMins / bullets.length);
  let rem = totalMins - per * bullets.length;
  return bullets.map((description, index) => {
    const plannedMinutes = per + (index === 0 ? rem : 0);
    rem = index === 0 ? 0 : rem;
    return {
      stepId: `legacy-${index + 1}`,
      description,
      plannedMinutes: plannedMinutes > 0 ? plannedMinutes : Math.max(1, per),
      status: 'pending' as const,
      completed: false,
    };
  });
}

function normalizePersistedStep(raw: unknown): DailyPlannerProcedureStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const description = String(row.description || '').trim();
  if (!description) return null;
  let plannedMinutes = Number(row.plannedMinutes);
  if (!Number.isFinite(plannedMinutes) || plannedMinutes < 0) {
    const h = Number(row.plannedHours);
    const m = Number(row.plannedMinutesPart ?? row.minutes);
    if (Number.isFinite(h) || Number.isFinite(m)) {
      plannedMinutes = plannedMinutesFromParts(h || 0, m || 0);
    } else {
      plannedMinutes = 0;
    }
  }
  plannedMinutes = Math.max(0, Math.round(plannedMinutes));
  const statusRaw = String(row.status || '').trim().toLowerCase();
  const status: ProcedureStepStatus =
    statusRaw === 'completed' || statusRaw === 'rescheduled' ? (statusRaw as ProcedureStepStatus) : 'pending';
  const completed = Boolean(row.completed) || status === 'completed';
  return {
    stepId: String(row.stepId || '').trim() || crypto.randomUUID(),
    description,
    plannedMinutes,
    startTime: row.startTime != null ? String(row.startTime) : null,
    endTime: row.endTime != null ? String(row.endTime) : null,
    actualMinutes:
      row.actualMinutes === undefined || row.actualMinutes === null || row.actualMinutes === ''
        ? null
        : Number(row.actualMinutes),
    workDone: row.workDone != null ? String(row.workDone).trim() : '',
    status: completed ? 'completed' : status,
    completed,
    rescheduledToDate: row.rescheduledToDate != null ? String(row.rescheduledToDate) : null,
    managerComment: String(row.managerComment || '').trim(),
  };
}

export function sumPlannedMinutes(steps: DailyPlannerProcedureStep[]): number {
  return steps.reduce((sum, s) => sum + Math.max(0, Math.round(Number(s.plannedMinutes) || 0)), 0);
}

export function sumActualMinutes(steps: DailyPlannerProcedureStep[]): number {
  return steps.reduce((sum, s) => {
    const n = Number(s.actualMinutes);
    return sum + (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
  }, 0);
}

export function minutesBetweenHhMm(startTime: string, endTime: string): number | null {
  const start = String(startTime || '').trim();
  const end = String(endTime || '').trim();
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return null;
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  // Cross-midnight: treat end as next day when earlier than start.
  if (endMins < startMins) endMins += 24 * 60;
  return endMins - startMins;
}

/** Duration-weighted progress from completed steps (0–100). */
export function progressFromProcedureSteps(steps: DailyPlannerProcedureStep[]): number {
  const active = steps.filter((s) => s.status !== 'rescheduled');
  const total = sumPlannedMinutes(active);
  if (total <= 0) return 0;
  const done = active
    .filter((s) => s.completed || s.status === 'completed')
    .reduce((sum, s) => sum + Math.max(0, Math.round(Number(s.plannedMinutes) || 0)), 0);
  return Math.round((done / total) * 10000) / 100;
}

export function draftsFromProcedureSteps(steps: DailyPlannerProcedureStep[]): ProcedureStepDraft[] {
  if (!steps.length) return [newProcedureStepDraft()];
  return steps.map((s) => {
    const parts = partsFromPlannedMinutes(s.plannedMinutes);
    return {
      stepId: s.stepId,
      description: s.description,
      hours: parts.hours,
      minutes: parts.minutes,
    };
  });
}

export function draftsFromDescription(description?: string): ProcedureStepDraft[] {
  const bullets = parseBulletPoints(description)
    .map((b) => b.trim())
    .filter(Boolean);
  if (bullets.length === 0) return [newProcedureStepDraft()];
  return bullets.map((description) => newProcedureStepDraft({ description }));
}

export { decimalHoursToParts, formatDurationLabel, partsToDecimalHours };
