/**
 * Authoritative Travel → Car/Bike amount: kilometers × configured per-km rate.
 * Keep formula aligned with `frontend/src/utils/expenseAmountCalculation.ts`.
 *
 * Future: city/surge caps, policies — extend this module only.
 */

function safeNonNegativeNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * @param {Object} params
 * @param {string} params.expenseHead
 * @param {string} [params.subCategory]
 * @param {number|string} [params.kilometers]
 * @param {string} [params.fuelType] Petrol/Diesel | Electric
 * @param {{ car: { petrolDieselRate?: number, electricRate?: number }, bike: { petrolDieselRate?: number, electricRate?: number } }} params.rates
 * @returns {number} Rounded to 2 decimal places; 0 if inputs invalid.
 */
export function computeTravelCarBikeRupeeAmount({
  expenseHead,
  subCategory,
  kilometers,
  fuelType,
  rates,
}) {
  const head = String(expenseHead || '').trim();
  const sub = String(subCategory || '').trim();
  if (head !== 'Travel' || (sub !== 'Car' && sub !== 'Bike')) {
    return 0;
  }

  const km = safeNonNegativeNumber(kilometers);
  const ft = String(fuelType || '').trim();
  if (ft !== 'Petrol/Diesel' && ft !== 'Electric') {
    return 0;
  }

  const vehicleKey = sub === 'Car' ? 'car' : 'bike';
  const rateField = ft === 'Electric' ? 'electricRate' : 'petrolDieselRate';
  const bucket = rates?.[vehicleKey] || {};
  const rate = safeNonNegativeNumber(bucket[rateField]);

  const raw = km * rate;
  return Math.round(raw * 100) / 100;
}
