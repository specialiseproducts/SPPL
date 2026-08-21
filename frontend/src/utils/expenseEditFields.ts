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
    addIfPresent('location', true);
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
    } else {
      addIfPresent('fromLocation');
      addIfPresent('toLocation');
      addIfPresent('returnType');
      addIfPresent('kilometers');
      addIfPresent('fuelType');
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
    add('Date', record.date, true);
    add('Amount', record.amount, true);
    add('Location', record.location, true);
    add('Purpose', record.purpose, true);
    add('From', record.fromLocation);
    add('To', record.toLocation);
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
