import { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import type { SalesForecastRecord, CurrencyRates } from './SalesForecastingTab';
import { computeTotalPrice, computeConversionToINR } from './SalesForecastingTab';
import type { UserMaster } from './UserCreationTab';

interface SalesForecastingImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (forecasts: SalesForecastRecord[]) => void;
  availableUsers: UserMaster[];
  currencyRates: CurrencyRates;
}

interface ParsedRow {
  data: any;
  errors: string[];
  warnings: string[];
}

export default function SalesForecastingImportModal({
  isOpen,
  onClose,
  onImport,
  availableUsers,
  currencyRates,
}: SalesForecastingImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [importResult, setImportResult] = useState({ imported: 0, failed: 0, skipped: 0 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      parseFile(droppedFile);
    }
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').filter((row) => row.trim());
      const headers = rows[0].split(',').map((h) => h.trim());

      const parsed: ParsedRow[] = [];

      for (let i = 1; i < Math.min(rows.length, 51); i++) {
        const values = rows[i].split(',').map((v) => v.trim());
        const rowData: any = {};
        const errors: string[] = [];
        const warnings: string[] = [];

        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        // Validation
        if (!rowData.quotation_ref) errors.push('Missing Quotation Ref #');
        if (!rowData.quotation_date) errors.push('Missing Quotation Date');
        if (!rowData.end_customer) errors.push('Missing End Customer');
        if (!rowData.quoted_item_model) errors.push('Missing Quoted Item Model');
        if (!rowData.currency) errors.push('Missing Currency');
        if (!rowData.unit_price || isNaN(parseFloat(rowData.unit_price))) errors.push('Invalid Unit Price');
        if (!rowData.quantity || isNaN(parseInt(rowData.quantity)) || parseInt(rowData.quantity) < 1)
          errors.push('Invalid Quantity');

        if (rowData.probability_percent) {
          const prob = parseFloat(rowData.probability_percent);
          if (isNaN(prob) || prob < 0 || prob > 100) errors.push('Invalid Probability (must be 0-100)');
        }

        if (rowData.quotation_date && isNaN(Date.parse(rowData.quotation_date))) {
          errors.push('Invalid Quotation Date format');
        }

        if (rowData.employee_name) {
          const userExists = availableUsers.find((u) => u.employee_name === rowData.employee_name);
          if (!userExists) warnings.push('Employee not found in system');
        } else {
          errors.push('Missing Employee Name');
        }

        parsed.push({ data: rowData, errors, warnings });
      }

      setParsedData(parsed);
      setStep('preview');
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    const validRows = parsedData.filter((row) => row.errors.length === 0);
    const newForecasts: SalesForecastRecord[] = validRows.map((row, index) => {
      const unitPrice = parseFloat(row.data.unit_price);
      const quantity = parseInt(row.data.quantity);
      const totalPrice = computeTotalPrice(unitPrice, quantity);
      const conversionToINR = computeConversionToINR(row.data.currency, totalPrice, currencyRates);

      const selectedUser = availableUsers.find((u) => u.employee_name === row.data.employee_name);
      const employeeCode = selectedUser?.employee_code || 'UNKNOWN';

      return {
        id: `SF-IMP-${Date.now()}-${index}`,
        quotation_ref: row.data.quotation_ref,
        quotation_date: row.data.quotation_date,
        valid_till: row.data.valid_till || '',
        decision_by_date: row.data.decision_by_date || '',
        end_customer: row.data.end_customer,
        enquiry_details: row.data.enquiry_details || '',
        principal: row.data.principal || '',
        quoted_item_model: row.data.quoted_item_model,
        quoted_item_description: row.data.quoted_item_description || '',
        currency: row.data.currency,
        unit_price: unitPrice,
        quantity: quantity,
        total_price: totalPrice,
        conversion_to_inr: conversionToINR,
        delivery_days: row.data.delivery_days ? parseInt(row.data.delivery_days) : 0,
        warranty_days: row.data.warranty_days ? parseInt(row.data.warranty_days) : 0,
        probability_percent: row.data.probability_percent ? parseFloat(row.data.probability_percent) : 0,
        supporting_docs: row.data.supporting_docs || '',
        employee_code: employeeCode,
        employee_name: row.data.employee_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    setImportResult({
      imported: validRows.length,
      failed: parsedData.filter((row) => row.errors.length > 0).length,
      skipped: 0,
    });

    setStep('result');
    onImport(newForecasts);
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setStep('upload');
    setImportResult({ imported: 0, failed: 0, skipped: 0 });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-[#212529]">Import Sales Forecasts from Excel</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-[#007BFF] transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Drag and drop your Excel file here, or click to browse</p>
                <p className="text-sm text-gray-500">Supported formats: .csv, .xlsx</p>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {file && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    File selected: <span className="font-medium">{file.name}</span>
                  </p>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Required columns:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• quotation_ref (required)</li>
                  <li>• quotation_date (required, format: YYYY-MM-DD)</li>
                  <li>• end_customer (required)</li>
                  <li>• quoted_item_model (required)</li>
                  <li>• currency (required: INR, USD, Euro)</li>
                  <li>• unit_price (required, numeric)</li>
                  <li>• quantity (required, integer ≥ 1)</li>
                  <li>• employee_name (required, must exist in User Management)</li>
                  <li>
                    • Optional: valid_till, decision_by_date, enquiry_details, principal, quoted_item_description,
                    delivery_days, warranty_days, probability_percent, supporting_docs
                  </li>
                </ul>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Preview: Showing first {parsedData.length} rows. Valid rows:{' '}
                  {parsedData.filter((r) => r.errors.length === 0).length} | Rows with errors:{' '}
                  {parsedData.filter((r) => r.errors.length > 0).length}
                </p>
              </div>

              <div className="border rounded-lg overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Quotation Ref</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>QTY</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, index) => (
                      <TableRow key={index} className={row.errors.length > 0 ? 'bg-red-50' : ''}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          {row.errors.length === 0 ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{row.data.quotation_ref}</TableCell>
                        <TableCell>{row.data.quotation_date}</TableCell>
                        <TableCell className="max-w-xs truncate">{row.data.end_customer}</TableCell>
                        <TableCell className="max-w-xs truncate">{row.data.quoted_item_model}</TableCell>
                        <TableCell>{row.data.currency}</TableCell>
                        <TableCell>{row.data.unit_price}</TableCell>
                        <TableCell>{row.data.quantity}</TableCell>
                        <TableCell>{row.data.employee_name}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 && (
                            <div className="text-xs text-red-600">
                              {row.errors.map((err, i) => (
                                <div key={i}>• {err}</div>
                              ))}
                            </div>
                          )}
                          {row.warnings.length > 0 && (
                            <div className="text-xs text-yellow-600">
                              {row.warnings.map((warn, i) => (
                                <div key={i}>⚠ {warn}</div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmImport}
                  disabled={parsedData.filter((r) => r.errors.length === 0).length === 0}
                  className="bg-[#007BFF] hover:bg-[#0056b3]"
                >
                  Import {parsedData.filter((r) => r.errors.length === 0).length} Records
                </Button>
              </div>
            </div>
          )}

          {step === 'result' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <CheckCircle2 className="w-16 h-16 mx-auto text-green-600 mb-4" />
                <h3 className="text-green-900 mb-2">Import Completed Successfully!</h3>
                <div className="text-sm text-green-700 space-y-1">
                  <p>✅ Imported: {importResult.imported} records</p>
                  {importResult.failed > 0 && <p>❌ Failed: {importResult.failed} records</p>}
                  {importResult.skipped > 0 && <p>⚠ Skipped: {importResult.skipped} records</p>}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleClose} className="bg-[#007BFF] hover:bg-[#0056b3]">
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
