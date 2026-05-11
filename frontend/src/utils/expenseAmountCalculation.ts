/**
 * Travel → Car/Bike amount: kilometers × configured per-km rate.
 * Keep aligned with `backend/src/utils/expenseTravelAmount.js`.
 *
 * Future: city/surge, caps, employee policies — extend here and the backend module together.
 */

export function isTravelCarOrBike(expenseHead: string, subCategory?: string): boolean {
  const sub = String(subCategory ?? '').trim();
  return expenseHead === 'Travel' && (sub === 'Car' || sub === 'Bike');
}

export function isHotelBookingSelf(expenseHead: string, subCategory?: string): boolean {
  const sub = String(subCategory ?? '').trim();
  return expenseHead === 'Hotel_Booking' && sub === 'Self';
}

/** Vehicle buckets from GET /api/expenses/settings/travel-rates */
export interface ExpenseTravelRateVehicle {
  petrolDieselRate?: number;
  electricRate?: number;
}

export interface ExpenseTravelRates {
  car: ExpenseTravelRateVehicle;
  bike: ExpenseTravelRateVehicle;
}

function safeNonNegativeNumber(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export interface TravelCarBikeRupeeParams {
  expenseHead: string;
  subCategory?: string;
  kilometers?: number | string;
  fuelType?: string;
  rates: ExpenseTravelRates;
}

/**
 * @returns Rupees rounded to 2 decimal places; 0 if head/sub/fuel invalid.
 */
export function computeTravelCarBikeRupeeAmount({
  expenseHead,
  subCategory,
  kilometers,
  fuelType,
  rates,
}: TravelCarBikeRupeeParams): number {
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
  const bucket = rates?.[vehicleKey] ?? {};
  const rate = safeNonNegativeNumber(bucket[rateField as keyof ExpenseTravelRateVehicle]);

  const raw = km * rate;
  return Math.round(raw * 100) / 100;
}

/** Stable string for controlled amount input (avoids unnecessary "90.00" when integer). */
export function formatTravelCarBikeAmountField(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (!Number.isFinite(rounded)) return '0';
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
