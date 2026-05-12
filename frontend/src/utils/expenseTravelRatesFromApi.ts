/**
 * Normalizes GET /api/expenses/settings/travel-rates `data` payloads.
 * Avoids truthy checks on `car`/`bike` objects (objects are always truthy when present).
 */

export interface ExpenseTravelRateSettingsShape {
  car: { petrolDieselRate: number; electricRate: number };
  bike: { petrolDieselRate: number; electricRate: number };
}

function finiteNonNeg(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

/** Returns parsed rates when `data` has valid car/bike maps; otherwise null. */
export function parseTravelRatesApiData(data: unknown): ExpenseTravelRateSettingsShape | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const car = d.car;
  const bike = d.bike;
  if (typeof car !== 'object' || car === null) return null;
  if (typeof bike !== 'object' || bike === null) return null;
  const c = car as Record<string, unknown>;
  const b = bike as Record<string, unknown>;
  return {
    car: {
      petrolDieselRate: finiteNonNeg(c.petrolDieselRate),
      electricRate: finiteNonNeg(c.electricRate),
    },
    bike: {
      petrolDieselRate: finiteNonNeg(b.petrolDieselRate),
      electricRate: finiteNonNeg(b.electricRate),
    },
  };
}
