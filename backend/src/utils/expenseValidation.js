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

export function isTravelOutstationAllowance(data) {
  const head = String(data?.expenseHead || '').trim();
  const outStation = String(data?.outStation || '').trim();
  return head === 'Travel' && outStation === 'Yes';
}

function parseDateTime(dateValue, timeValue) {
  const date = String(dateValue ?? '').trim();
  const time = String(timeValue ?? '').trim();
  if (!date || !time) return null;
  const dt = new Date(`${date}T${time}`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function computeOutstationDuration(data) {
  const start = parseDateTime(data?.arrivalDate, data?.arrivalTime);
  const end = parseDateTime(data?.departureDate, data?.departureTime);
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return null;
  const durationHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  const durationDays = Math.round((durationHours / 24) * 100) / 100;
  return { durationHours, durationDays };
}

/** ₹ per hour for OutStation / Travel Allowance. */
export const OUTSTATION_TRAVEL_ALLOWANCE_RATE_PER_HOUR = 20;

export function computeOutstationTravelAllowanceAmount(durationHours) {
  const hours = Number(durationHours);
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.round(hours * OUTSTATION_TRAVEL_ALLOWANCE_RATE_PER_HOUR * 100) / 100;
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

  if (isTravelOutstationAllowance(merged)) {
    const duration = computeOutstationDuration(merged);
    if (!duration) {
      throw new Error('Departure datetime cannot be earlier than arrival datetime');
    }
    return;
  }

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
