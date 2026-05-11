import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Alert, AlertDescription } from './ui/alert';
import type { ExpenseRecord } from './ExpensesTab';
import { isCanonicalExpenseHead, getSubcategoriesForHead } from '../constants/expenseSubCategories';

interface ExpenseImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (expenses: ExpenseRecord[]) => void;
  isAdmin: boolean;
  currentEmployeeCode: string;
  currentUserName: string;
}

interface ImportPreviewRow {
  expense_head: string;
  sub_category?: string;
  location: string;
  purpose: string;
  service_provider: string;
  bill_number: string;
  date: string;
  amount: string;
  employee_name?: string;
  employee_code?: string;
  month: string;
  year: string;
  status: 'valid' | 'error';
  errors: string[];
}

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function subCategoryImportErrors(row: ImportPreviewRow): string[] {
  const errs: string[] = [];
  if (!isCanonicalExpenseHead(row.expense_head)) {
    return errs;
  }
  const sub = (row.sub_category ?? '').trim();
  if (!sub) {
    errs.push('Sub category is required for this expense head');
    return errs;
  }
  if (!getSubcategoriesForHead(row.expense_head).includes(sub)) {
    errs.push('Sub category does not match expense head');
  }
  return errs;
}

export default function ExpenseImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  isAdmin,
  currentEmployeeCode,
  currentUserName,
}: ExpenseImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm'>(isOpen ? 'upload' : 'upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    
    if (!validTypes.includes(selectedFile.type) && 
        !selectedFile.name.endsWith('.xlsx') && 
        !selectedFile.name.endsWith('.xls') && 
        !selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a valid Excel or CSV file');
      return;
    }

    setFile(selectedFile);
    processFile(selectedFile);
  };

  const processFile = (file: File) => {
    // Simulate file processing with mock data
    // In a real app, you would parse the Excel file here
    toast.info('📄 Processing file...');
    
    setTimeout(() => {
      const mockData: ImportPreviewRow[] = [
        {
          expense_head: 'Travel',
          sub_category: 'Taxi',
          location: 'Delhi',
          purpose: 'Client meeting',
          service_provider: 'Uber',
          bill_number: 'UBR789',
          date: '2024-04-20',
          amount: '850',
          employee_name: isAdmin ? 'John Doe' : currentUserName,
          employee_code: isAdmin ? 'E002' : currentEmployeeCode,
          month: 'April',
          year: '2024',
          status: 'valid',
          errors: [],
        },
        {
          expense_head: 'Food',
          sub_category: 'Lunch',
          location: 'Office',
          purpose: 'Team lunch',
          service_provider: 'Restaurant ABC',
          bill_number: 'ABC/2024/123',
          date: '2024-04-21',
          amount: '3500',
          employee_name: isAdmin ? 'Jane Smith' : currentUserName,
          employee_code: isAdmin ? 'E003' : currentEmployeeCode,
          month: 'April',
          year: '2024',
          status: 'valid',
          errors: [],
        },
        {
          expense_head: 'Travel',
          sub_category: '',
          location: '',
          purpose: '',
          service_provider: 'Ola',
          bill_number: 'OLA456',
          date: '2024-04-22',
          amount: '',
          employee_name: isAdmin ? 'Bob Johnson' : currentUserName,
          employee_code: isAdmin ? 'E004' : currentEmployeeCode,
          month: 'April',
          year: '2024',
          status: 'error',
          errors: ['Missing location', 'Missing purpose', 'Missing amount'],
        },
      ];

      const validated = mockData.map((row) => {
        const subErrs = subCategoryImportErrors(row);
        const mergedErrors = [...row.errors, ...subErrs];
        return {
          ...row,
          errors: mergedErrors,
          status: mergedErrors.length > 0 ? ('error' as const) : ('valid' as const),
        };
      });

      setPreviewData(validated);
      setStep('preview');
      toast.success('✅ File processed successfully');
    }, 1500);
  };

  const handleImport = () => {
    const validRows = previewData.filter(row => row.status === 'valid');
    
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    const expenses: ExpenseRecord[] = validRows.map((row) => ({
      expenseId: '',
      expenseHead: row.expense_head,
      subCategory: row.sub_category?.trim() || undefined,
      location: row.location,
      purpose: row.purpose,
      serviceProvider: row.service_provider,
      billNumber: row.bill_number,
      date: row.date,
      amount: parseFloat(row.amount),
      employeeName: row.employee_name || currentUserName,
      monthYear: `${months.indexOf(row.month) + 1}`.padStart(2, '0') + `-${row.year}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
    }));

    onImportSuccess(expenses);
    handleClose();
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setPreviewData([]);
    onClose();
  };

  const validCount = previewData.filter(row => row.status === 'valid').length;
  const errorCount = previewData.filter(row => row.status === 'error').length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Expenses from Excel</DialogTitle>
          <DialogDescription>
            Upload an Excel file with expense data to bulk import records
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging ? 'border-[#007BFF] bg-blue-50' : 'border-gray-300'
              }`}
            >
              <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="mb-2 text-gray-700">Drag and drop your Excel file here</h3>
              <p className="text-sm text-gray-500 mb-4">or</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.xlsx,.xls,.csv';
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files && target.files[0]) {
                      handleFileSelect(target.files[0]);
                    }
                  };
                  input.click();
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </Button>
              <p className="text-xs text-gray-500 mt-4">
                Accepted formats: .xlsx, .xls, .csv
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Expected columns:</strong> Expense Head, Sub Category, Location, Purpose, Service Provider, 
                Bill Number, Date, Amount{isAdmin ? ', Employee Name' : ''}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <FileSpreadsheet className="w-8 h-8 text-[#007BFF]" />
                <div>
                  <p className="text-sm">{file?.name}</p>
                  <p className="text-xs text-gray-500">{previewData.length} rows found</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">{validCount} Valid</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm">{errorCount} Errors</span>
                </div>
              </div>
            </div>

            <div className="border rounded-lg overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Status</TableHead>
                    <TableHead>Expense Head</TableHead>
                    <TableHead>Sub Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Bill No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    {isAdmin && <TableHead>Employee</TableHead>}
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={index} className={row.status === 'error' ? 'bg-red-50' : ''}>
                      <TableCell>
                        {row.status === 'valid' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>{row.expense_head}</TableCell>
                      <TableCell>{row.sub_category?.trim() ? row.sub_category : '—'}</TableCell>
                      <TableCell className="max-w-xs truncate">{row.location || '—'}</TableCell>
                      <TableCell className="max-w-xs truncate">{row.purpose || '—'}</TableCell>
                      <TableCell>{row.service_provider}</TableCell>
                      <TableCell>{row.bill_number}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.amount ? `₹${row.amount}` : '—'}</TableCell>
                      {isAdmin && <TableCell>{row.employee_name}</TableCell>}
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <div className="text-xs text-red-600">
                            {row.errors.map((err, i) => (
                              <div key={i}>• {err}</div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-green-600">✓ Valid</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {errorCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {errorCount} row(s) have errors and will be skipped. Only valid rows will be imported.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setStep('upload');
                  setFile(null);
                  setPreviewData([]);
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                className="bg-[#007BFF] hover:bg-[#0056b3]"
                disabled={validCount === 0}
              >
                Import {validCount} Record{validCount !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
