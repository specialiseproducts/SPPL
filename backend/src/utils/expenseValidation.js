/**
 * Shared expense conditional rules (keep in sync with frontend).
 * Amount formula for Travel → Car/Bike will plug in here later.
 */

export function isTravelCarOrBike(expenseHead, subCategory) {
  const sub = String(subCategory || '').trim();
  return expenseHead === 'Travel' && (sub === 'Car' || sub === 'Bike');
}

export function isHotelBookingSelf(expenseHead, subCategory) {
  const sub = String(subCategory || '').trim();
  return expenseHead === 'Hotel_Booking' && sub === 'Self';
}

/**
 * Future: compute reimbursement from km / slabs / policy.
 * @returns {number|null} null = not yet implemented; caller should treat as 0 for persistence.
 */
export function computeTravelCarBikeAmount(_ctx) {
  return null;
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
    const computed = computeTravelCarBikeAmount({
      expenseHead: head,
      subCategory: sub,
      fromLocation: merged.fromLocation,
      toLocation: merged.toLocation,
      returnType: merged.returnType,
      kilometers: merged.kilometers,
    });
    void computed; // reserved for when formula returns a value
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
