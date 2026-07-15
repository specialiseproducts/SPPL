import type { PlannerEvent, PlannerEventDraft, PlannerOrganizationOption } from '../../types/planner';
import { apiFetch } from '../../services/api';

function toDateOnly(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizePlannerEvent(raw: PlannerEvent | Record<string, unknown>): PlannerEvent {
  const r = raw as Record<string, unknown>;
  const contactTitle = String(r.contactTitle ?? r.title ?? '').trim();
  const contactFullName = String(r.contactFullName ?? r.fullName ?? '').trim();
  const contactAddress = String(r.contactAddress ?? r.address ?? '').trim();
  const contactNumber = String(r.contactNumber ?? r.phoneNumber ?? '').trim();
  const contactEmail = String(r.contactEmail ?? r.email ?? '').trim();
  const organizationName = String(r.organizationName ?? r.customerOrganization ?? '').trim();
  const visitReport = String(r.visitReport ?? r.report ?? '').trim();
  const notVisitedReason = String(r.notVisitedReason ?? r.reason ?? '').trim();

  return {
    ...(raw as PlannerEvent),
    eventId: String(r.eventId ?? '').trim(),
    ownerEmployeeCode: String(r.ownerEmployeeCode ?? '').trim(),
    ownerEmployeeName: String(r.ownerEmployeeName ?? '').trim(),
    visitDate: toDateOnly(r.visitDate),
    organizationName,
    organizationAddress: String(r.organizationAddress ?? r.address ?? '').trim(),
    modeOfMeeting: String(r.modeOfMeeting ?? '').trim(),
    contactTitle,
    contactFullName,
    contactAddress,
    contactNumber,
    contactEmail,
    purpose: String(r.purpose ?? '').trim(),
    status: String(r.status ?? 'Planned').trim() as PlannerEvent['status'],
    notVisitedReason,
    visitReport,
  };
}

export async function fetchPlannerOrganizations(): Promise<PlannerOrganizationOption[]> {
  const res = (await apiFetch('/api/sales-forecasts/planner/organizations')) as {
    data?: { organizations?: PlannerOrganizationOption[] };
  };
  return res?.data?.organizations ?? [];
}

export async function fetchPlannerMonthEvents(
  year: number,
  month: number,
  employeeCode?: string,
): Promise<PlannerEvent[]> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const code = String(employeeCode || '').trim();
  if (code) params.set('employeeCode', code);
  const res = (await apiFetch(
    `/api/sales-forecasts/planner/events?${params.toString()}`,
  )) as { data?: { events?: PlannerEvent[] } };
  return (res?.data?.events ?? []).map(normalizePlannerEvent).filter((e) => !!e.visitDate);
}

export async function createPlannerEvents(
  visitDate: string,
  events: PlannerEventDraft[],
): Promise<PlannerEvent[]> {
  const res = (await apiFetch('/api/sales-forecasts/planner/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitDate, events }),
  })) as { data?: { events?: PlannerEvent[] } };
  return (res?.data?.events ?? []).map(normalizePlannerEvent).filter((e) => !!e.visitDate);
}

export async function updatePlannerEventVisit(
  eventId: string,
  body: Record<string, unknown>,
): Promise<{ event: PlannerEvent; quotation?: { forecastId: string }; rescheduledFrom?: string }> {
  const res = (await apiFetch(`/api/sales-forecasts/planner/events/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })) as {
    data?: { event: PlannerEvent; quotation?: { forecastId: string }; rescheduledFrom?: string };
  };
  if (!res?.data?.event) throw new Error('Update failed');
  return {
    ...res.data,
    event: normalizePlannerEvent(res.data.event),
  };
}
