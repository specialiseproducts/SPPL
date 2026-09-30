import type { ExpenseRecord } from '../types/expenses';

export type ExpenseEditFieldOption = {
  key: string;
  label: string;
};

export type ExpenseDisplayField = {
  label: string;
  value: unknown;
};

const FIELD_LABELS: Record<string, string> = {
  expenseHead: 'Expense Head',
  subCategory: 'Sub Category',
  outStation: 'OutStation (more than 100km)',
  date: 'Date',
  amount: 'Amount',
  location: 'Location',
  purpose: 'Purpose',
  serviceProvider: 'Service Provider Name',
  billNumber: 'Bill Number',
  pnrNo: 'PNR No.',
  fromLocation: 'From',
  toLocation: 'To',
  returnType: 'Return',
  kilometers: 'Kilometers (km)',
  stayDateFrom: 'Stay Date (From)',
  stayDateTo: 'Stay Date (To)',
  fuelType: 'Fuel Type',
  supportingDocument: 'Supporting Document',
  arrivalDate: 'Arrival Date',
  arrivalTime: 'Arrival Time',
  departureDate: 'Departure Date (last)',
  departureTime: 'Departure Time',
  durationHours: 'Duration Hours',
  durationDays: 'Duration Days',
  travelAllowanceAmount: 'Travel Allowance',
  employeeName: 'Employee Name',
  employeeId: 'Employee Code',
  auditStatus: 'Status',
  monthYear: 'Month-Year',
  documentFileName: 'Supporting File',
};

const EDITABLE_KEYS = Object.keys(FIELD_LABELS);

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  const text = String(value).trim();
  return text !== '';
}

function isOutstationRecord(record: ExpenseRecord): boolean {
  return record.expenseHead === 'Travel' && record.outStation === 'Yes';
}

function isTravelCarOrBikeRecord(record: ExpenseRecord): boolean {
  const sub = String(record.subCategory || '').trim();
  return record.expenseHead === 'Travel' && (sub === 'Car' || sub === 'Bike');
}

function isTravelTicketTransportRecord(record: ExpenseRecord): boolean {
  const sub = String(record.subCategory || '').trim();
  return (
    record.expenseHead === 'Travel' &&
    (sub === 'Flight' || sub === 'Bus' || sub === 'Taxi' || sub === 'Train')
  );
}

function isHotelSelfRecord(record: ExpenseRecord): boolean {
  return record.expenseHead === 'Hotel_Booking' && String(record.subCategory || '').trim() === 'Self';
}

export function getExpenseFieldLabel(keyOrLabel: string): string {
  if (FIELD_LABELS[keyOrLabel]) return FIELD_LABELS[keyOrLabel];
  const match = Object.entries(FIELD_LABELS).find(([, label]) => label === keyOrLabel);
  return match ? match[1] : keyOrLabel;
}

export function getExpenseFieldValue(record: ExpenseRecord | null, key: string): string {
  if (!record) return '';
  const value = (record as unknown as Record<string, unknown>)[key];
  if (value === undefined || value === null) return '';
  return String(value);
}

export function getEditableExpenseFields(record: ExpenseRecord | null): ExpenseEditFieldOption[] {
  if (!record) return [];

  const include = new Set<string>();
  const addIfPresent = (key: string, always = false) => {
    if (!EDITABLE_KEYS.includes(key)) return;
    if (always || hasValue((record as unknown as Record<string, unknown>)[key])) {
      include.add(key);
    }
  };

  if (isOutstationRecord(record)) {
    addIfPresent('arrivalDate', true);
    addIfPresent('arrivalTime', true);
    addIfPresent('departureDate', true);
    addIfPresent('departureTime', true);
    addIfPresent('subCategory');
    addIfPresent('date');
    addIfPresent('amount');
    addIfPresent('location');
    addIfPresent('purpose');
    addIfPresent('serviceProvider');
    addIfPresent('billNumber');
  } else {
    addIfPresent('subCategory', true);
    addIfPresent('date', !isHotelSelfRecord(record));
    addIfPresent('amount', true);
    if (isTravelTicketTransportRecord(record)) {
      addIfPresent('pnrNo', true);
      addIfPresent('fromLocation', true);
      addIfPresent('toLocation', true);
    } else {
      addIfPresent('location', true);
    }
    addIfPresent('purpose', true);
    if (!isTravelCarOrBikeRecord(record)) {
      addIfPresent('serviceProvider', true);
      addIfPresent('billNumber', true);
      addIfPresent('supportingDocument', true);
    }
    if (isTravelCarOrBikeRecord(record)) {
      addIfPresent('fromLocation', true);
      addIfPresent('toLocation', true);
      addIfPresent('returnType', true);
      addIfPresent('kilometers', true);
      addIfPresent('fuelType', true);
    } else if (!isTravelTicketTransportRecord(record)) {
      addIfPresent('fromLocation');
      addIfPresent('toLocation');
      addIfPresent('returnType');
      addIfPresent('kilometers');
      addIfPresent('fuelType');
      addIfPresent('pnrNo');
    }
    if (isHotelSelfRecord(record)) {
      addIfPresent('stayDateFrom', true);
      addIfPresent('stayDateTo', true);
    } else {
      addIfPresent('stayDateFrom');
      addIfPresent('stayDateTo');
    }
  }

  return [...include].map((key) => ({ key, label: FIELD_LABELS[key] }));
}

