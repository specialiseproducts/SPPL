import { useEffect, useMemo, useState } from 'react';
import { Plus, Download, Upload, Search, Edit, Trash2, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import ExpenseFormModal from './ExpenseFormModal';
import ExpenseImportModal from './ExpenseImportModal';
import ExpenseRateSettingsModal, {
  type ExpenseTravelRateSettings,
} from './ExpenseRateSettingsModal';
import type { UserRole } from '../App';
import type { UserMaster } from './UserCreationTab';
import { apiFetch } from '../services/api';
import { isTravelCarOrBike } from '../utils/expenseAmountCalculation';
import { parseTravelRatesApiData } from '../utils/expenseTravelRatesFromApi';
import { fetchExpenseTravelRates } from '../hooks/expenses/expensesApi';
import {
  useExpenseTravelRatesQuery,
  useExpensesListQuery,
  useInvalidateExpenseTravelRates,
  useInvalidateExpensesList,
} from '../hooks/expenses/useExpensesQueries';
import {
  canCreate,
  canDelete,
  canEdit,
  canExport,
  isAdmin,
  isDeveloper,
  isSuperAdmin,
} from '../utils/accessControl';

import type { ExpenseRecord } from '../types/expenses';

export type { ExpenseRecord } from '../types/expenses';

interface ExpensesTabProps {
  userRole: UserRole;
  /** When true, list and filters behave like a standard user (own records only); CRUD still follows userRole. Used for Admin/Super Admin "My Expenses" tab. */
  scopeSelfOnly?: boolean;
  currentUserName: string;
  currentEmployeeCode: string;
  availableUsers: UserMaster[];
}

const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const years = Array.from({ length: 11 }, (_, i) => (2020 + i).toString());

const DEFAULT_TRAVEL_RATES: ExpenseTravelRateSettings = {
  car: { petrolDieselRate: 0, electricRate: 0 },
  bike: { petrolDieselRate: 0, electricRate: 0 },
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? 'Request failed');
}

/** Table / export: show em dash when value is missing or blank */
function displayCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

function formatKm(km: number | undefined): string {
  if (km === undefined || km === null || Number.isNaN(Number(km))) return '—';
  return String(km);
}

