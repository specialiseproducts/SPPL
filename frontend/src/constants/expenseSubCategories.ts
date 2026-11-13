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
} as const;

export type ExpenseHeadKey = keyof typeof EXPENSE_SUBCATEGORY_MAP;

/** Alphabetically sorted canonical heads for create/edit dropdowns. */
export const EXPENSE_HEADS: ExpenseHeadKey[] = (
  Object.keys(EXPENSE_SUBCATEGORY_MAP) as ExpenseHeadKey[]
).sort((a, b) => a.localeCompare(b));

export function getSubcategoriesForHead(head: string): readonly string[] {
  const list = EXPENSE_SUBCATEGORY_MAP[head as ExpenseHeadKey];
  return list ?? [];
}

export function isCanonicalExpenseHead(head: string): head is ExpenseHeadKey {
  return Object.prototype.hasOwnProperty.call(EXPENSE_SUBCATEGORY_MAP, head);
}

export function isValidSubCategoryForHead(head: string, subCategory: string): boolean {
  if (!isCanonicalExpenseHead(head)) return true;
  const opts = getSubcategoriesForHead(head);
  return opts.includes(subCategory);
}

/** Exact Expense Head → Subcategory pairs that show Company GSTIN (Yes/No). */
const COMPANY_GSTIN_SUBCATEGORIES: ReadonlyArray<readonly [string, string]> = [
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
export function showCompanyGstInField(expenseHead: string, subCategory?: string): boolean {
  const head = String(expenseHead ?? '').trim();
  const sub = String(subCategory ?? '').trim();
  if (!head || !sub) return false;
  return COMPANY_GSTIN_KEYS.has(`${head}\0${sub}`);
}
