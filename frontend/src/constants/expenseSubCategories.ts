export const EXPENSE_SUBCATEGORY_MAP = {
  Travel: [
    'Bus',
    'Cancellation Charges',
    'Car',
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
} as const;

export type ExpenseHeadKey = keyof typeof EXPENSE_SUBCATEGORY_MAP;

export const EXPENSE_HEADS: ExpenseHeadKey[] = Object.keys(
  EXPENSE_SUBCATEGORY_MAP
) as ExpenseHeadKey[];

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
