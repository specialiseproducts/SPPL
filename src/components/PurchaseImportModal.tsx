import { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import type { PurchaseRecord } from './PurchasesTab';

interface PurchaseImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (purchases: PurchaseRecord[]) => void;
  currentEmployeeCode: string;
}

export default function PurchaseImportModal({
  isOpen,
  onClose,
  onImportComplete,
  currentEmployeeCode,
}: PurchaseImportModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast.error('Please upload an Excel file (.xlsx, .xls) or CSV file');
      return;
    }

    // Mock preview data (in real app, would parse the Excel file)
    const mockPreview = [
      {
        record_type: 'Import – SPPL Paid',
        po_number: 'PO-2024-003',
        date: '2024-03-01',
        principal: 'Import Corp',
        invoice_number: 'INV-2024-003',
        invoice_date: '2024-03-01',
        boe_number: 'BOE-2024-003',
        boe_date: '2024-03-02',
        hs_code: '8471.30.00',
        item_details: 'Imported Computer Parts',
        part_number: 'IMP-123',
        unit_price: 600,
        qty: 80,
        freight_charges_international: 2500,
        gst_on_freight_charges: 450,
        exchange_rate_as_per_boe: 83,
        unit_price_in_inr_local_price: 49800,
        freight_charges_local: 1800,
        gst_on_local_freight_charges: 324,
        custom_duty_percentage: 10,
        other_charges_international: 800,
        other_charges_local: 400,
        sppl_price: 900,
        shipping_charges_to_customer: 2500,
        price_to_customer: 85000,
        customer: 'Tech Import Ltd',
        customer_po: 'CUST-PO-003',
        po_date: '2024-02-25',
        po_price: 950,
        quantity: 80,
        igst_gst_percentage: 18,
        customer_invoice_number: 'CINV-003',
        customer_invoice_date: '2024-03-15',
      },
      {
        record_type: 'Local Manufacturing',
        po_number: 'PO-2024-004',
        date: '2024-03-05',
        principal: 'Local Mfg Co',
        invoice_number: 'INV-2024-004',
        invoice_date: '2024-03-05',
        boe_number: '',
        boe_date: '',
        hs_code: '8517.62.90',
        item_details: 'Locally Manufactured Parts',
        part_number: 'LOC-456',
        unit_price: 850,
        qty: 120,
        freight_charges_international: 0,
        gst_on_freight_charges: 0,
        exchange_rate_as_per_boe: 0,
        unit_price_in_inr_local_price: 102000,
        freight_charges_local: 2200,
        gst_on_local_freight_charges: 396,
        custom_duty_percentage: 0,
        other_charges_international: 0,
        other_charges_local: 1200,
        sppl_price: 1100,
        shipping_charges_to_customer: 2800,
        price_to_customer: 152000,
        customer: 'Local Systems Inc',
        customer_po: 'CUST-PO-004',
        po_date: '2024-03-01',
        po_price: 1150,
        quantity: 120,
        igst_gst_percentage: 18,
        customer_invoice_number: 'CINV-004',
        customer_invoice_date: '2024-03-20',
      },
    ];

    // Validate required fields
    const errors: string[] = [];
    mockPreview.forEach((row, index) => {
      if (!row.record_type) errors.push(`Row ${index + 1}: Record Type is required`);
      if (!row.po_number) errors.push(`Row ${index + 1}: PO # is required`);
      if (!row.date) errors.push(`Row ${index + 1}: Date is required`);
      if (!row.principal) errors.push(`Row ${index + 1}: Principal is required`);
      if (!row.invoice_number) errors.push(`Row ${index + 1}: Invoice # is required`);
      if (!row.item_details) errors.push(`Row ${index + 1}: Item Details is required`);
      if (!row.customer) errors.push(`Row ${index + 1}: Customer is required`);
    });

    setPreviewData(mockPreview);
    setValidationErrors(errors);
    setStep('preview');
    
    if (errors.length > 0) {
      toast.error(`Found ${errors.length} validation errors. Please review.`);
    } else {
      toast.success('File uploaded successfully. Review the preview below.');
    }
  };

  const handleConfirmImport = () => {
    // Calculate all derived fields for each import
    const importedPurchases: PurchaseRecord[] = previewData.map((row, index) => {
      // Formula calculations
      const total_price_in_fe_inr = (row.unit_price || 0) * (row.qty || 0);
      const igst_on_import_cgst_sgst_igst_local = (row.unit_price_in_inr_local_price || 0) * 0.18;
      const custom_duty_amount = (row.unit_price_in_inr_local_price || 0) * ((row.custom_duty_percentage || 0) / 100);
      
      const total_landed_price = 
        (row.freight_charges_international || 0) +
        (row.gst_on_freight_charges || 0) +
        (row.freight_charges_local || 0) +
        (row.gst_on_local_freight_charges || 0) +
        custom_duty_amount +
        (row.other_charges_international || 0) +
        (row.other_charges_local || 0);
      
      const landed_unit_price = (row.qty || 0) > 0 ? total_landed_price / (row.qty || 1) : 0;
      const total_po_price = (row.po_price || 0) * (row.quantity || 0);
      const gst_igst_amount = (row.po_price || 0) * ((row.igst_gst_percentage || 0) / 100);
      const cgst_sgst = (row.sppl_price || 0) * ((row.igst_gst_percentage || 18) / 100);
      const price_to_sppl = (row.price_to_customer || 0) - ((row.shipping_charges_to_customer || 0) + cgst_sgst);
      const gm = price_to_sppl - total_landed_price;
      const margin_percentage = price_to_sppl > 0 ? (gm / price_to_sppl) * 100 : 0;

      return {
        id: `import-${Date.now()}-${index}`,
        record_type: row.record_type || '',
        po_number: row.po_number || '',
        date: row.date || '',
        principal: row.principal || '',
        invoice_number: row.invoice_number || '',
        invoice_date: row.invoice_date || '',
        boe_number: row.boe_number || '',
        boe_date: row.boe_date || '',
        hs_code: row.hs_code || '',
        item_details: row.item_details || '',
        part_number: row.part_number || '',
        unit_price: parseFloat(row.unit_price) || 0,
        qty: parseInt(row.qty) || 0,
        freight_charges_international: parseFloat(row.freight_charges_international) || 0,
        gst_on_freight_charges: parseFloat(row.gst_on_freight_charges) || 0,
        total_price_in_fe_inr,
        exchange_rate_as_per_boe: parseFloat(row.exchange_rate_as_per_boe) || 0,
        unit_price_in_inr_local_price: parseFloat(row.unit_price_in_inr_local_price) || 0,
        freight_charges_local: parseFloat(row.freight_charges_local) || 0,
        gst_on_local_freight_charges: parseFloat(row.gst_on_local_freight_charges) || 0,
        igst_on_import_cgst_sgst_igst_local,
        custom_duty_percentage: parseFloat(row.custom_duty_percentage) || 0,
        custom_duty_amount,
        other_charges_international: parseFloat(row.other_charges_international) || 0,
        other_charges_local: parseFloat(row.other_charges_local) || 0,
        total_landed_price,
        landed_unit_price,
        sppl_price: parseFloat(row.sppl_price) || 0,
        shipping_charges_to_customer: parseFloat(row.shipping_charges_to_customer) || 0,
        cgst_sgst,
        price_to_customer: parseFloat(row.price_to_customer) || 0,
        price_to_sppl,
        gm,
        margin_percentage,
        customer: row.customer || '',
        customer_po: row.customer_po || '',
        po_date: row.po_date || '',
        po_price: parseFloat(row.po_price) || 0,
        quantity: parseInt(row.quantity) || 0,
        total_po_price,
        igst_gst_percentage: parseFloat(row.igst_gst_percentage) || 18,
        gst_igst_amount,
        customer_invoice_number: row.customer_invoice_number || '',
        customer_invoice_date: row.customer_invoice_date || '',
        shipping_charges_to_customer_summary: parseFloat(row.shipping_charges_to_customer_summary) || 0,
        cgst_sgst_customer: parseFloat(row.cgst_sgst_customer) || 0,
        created_by: currentEmployeeCode,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    onImportComplete(importedPurchases);
  };

  const handleCancel = () => {
    setStep('upload');
    setPreviewData([]);
    setValidationErrors([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-[#212529]">Import Purchases from Excel</h2>
            <p className="text-sm text-gray-600 mt-1">
              {step === 'upload' ? 'Upload your Excel file to import purchase records' : 'Review and confirm import'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' ? (
            <div className="space-y-6">
              {/* Upload Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center ${
                  dragActive ? 'border-[#007BFF] bg-blue-50' : 'border-gray-300'
                }`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-[#007BFF]" />
                  </div>
                  <div>
                    <p className="text-gray-700 mb-2">
                      Drag and drop your Excel file here, or
                    </p>
                    <label className="cursor-pointer">
                      <span className="text-[#007BFF] hover:underline">browse files</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileInput}
                      />
                    </label>
                  </div>
                  <p className="text-sm text-gray-500">
                    Supported formats: .xlsx, .xls, .csv
                  </p>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="flex items-center gap-2 text-[#212529] mb-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#007BFF]" />
                  Excel File Requirements
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 ml-7">
                  <li>• First row must contain column headers</li>
                  <li>• <strong>Required columns:</strong> Record Type, PO #, Date, Principal, Invoice #, Item Details, Unit Price, QTY, Customer</li>
                  <li>• Record Type must be one of the 4 valid options</li>
                  <li>• All cost fields should be numeric values</li>
                  <li>• Date format: YYYY-MM-DD</li>
                  <li>• Auto-calculated fields will be computed during import</li>
                  <li>• Maximum 1000 rows per import</li>
                </ul>
              </div>

              {/* Column Mapping Reference */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-[#212529] mb-3">Expected Column Headers (45 fields)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs text-gray-600">
                  <div>Record Type *</div>
                  <div>PO # *</div>
                  <div>Date *</div>
                  <div>Principal *</div>
                  <div>Invoice # *</div>
                  <div>Invoice Date</div>
                  <div>BOE #</div>
                  <div>BOE Date</div>
                  <div>HS Code</div>
                  <div>Item Details *</div>
                  <div>Part #</div>
                  <div>Unit Price *</div>
                  <div>QTY *</div>
                  <div>Freight Charges - Intl</div>
                  <div>GST on Freight</div>
                  <div>Exchange Rate</div>
                  <div>Unit Price INR/Local *</div>
                  <div>Freight Charges - Local</div>
                  <div>GST on Local Freight</div>
                  <div>Custom Duty %</div>
                  <div>Other Charges - Intl</div>
                  <div>Other Charges - Local</div>
                  <div>SPPL Price</div>
                  <div>Shipping to Customer</div>
                  <div>Price to Customer</div>
                  <div>Customer *</div>
                  <div>Customer's PO</div>
                  <div>PO Date</div>
                  <div>PO Price</div>
                  <div>Quantity</div>
                  <div>IGST/GST %</div>
                  <div>Customer Invoice #</div>
                  <div>Customer Invoice Date</div>
                </div>
                <p className="text-xs text-gray-500 mt-3">* Required fields | Other fields will be auto-calculated</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Validation Summary */}
              {validationErrors.length > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="flex items-center gap-2 text-red-800 mb-2">
                    <AlertCircle className="w-5 h-5" />
                    Validation Errors ({validationErrors.length})
                  </h3>
                  <ul className="text-sm text-red-700 space-y-1 ml-7 max-h-40 overflow-y-auto">
                    {validationErrors.slice(0, 10).map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li className="text-red-600">• ... and {validationErrors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="w-5 h-5" />
                    Ready to import {previewData.length} purchase records
                  </h3>
                  <p className="text-sm text-green-700 mt-1">All computed fields will be calculated automatically</p>
                </div>
              )}

              {/* Preview Table */}
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Row</TableHead>
                      <TableHead>Record Type</TableHead>
                      <TableHead>PO #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Item Details</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>QTY</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>SPPL Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 50).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="max-w-xs">
                          <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 line-clamp-2">
                            {row.record_type}
                          </span>
                        </TableCell>
                        <TableCell>{row.po_number}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.principal}</TableCell>
                        <TableCell>{row.invoice_number}</TableCell>
                        <TableCell className="max-w-xs truncate">{row.item_details}</TableCell>
                        <TableCell className="text-right">₹{row.unit_price?.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.qty}</TableCell>
                        <TableCell>{row.customer}</TableCell>
                        <TableCell className="text-right">₹{row.sppl_price?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {previewData.length > 50 && (
                <p className="text-sm text-gray-600 text-center">
                  Showing first 50 of {previewData.length} records
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          {step === 'preview' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('upload')}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleConfirmImport}
                disabled={validationErrors.length > 0}
                className="bg-[#007BFF] hover:bg-[#0056b3]"
              >
                Confirm Import ({previewData.length} records)
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}