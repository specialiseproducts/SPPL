import { useState, useEffect, useMemo } from 'react';
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
import {
  EXPENSE_HEADS,
  getSubcategoriesForHead,
  isCanonicalExpenseHead,
} from '../constants/expenseSubCategories';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: ExpenseRecord) => void | Promise<void>;
  availableUsers: UserMaster[];
  isAdmin: boolean;
  currentEmployeeCode: string;
  currentUserName: string;
  initialData?: ExpenseRecord;
  isEdit?: boolean;
}

export default function ExpenseFormModal({
  isOpen,
  onClose,
  onSubmit,
  availableUsers,
  isAdmin,
  currentUserName,
  initialData,
  isEdit
}: ExpenseFormModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const expenseHeadOptions = useMemo(() => {
    const base: string[] = [...EXPENSE_HEADS];
    const legacy = initialData?.expenseHead;
    if (legacy && !base.includes(legacy)) {
      base.push(legacy);
    }
    return base;
  }, [initialData?.expenseHead]);

  const [formData, setFormData] = useState({
    expenseHead: initialData?.expenseHead || 'Travel',
    subCategory: initialData?.subCategory?.trim() || '',
    locationPurpose: initialData?.locationPurpose || '',
    serviceProvider: initialData?.serviceProvider || '',
    billNumber: initialData?.billNumber || '',
    date: initialData?.date || '',
    amount: initialData?.amount?.toString() || '',
    employeeName: initialData?.employeeName || (isAdmin ? '' : currentUserName),
    monthYear: initialData?.monthYear || '',
  });

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      const head = initialData.expenseHead;
      const savedSub = initialData.subCategory?.trim() || '';
      const options = getSubcategoriesForHead(head);
      const subCategory =
        savedSub && options.includes(savedSub) ? savedSub : '';
      setFormData({
        expenseHead: head,
        subCategory,
        locationPurpose: initialData.locationPurpose,
        serviceProvider: initialData.serviceProvider,
        billNumber: initialData.billNumber,
        date: initialData.date,
        amount: initialData.amount.toString(),
        employeeName: initialData.employeeName,
        monthYear: initialData.monthYear,
      });
    } else {
      setFormData({
        expenseHead: 'Travel',
        subCategory: '',
        locationPurpose: '',
        serviceProvider: '',
        billNumber: '',
        date: '',
        amount: '',
        employeeName: isAdmin ? '' : currentUserName,
        monthYear: '',
      });
    }
    setSelectedFile(null);
  }, [initialData, isOpen, isAdmin, currentUserName]);

  // Auto-detect month and year from date
  useEffect(() => {
    if (formData.date) {
      const dateObj = new Date(formData.date);
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const year = String(dateObj.getUTCFullYear());
      setFormData(prev => ({ ...prev, monthYear: `${month}-${year}` }));
    }
  }, [formData.date]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.employeeName) {
      toast.error('Please select an employee');
      return;
    }
    if (!formData.locationPurpose.trim()) {
      toast.error('Please enter location and purpose');
      return;
    }
    if (!formData.serviceProvider.trim()) {
      toast.error('Please enter service provider name');
      return;
    }
    if (!formData.billNumber.trim()) {
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

    if (isCanonicalExpenseHead(formData.expenseHead)) {
      if (!formData.subCategory.trim()) {
        toast.error('Please select a sub category');
        return;
      }
      if (!getSubcategoriesForHead(formData.expenseHead).includes(formData.subCategory)) {
        toast.error('Sub category does not match expense head');
        return;
      }
    }

    const expense: ExpenseRecord = {
      expenseId: isEdit && initialData ? initialData.expenseId : '',
      expenseHead: formData.expenseHead,
      subCategory: formData.subCategory.trim() || undefined,
      locationPurpose: formData.locationPurpose,
      serviceProvider: formData.serviceProvider,
      billNumber: formData.billNumber,
      date: formData.date,
      amount: parseFloat(formData.amount),
      employeeName: formData.employeeName,
      monthYear: formData.monthYear,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      selectedFile: selectedFile || undefined,
      documents: selectedFile
        ? [
            {
              fileName: selectedFile.name,
              fileUrl: `/uploads/expenses/${selectedFile.name}`,
            },
          ]
        : initialData?.documents || [],
    };

    onSubmit(expense);
    
    // Reset form only if not editing
    if (!isEdit) {
      setFormData({
        expenseHead: 'Travel',
        subCategory: '',
        locationPurpose: '',
        serviceProvider: '',
        billNumber: '',
        date: '',
        amount: '',
        employeeName: isAdmin ? '' : currentUserName,
        monthYear: '',
      });
      setSelectedFile(null);
    }
  };

  const subCategoryOptions = getSubcategoriesForHead(formData.expenseHead);
  const subCategoryDisabled =
    !formData.expenseHead || !isCanonicalExpenseHead(formData.expenseHead);

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
                  value={formData.employeeName} 
                  onValueChange={(value) => setFormData({ ...formData, employeeName: value })}
                >
                  <SelectTrigger id="employee">
                    <SelectValue placeholder="Select Employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map(user => (
                      <SelectItem key={user.employee_code} value={user.name}>
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
                value={formData.expenseHead} 
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    expenseHead: value,
                    subCategory: '',
                  })
                }
              >
                <SelectTrigger id="expense_head">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseHeadOptions.map((head) => (
                    <SelectItem key={head} value={head}>
                      {head}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub_category">
                Sub Category{!subCategoryDisabled ? ' *' : ''}
              </Label>
              <Select
                value={formData.subCategory || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, subCategory: value })
                }
                disabled={subCategoryDisabled}
              >
                <SelectTrigger id="sub_category" className={subCategoryDisabled ? 'opacity-70' : ''}>
                  <SelectValue placeholder="Select Sub Category" />
                </SelectTrigger>
                <SelectContent>
                  {subCategoryOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
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
                value={formData.locationPurpose}
                onChange={(e) => setFormData({ ...formData, locationPurpose: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Service Provider */}
            <div className="space-y-2">
              <Label htmlFor="service_provider">Service Provider Name *</Label>
              <Input
                id="service_provider"
                placeholder="Enter service provider"
                value={formData.serviceProvider}
                onChange={(e) => setFormData({ ...formData, serviceProvider: e.target.value })}
              />
            </div>

            {/* Bill Number */}
            <div className="space-y-2">
              <Label htmlFor="bill_number">Bill Number *</Label>
              <Input
                id="bill_number"
                placeholder="Enter bill number or NA"
                value={formData.billNumber}
                onChange={(e) => setFormData({ ...formData, billNumber: e.target.value })}
              />
            </div>
          </div>

          {/* Month-Year (Auto-detected) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthYear">Month-Year (Auto-detected)</Label>
              <Input
                id="monthYear"
                value={formData.monthYear}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>

          {/* Supporting Document */}
          <div className="space-y-2">
            <Label htmlFor="supporting_file">Supporting Document</Label>
            <div className="flex items-center gap-3">
              <input
                id="supporting_file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-sm file:font-medium"
              />
              <Upload className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-xs text-gray-500">Upload PDF, JPG, PNG, or Excel file</p>
            {selectedFile && (
              <p className="text-xs text-green-600">✓ {selectedFile.name}</p>
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
