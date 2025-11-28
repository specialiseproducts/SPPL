import { useState } from 'react';
import { Plus, Download, Upload, Search, Edit, Trash2, Eye } from 'lucide-react';
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

export interface ExpenseRecord {
  expense_id: string;
  employee_code: string;
  employee_name: string;
  expense_head: string;
  location_purpose: string;
  service_provider: string;
  bill_number: string;
  date: string;
  amount: number;
  supporting_file_url: string;
  month: string;
  year: string;
  created_at: string;
  updated_at: string;
}

interface ExpensesTabProps {
  userRole: UserRole;
  currentUserName: string;
  currentEmployeeCode: string;
  availableUsers: UserMaster[];
}

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const years = Array.from({ length: 11 }, (_, i) => (2020 + i).toString());

const initialExpenses: ExpenseRecord[] = [
  {
    expense_id: '1',
    employee_code: 'E001',
    employee_name: 'Admin User',
    expense_head: 'Travel',
    location_purpose: 'Mumbai trip for client meeting with ABC Corp',
    service_provider: 'Ola',
    bill_number: 'OLA12345',
    date: '2024-04-11',
    amount: 540,
    supporting_file_url: '/uploads/expenses/file1.pdf',
    month: 'April',
    year: '2024',
    created_at: '2024-04-11T10:30:00',
    updated_at: '2024-04-11T10:30:00',
  },
  {
    expense_id: '2',
    employee_code: 'E002',
    employee_name: 'John Doe',
    expense_head: 'Food',
    location_purpose: 'Client lunch at Taj Hotel',
    service_provider: 'Taj Restaurant',
    bill_number: 'TAJ/2024/456',
    date: '2024-04-15',
    amount: 2500,
    supporting_file_url: '/uploads/expenses/file2.pdf',
    month: 'April',
    year: '2024',
    created_at: '2024-04-15T14:20:00',
    updated_at: '2024-04-15T14:20:00',
  },
];

export default function ExpensesTab({ userRole, currentUserName, currentEmployeeCode, availableUsers }: ExpensesTabProps) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(initialExpenses);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  const isAdmin = userRole === 'Admin';

  const handleCreateExpense = (expense: ExpenseRecord) => {
    setExpenses([...expenses, expense]);
    setIsFormModalOpen(false);
    toast.success('✅ Expense Record Created Successfully');
  };

  const handleEditExpense = (expense: ExpenseRecord) => {
    setExpenses(expenses.map(e => e.expense_id === expense.expense_id ? expense : e));
    setEditingExpense(null);
    toast.success('✅ Expense Record Updated Successfully');
  };

  const handleDeleteExpense = (expenseId: string) => {
    const expense = expenses.find(e => e.expense_id === expenseId);
    if (expense && confirm(`Are you sure you want to delete this expense record for ${expense.employee_name}? This action cannot be undone.`)) {
      setExpenses(expenses.filter(e => e.expense_id !== expenseId));
      toast.success('✅ Expense Record Deleted');
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
    if (!isAdmin && expense.employee_code !== currentEmployeeCode) {
      return false;
    }

    // Apply admin filters
    if (isAdmin && selectedEmployee && selectedEmployee !== 'all' && expense.employee_code !== selectedEmployee) {
      return false;
    }

    // Apply month filter
    if (selectedMonth && selectedMonth !== 'all' && expense.month !== selectedMonth) {
      return false;
    }

    // Apply year filter
    if (selectedYear && selectedYear !== 'all' && expense.year !== selectedYear) {
      return false;
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        expense.location_purpose.toLowerCase().includes(search) ||
        expense.service_provider.toLowerCase().includes(search) ||
        expense.bill_number.toLowerCase().includes(search) ||
        expense.expense_head.toLowerCase().includes(search)
      );
    }

    return true;
  });

  return (
    <Card className="p-6">
      <div className="flex justify-end mb-6">
        <div className="flex gap-2">
          <Button
            onClick={handleDownloadTemplate}
            variant="outline"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export Data
          </Button>
          <Button
            onClick={() => setIsImportModalOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Import from Excel
          </Button>
          <Button
            onClick={() => setIsFormModalOpen(true)}
            className="bg-[#007BFF] hover:bg-[#0056b3] gap-2"
          >
            <Plus className="w-4 h-4" />
            Create New Record
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        {isAdmin && (
          <div className="space-y-2">
            <label className="text-sm">Employee Name</label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {availableUsers.map(user => (
                  <SelectItem key={user.employee_code} value={user.employee_code}>
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
                {isAdmin && <TableHead>Employee Name</TableHead>}
                <TableHead>Month-Year</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 11 : 10} className="text-center py-8 text-gray-500">
                    No expense records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense, index) => (
                  <TableRow key={expense.expense_id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                        {expense.expense_head}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={expense.location_purpose}>
                        {expense.location_purpose}
                      </div>
                    </TableCell>
                    <TableCell>{expense.service_provider}</TableCell>
                    <TableCell>{expense.bill_number}</TableCell>
                    <TableCell>{new Date(expense.date).toLocaleDateString('en-GB')}</TableCell>
                    <TableCell>₹{expense.amount.toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="text-[#007BFF] hover:text-[#0056b3]">
                            <Eye className="w-5 h-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View Document</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    {isAdmin && <TableCell>{expense.employee_name}</TableCell>}
                    <TableCell>{expense.month} {expense.year}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleDeleteExpense(expense.expense_id)}
                              className="text-[#EF4444] hover:text-[#dc2626] transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete Expense</p>
                          </TooltipContent>
                        </Tooltip>
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
      <ExpenseFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleCreateExpense}
        availableUsers={availableUsers}
        isAdmin={isAdmin}
        currentEmployeeCode={currentEmployeeCode}
        currentUserName={currentUserName}
      />

      <ExpenseFormModal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        onSubmit={handleEditExpense}
        availableUsers={availableUsers}
        isAdmin={isAdmin}
        currentEmployeeCode={currentEmployeeCode}
        currentUserName={currentUserName}
        initialData={editingExpense || undefined}
        isEdit={true}
      />

      <ExpenseImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        isAdmin={isAdmin}
        currentEmployeeCode={currentEmployeeCode}
        currentUserName={currentUserName}
      />
    </Card>
  );
}