import { fetchPaginatedList } from '../../utils/paginatedFetch';
import type { PaginatedResponse } from '../paginationTypes';
import type { EmployeeListDto } from '../../types/employeeListDto';
import type { ExpenseDocument, ExpenseEditRequest, ExpenseRecord } from '../../types/expenses';
import type { UserMaster } from '../../types/userMaster';
import { mapApiEmployee } from '../../utils/mapApiEmployee';
import { normalizeExpenseRow } from '../../utils/expenseRowNormalize';
import type { ExpenseTravelRateSettings } from '../../components/ExpenseRateSettingsModal';
import { parseTravelRatesApiData } from '../../utils/expenseTravelRatesFromApi';
import { isTravelCarOrBike, isTravelTicketTransport } from '../../utils/expenseAmountCalculation';
import { apiFetch } from '../../services/api';

export function buildExpenseFormData(expense: ExpenseRecord): FormData {
  const travelCarBike = isTravelCarOrBike(expense.expenseHead, expense.subCategory ?? '');
  const travelTicket = isTravelTicketTransport(expense.expenseHead, expense.subCategory ?? '');
  const formData = new FormData();
  formData.append('expenseHead', expense.expenseHead);
  if (expense.subCategory) {
    formData.append('subCategory', expense.subCategory);
  }
  formData.append('location', travelTicket ? '' : expense.location);
  formData.append('purpose', expense.purpose);
  if (!travelCarBike) {
    formData.append('serviceProvider', expense.serviceProvider);
    formData.append('billNumber', expense.billNumber);
  }
  formData.append('date', expense.date);
  formData.append('amount', String(expense.amount));
  formData.append('monthYear', expense.monthYear);
  if (expense.pnrNo) {
    formData.append('pnrNo', expense.pnrNo);
  }
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

export async function fetchAuditApprovedTotal(
  filters: AuditExpenseFilters,
): Promise<number> {
  const params = new URLSearchParams();
  if (filters.employeeId !== 'all') {
    params.set('employeeId', filters.employeeId);
  }
  if (filters.month !== 'all') {
    params.set('month', filters.month);
  }
  if (filters.year !== 'all') {
    params.set('year', filters.year);
  }
  const qs = params.toString();
  const payload = await apiFetch(
    `/api/expenses/audit/approved-total${qs ? `?${qs}` : ''}`,
  );
  if (!payload?.success) {
    throw new Error(
      typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message
        : 'Failed to fetch audit approved total',
    );
  }
  const total = Number((payload.data as { total?: number } | undefined)?.total);
  return Number.isFinite(total) ? total : 0;
}

export async function fetchExpenseServiceProviderMasters(): Promise<string[]> {
  const payload = await apiFetch('/api/expenses/masters/service-providers');
  if (!payload?.success) {
    throw new Error(
      typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message
        : 'Failed to load service providers',
    );
  }
  return Array.isArray(payload.data)
    ? (payload.data as unknown[]).map((v) => String(v ?? '').trim()).filter(Boolean)
    : [];
}

export async function fetchExpenseLocationMasters(): Promise<string[]> {
  const payload = await apiFetch('/api/expenses/masters/locations');
  if (!payload?.success) {
    throw new Error(
      typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message
        : 'Failed to load locations',
    );
  }
  return Array.isArray(payload.data)
    ? (payload.data as unknown[]).map((v) => String(v ?? '').trim()).filter(Boolean)
    : [];
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

export type CompanyOverviewKpis = {
  totalExpenses: number;
  highestExpenseMonth: {
    monthYear: string;
    label: string;
    amount: number;
  } | null;
  highestExpenseHead: {
    expenseHead: string;
    amount: number;
  } | null;
  averageMonthlyExpense: number;
  momChange?: {
    percent: number | null;
    latestMonthYear: string;
    latestMonthLabel: string;
    previousMonthYear: string;
    previousMonthLabel: string;
    latestAmount: number;
    previousAmount: number;
  } | null;
};

export type CompanyOverviewMonthlyPoint = {
  monthYear: string;
  label: string;
  amount: number;
};

export type CompanyOverviewExpenseHead = {
  expenseHead: string;
  amount: number;
  percentage: number;
};

export type CompanyOverviewServiceProvider = {
  serviceProvider: string;
  amount: number;
  percentage: number;
};

export type CompanyOverviewEmployeeExpense = {
  employeeCode: string;
  employeeName: string;
  amount: number;
  percentage: number;
};

export type CompanyOverviewLocation = {
  location: string;
  amount: number;
  percentage: number;
};

export type CompanyOverviewPurpose = {
  purpose: string;
  amount: number;
  percentage: number;
  cumulativeAmount: number;
  cumulativePercent: number;
};

export type MonthWaterfallContribution = {
  expenseHead: string;
  change: number;
  currentAmount: number;
  previousAmount: number;
};

export type MonthWaterfallData = {
  previousMonthYear: string;
  previousMonthLabel: string;
  currentMonthYear: string;
  currentMonthLabel: string;
  previousMonthTotal: number;
  currentMonthTotal: number;
  contributions: MonthWaterfallContribution[];
};

export type CompanyOverviewData = {
  period: {
    start: string;
    end: string;
    label: string;
    months: string[];
    monthCount?: number;
    from?: string;
    to?: string;
  };
  kpis: CompanyOverviewKpis;
  monthlyTrend: CompanyOverviewMonthlyPoint[];
  expenseHeads: CompanyOverviewExpenseHead[];
  serviceProviders?: CompanyOverviewServiceProvider[];
  employeesByExpense?: CompanyOverviewEmployeeExpense[];
  locations?: CompanyOverviewLocation[];
  purposes?: CompanyOverviewPurpose[];
  waterfall?: MonthWaterfallData | null;
  location?: string | null;
};

export async function fetchCompanyOverview(params: {
  from: string;
  to: string;
  employeeCode?: string;
  location?: string;
}): Promise<CompanyOverviewData> {
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
  });
  const employeeCode = String(params.employeeCode ?? '').trim();
  if (employeeCode) qs.set('employeeCode', employeeCode);
  const location = String(params.location ?? '').trim();
  if (location) qs.set('location', location);
  const res = (await apiFetch(
    `/api/expenses/dashboard/company-overview?${qs.toString()}`,
  )) as {
    success?: boolean;
    message?: string;
    data?: CompanyOverviewData;
  };
  if (!res?.success || !res.data) {
    throw new Error(
      typeof res?.message === 'string' && res.message.trim()
        ? res.message
        : 'Failed to load company overview analytics',
    );
  }
  return res.data;
}

