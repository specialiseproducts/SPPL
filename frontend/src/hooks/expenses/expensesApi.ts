import { fetchPaginatedList } from '../../utils/paginatedFetch';
import type { PaginatedResponse } from '../paginationTypes';
import type { EmployeeListDto } from '../../types/employeeListDto';
import type { ExpenseDocument, ExpenseEditRequest, ExpenseRecord } from '../../types/expenses';
import type { UserMaster } from '../../types/userMaster';
import { mapApiEmployee } from '../../utils/mapApiEmployee';
import { normalizeExpenseRow } from '../../utils/expenseRowNormalize';
import type { ExpenseTravelRateSettings } from '../../components/ExpenseRateSettingsModal';
import { parseTravelRatesApiData } from '../../utils/expenseTravelRatesFromApi';
import { isTravelCarOrBike } from '../../utils/expenseAmountCalculation';
import { apiFetch } from '../../services/api';

export function buildExpenseFormData(expense: ExpenseRecord): FormData {
  const travelCarBike = isTravelCarOrBike(expense.expenseHead, expense.subCategory ?? '');
  const formData = new FormData();
  formData.append('expenseHead', expense.expenseHead);
  if (expense.subCategory) {
    formData.append('subCategory', expense.subCategory);
  }
  formData.append('location', expense.location);
  formData.append('purpose', expense.purpose);
  if (!travelCarBike) {
    formData.append('serviceProvider', expense.serviceProvider);
    formData.append('billNumber', expense.billNumber);
  }
  formData.append('date', expense.date);
  formData.append('amount', String(expense.amount));
  formData.append('monthYear', expense.monthYear);
  if (expense.fromLocation) {
    formData.append('fromLocation', expense.fromLocation);
  }
  if (expense.toLocation) {
    formData.append('toLocation', expense.toLocation);
  }
  if (expense.returnType) {
    formData.append('returnType', expense.returnType);
  }
  if (expense.kilometers !== undefined && expense.kilometers !== null) {
    formData.append('kilometers', String(expense.kilometers));
  }
  if (expense.stayDateFrom) {
    formData.append('stayDateFrom', expense.stayDateFrom);
  }
  if (expense.stayDateTo) {
    formData.append('stayDateTo', expense.stayDateTo);
  }
  if (expense.supportingDocument && !travelCarBike) {
    formData.append('supportingDocument', expense.supportingDocument);
  }
  if (expense.fuelType) {
    formData.append('fuelType', expense.fuelType);
  }
  if (expense.outStation) {
    formData.append('outStation', expense.outStation);
  }
  if (expense.arrivalDate) {
    formData.append('arrivalDate', expense.arrivalDate);
  }
  if (expense.arrivalTime) {
    formData.append('arrivalTime', expense.arrivalTime);
  }
  if (expense.departureDate) {
    formData.append('departureDate', expense.departureDate);
  }
  if (expense.departureTime) {
    formData.append('departureTime', expense.departureTime);
  }
  if (expense.durationHours !== undefined && expense.durationHours !== null) {
    formData.append('durationHours', String(expense.durationHours));
  }
  if (expense.durationDays !== undefined && expense.durationDays !== null) {
    formData.append('durationDays', String(expense.durationDays));
  }
  if (expense.travelAllowanceAmount !== undefined && expense.travelAllowanceAmount !== null) {
    formData.append('travelAllowanceAmount', String(expense.travelAllowanceAmount));
  }
  if (expense.selectedFile) {
    formData.append('file', expense.selectedFile);
  }
  return formData;
}

export async function createExpenseRecord(expense: ExpenseRecord): Promise<void> {
  const payload = await apiFetch('/api/expenses', {
    method: 'POST',
    body: buildExpenseFormData(expense),
  });
  if (!payload?.success) {
    throw new Error('Create failed');
  }
}