export function getExpenseDisplayFields(record: ExpenseRecord): ExpenseDisplayField[] {
  const fields: ExpenseDisplayField[] = [
    { label: 'Expense Ref', value: record.expenseId },
    { label: 'Employee Name', value: record.employeeName },
    { label: 'Employee Code', value: record.employeeId },
    { label: 'Expense Head', value: record.expenseHead },
  ];

  const add = (label: string, value: unknown, always = false) => {
    if (always || hasValue(value)) {
      fields.push({ label, value });
    }
  };

  if (record.expenseHead === 'Travel') {
    add('OutStation (more than 100km)', record.outStation || 'No', true);
  }

  if (isOutstationRecord(record)) {
    add('Arrival Date', record.arrivalDate, true);
    add('Arrival Time', record.arrivalTime, true);
    add('Departure Date (last)', record.departureDate, true);
    add('Departure Time', record.departureTime, true);
    add('Duration Hours', record.durationHours, true);
    add('Duration Days', record.durationDays, true);
    add('Travel Allowance', record.travelAllowanceAmount);
    add('Sub Category', record.subCategory);
    add('Date', record.date);
    add('Amount', record.amount);
    add('Location', record.location);
    add('Purpose', record.purpose);
  } else {
    add('Sub Category', record.subCategory);
    add('PNR No.', record.pnrNo, isTravelTicketTransportRecord(record));
    add('Date', record.date, true);
    add('Amount', record.amount, true);
    if (!isTravelTicketTransportRecord(record)) {
      add('Location', record.location, true);
    }
    add('Purpose', record.purpose, true);
    add('From', record.fromLocation, isTravelTicketTransportRecord(record) || isTravelCarOrBikeRecord(record));
    add('To', record.toLocation, isTravelTicketTransportRecord(record) || isTravelCarOrBikeRecord(record));
    add('Return', record.returnType);
    add('Kilometers (km)', record.kilometers);
    add('Stay Date (From)', record.stayDateFrom);
    add('Stay Date (To)', record.stayDateTo);
    add('Fuel Type', record.fuelType);
    add('Service Provider Name', record.serviceProvider, !isTravelCarOrBikeRecord(record));
    add('Bill Number', record.billNumber, !isTravelCarOrBikeRecord(record));
    add('Supporting Document', record.supportingDocument, !isTravelCarOrBikeRecord(record));
  }

  add('Status', record.auditStatus ?? 'Pending', true);
  add('Month-Year', record.monthYear, true);

  if (record.documents && record.documents.length > 0) {
    add('Supporting File', record.documents[0].fileName, true);
  }

  return fields;
}

export function formatExpenseFieldValue(value: unknown): string {
  if (value === undefined || value === null || String(value).trim() === '') return '—';
  return String(value);
}

export type ExpenseTransactionDetailColumn = {
  key: string;
  label: string;
};

type ExpenseFormShape = {
  expenseHead?: string;
  subCategory?: string;
  outStation?: string;
};

/**
 * Form-applicable field keys for a head/sub/outStation combination.
 * Mirrors ExpenseFormModal / getExpenseDisplayFields branch order (always include applicable fields).
 */
