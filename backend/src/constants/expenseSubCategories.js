/**
 * Expense head → sub category options (must stay in sync with frontend).
 */

export const EXPENSE_SUBCATEGORY_MAP = {
  Travel: [
    'Bus',
    'Cancellation Charges',
    'Car',
    'Bike',
    'Driver Charges',
    'Excess Baggage',
    'Auto',
    'Flight',
    'Metro',
    'Parking Charges',
    'Railway Pass',
    'Taxi',
    'Toll Tax',
  ],
  Fuel: ['CNG', 'Diesel', 'EV', 'Petrol'],
  Hotel_Booking: ['By Office', 'Self'],
  Food: [
    'Breakfast',
    'Cake',
    'Dinner',
    'Ice-cream',
    'Lunch',
    'Snacks',
    'Sweets',
    'Tea/Coffee',
    'Water',
  ],
  Communication: ['Internet', 'Mobile'],
  Foreign_Travel: [
    'Advance from Office',
    'City Tax',
    'International Trip',
    'Paid By Company',
    'Return to Office',
    'Visa Fee',
    'Chocolate',
  ],
  'Misc.': [
    'Courier',
    'EMD',
    'Flower',
    'Gift Item',
    'Insurance',
    'Labour Charges',
    'Photocopy',
    'Refund',
    'Speed Post',
    'Stamp Paper',
    'Stationary',
    'Tender Fee',
  ],
};

export function isCanonicalExpenseHead(head) {
  return Object.prototype.hasOwnProperty.call(EXPENSE_SUBCATEGORY_MAP, head);
}

/**
 * Enforces subCategory for canonical heads; skips legacy expense heads.
 */
export function validateSubCategoryForHead(expenseHead, subCategory) {
  if (!isCanonicalExpenseHead(expenseHead)) {
    return;
  }
  const value = (subCategory ?? '').trim();
  if (!value) {
    throw new Error('subCategory is required');
  }
  const allowed = EXPENSE_SUBCATEGORY_MAP[expenseHead];
  if (!allowed.includes(value)) {
    throw new Error('subCategory does not match expense head');
  }
}
