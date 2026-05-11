/**
 * Shared expense conditional rules (keep in sync with frontend).
 * Authoritative Travel → Car/Bike amount is computed in the expense service using
 * `expenseTravelAmount.js` and stored global rates.
 */

export function isTravelCarOrBike(expenseHead, subCategory) {
  const sub = String(subCategory || '').trim();
  return expenseHead === 'Travel' && (sub === 'Car' || sub === 'Bike');
}

export function isHotelBookingSelf(expenseHead, subCategory) {
  const sub = String(subCategory || '').trim();
  return expenseHead === 'Hotel_Booking' && sub === 'Self';
}

export function assertTravelCarBikeFields(data) {
  const from = String(data.fromLocation ?? '').trim();
  const to = String(data.toLocation ?? '').trim();
  const ret = String(data.returnType ?? '').trim();
  const kmRaw = data.kilometers;
  if (!from) throw new Error('fromLocation is required for Travel Car/Bike');
  if (!to) throw new Error('toLocation is required for Travel Car/Bike');
  if (!ret) throw new Error('returnType is required for Travel Car/Bike');
  if (kmRaw === undefined || kmRaw === null || String(kmRaw).trim() === '') {
    throw new Error('kilometers is required for Travel Car/Bike');
  }
  const km = Number(kmRaw);
  if (Number.isNaN(km) || km < 0) {
    throw new Error('kilometers must be a non-negative number');
  }
}

const FUEL_TYPES = new Set(['Petrol/Diesel', 'Electric']);

export function assertFuelTypeForTravelCarBike(data) {
  const ft = String(data.fuelType ?? '').trim();
  if (!ft) {
    throw new Error('fuelType is required for Travel Car/Bike');
  }
  if (!FUEL_TYPES.has(ft)) {
    throw new Error('fuelType must be Petrol/Diesel or Electric');
  }
}

export function assertHotelSelfStayDates(data) {
  const from = String(data.stayDateFrom ?? '').trim();
  const to = String(data.stayDateTo ?? '').trim();
  if (!from) throw new Error('stayDateFrom is required for Hotel_Booking Self');
  if (!to) throw new Error('stayDateTo is required for Hotel_Booking Self');
  if (new Date(to) < new Date(from)) {
    throw new Error('stayDateTo cannot be earlier than stayDateFrom');
  }
}

/**
 * Enforce conditional fields and amount rules on a fully merged expense row.
 */
export function validateExpenseBusinessRules(merged) {
  const head = merged?.expenseHead;
  const sub = merged?.subCategory != null ? String(merged.subCategory).trim() : '';
  const amountNum = Number(merged?.amount);

  if (isTravelCarOrBike(head, sub)) {
    assertTravelCarBikeFields(merged);
    assertFuelTypeForTravelCarBike(merged);
    if (Number.isNaN(amountNum) || amountNum < 0) {
      throw new Error('amount must be a non-negative number for Travel Car/Bike');
    }
    return;
  }

  if (isHotelBookingSelf(head, sub)) {
    assertHotelSelfStayDates(merged);
  }

  if (Number.isNaN(amountNum) || amountNum <= 0) {
    throw new Error('amount must be a positive number');
  }
}