export function getApplicableExpenseFormFieldKeys(record: ExpenseFormShape): string[] {
  const head = String(record.expenseHead || '').trim();
  const sub = String(record.subCategory || '').trim();
  const outStation = String(record.outStation || '').trim();
  const keys: string[] = [];

  const push = (key: string) => {
    if (!keys.includes(key)) keys.push(key);
  };

  if (head === 'Travel') {
    push('outStation');
  }

  const asRecord = {
    expenseHead: head,
    subCategory: sub,
    outStation: outStation === 'Yes' ? 'Yes' : 'No',
  } as ExpenseRecord;

  if (isOutstationRecord(asRecord)) {
    push('arrivalDate');
    push('arrivalTime');
    push('departureDate');
    push('departureTime');
    push('durationHours');
    push('durationDays');
    push('travelAllowanceAmount');
    push('subCategory');
    push('date');
    push('amount');
    push('location');
    push('purpose');
    return keys;
  }

  push('subCategory');
  if (isTravelTicketTransportRecord(asRecord)) {
    push('pnrNo');
  }
  push('date');
  push('amount');
  if (!isTravelTicketTransportRecord(asRecord)) {
    push('location');
  }
  push('purpose');
  if (isTravelTicketTransportRecord(asRecord) || isTravelCarOrBikeRecord(asRecord)) {
    push('fromLocation');
    push('toLocation');
  }
  if (isTravelCarOrBikeRecord(asRecord)) {
    push('returnType');
    push('kilometers');
    push('fuelType');
  } else {
    push('serviceProvider');
    push('billNumber');
    push('supportingDocument');
    push('documentFileName');
  }
  if (isHotelSelfRecord(asRecord)) {
    push('stayDateFrom');
    push('stayDateTo');
  }

  return keys;
}

/**
 * Dynamic Transaction Details columns for Admin Dashboard subcategory view.
 * Uses the same form-branch field set as Expense forms; unions outstation +
 * record variants so all applicable fields appear (empty cells use —).
 * Then applies analytics-only visibility exclusions (does not affect forms/API/data).
 */
export function getExpenseTransactionDetailColumns(
  expenseHead: string,
  subCategory: string,
  transactions: Array<ExpenseFormShape & Record<string, unknown>> = [],
): ExpenseTransactionDetailColumn[] {
  const orderedKeys: string[] = [];
  const seen = new Set<string>();

  const add = (key: string) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    orderedKeys.push(key);
  };

  // Identity / context — always first (matches getExpenseDisplayFields identity block).
  add('date');
  add('employeeName');
  add('employeeId');
  add('expenseHead');
  add('subCategory');

  const head = String(expenseHead || '').trim();
  const sub = String(subCategory || '').trim();

  for (const key of getApplicableExpenseFormFieldKeys({
    expenseHead: head,
    subCategory: sub,
    outStation: 'No',
  })) {
    add(key);
  }

  // Travel may include outstation records under the same subcategory filter.
  if (head === 'Travel') {
    for (const key of getApplicableExpenseFormFieldKeys({
      expenseHead: head,
      subCategory: sub,
      outStation: 'Yes',
    })) {
      add(key);
    }
  }

  for (const txn of transactions) {
    const txnHead = String(txn.expenseHead || head).trim();
    const txnSub = String(txn.subCategory || sub).trim();
    const txnOut = String(txn.outStation || 'No').trim();
    for (const key of getApplicableExpenseFormFieldKeys({
      expenseHead: txnHead,
      subCategory: txnSub,
      outStation: txnOut,
    })) {
      add(key);
    }
  }

  add('auditStatus');
  add('monthYear');

  const hidden = getTransactionDetailHiddenFieldKeys(head, sub);
  const visibleKeys = hidden.size
    ? orderedKeys.filter((key) => !hidden.has(key))
    : orderedKeys;

  return visibleKeys.map((key) => ({
    key,
    label: FIELD_LABELS[key] || key,
  }));
}

/**
 * Analytics Transaction Details only — fields hidden for specific Travel subcategories.
 * Does NOT remove fields from forms, DynamoDB, API payloads, or other Expenses views.
 */
const TRAVEL_TXN_DETAIL_HIDDEN_BASE = [
  'employeeId',
  'expenseHead',
  'subCategory',
  'outStation',
  'billNumber',
  'supportingDocument',
  'documentFileName',
  'arrivalDate',
  'arrivalTime',
  'departureDate',
  'departureTime',
  'durationHours',
  'durationDays',
  'travelAllowanceAmount',
  'auditStatus',
  'monthYear',
] as const;

/** Same as base, plus PNR No. */
const TRAVEL_TXN_DETAIL_HIDDEN_WITH_PNR = [...TRAVEL_TXN_DETAIL_HIDDEN_BASE, 'pnrNo'] as const;

