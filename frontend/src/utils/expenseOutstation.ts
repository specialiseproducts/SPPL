export type OutstationDuration = {
  durationHours: number;
  durationDays: number;
};

/** ₹ per hour for OutStation / Travel Allowance. */
export const OUTSTATION_TRAVEL_ALLOWANCE_RATE_PER_HOUR = 20;

function buildDateTime(dateValue: string, timeValue: string): Date | null {
  const date = String(dateValue || '').trim();
  const time = String(timeValue || '').trim();
  if (!date || !time) return null;
  const dt = new Date(`${date}T${time}`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function computeOutstationDuration(
  arrivalDate: string,
  arrivalTime: string,
  departureDate: string,
  departureTime: string,
): OutstationDuration | null {
  const start = buildDateTime(arrivalDate, arrivalTime);
  const end = buildDateTime(departureDate, departureTime);
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return null;
  const durationHours = diffMs / (1000 * 60 * 60);
  const durationDays = durationHours / 24;
  return {
    durationHours: Math.round(durationHours * 100) / 100,
    durationDays: Math.round(durationDays * 100) / 100,
  };
}

export function computeOutstationTravelAllowanceAmount(
  durationHours: number | null | undefined,
): number | null {
  const hours = Number(durationHours);
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.round(hours * OUTSTATION_TRAVEL_ALLOWANCE_RATE_PER_HOUR * 100) / 100;
}
