import { useEffect, useState } from 'react';
import { Plus, Download, Upload, Search, Edit, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import ExpenseFormModal from './ExpenseFormModal';
import ExpenseImportModal from './ExpenseImportModal';
import type { UserRole } from '../App';
import type { UserMaster } from './UserCreationTab';
import { apiFetch } from '../services/api';
import { canCreate, canDelete, canEdit, canExport, isAdmin, isDeveloper } from '../utils/accessControl';

interface ExpenseDocument {
  documentId?: string;
  fileName: string;
  fileUrl: string;
  uploadedAt?: string;
}

export interface ExpenseRecord {
  expenseId: string;
  expenseHead: string;
  locationPurpose: string;
  serviceProvider: string;
  billNumber: string;
  date: string;
  amount: number;
  employeeName: string;
  monthYear: string;
  createdAt: string;
  updatedAt: string;
  documents?: ExpenseDocument[];
  selectedFile?: File;
}

interface ExpensesTabProps {
  userRole: UserRole;
  currentUserName: string;
  currentEmployeeCode: string;
  availableUsers: UserMaster[];
}

const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const years = Array.from({ length: 11 }, (_, i) => (2020 + i).toString());

export default function ExpensesTab({ userRole, currentUserName, currentEmployeeCode, availableUsers }: ExpensesTabProps) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  const privileged = isAdmin(userRole) || isDeveloper(userRole);
  const canCreateRecords = canCreate(userRole);
  const canEditRecords = canEdit(userRole);
  const canDeleteRecords = canDelete(userRole);
  const canExportRecords = canExport(userRole);

  const fetchExpenses = async () => {
    const payload = await apiFetch('/api/expenses');
    if (!payload.success) {
      throw new Error('Failed to fetch expenses');
    }

    setExpenses(payload.data || []);
  };

  useEffect(() => {
    fetchExpenses().catch((error) => {
      console.error('Expenses fetch error:', error);
      toast.error('Failed to load expenses');
    });
  }, []);

  const handleCreateExpense = async (expense: ExpenseRecord) => {
    try {
      const formData = new FormData();
      formData.append('expenseHead', expense.expenseHead);
      formData.append('locationPurpose', expense.locationPurpose);
      formData.append('serviceProvider', expense.serviceProvider);
      formData.append('billNumber', expense.billNumber);
      formData.append('date', expense.date);
      formData.append('amount', String(expense.amount));
      formData.append('employeeName', expense.employeeName);
      formData.append('monthYear', expense.monthYear);

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

      await fetchExpenses();
      setIsFormModalOpen(false);
      toast.success('✅ Expense Record Created Successfully');
    } catch (error) {
      console.error('Create expense error:', error);
      toast.error('Failed to create expense');
    }
  };

  const handleEditExpense = async (expense: ExpenseRecord) => {
    try {
      const id = editingExpense?.expenseId;
      if (!id) {
        throw new Error('Missing expenseId');
      }

      const { locationPurpose, serviceProvider, billNumber, amount, date, selectedFile } = expense;

      const formData = new FormData();
      formData.append('locationPurpose', locationPurpose);
      formData.append('serviceProvider', serviceProvider);
      formData.append('billNumber', billNumber);
      formData.append('amount', String(amount));
      formData.append('date', date);

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

      await fetchExpenses();
      setEditingExpense(null);
      toast.success('✅ Expense Record Updated Successfully');
    } catch (error) {
      console.error('Update expense error:', error);
      toast.error('Failed to update expense');
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

      await fetchExpenses();
      toast.success('✅ Expense Record Deleted');
    } catch (error) {
      console.error('Delete expense error:', error);
      toast.error('Failed to delete expense');
    }
  };

  const handleImportSuccess = (importedExpenses: ExpenseRecord[]) => {
    setExpenses([...expenses, ...importedExpenses]);
    setIsImportModalOpen(false);
    toast.success(`✅ Successfully imported ${importedExpenses.length} expense records`);
  };

  const handleDownloadTemplate = () => {
    toast.info('📥 Downloading expense template...');
    // In a real app, this would download an Excel template
  };

  // Filter expenses based on role and filters
  const filteredExpenses = expenses.filter(expense => {
    // Employee can only see their own records
    if (!isAdmin && expense.employeeName !== currentUserName) {
      return false;
    }

    // Apply admin filters
    if (isAdmin && selectedEmployee !== 'all' && expense.employeeName !== selectedEmployee) {
      return false;
    }

    // Apply month filter
    if (selectedMonth !== 'all' && !expense.monthYear.startsWith(`${selectedMonth}-`)) {
      return false;
    }

    // Apply year filter
    if (selectedYear !== 'all' && !expense.monthYear.endsWith(`-${selectedYear}`)) {
      return false;
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        expense.locationPurpose.toLowerCase().includes(search) ||
        expense.serviceProvider.toLowerCase().includes(search) ||
        expense.billNumber.toLowerCase().includes(search) ||
        expense.expenseHead.toLowerCase().includes(search)
      );
    }

    return true;
  });

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
              placeholder="Location, provider, bill no..."
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
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Sr. #</TableHead>
                <TableHead>Expense Head</TableHead>
                <TableHead>Location & Purpose</TableHead>
                <TableHead>Service Provider</TableHead>
                <TableHead>Bill Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount (Rs)</TableHead>
                <TableHead>Document</TableHead>
                {privileged && <TableHead>Employee Name</TableHead>}
                <TableHead>Month-Year</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={privileged ? 11 : 10} className="text-center py-8 text-gray-500">
                    No expense records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense, index) => (
                  <TableRow key={expense.expenseId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                        {expense.expenseHead}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={expense.locationPurpose}>
                        {expense.locationPurpose}
                      </div>
                    </TableCell>
                    <TableCell>{expense.serviceProvider}</TableCell>
                    <TableCell>{expense.billNumber}</TableCell>
                    <TableCell>{new Date(expense.date).toLocaleDateString('en-GB')}</TableCell>
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
                        '-'
                      )}
                    </TableCell>
                    {privileged && <TableCell>{expense.employeeName}</TableCell>}
                    <TableCell>{expense.monthYear}</TableCell>
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
        </TooltipProvider>
      </div>

      {/* Modals */}
      {canCreateRecords && <ExpenseFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleCreateExpense}
        availableUsers={availableUsers}
        isAdmin={privileged}
        currentEmployeeCode={currentEmployeeCode}
        currentUserName={currentUserName}
      />}

      {canEditRecords && <ExpenseFormModal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        onSubmit={handleEditExpense}
        availableUsers={availableUsers}
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
    </Card>
  );
}