const TRAVEL_TRANSACTION_DETAIL_HIDDEN_FIELDS: Record<string, readonly string[]> = {
  Flight: TRAVEL_TXN_DETAIL_HIDDEN_WITH_PNR,
  Taxi: TRAVEL_TXN_DETAIL_HIDDEN_WITH_PNR,
  Bus: TRAVEL_TXN_DETAIL_HIDDEN_WITH_PNR,
  'Railway Pass': TRAVEL_TXN_DETAIL_HIDDEN_WITH_PNR,
  'Driver Charges': TRAVEL_TXN_DETAIL_HIDDEN_WITH_PNR,
  Metro: TRAVEL_TXN_DETAIL_HIDDEN_WITH_PNR,
  'Toll Tax': TRAVEL_TXN_DETAIL_HIDDEN_WITH_PNR,
  // Car / Auto — do not hide PNR No.
  Car: TRAVEL_TXN_DETAIL_HIDDEN_BASE,
  Auto: TRAVEL_TXN_DETAIL_HIDDEN_BASE,
};

/**
 * Analytics Transaction Details only — fields hidden for specific Hotel_Booking subcategories.
 * Does NOT remove fields from forms, DynamoDB, API payloads, or other Expenses views.
 */
const HOTEL_BOOKING_TXN_DETAIL_HIDDEN = [
  'employeeId',
  'expenseHead',
  'subCategory',
  'billNumber',
  'supportingDocument',
  'documentFileName',
  'auditStatus',
  'monthYear',
] as const;

const HOTEL_BOOKING_TRANSACTION_DETAIL_HIDDEN_FIELDS: Record<string, readonly string[]> = {
  Self: HOTEL_BOOKING_TXN_DETAIL_HIDDEN,
  'By Office': HOTEL_BOOKING_TXN_DETAIL_HIDDEN,
};

/**
 * Analytics Transaction Details only — fields hidden for specific Food subcategories.
 * Does NOT remove fields from forms, DynamoDB, API payloads, or other Expenses views.
 */
const FOOD_TXN_DETAIL_HIDDEN = [
  'employeeId',
  'expenseHead',
  'subCategory',
  'serviceProvider',
  'billNumber',
  'supportingDocument',
  'documentFileName',
  'auditStatus',
  'monthYear',
] as const;

const FOOD_TRANSACTION_DETAIL_HIDDEN_FIELDS: Record<string, readonly string[]> = {
  Breakfast: FOOD_TXN_DETAIL_HIDDEN,
  Cake: FOOD_TXN_DETAIL_HIDDEN,
  Dinner: FOOD_TXN_DETAIL_HIDDEN,
  'Ice-cream': FOOD_TXN_DETAIL_HIDDEN,
  Lunch: FOOD_TXN_DETAIL_HIDDEN,
  Snacks: FOOD_TXN_DETAIL_HIDDEN,
  Sweets: FOOD_TXN_DETAIL_HIDDEN,
  'Tea/Coffee': FOOD_TXN_DETAIL_HIDDEN,
  Water: FOOD_TXN_DETAIL_HIDDEN,
};

/**
 * Analytics Transaction Details only — fields hidden for specific Communication subcategories.
 * Does NOT remove fields from forms, DynamoDB, API payloads, or other Expenses views.
 */
const COMMUNICATION_TXN_DETAIL_HIDDEN = [
  'employeeId',
  'expenseHead',
  'subCategory',
  'serviceProvider',
  'billNumber',
  'supportingDocument',
  'documentFileName',
  'auditStatus',
  'monthYear',
] as const;

const COMMUNICATION_TRANSACTION_DETAIL_HIDDEN_FIELDS: Record<string, readonly string[]> = {
  Internet: COMMUNICATION_TXN_DETAIL_HIDDEN,
  Mobile: COMMUNICATION_TXN_DETAIL_HIDDEN,
};

/**
 * Analytics Transaction Details only — fields hidden for specific Fuel subcategories.
 * Does NOT remove fields from forms, DynamoDB, API payloads, or other Expenses views.
 */
const FUEL_TXN_DETAIL_HIDDEN = [
  'employeeId',
  'expenseHead',
  'subCategory',
  'serviceProvider',
  'billNumber',
  'supportingDocument',
  'documentFileName',
  'auditStatus',
  'monthYear',
] as const;

const FUEL_TRANSACTION_DETAIL_HIDDEN_FIELDS: Record<string, readonly string[]> = {
  CNG: FUEL_TXN_DETAIL_HIDDEN,
  EV: FUEL_TXN_DETAIL_HIDDEN,
  Diesel: FUEL_TXN_DETAIL_HIDDEN,
  Petrol: FUEL_TXN_DETAIL_HIDDEN,
};