export async function updateExpenseRecord(expense: ExpenseRecord): Promise<void> {
  const id = expense.expenseId;
  if (!id) {
    throw new Error('Missing expenseId');
  }
  const payload = await apiFetch(`/api/expenses/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: buildExpenseFormData(expense),
  });
  if (!payload?.success) {
    throw new Error('Update failed');
  }
}

export async function fetchExpensesPage(cursor?: string): Promise<PaginatedResponse<ExpenseRecord>> {
  const page = await fetchPaginatedList<Record<string, unknown>>('/api/expenses', cursor);
  return {
    data: page.data.map((row) => normalizeExpenseRow(row)),
    nextCursor: page.nextCursor,
  };
}

const AUDIT_PAGE_SIZE = 100;

export type AuditExpenseFilters = {
  employeeId: string;
  month: string;
  year: string;
};

async function fetchAuditEmployeesPage(cursor?: string): Promise<PaginatedResponse<UserMaster>> {
  const page = await fetchPaginatedList<EmployeeListDto>('/api/expenses/audit/employees', cursor);
  return {
    data: page.data.map((emp) => mapApiEmployee(emp)),
    nextCursor: page.nextCursor,
  };
}

/** Loads all employee pages for Audit Expenses filter dropdown. */
export async function fetchAuditEmployeeDirectory(): Promise<UserMaster[]> {
  const all: UserMaster[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchAuditEmployeesPage(cursor);
    all.push(...page.data);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

export async function fetchAuditExpensesFiltered(
  filters: AuditExpenseFilters,
  cursor?: string,
): Promise<PaginatedResponse<ExpenseRecord>> {
  const params = new URLSearchParams({ limit: String(AUDIT_PAGE_SIZE) });
  if (filters.employeeId !== 'all') {
    params.set('employeeId', filters.employeeId);
  }
  if (filters.month !== 'all') {
    params.set('month', filters.month);
  }
  if (filters.year !== 'all') {
    params.set('year', filters.year);
  }
  if (cursor) {
    params.set('cursor', cursor);
  }

  const payload = await apiFetch(`/api/expenses/audit?${params.toString()}`);
  if (!payload?.success) {
    throw new Error(
      typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message
        : 'Failed to fetch audit expenses',
    );
  }
  const data = Array.isArray(payload.data) ? (payload.data as Record<string, unknown>[]) : [];
  return {
    data: data.map((row) => normalizeExpenseRow(row)),
    nextCursor: (payload.nextCursor as string | null | undefined) ?? null,
  };
}

export async function fetchExpenseDetail(expenseId: string): Promise<ExpenseRecord> {
  const res = (await apiFetch(`/api/expenses/${encodeURIComponent(expenseId)}`)) as {
    success?: boolean;
    data?: Record<string, unknown>;
    message?: string;
  };
  if (!res?.success || !res.data) {
    throw new Error(res?.message || 'Failed to load expense');
  }
  return normalizeExpenseRow(res.data);
}

export async function fetchExpenseFullDetails(expenseId: string): Promise<{
  expense: ExpenseRecord;
  documents: ExpenseDocument[];
}> {
  const res = (await apiFetch(`/api/expenses/${encodeURIComponent(expenseId)}/full`)) as {
    success?: boolean;
    data?: {
      expense?: Record<string, unknown>;
      documents?: ExpenseDocument[];
    };
    message?: string;
  };

  if (!res?.success || !res.data?.expense) {
    throw new Error(
      typeof res?.message === 'string' && res.message.trim()
        ? res.message
        : 'Failed to load expense details',
    );
  }

  return {
    expense: normalizeExpenseRow(res.data.expense),
    documents: Array.isArray(res.data.documents) ? res.data.documents : [],
  };
}

export async function approveExpenseAudit(expenseId: string): Promise<ExpenseRecord> {
  const res = (await apiFetch(`/api/expenses/${encodeURIComponent(expenseId)}/approve`, {
    method: 'POST',
  })) as { success?: boolean; data?: Record<string, unknown>; message?: string };
  if (!res?.success || !res.data) {
    throw new Error(res?.message || 'Failed to approve expense');
  }
  return normalizeExpenseRow(res.data);
}

export async function fetchPendingPreviousExportExpenses(options: {
  month: string;
  year: string;
  employeeCode?: string;
}): Promise<ExpenseRecord[]> {
  const params = new URLSearchParams({
    month: options.month,
    year: options.year,
  });
  if (options.employeeCode) {
    params.set('employeeCode', options.employeeCode);
  }
  const res = (await apiFetch(`/api/expenses/export/pending-previous?${params.toString()}`)) as {
    success?: boolean;
    data?: Record<string, unknown>[];
    message?: string;
  };
  if (!res?.success || !Array.isArray(res.data)) {
    throw new Error(res?.message || 'Failed to load pending previous expenses');
  }
  return res.data.map((row) => normalizeExpenseRow(row));
}

export async function markExpenseExportStatuses(payload: {
  expenseIds: string[];
  status: 'Exported' | 'Skipped';
  exportedMonth?: string;
  exportedYear?: string;
  exportBatch?: string;
}): Promise<ExpenseRecord[]> {
  const res = (await apiFetch('/api/expenses/export/mark-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })) as { success?: boolean; data?: Record<string, unknown>[]; message?: string };
  if (!res?.success || !Array.isArray(res.data)) {
    throw new Error(res?.message || 'Failed to update export status');
  }
  return res.data.map((row) => normalizeExpenseRow(row));
}

export async function rejectExpenseAudit(expenseId: string, reason?: string): Promise<ExpenseRecord> {
  const res = (await apiFetch(`/api/expenses/${encodeURIComponent(expenseId)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason ?? '' }),
  })) as { success?: boolean; data?: Record<string, unknown>; message?: string };
  if (!res?.success || !res.data) {
    throw new Error(res?.message || 'Failed to reject expense');
  }
  return normalizeExpenseRow(res.data);
}