function formatDateCell(iso: string | undefined): string {
  if (!iso || String(iso).trim() === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB');
}

function escapeCsvCell(value: string): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function ExpensesTab({
  userRole,
  scopeSelfOnly = false,
  currentUserName,
  currentEmployeeCode,
  availableUsers,
}: ExpensesTabProps) {
  const expensesQuery = useExpensesListQuery();
  const invalidateExpensesList = useInvalidateExpensesList();
  const invalidateTravelRates = useInvalidateExpenseTravelRates();
  const travelRatesQuery = useExpenseTravelRatesQuery(isSuperAdmin(userRole));

  const expenses = expensesQuery.data ?? [];
  const travelRates = travelRatesQuery.data ?? DEFAULT_TRAVEL_RATES;

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRateSettingsOpen, setIsRateSettingsOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  const privileged = !scopeSelfOnly && (isAdmin(userRole) || isDeveloper(userRole));
  const canCreateRecords = canCreate(userRole);
  const canEditRecords = canEdit(userRole);
  const canDeleteRecords = canDelete(userRole);
  const canExportRecords = canExport(userRole);

  useEffect(() => {
    if (expensesQuery.isError && expensesQuery.data === undefined) {
      console.error('Expenses fetch error:', expensesQuery.error);
      toast.error('Failed to load expenses');
    }
  }, [expensesQuery.isError, expensesQuery.error, expensesQuery.data]);

  useEffect(() => {
    if (travelRatesQuery.isError && travelRatesQuery.data === undefined) {
      console.error('Travel rates fetch error:', travelRatesQuery.error);
      toast.error(getErrorMessage(travelRatesQuery.error));
    }
  }, [travelRatesQuery.isError, travelRatesQuery.error, travelRatesQuery.data]);

  const handleSaveTravelRates = async (rates: ExpenseTravelRateSettings) => {
    try {
      const res = (await apiFetch('/api/expenses/settings/travel-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rates),
      })) as { success?: boolean; message?: string; data?: unknown };
      const parsed = parseTravelRatesApiData(res?.data);
      if (!res?.success || !parsed) {
        throw new Error(
          typeof res?.message === 'string' && res.message.trim()
            ? res.message
            : 'Failed to save settings'
        );
      }
      setIsRateSettingsOpen(false);
      toast.success('Expense rate settings saved');
      void invalidateTravelRates();
    } catch (error) {
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  const handleCreateExpense = async (expense: ExpenseRecord) => {
    try {
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

      if (expense.selectedFile) {
        formData.append('file', expense.selectedFile);
      }

      const payload = await apiFetch('/api/expenses', {
        method: 'POST',
        body: formData,
      });
      if (!payload.success) {
        throw new Error('Create failed');
      }

      void invalidateExpensesList();
      setIsFormModalOpen(false);
      toast.success('Expense Record Created Successfully');
    } catch (error) {
      console.error('Create expense error:', error);
      toast.error(getErrorMessage(error));
    }
  };

  const handleEditExpense = async (expense: ExpenseRecord) => {
    try {
      const id = editingExpense?.expenseId;
      if (!id) {
        throw new Error('Missing expenseId');
      }

      const {
        expenseHead,
        subCategory,
        location,
        purpose,
        serviceProvider,
        billNumber,
        amount,
        date,
        monthYear,
        selectedFile,
        fromLocation,
        toLocation,
        returnType,
        kilometers,
        stayDateFrom,
        stayDateTo,
      } = expense;

      const travelCarBike = isTravelCarOrBike(expenseHead, subCategory ?? '');

      const formData = new FormData();
      formData.append('expenseHead', expenseHead);
      if (subCategory) {
        formData.append('subCategory', subCategory);
      }
      formData.append('location', location);
      formData.append('purpose', purpose);
      if (!travelCarBike) {
        formData.append('serviceProvider', serviceProvider);
        formData.append('billNumber', billNumber);
      }
      formData.append('amount', String(amount));
      formData.append('date', date);
      formData.append('monthYear', monthYear);
      if (fromLocation) {
        formData.append('fromLocation', fromLocation);
      }
      if (toLocation) {
        formData.append('toLocation', toLocation);
      }
      if (returnType) {
        formData.append('returnType', returnType);
      }
      if (kilometers !== undefined && kilometers !== null) {
        formData.append('kilometers', String(kilometers));
      }
      if (stayDateFrom) {
        formData.append('stayDateFrom', stayDateFrom);
      }
      if (stayDateTo) {
        formData.append('stayDateTo', stayDateTo);
      }
      if (expense.supportingDocument && !travelCarBike) {
        formData.append('supportingDocument', expense.supportingDocument);
      }
      if (expense.fuelType) {
        formData.append('fuelType', expense.fuelType);
      }

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const payload = await apiFetch(`/api/expenses/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: formData,
      });
      if (!payload.success) {
        throw new Error('Update failed');
      }

      void invalidateExpensesList();
      setEditingExpense(null);
      toast.success('Expense Record Updated Successfully');
    } catch (error) {
      console.error('Update expense error:', error);
      toast.error(getErrorMessage(error));
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    const expense = expenses.find((entry) => entry.expenseId === expenseId);
    if (!expense) {
      return;
    }

    if (!window.confirm(`Are you sure you want to delete this expense record for ${expense.employeeName}?`)) {
      return;
    }

    try {
      const payload = await apiFetch(`/api/expenses/${encodeURIComponent(expenseId)}`, {
        method: 'DELETE',
      });
      if (!payload.success) {
        throw new Error('Delete failed');
      }

      void invalidateExpensesList();
      toast.success('Expense Record Deleted');
    } catch (error) {
      console.error('Delete expense error:', error);
      toast.error(getErrorMessage(error));
    }
  };

  const handleImportSuccess = (importedExpenses: ExpenseRecord[]) => {
    void invalidateExpensesList();
    setIsImportModalOpen(false);
    toast.success(`Successfully imported ${importedExpenses.length} expense records`);
  };

  const handleExportData = () => {
    const rows = filteredExpenses;
    if (rows.length === 0) {
      toast.info('No expense rows to export for the current filters.');
      return;
    }

    const headers = [
      'Sr. #',
      'Expense Head',
      'Sub Category',
      'Location',
      'Purpose',
      'From',
      'To',
      'Return',
      'Kilometers (km)',
      'Stay date (from)',
      'Stay date (to)',
      'Service Provider',
      'Bill Number',
      'Date',
      'Amount (Rs)',
      'Document URL',
      'Supporting document',
      'Fuel type',
      ...(privileged ? ['Employee Name'] : []),
      'Month-Year',
    ];

    const lines: string[] = [headers.map(escapeCsvCell).join(',')];

    rows.forEach((expense, index) => {
      const docUrl =
        expense.documents && expense.documents.length > 0
          ? expense.documents[0].fileUrl
          : '';
      const cells = [
        String(index + 1),
        expense.expenseHead,
        expense.subCategory?.trim() ?? '',
        expense.location,
        expense.purpose,
        displayCell(expense.fromLocation),
        displayCell(expense.toLocation),
        displayCell(expense.returnType),
        formatKm(expense.kilometers),
        formatDateCell(expense.stayDateFrom),
        formatDateCell(expense.stayDateTo),
        expense.serviceProvider,
        expense.billNumber,
        formatDateCell(expense.date),
        String(expense.amount),
        docUrl,
        expense.supportingDocument ??
          (expense.documents && expense.documents.length > 0 ? 'Yes' : 'No'),
        displayCell(expense.fuelType),
        ...(privileged ? [expense.employeeName] : []),
        expense.monthYear,
      ];
      lines.push(cells.map(escapeCsvCell).join(','));
    });

    const csv = `\uFEFF${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} expense record(s)`);
  };

  /** Legacy name from template download — same as CSV export (avoids stale JSX / hot-reload crashes). */
  const handleDownloadTemplate = handleExportData;

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (!privileged && expense.employeeName !== currentUserName) {
        return false;
      }

      if (privileged && selectedEmployee !== 'all' && expense.employeeName !== selectedEmployee) {
        return false;
      }

      if (selectedMonth !== 'all' && !expense.monthYear.startsWith(`${selectedMonth}-`)) {
        return false;
      }

      if (selectedYear !== 'all' && !expense.monthYear.endsWith(`-${selectedYear}`)) {
        return false;
      }

      if (searchTerm) {
        const hay = [
          expense.location,
          expense.purpose,
          expense.serviceProvider,
          expense.billNumber,
          expense.expenseHead,
          expense.subCategory ?? '',
          expense.fromLocation ?? '',
          expense.toLocation ?? '',
          expense.returnType ?? '',
          expense.stayDateFrom ?? '',
          expense.stayDateTo ?? '',
          expense.kilometers !== undefined && expense.kilometers !== null
            ? String(expense.kilometers)
            : '',
          expense.fuelType ?? '',
          expense.supportingDocument ?? '',
          expense.employeeName ?? '',
          expense.monthYear ?? '',
        ]
          .join(' ')
          .toLowerCase();
        const tokens = searchTerm
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        return tokens.every((t) => hay.includes(t));
      }

      return true;
    });
  }, [
    expenses,
    privileged,
    currentUserName,
    selectedEmployee,
    selectedMonth,
    selectedYear,
    searchTerm,
  ]);

  const isInitialLoading = expensesQuery.isPending && expensesQuery.data === undefined;
  const showEmptyState =
    !isInitialLoading && !expensesQuery.isError && filteredExpenses.length === 0;

  return (
    <Card className="p-6">
      <div className="flex justify-end mb-6">
        <div className="flex gap-2">
          {canExportRecords && (
            <Button
              onClick={handleDownloadTemplate}
              variant="outline"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export Data
            </Button>
          )}
          {isSuperAdmin(userRole) && (
            <Button
              type="button"
              onClick={() => setIsRateSettingsOpen(true)}
              variant="outline"
              size="icon"
              title="Expense rate settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
          {canCreateRecords && (
            <Button
              onClick={() => setIsImportModalOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Import from Excel
            </Button>
          )}
          {canCreateRecords && (
            <Button
              onClick={() => setIsFormModalOpen(true)}
              className="bg-[#007BFF] hover:bg-[#0056b3] gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New Record
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        {privileged && (
          <div className="space-y-2">
            <label className="text-sm">Employee Name</label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {availableUsers.map(user => (
                  <SelectItem key={user.employee_code} value={user.name}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        <div className="space-y-2">
          <label className="text-sm">Month</label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <SelectValue placeholder="All Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {months.map(month => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm">Year</label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger>
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map(year => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Location, purpose, from, to, km, hotel dates, provider..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="border rounded-lg overflow-hidden">
        <TooltipProvider>
          <div className="w-full overflow-x-auto">
          <Table className="min-w-[1280px]">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap">Sr. #</TableHead>
                <TableHead className="whitespace-nowrap">Expense Head</TableHead>
                <TableHead className="whitespace-nowrap">Sub Category</TableHead>
                <TableHead className="whitespace-nowrap">Location</TableHead>
                <TableHead className="whitespace-nowrap">Purpose</TableHead>
                <TableHead className="whitespace-nowrap">From</TableHead>
                <TableHead className="whitespace-nowrap">To</TableHead>
                <TableHead className="whitespace-nowrap">Return</TableHead>
                <TableHead className="whitespace-nowrap">Kilometers (km)</TableHead>
                <TableHead className="whitespace-nowrap">Stay date (from)</TableHead>
                <TableHead className="whitespace-nowrap">Stay date (to)</TableHead>
                <TableHead className="whitespace-nowrap">Service Provider</TableHead>
                <TableHead className="whitespace-nowrap">Bill Number</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">Amount (Rs)</TableHead>
                <TableHead className="whitespace-nowrap">Document</TableHead>
                <TableHead className="whitespace-nowrap">Supporting doc.</TableHead>
                <TableHead className="whitespace-nowrap">Fuel type</TableHead>
                {privileged && <TableHead className="whitespace-nowrap">Employee Name</TableHead>}
                <TableHead className="whitespace-nowrap">Month-Year</TableHead>
                <TableHead className="whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isInitialLoading ? (
                <TableRow>
                  <TableCell colSpan={privileged ? 21 : 20} className="text-center py-8 text-gray-500">
                    Loading expense records…
                  </TableCell>
                </TableRow>
              ) : showEmptyState ? (
                <TableRow>
                  <TableCell colSpan={privileged ? 21 : 20} className="text-center py-8 text-gray-500">
                    No expense records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense, index) => (
                  <TableRow key={expense.expenseId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <TableCell className="whitespace-nowrap">{index + 1}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                        {expense.expenseHead}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-800">
                        {expense.subCategory?.trim() ? expense.subCategory : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[10rem]">
                      <div className="truncate" title={expense.location || undefined}>
                        {displayCell(expense.location)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[10rem]">
                      <div className="truncate" title={expense.purpose || undefined}>
                        {displayCell(expense.purpose)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[8rem]">
                      <div className="truncate" title={expense.fromLocation || undefined}>
                        {displayCell(expense.fromLocation)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[8rem]">
                      <div className="truncate" title={expense.toLocation || undefined}>
                        {displayCell(expense.toLocation)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[6rem]">
                      <div className="truncate" title={expense.returnType || undefined}>
                        {displayCell(expense.returnType)}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {formatKm(expense.kilometers)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateCell(expense.stayDateFrom)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateCell(expense.stayDateTo)}</TableCell>
                    <TableCell>{displayCell(expense.serviceProvider)}</TableCell>
                    <TableCell>{displayCell(expense.billNumber)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {expense.date ? new Date(expense.date).toLocaleDateString('en-GB') : '—'}
                    </TableCell>
                    <TableCell>₹{expense.amount.toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      {expense.documents && expense.documents.length > 0 ? (
                        <a
                          href={expense.documents[0].fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            border: '1.5px solid #2563eb',
                            borderRadius: '6px',
                            color: '#2563eb',
                            textDecoration: 'none',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#eff6ff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          👁
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {expense.supportingDocument ??
                        (expense.documents && expense.documents.length > 0 ? 'Yes' : 'No')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{displayCell(expense.fuelType)}</TableCell>
                    {privileged && <TableCell>{displayCell(expense.employeeName)}</TableCell>}
                    <TableCell className="whitespace-nowrap">{displayCell(expense.monthYear)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {canEditRecords && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setEditingExpense(expense)}
                              className="text-[#1D4ED8] hover:text-[#1e40af] transition-colors"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit Expense</p>
                          </TooltipContent>
                        </Tooltip>
                        )}
                        {canDeleteRecords && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleDeleteExpense(expense.expenseId)}
                              className="text-[#EF4444] hover:text-[#dc2626] transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete Expense</p>
                          </TooltipContent>
                        </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </TooltipProvider>
      </div>

      {/* Modals */}
      {canCreateRecords && <ExpenseFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleCreateExpense}
        isAdmin={privileged}
        currentEmployeeCode={currentEmployeeCode}
        currentUserName={currentUserName}
      />}

      {canEditRecords && <ExpenseFormModal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        onSubmit={handleEditExpense}
        isAdmin={privileged}
        currentEmployeeCode={currentEmployeeCode}
        currentUserName={currentUserName}
        initialData={editingExpense || undefined}
        isEdit={true}
      />}

      {canCreateRecords && <ExpenseImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        isAdmin={privileged}
        currentEmployeeCode={currentEmployeeCode}
        currentUserName={currentUserName}
      />}

      {isSuperAdmin(userRole) && (
        <ExpenseRateSettingsModal
          isOpen={isRateSettingsOpen}
          onClose={() => setIsRateSettingsOpen(false)}
          initialRates={travelRates}
          loadRates={fetchExpenseTravelRates}
          onSave={handleSaveTravelRates}
        />
      )}
    </Card>
  );
}