/**
 * Analytics Transaction Details only — fields hidden for specific Foreign_Travel subcategories.
 * Does NOT remove fields from forms, DynamoDB, API payloads, or other Expenses views.
 */
const FOREIGN_TRAVEL_TXN_DETAIL_HIDDEN = [
  'employeeId',
  'expenseHead',
  'subCategory',
  'serviceProvider',
  'billNumber',
  'supportingDocument',
  'documentFileName',
  'auditStatus',
  'monthYear',
] as const;

const FOREIGN_TRAVEL_TRANSACTION_DETAIL_HIDDEN_FIELDS: Record<string, readonly string[]> = {
  'Advance from Office': FOREIGN_TRAVEL_TXN_DETAIL_HIDDEN,
  'City Tax': FOREIGN_TRAVEL_TXN_DETAIL_HIDDEN,
  'International Trip': FOREIGN_TRAVEL_TXN_DETAIL_HIDDEN,
  'Paid By Company': FOREIGN_TRAVEL_TXN_DETAIL_HIDDEN,
  'Return to Office': FOREIGN_TRAVEL_TXN_DETAIL_HIDDEN,
  'Visa Fee': FOREIGN_TRAVEL_TXN_DETAIL_HIDDEN,
  Chocolate: FOREIGN_TRAVEL_TXN_DETAIL_HIDDEN,
};

/**
 * Analytics Transaction Details only — fields hidden for specific Misc. subcategories.
 * Does NOT remove fields from forms, DynamoDB, API payloads, or other Expenses views.
 */
const MISC_TXN_DETAIL_HIDDEN = [
  'employeeId',
  'expenseHead',
  'subCategory',
  'serviceProvider',
  'billNumber',
  'supportingDocument',
  'documentFileName',
  'auditStatus',
  'monthYear',
] as const;

const MISC_TRANSACTION_DETAIL_HIDDEN_FIELDS: Record<string, readonly string[]> = {
  Courier: MISC_TXN_DETAIL_HIDDEN,
  EMD: MISC_TXN_DETAIL_HIDDEN,
  Flower: MISC_TXN_DETAIL_HIDDEN,
  'Gift Item': MISC_TXN_DETAIL_HIDDEN,
  Insurance: MISC_TXN_DETAIL_HIDDEN,
  'Labour Charges': MISC_TXN_DETAIL_HIDDEN,
  Photocopy: MISC_TXN_DETAIL_HIDDEN,
  Refund: MISC_TXN_DETAIL_HIDDEN,
  'Speed Post': MISC_TXN_DETAIL_HIDDEN,
  'Stamp Paper': MISC_TXN_DETAIL_HIDDEN,
  Stationary: MISC_TXN_DETAIL_HIDDEN,
  'Tender Fee': MISC_TXN_DETAIL_HIDDEN,
};

function getTransactionDetailHiddenFieldKeys(
  expenseHead: string,
  subCategory: string,
): Set<string> {
  const head = String(expenseHead || '').trim();
  const sub = String(subCategory || '').trim();

  if (head === 'Travel') {
    const hidden = TRAVEL_TRANSACTION_DETAIL_HIDDEN_FIELDS[sub];
    return hidden ? new Set(hidden) : new Set();
  }

  if (head === 'Hotel_Booking') {
    const hidden = HOTEL_BOOKING_TRANSACTION_DETAIL_HIDDEN_FIELDS[sub];
    return hidden ? new Set(hidden) : new Set();
  }

  if (head === 'Food') {
    const hidden = FOOD_TRANSACTION_DETAIL_HIDDEN_FIELDS[sub];
    return hidden ? new Set(hidden) : new Set();
  }

  if (head === 'Communication') {
    const hidden = COMMUNICATION_TRANSACTION_DETAIL_HIDDEN_FIELDS[sub];
    return hidden ? new Set(hidden) : new Set();
  }

  if (head === 'Fuel') {
    const hidden = FUEL_TRANSACTION_DETAIL_HIDDEN_FIELDS[sub];
    return hidden ? new Set(hidden) : new Set();
  }

  if (head === 'Foreign_Travel') {
    const hidden = FOREIGN_TRAVEL_TRANSACTION_DETAIL_HIDDEN_FIELDS[sub];
    return hidden ? new Set(hidden) : new Set();
  }

  if (head === 'Misc.') {
    const hidden = MISC_TRANSACTION_DETAIL_HIDDEN_FIELDS[sub];
    return hidden ? new Set(hidden) : new Set();
  }

  return new Set();
}
