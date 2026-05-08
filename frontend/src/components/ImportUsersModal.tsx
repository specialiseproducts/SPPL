import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, XCircle, Download, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { UserMaster } from './UserCreationTab';

interface ImportUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (users: UserMaster[]) => void | Promise<void>;
  existingEmployeeCodes: string[];
}

interface ValidationError {
  field: string;
  message: string;
}

interface ParsedRow {
  rowNumber: number;
  data: Partial<UserMaster>;
  errors: ValidationError[];
  warnings: ValidationError[];
  status: 'valid' | 'warning' | 'error';
}

type ImportStep = 'upload' | 'preview' | 'confirm' | 'progress' | 'complete';

export default function ImportUsersModal({ isOpen, onClose, onImport, existingEmployeeCodes }: ImportUsersModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [skipInvalidRows, setSkipInvalidRows] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    failed: number;
    details: string[];
  } | null>(null);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateAadhar = (aadhar: string): boolean => {
    return /^\d{12}$/.test(aadhar);
  };

  const validatePAN = (pan: string): boolean => {
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  };

  const validateIFSC = (ifsc: string): boolean => {
    return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
  };

  const validateAccountNo = (accountNo: string): boolean => {
    return /^\d{9,18}$/.test(accountNo);
  };

  const validateRow = (data: Partial<UserMaster>, _rowNumber: number): { errors: ValidationError[]; warnings: ValidationError[] } => {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required fields
    if (!data.employee_code?.trim()) {
      errors.push({ field: 'employee_code', message: 'Employee Code is required' });
    } else if (existingEmployeeCodes.includes(data.employee_code) && !overwriteExisting) {
      errors.push({ field: 'employee_code', message: `Employee Code ${data.employee_code} already exists` });
    }

    if (!data.first_name?.trim()) {
      errors.push({ field: 'first_name', message: 'First Name is required' });
    }

    if (!data.last_name?.trim()) {
      errors.push({ field: 'last_name', message: 'Last Name is required' });
    }

    if (!data.date_of_joining) {
      errors.push({ field: 'date_of_joining', message: 'Date of Joining is required' });
    }

    if (!data.phone?.trim()) {
      errors.push({ field: 'phone', message: 'Phone Number is required' });
    }

    if (!data.official_email?.trim()) {
      errors.push({ field: 'official_email', message: 'Official Email is required' });
    } else if (!validateEmail(data.official_email)) {
      errors.push({ field: 'official_email', message: 'Invalid email format' });
    }

    // Optional field validations
    if (data.personal_email && !validateEmail(data.personal_email)) {
      errors.push({ field: 'personal_email', message: 'Invalid personal email format' });
    }

    if (data.aadhar_no && !validateAadhar(data.aadhar_no)) {
      errors.push({ field: 'aadhar_no', message: 'Aadhar must be exactly 12 digits' });
    }

    if (data.pan_no && !validatePAN(data.pan_no)) {
      errors.push({ field: 'pan_no', message: 'Invalid PAN format (e.g., ABCDE1234F)' });
    }

    if (data.ifsc && !validateIFSC(data.ifsc)) {
      errors.push({ field: 'ifsc', message: 'Invalid IFSC format (e.g., SBIN0001234)' });
    }

    if (data.account_no && !validateAccountNo(data.account_no)) {
      errors.push({ field: 'account_no', message: 'Account number must be 9-18 digits' });
    }

    if (data.location && data.location !== 'Office' && data.location !== 'Factory') {
      errors.push({ field: 'location', message: 'Location must be Office, Factory, or empty' });
    }

    if (data.gender && data.gender !== 'Male' && data.gender !== 'Female') {
      errors.push({ field: 'gender', message: 'Gender must be Male or Female' });
    }

    // Date validations
    if (data.date_of_exit && data.date_of_joining) {
      const joining = new Date(data.date_of_joining);
      const exit = new Date(data.date_of_exit);
      if (exit < joining) {
        errors.push({ field: 'date_of_exit', message: 'Date of Exit cannot be earlier than Date of Joining' });
      }
    }

    if (data.date_of_birth) {
      const dob = new Date(data.date_of_birth);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (Number.isNaN(dob.getTime())) {
        errors.push({ field: 'date_of_birth', message: 'Date of Birth must be a valid date' });
      } else if (dob > now) {
        errors.push({ field: 'date_of_birth', message: 'Date of Birth cannot be in the future' });
      }
    }

    // Warnings
    if (!data.personal_email) {
      warnings.push({ field: 'personal_email', message: 'Personal email not provided' });
    }

    if (!data.designation) {
      warnings.push({ field: 'designation', message: 'Designation not provided' });
    }

    return { errors, warnings };
  };

  const parseExcelFile = useCallback((file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        if (jsonData.length === 0) {
          toast.error('Excel file is empty');
          return;
        }

        if (jsonData.length > 1000) {
          toast.error('Maximum 1000 rows allowed per import');
          return;
        }

        const parsed: ParsedRow[] = jsonData.map((row: any, index) => {
          const locRaw = row.location !== undefined && row.location !== null ? String(row.location).trim() : '';
          const genderRaw = row.gender ?? row.Gender ?? '';
          const normalizedGenderRaw = String(genderRaw || '').trim();
          const genderNormalized =
            normalizedGenderRaw.toLowerCase() === 'male'
              ? 'Male'
              : normalizedGenderRaw.toLowerCase() === 'female'
                ? 'Female'
                : normalizedGenderRaw;
          const userData: Partial<UserMaster> = {
            employee_code: row.employee_code?.toString().trim() || '',
            corporateId: row.corporate_id?.toString().trim() || '',
            first_name: row.first_name?.toString().trim() || '',
            last_name: row.last_name?.toString().trim() || '',
            name:
              `${row.first_name?.toString().trim() || ''} ${row.last_name?.toString().trim() || ''}`.trim() ||
              row.name?.toString().trim() ||
              '',
            designation: row.designation?.toString().trim() || '',
            date_of_joining: row.date_of_joining ? formatDate(row.date_of_joining) : '',
            date_of_exit: row.date_of_exit ? formatDate(row.date_of_exit) : '',
            date_of_birth: row.date_of_birth ? formatDate(row.date_of_birth) : row['Date of Birth'] ? formatDate(row['Date of Birth']) : '',
            gender: genderNormalized || '',
            phone: row.phone?.toString().trim() || '',
            official_email: row.official_email?.toString().trim() || '',
            personal_email: row.personal_email?.toString().trim() || '',
            aadhar_no: row.aadhar_no?.toString().replace(/\D/g, '') || '',
            pan_no: row.pan_no?.toString().toUpperCase().trim() || '',
            account_no: row.account_no?.toString().replace(/\D/g, '') || '',
            bank_name: row.bank_name?.toString().trim() || '',
            ifsc: row.ifsc?.toString().toUpperCase().trim() || '',
            uan_no: row.uan_no?.toString().trim() || '',
            emergency_contact: row.emergency_contact?.toString().trim() || '',
            address: row.current_address?.toString().trim() || row.address?.toString().trim() || '',
            permanent_address: row.permanent_address?.toString().trim() || '',
            biometric_code: row.biometric_code?.toString().trim() || '',
            biometric_password: row.biometric_password?.toString().trim() || '',
            passport_no: row.passport_no?.toString().trim() || '',
            medi_claim_no: row.medi_claim_no?.toString().trim() || '',
            location: locRaw === '' ? '' : locRaw,
            documentsUrl: row.documents_url?.toString().trim() || '',
            pastExperienceUrl: row.past_experience_url?.toString().trim() || '',
            profilePhotoUrl: row.profile_photo_url?.toString().trim() || '',
          };

          const { errors, warnings } = validateRow(userData, index + 2);
          
          let status: 'valid' | 'warning' | 'error' = 'valid';
          if (errors.length > 0) status = 'error';
          else if (warnings.length > 0) status = 'warning';

          return {
            rowNumber: index + 2,
            data: userData,
            errors,
            warnings,
            status,
          };
        });

        setParsedRows(parsed);
        setStep('preview');
        toast.success(`Parsed ${parsed.length} rows from Excel file`);
      } catch (error) {
        console.error('Error parsing Excel:', error);
        toast.error('Failed to parse Excel file. Please check the format.');
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read file');
    };

    reader.readAsArrayBuffer(file);
  }, [existingEmployeeCodes, overwriteExisting]);

  const formatDate = (dateValue: any): string => {
    if (!dateValue) return '';
    
    // If it's already in YYYY-MM-DD format
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    
    // If it's in DD-MM-YYYY format
    if (typeof dateValue === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(dateValue)) {
      const [day, month, year] = dateValue.split('-');
      return `${year}-${month}-${day}`;
    }

    // If it's an Excel date number
    if (typeof dateValue === 'number') {
      const date = XLSX.SSF.parse_date_code(dateValue);
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }

    // Try to parse as Date
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      // Ignore
    }

    return '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'xls', 'csv'].includes(fileExt || '')) {
        toast.error('Only .xlsx, .xls, and .csv files are supported');
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      const fileExt = droppedFile.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'xls', 'csv'].includes(fileExt || '')) {
        toast.error('Only .xlsx, .xls, and .csv files are supported');
        return;
      }

      setFile(droppedFile);
    }
  };

  const handlePreview = () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }
    parseExcelFile(file);
  };

  const handleConfirmImport = () => {
    const validRows = parsedRows.filter(row => row.status !== 'error' || skipInvalidRows);
    
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setStep('confirm');
  };

  const handleImport = async () => {
    setStep('progress');
    setImportProgress(0);

    const validRows = parsedRows.filter(row =>
      skipInvalidRows ? row.status !== 'error' : row.status === 'valid' || row.status === 'warning'
    );

    const usersToImport = validRows.filter(row => row.status !== 'error').map(row => row.data as UserMaster);

    try {
      if (usersToImport.length > 0) {
        await Promise.resolve(onImport(usersToImport));
      }
      setImportProgress(100);
      setImportResult({
        imported: usersToImport.length,
        skipped: parsedRows.length - usersToImport.length,
        failed: 0,
        details: usersToImport.map((_, idx) => `Batch row ${idx + 1}: submitted`),
      });
    } catch {
      toast.error('Import failed');
      setImportResult({
        imported: 0,
        skipped: 0,
        failed: usersToImport.length,
        details: [],
      });
    }
    setStep('complete');
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setParsedRows([]);
    setImportResult(null);
    setImportProgress(0);
    onClose();
  };

  const downloadTemplate = () => {
    const template = [
      {
        employee_code: 'E1001',
        corporate_id: 'SpecialisePdt',
        first_name: 'Shreya',
        last_name: 'Verma',
        designation: 'Data Analyst',
        date_of_joining: '2024-07-01',
        date_of_exit: '',
        date_of_birth: '1998-04-15',
        gender: 'Male',
        phone: '+919876543210',
        official_email: 'shreya@company.com',
        personal_email: 'shreya.personal@gmail.com',
        aadhar_no: '123412341234',
        pan_no: 'ABCDE1234F',
        account_no: '0123456789012345',
        bank_name: 'State Bank',
        ifsc: 'SBIN0001234',
        uan_no: '100200300',
        emergency_contact: '+919123456789',
        current_address: '123 Main Road',
        permanent_address: '',
        biometric_code: '039',
        biometric_password: '',
        passport_no: '',
        medi_claim_no: '',
        location: 'Office',
        documents_url: '',
        past_experience_url: '',
        profile_photo_url: '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'users_template.xlsx');
    toast.success('Template downloaded successfully');
  };

  const validCount = parsedRows.filter(r => r.status === 'valid').length;
  const warningCount = parsedRows.filter(r => r.status === 'warning').length;
  const errorCount = parsedRows.filter(r => r.status === 'error').length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Users from Excel</DialogTitle>
          <DialogDescription>
            Upload an Excel file to bulk import users into the system
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Upload Area */}
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#007BFF] transition-colors cursor-pointer"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="mb-2">Drop .xlsx / .csv file here — or click to browse</p>
                  <p className="text-sm text-gray-500">Max 10 MB. Up to 1000 rows per file.</p>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {file && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <FileSpreadsheet className="w-8 h-8 text-green-600" />
                    <div className="flex-1">
                      <p>{file.name}</p>
                      <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Instructions */}
              <div className="space-y-4">
                <h3>Quick Instructions</h3>
                <ol className="space-y-2 text-sm">
                  <li>1. Download the template using the button below</li>
                  <li>2. Fill in user data (don't change column headers)</li>
                  <li>3. Upload the file and click Preview</li>
                  <li>4. Review validation results and Confirm Import</li>
                </ol>

                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  className="w-full gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Excel Template
                </Button>

                <div className="space-y-3 pt-4">
                  <p className="text-sm text-gray-600">
                    Login passwords are generated on the server when each user is created (not from this file).
                  </p>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="overwrite"
                      checked={overwriteExisting}
                      onCheckedChange={(checked) => setOverwriteExisting(checked as boolean)}
                    />
                    <Label htmlFor="overwrite" className="text-sm">
                      Overwrite existing users with same Employee Code
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handlePreview}
                disabled={!file}
                className="bg-[#007BFF] hover:bg-[#0056b3]"
              >
                Preview
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setStep('upload')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h3>Preview & Validation</h3>
                <p className="text-sm text-gray-500">
                  {parsedRows.length} rows detected
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span>Valid</span>
                </div>
                <p className="text-2xl">{validCount}</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span>Warnings</span>
                </div>
                <p className="text-2xl">{warningCount}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span>Errors</span>
                </div>
                <p className="text-2xl">{errorCount}</p>
              </div>
            </div>

            {errorCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {errorCount} row(s) have errors. You can skip invalid rows or fix the file and re-upload.
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Row</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Employee Code</th>
                    <th className="p-2 text-left">First Name</th>
                    <th className="p-2 text-left">Last Name</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 50).map((row) => (
                    <tr key={row.rowNumber} className="border-t hover:bg-gray-50">
                      <td className="p-2">{row.rowNumber}</td>
                      <td className="p-2">
                        {row.status === 'valid' && (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Valid
                          </Badge>
                        )}
                        {row.status === 'warning' && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Warning
                          </Badge>
                        )}
                        {row.status === 'error' && (
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            Error
                          </Badge>
                        )}
                      </td>
                      <td className="p-2">{row.data.employee_code}</td>
                      <td className="p-2">{row.data.first_name}</td>
                      <td className="p-2">{row.data.last_name}</td>
                      <td className="p-2">{row.data.official_email}</td>
                      <td className="p-2">
                        <div className="space-y-1">
                          {row.errors.map((err, idx) => (
                            <p key={idx} className="text-xs text-red-600">
                              {err.field}: {err.message}
                            </p>
                          ))}
                          {row.warnings.map((warn, idx) => (
                            <p key={idx} className="text-xs text-yellow-600">
                              {warn.field}: {warn.message}
                            </p>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 50 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  Showing first 50 of {parsedRows.length} rows
                </div>
              )}
            </div>

            {errorCount > 0 && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skip-invalid"
                  checked={skipInvalidRows}
                  onCheckedChange={(checked) => setSkipInvalidRows(checked as boolean)}
                />
                <Label htmlFor="skip-invalid" className="text-sm">
                  Skip invalid rows and import only valid ones
                </Label>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={errorCount > 0 && !skipInvalidRows}
                className="bg-[#007BFF] hover:bg-[#0056b3]"
              >
                Confirm Import
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Confirm Step */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <h3>Confirm Import</h3>
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-gray-50 rounded">
                <span>Total rows detected:</span>
                <span>{parsedRows.length}</span>
              </div>
              <div className="flex justify-between p-3 bg-green-50 rounded">
                <span>Rows valid:</span>
                <span className="text-green-700">{validCount}</span>
              </div>
              <div className="flex justify-between p-3 bg-yellow-50 rounded">
                <span>Rows with non-blocking warnings:</span>
                <span className="text-yellow-700">{warningCount}</span>
              </div>
              {errorCount > 0 && skipInvalidRows && (
                <div className="flex justify-between p-3 bg-red-50 rounded">
                  <span>Rows with blocking errors (will be skipped):</span>
                  <span className="text-red-700">{errorCount}</span>
                </div>
              )}
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will import {skipInvalidRows ? validCount + warningCount : parsedRows.filter(r => r.status !== 'error').length} user(s) into the system.
                Each user will be created via the API; login passwords are assigned automatically.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('preview')}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                className="bg-[#007BFF] hover:bg-[#0056b3]"
              >
                Import Now
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Progress Step */}
        {step === 'progress' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <h3 className="mb-2">Importing Users...</h3>
              <p className="text-sm text-gray-500 mb-4">Please wait while we import your users</p>
              <Progress value={importProgress} className="w-full" />
              <p className="mt-2 text-sm">{Math.round(importProgress)}%</p>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && importResult && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3>Import Complete!</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-green-50 rounded">
                <span>Successfully imported:</span>
                <span className="text-green-700">{importResult.imported}</span>
              </div>
              {importResult.skipped > 0 && (
                <div className="flex justify-between p-3 bg-yellow-50 rounded">
                  <span>Skipped:</span>
                  <span className="text-yellow-700">{importResult.skipped}</span>
                </div>
              )}
              {importResult.failed > 0 && (
                <div className="flex justify-between p-3 bg-red-50 rounded">
                  <span>Failed:</span>
                  <span className="text-red-700">{importResult.failed}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                onClick={handleClose}
                className="bg-[#007BFF] hover:bg-[#0056b3]"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
