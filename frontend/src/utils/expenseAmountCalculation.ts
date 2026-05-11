/**
 * Travel Car/Bike amount rules — keep aligned with backend `expenseValidation.js`.
 * Formula integration: implement `computeTravelCarBikeAmount` and wire it in the form submit path.
 */

export function isTravelCarOrBike(expenseHead: string, subCategory?: string): boolean {
  const sub = String(subCategory ?? '').trim();
  return expenseHead === 'Travel' && (sub === 'Car' || sub === 'Bike');
}

export function isHotelBookingSelf(expenseHead: string, subCategory?: string): boolean {
  const sub = String(subCategory ?? '').trim();
  return expenseHead === 'Hotel_Booking' && sub === 'Self';
}

export interface TravelCarBikeAmountInput {
  expenseHead: string;
  subCategory?: string;
  fromLocation?: string;
  toLocation?: string;
  returnType?: string;
  kilometers?: number;
}

/**
 * Future: plug in policy-based reimbursement (per-km, caps, etc.).
 * Returns null while TBD — UI should treat as 0 until implemented.
 */
export function computeTravelCarBikeAmount(_input: TravelCarBikeAmountInput): number | null {
  return null;
}