/** @deprecated Use fetchExpensesPage + infinite query */
export async function fetchExpensesList(): Promise<ExpenseRecord[]> {
  const all: ExpenseRecord[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchExpensesPage(cursor);
    all.push(...page.data);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

export async function fetchExpenseTravelRates(): Promise<ExpenseTravelRateSettings> {
  const res = (await apiFetch('/api/expenses/settings/travel-rates')) as {
    success?: boolean;
    message?: string;
    data?: unknown;
  };
  if (!res?.success) {
    throw new Error(
      typeof res?.message === 'string' && res.message.trim()
        ? res.message
        : 'Failed to load travel rates',
    );
  }
  const parsed = parseTravelRatesApiData(res.data);
  if (!parsed) {
    throw new Error('Invalid travel rates response from server');
  }
  return parsed;
}

export async function fetchPendingExpenseEditRequests(): Promise<ExpenseEditRequest[]> {
  const res = (await apiFetch('/api/expenses/edit-requests/pending')) as {
    success?: boolean;
    data?: ExpenseEditRequest[];
  };
  return Array.isArray(res?.data) ? res.data : [];
}

export async function fetchExpenseEditRequests(expenseId: string): Promise<ExpenseEditRequest[]> {
  const res = (await apiFetch(`/api/expenses/${encodeURIComponent(expenseId)}/edit-requests`)) as {
    success?: boolean;
    data?: ExpenseEditRequest[];
  };
  return Array.isArray(res?.data) ? res.data : [];
}

export async function createExpenseEditRequest(
  expenseId: string,
  body: { requestType: string; requestedValue: string },
): Promise<ExpenseEditRequest> {
  const res = (await apiFetch(`/api/expenses/${encodeURIComponent(expenseId)}/edit-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })) as { success?: boolean; data?: ExpenseEditRequest; message?: string };
  if (!res?.success || !res.data) {
    throw new Error(res?.message || 'Failed to submit edit request');
  }
  return res.data;
}

export async function approveExpenseEditRequest(requestId: string): Promise<ExpenseEditRequest> {
  const res = (await apiFetch(`/api/expenses/edit-requests/${encodeURIComponent(requestId)}/approve`, {
    method: 'POST',
  })) as { success?: boolean; data?: ExpenseEditRequest; message?: string };
  if (!res?.success || !res.data) {
    throw new Error(res?.message || 'Failed to approve expense edit request');
  }
  return res.data;
}

export async function rejectExpenseEditRequest(
  requestId: string,
  adminRemark: string,
): Promise<ExpenseEditRequest> {
  const res = (await apiFetch(`/api/expenses/edit-requests/${encodeURIComponent(requestId)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminRemark }),
  })) as { success?: boolean; data?: ExpenseEditRequest; message?: string };
  if (!res?.success || !res.data) {
    throw new Error(res?.message || 'Failed to reject expense edit request');
  }
  return res.data;
}