export type DashboardEmployeeOption = {
  employeeCode: string;
  employeeName: string;
};

export async function fetchDashboardEmployees(): Promise<DashboardEmployeeOption[]> {
  const res = (await apiFetch('/api/expenses/dashboard/employees')) as {
    success?: boolean;
    message?: string;
    data?: { employees?: DashboardEmployeeOption[] };
  };
  if (!res?.success || !res.data) {
    throw new Error(
      typeof res?.message === 'string' && res.message.trim()
        ? res.message
        : 'Failed to load dashboard employees',
    );
  }
  return Array.isArray(res.data.employees) ? res.data.employees : [];
}

export type ExpenseHeadAnalysisSubcategory = {
  subCategory: string;
  amount: number;
  count: number;
  percentage: number;
};

export type ExpenseHeadAnalysisData = {
  period: {
    start: string;
    end: string;
    label: string;
    months: string[];
    monthCount?: number;
    from?: string;
    to?: string;
  };
  expenseHead: string;
  kpis: {
    totalExpenses: number;
    recordCount: number;
  };
  subcategories: ExpenseHeadAnalysisSubcategory[];
};

export async function fetchExpenseHeadAnalysis(params: {
  from: string;
  to: string;
  expenseHead: string;
  employeeCode?: string;
  location?: string;
}): Promise<ExpenseHeadAnalysisData> {
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
    expenseHead: params.expenseHead,
  });
  const employeeCode = String(params.employeeCode ?? '').trim();
  if (employeeCode) qs.set('employeeCode', employeeCode);
  const location = String(params.location ?? '').trim();
  if (location) qs.set('location', location);
  const res = (await apiFetch(
    `/api/expenses/dashboard/company-overview?${qs.toString()}`,
  )) as {
    success?: boolean;
    message?: string;
    data?: ExpenseHeadAnalysisData;
  };
  if (!res?.success || !res.data) {
    throw new Error(
      typeof res?.message === 'string' && res.message.trim()
        ? res.message
        : 'Failed to load expense head analytics',
    );
  }
  return res.data;
}

export type ExpenseSubcategoryTransaction = {
  expenseId: string;
  date: string;
  dateLabel: string;
  employeeName: string;
  employeeId?: string;
  expenseHead?: string;
  subCategory?: string;
  outStation?: string;
  billNumber: string;
  amount: number;
  serviceProvider: string;
  purpose: string;
  location?: string;
  pnrNo?: string;
  fromLocation?: string;
  toLocation?: string;
  returnType?: string;
  kilometers?: number | null;
  stayDateFrom?: string;
  stayDateTo?: string;
  fuelType?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  departureDate?: string;
  departureTime?: string;
  durationHours?: number | null;
  durationDays?: number | null;
  travelAllowanceAmount?: number | null;
  supportingDocument: string;
  documentUrl: string;
  documentFileName: string;
  auditStatus?: string;
  monthYear: string;
};

export type ExpenseSubcategoryAnalysisData = {
  period: {
    start: string;
    end: string;
    label: string;
    months: string[];
    monthCount?: number;
    from?: string;
    to?: string;
  };
  expenseHead: string;
  subCategory: string;
  kpis: {
    totalExpenses: number;
    recordCount: number;
  };
  transactions: ExpenseSubcategoryTransaction[];
};

export async function fetchExpenseSubcategoryAnalysis(params: {
  from: string;
  to: string;
  expenseHead: string;
  subCategory: string;
  employeeCode?: string;
  location?: string;
}): Promise<ExpenseSubcategoryAnalysisData> {
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
    expenseHead: params.expenseHead,
    subCategory: params.subCategory,
  });
  const employeeCode = String(params.employeeCode ?? '').trim();
  if (employeeCode) qs.set('employeeCode', employeeCode);
  const location = String(params.location ?? '').trim();
  if (location) qs.set('location', location);
  const res = (await apiFetch(
    `/api/expenses/dashboard/company-overview?${qs.toString()}`,
  )) as {
    success?: boolean;
    message?: string;
    data?: ExpenseSubcategoryAnalysisData;
  };
  if (!res?.success || !res.data) {
    throw new Error(
      typeof res?.message === 'string' && res.message.trim()
        ? res.message
        : 'Failed to load subcategory analytics',
    );
  }
  return res.data;
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
