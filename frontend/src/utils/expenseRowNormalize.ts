import { EXPENSE_LEGACY_COMBINED_LOCATION_ATTR } from '../constants/expenseLegacy';
import type { ExpenseDocument, ExpenseRecord } from '../types/expenses';

export function normalizeExpenseRow(raw: Record<string, unknown>): ExpenseRecord {
  const legacyLp = String(raw[EXPENSE_LEGACY_COMBINED_LOCATION_ATTR] ?? '').trim();
  let location = String(raw.location ?? '').trim();
  let purpose = String(raw.purpose ?? '').trim();
  if (!location && legacyLp) {
    location = legacyLp;
  }
  if (!purpose && legacyLp) {
    purpose = legacyLp;
  }
  const monthYear = String(raw.monthYear ?? '');
  const kmRaw = raw.kilometers;
  let kilometers: number | undefined;
  if (kmRaw !== undefined && kmRaw !== null && String(kmRaw).trim() !== '') {
    const n = Number(kmRaw);
    kilometers = Number.isNaN(n) ? undefined : n;
  }

  return {
    expenseId: String(raw.expenseId ?? raw.expense_id ?? raw.id ?? '').trim(),
    expenseHead: String(raw.expenseHead ?? ''),
    subCategory: raw.subCategory != null ? String(raw.subCategory).trim() : undefined,
    location,
    purpose,
    serviceProvider: String(raw.serviceProvider ?? ''),
    billNumber: String(raw.billNumber ?? ''),
    date: String(raw.date ?? ''),
    amount: Number(raw.amount ?? 0),
    employeeName: String(raw.employeeName ?? ''),
    employeeId: raw.employeeId != null ? String(raw.employeeId) : undefined,
    employeeEmail: raw.employeeEmail != null ? String(raw.employeeEmail) : undefined,
    monthYear,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
    fromLocation: raw.fromLocation != null ? String(raw.fromLocation) : undefined,
    toLocation: raw.toLocation != null ? String(raw.toLocation) : undefined,
    returnType: raw.returnType != null ? String(raw.returnType) : undefined,
    kilometers,
    stayDateFrom: raw.stayDateFrom != null ? String(raw.stayDateFrom) : undefined,
    stayDateTo: raw.stayDateTo != null ? String(raw.stayDateTo) : undefined,
    supportingDocument:
      raw.supportingDocument === 'Yes' || raw.supportingDocument === 'No'
        ? raw.supportingDocument
        : undefined,
    fuelType: raw.fuelType != null ? String(raw.fuelType).trim() : undefined,
    documents: Array.isArray(raw.documents) ? (raw.documents as ExpenseDocument[]) : undefined,
  };
}
