/**
 * Expense head → sub category options (must stay in sync with frontend).
 * Historical heads (Travel, Hotel_Booking, Foreign_Travel, Misc., etc.) remain
 * displayable; validation is skipped for non-canonical heads.
 */

export const EXPENSE_SUBCATEGORY_MAP = {
  'AI Subscription': ['AWS Console', 'Claude AI', 'Cursor', 'Railway'],
  Communication: [
    'Internet',
    'Microsoft Exchange',
    'Microsoft Office 365',
    'Mobile Recharge: Annual',
    'Mobile Recharge: Monthly',
  ],
  Food: [
    'Breakfast',
    'Cake',
    'Chocolate',
    'Dinner',
    'Fruits',
    'Ice-cream',
    'Lunch',
    'Snacks',
    'Sweets',
    'Tea/Coffee',
    'Water',
  ],
  Fuel: ['CNG', 'Diesel', 'EV', 'Petrol'],
  'Hotel Booking': ['By Office', 'Self Booking'],
  'International Travel': [
    'Advance from Office in FE',
    'Return to Office',
    'Travel Insurance',
    'Visa Fee',
  ],
  'Office Expense': [
    'Annual Gift',
    'Annual Pooja : Pandit',
    'Annual Pooja: Flowers',
    'Annual Pooja: Fruits',
    'Annual Pooja: Pooja Samagri',
    'Annual Pooja: Sweets',
    'Biscuits',
    'Bouquet: Birthday / Visitors',
    'Cloths: Dusting',
    'Courier',
    'EMD',
    'Gift Item for Exhibitions',
    'Labour Charges',
    'Laptop Bag',
    'Notary',
    'Office Cleaning',
    'Paper Plate & Cup',
    'Party: Factory',
    'Party: Office',
    'Photocopy',
    'Photography',
    'Printing: Catalogues',
    'Printing: Identity Cards',
    'Printing: Posters',
    'Printing: Visiting Cards',
    'Speed Post',
    'Stamp Paper',
    'Stationary: Diary',
    'Stationary: Folder',
    'Stationary: Paper',
    'Stationary: Pen',
    'Stationary: Printer Ink',
    'Stationary: Spiral Binding',
    'Stationary: Stapler Pin',
    'Stationary: Tapes',
    'Tea: Factory',
    'Tea: Office',
    'Toiletry Items: Factory',
    'Toiletry Items: Office',
    'Tools',
    'Water',
  ],
  'Office Renovation': [
    'Carpenter',
    'Civil',
    'Electrical',
    'Hardware',
    'Painter',
    'Plumber',
    'POP',
  ],
  Transport: [
    'Agent: Ticket Booking',
    'Auto',
    'Bike',
    'Bus Ticket',
    'Cancellation Charges',
    'Car',
    'Driver Charges',
    'Excess Baggage',
    'Flight',
    'Lounge / Waiting Room',
    'Metro Pass / Ticket',
    'Monthly Railway Pass',
    'Parking Charges',
    'Quarterly Railway Pass',
    'Taxi',
    'Toll Tax',
    'Train Ticket',
    'Tram',
  ],
};

export function isCanonicalExpenseHead(head) {
  return Object.prototype.hasOwnProperty.call(EXPENSE_SUBCATEGORY_MAP, head);
}

/**
 * Enforces subCategory for canonical heads; skips legacy expense heads
 * (e.g. Travel outstation allowance) and historical values.
 */
export function validateSubCategoryForHead(expenseHead, subCategory) {
  if (!isCanonicalExpenseHead(expenseHead)) {
    return;
  }
  const value = (subCategory ?? '').trim();
  if (!value) {
    throw new Error('Sub Category is required');
  }
  const allowed = EXPENSE_SUBCATEGORY_MAP[expenseHead];
  if (!allowed.includes(value)) {
    throw new Error('Sub Category does not match Expense Head');
  }
}

/** Exact Expense Head → Subcategory pairs that show Company GSTIN (Yes/No). */
const COMPANY_GSTIN_SUBCATEGORIES = [
  ['Transport', 'Agent: Ticket Booking'],
  ['Transport', 'Driver Charges'],
  ['Transport', 'Taxi'],
  ['Hotel Booking', 'By Office'],
  ['Hotel Booking', 'Self Booking'],
  ['Communication', 'Mobile Recharge: Monthly'],
  ['Communication', 'Mobile Recharge: Annual'],
  ['Communication', 'Microsoft Office 365'],
  ['Communication', 'Microsoft Exchange'],
  ['Food', 'Dinner'],
  ['Food', 'Lunch'],
  ['Food', 'Breakfast'],
  ['AI Subscription', 'Cursor'],
  ['AI Subscription', 'AWS Console'],
  ['AI Subscription', 'Railway'],
  ['AI Subscription', 'Claude AI'],
];

const COMPANY_GSTIN_KEYS = new Set(
  COMPANY_GSTIN_SUBCATEGORIES.map(([head, sub]) => `${head}\0${sub}`),
);

/** Company GSTIN Yes/No — only the approved Head/Subcategory combinations. */
export function showCompanyGstInField(expenseHead, subCategory) {
  const head = String(expenseHead ?? '').trim();
  const sub = String(subCategory ?? '').trim();
  if (!head || !sub) return false;
  return COMPANY_GSTIN_KEYS.has(`${head}\0${sub}`);
}
