import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RECORD_TYPE_OPTIONS } from './PurchasesTab';

// STEP 1: PO Header - ONLY 8 fields
export interface PurchaseHeader {
  id: string;
  record_type: string;          // 1. Record Type
  po_number: string;             // 2. PO#
  date: string;                  // 3. Date
  principal: string;             // 4. Principal
  invoice_number: string;        // 5. Invoice #
  invoice_date: string;          // 6. Invoice Date
  boe_number: string;            // 7. BOE #
  boe_date: string;              // 8. BOE Date
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface PurchaseHeaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveContinue: (header: PurchaseHeader) => void;
  editingHeader: PurchaseHeader | null;
  currentEmployeeCode: string;
}

export default function PurchaseHeaderModal({
  isOpen,
  onClose,
  onSaveContinue,
  editingHeader,
  currentEmployeeCode,
}: PurchaseHeaderModalProps) {
  const [formData, setFormData] = useState<Partial<PurchaseHeader>>({
    record_type: '',
    po_number: '',
    date: new Date().toISOString().split('T')[0],
    principal: '',
    invoice_number: '',
    invoice_date: '',
    boe_number: '',
    boe_date: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingHeader) {
      setFormData(editingHeader);
    }
  }, [editingHeader]);

  const handleInputChange = (field: keyof PurchaseHeader, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.record_type) {
      newErrors.record_type = 'Record Type is required';
    }
    if (!formData.po_number?.trim()) {
      newErrors.po_number = 'PO# is required';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    if (!formData.principal?.trim()) {
      newErrors.principal = 'Principal is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const headerData: PurchaseHeader = {
      id: editingHeader?.id || Date.now().toString(),
      record_type: formData.record_type || '',
      po_number: formData.po_number || '',
      date: formData.date || new Date().toISOString().split('T')[0],
      principal: formData.principal || '',
      invoice_number: formData.invoice_number || '',
      invoice_date: formData.invoice_date || '',
      boe_number: formData.boe_number || '',
      boe_date: formData.boe_date || '',
      created_by: editingHeader?.created_by || currentEmployeeCode,
      created_at: editingHeader?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSaveContinue(headerData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-[#212529]">
              {editingHeader ? 'Edit PO Header' : 'Create New PO - Step 1: PO Header'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Enter PO header information. You'll add line items in the next step.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* 1. Record Type */}
            <div className="space-y-2">
              <Label htmlFor="record_type">
                Record Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.record_type}
                onValueChange={(value) => handleInputChange('record_type', value)}
              >
                <SelectTrigger id="record_type" className={errors.record_type ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select record type" />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_TYPE_OPTIONS.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.record_type && (
                <p className="text-sm text-red-500">{errors.record_type}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 2. PO# */}
              <div className="space-y-2">
                <Label htmlFor="po_number">
                  PO# <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="po_number"
                  value={formData.po_number}
                  onChange={(e) => handleInputChange('po_number', e.target.value)}
                  placeholder="e.g., PO-2024-001"
                  className={errors.po_number ? 'border-red-500' : ''}
                />
                {errors.po_number && (
                  <p className="text-sm text-red-500">{errors.po_number}</p>
                )}
              </div>

              {/* 3. Date */}
              <div className="space-y-2">
                <Label htmlFor="date">
                  Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className={errors.date ? 'border-red-500' : ''}
                />
                {errors.date && (
                  <p className="text-sm text-red-500">{errors.date}</p>
                )}
              </div>

              {/* 4. Principal */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="principal">
                  Principal <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="principal"
                  value={formData.principal}
                  onChange={(e) => handleInputChange('principal', e.target.value)}
                  placeholder="e.g., ABC Corporation"
                  className={errors.principal ? 'border-red-500' : ''}
                />
                {errors.principal && (
                  <p className="text-sm text-red-500">{errors.principal}</p>
                )}
              </div>

              {/* 5. Invoice # */}
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice #</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                  placeholder="e.g., INV-2024-001"
                />
              </div>

              {/* 6. Invoice Date */}
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Invoice Date</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                />
              </div>

              {/* 7. BOE # */}
              <div className="space-y-2">
                <Label htmlFor="boe_number">BOE #</Label>
                <Input
                  id="boe_number"
                  value={formData.boe_number}
                  onChange={(e) => handleInputChange('boe_number', e.target.value)}
                  placeholder="e.g., BOE-2024-001"
                />
              </div>

              {/* 8. BOE Date */}
              <div className="space-y-2">
                <Label htmlFor="boe_date">BOE Date</Label>
                <Input
                  id="boe_date"
                  type="date"
                  value={formData.boe_date}
                  onChange={(e) => handleInputChange('boe_date', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#007BFF] hover:bg-[#0056b3]">
              Save & Continue to Line Items →
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
