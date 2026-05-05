import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { ExpenseRecord } from './ExpensesTab';
import type { UserMaster } from './UserCreationTab';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: ExpenseRecord) => void;
  availableUsers: UserMaster[];
  isAdmin: boolean;
  currentEmployeeCode: string;
  currentUserName: string;
  initialData?: ExpenseRecord;
  isEdit?: boolean;
}

const expenseHeads = ['Travel', 'Food', 'Hotel', 'Stationary', 'Fuel', 'Internet', 'Phone', 'Misc.'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function ExpenseFormModal({
  isOpen,
  onClose,
  onSubmit,
  availableUsers,
  isAdmin,
  currentEmployeeCode,
  currentUserName,
  initialData,
  isEdit
}: ExpenseFormModalProps) {
  const [formData, setFormData] = useState({
    expense_head: initialData?.expense_head || 'Travel',
    location_purpose: initialData?.location_purpose || '',
    service_provider: initialData?.service_provider || '',
    bill_number: initialData?.bill_number || '',
    date: initialData?.date || '',
    amount: initialData?.amount?.toString() || '',
    employee_code: initialData?.employee_code || (isAdmin ? '' : currentEmployeeCode),
    month: initialData?.month || '',
    year: initialData?.year || '',
    supporting_file: null as File | null,
  });

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        expense_head: initialData.expense_head,
        location_purpose: initialData.location_purpose,
        service_provider: initialData.service_provider,
        bill_number: initialData.bill_number,
        date: initialData.date,
        amount: initialData.amount.toString(),
        employee_code: initialData.employee_code,
        month: initialData.month,
        year: initialData.year,
        supporting_file: null,
      });
    } else {
      setFormData({
        expense_head: 'Travel',
        location_purpose: '',
        service_provider: '',
        bill_number: '',
        date: '',
        amount: '',
        employee_code: isAdmin ? '' : currentEmployeeCode,
        month: '',
        year: '',
        supporting_file: null,
      });
    }
  }, [initialData, isOpen, isAdmin, currentEmployeeCode]);

  // Auto-detect month and year from date
  useEffect(() => {
    if (formData.date) {
      const dateObj = new Date(formData.date);
      const monthName = months[dateObj.getMonth()];
      const yearStr = dateObj.getFullYear().toString();
      setFormData(prev => ({ ...prev, month: monthName, year: yearStr }));
    }
  }, [formData.date]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, supporting_file: e.target.files[0] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.employee_code) {
      toast.error('Please select an employee');
      return;
    }
    if (!formData.location_purpose.trim()) {
      toast.error('Please enter location and purpose');
      return;
    }
    if (!formData.service_provider.trim()) {
      toast.error('Please enter service provider name');
      return;
    }
    if (!formData.bill_number.trim()) {
      toast.error('Please enter bill number or "NA"');
      return;
    }
    if (!formData.date) {
      toast.error('Please select a date');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const selectedUser = availableUsers.find(u => u.employee_code === formData.employee_code);
    const employeeName = selectedUser ? selectedUser.name : currentUserName;

    const expense: ExpenseRecord = {
      expense_id: isEdit && initialData ? initialData.expense_id : Date.now().toString(),
      employee_code: formData.employee_code,
      employee_name: employeeName,
      expense_head: formData.expense_head,
      location_purpose: formData.location_purpose,
      service_provider: formData.service_provider,
      bill_number: formData.bill_number,
      date: formData.date,
      amount: parseFloat(formData.amount),
      supporting_file_url: formData.supporting_file 
        ? `/uploads/expenses/${formData.supporting_file.name}` 
        : initialData?.supporting_file_url || '',
      month: formData.month,
      year: formData.year,
      created_at: initialData?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSubmit(expense);
    
    // Reset form only if not editing
    if (!isEdit) {
      setFormData({
        expense_head: 'Travel',
        location_purpose: '',
        service_provider: '',
        bill_number: '',
        date: '',
        amount: '',
        employee_code: isAdmin ? '' : currentEmployeeCode,
        month: '',
        year: '',
        supporting_file: null,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Expense Record' : 'Create New Expense Record'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update expense details below' : 'Fill in the expense details below'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Employee Name (Admin only) */}
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="employee">Employee Name *</Label>
                <Select 
                  value={formData.employee_code} 
                  onValueChange={(value) => setFormData({ ...formData, employee_code: value })}
                >
                  <SelectTrigger id="employee">
                    <SelectValue placeholder="Select Employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map(user => (
                      <SelectItem key={user.employee_code} value={user.employee_code}>
                        {user.name} — {user.employee_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Expense Head */}
            <div className="space-y-2">
              <Label htmlFor="expense_head">Expense Head *</Label>
              <Select 
                value={formData.expense_head} 
                onValueChange={(value) => setFormData({ ...formData, expense_head: value })}
              >
                <SelectTrigger id="expense_head">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseHeads.map(head => (
                    <SelectItem key={head} value={head}>
                      {head}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (Rs) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
          </div>

          {/* Location & Purpose */}
          <div className="space-y-2">
            <Label htmlFor="location_purpose">Location & Purpose *</Label>
            <Textarea
              id="location_purpose"
              placeholder="Enter location and purpose of expense"
              rows={3}
              value={formData.location_purpose}
              onChange={(e) => setFormData({ ...formData, location_purpose: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Service Provider */}
            <div className="space-y-2">
              <Label htmlFor="service_provider">Service Provider Name *</Label>
              <Input
                id="service_provider"
                placeholder="Enter service provider"
                value={formData.service_provider}
                onChange={(e) => setFormData({ ...formData, service_provider: e.target.value })}
              />
            </div>

            {/* Bill Number */}
            <div className="space-y-2">
              <Label htmlFor="bill_number">Bill Number *</Label>
              <Input
                id="bill_number"
                placeholder="Enter bill number or NA"
                value={formData.bill_number}
                onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
              />
            </div>
          </div>

          {/* Month-Year (Auto-detected) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month">Month (Auto-detected)</Label>
              <Input
                id="month"
                value={formData.month}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year (Auto-detected)</Label>
              <Input
                id="year"
                value={formData.year}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>

          {/* Supporting Document */}
          <div className="space-y-2">
            <Label htmlFor="supporting_file">Supporting Document</Label>
            <div className="flex items-center gap-3">
              <Input
                id="supporting_file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                onChange={handleFileChange}
                className="flex-1"
              />
              <Upload className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-xs text-gray-500">Upload PDF, JPG, PNG, or Excel file</p>
            {formData.supporting_file && (
              <p className="text-xs text-green-600">✓ {formData.supporting_file.name}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#007BFF] hover:bg-[#0056b3]">
              Save Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
