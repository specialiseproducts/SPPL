import { useState, useEffect } from 'react';
import { X, Calculator, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import type { PurchaseRecord } from './PurchasesTabNew';
import { calculatePurchaseFields } from './PurchasesTabNew';
import type { UserMaster } from './UserCreationTab';

interface PurchaseFormModalNewProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<PurchaseRecord, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => void;
  editData?: PurchaseRecord;
  availableUsers: UserMaster[];
}

const RECORD_TYPE_OPTIONS = [
  'Local Manufacturing',
  'Stock FY21–24',
  'Import – SPPL Paid',
  'FOC Imports – SPPL Duty',
];

export default function PurchaseFormModalNew({ isOpen, onClose, onSubmit, editData, availableUsers }: PurchaseFormModalNewProps) {
  const [formData, setFormData] = useState<Partial<PurchaseRecord>>({
    record_type: '',
    po_number: '',
    date: '',
    principal: '',
    invoice_number: '',
    invoice_date: '',
    boe_number: '',
    boe_date: '',
    hs_code: '',
    item_details: '',
    part_number: '',
    unit_price: 0,
    qty: 0,
    freight_charges_international: 0,
    gst_on_freight_charges: 0,
    exchange_rate_as_per_boe: 0,
    actual_bank_transfer_amount: 0,
    bank_charges: 0,
    gst_on_bank_charges: 0,
    custom_duty_percentage: 0,
    other_charges_international: 0,
    other_charges_local: 0,
    sppl_price: 0,
    shipping_charges_to_customer: 0,
    cgst_sgst: 0,
    price_to_customer: 0,
    customer: '',
    customer_po: '',
    po_date: '',
    po_price: 0,
    quantity: 0,
    igst_gst_percentage: 0,
    price_to_customer_2: 0,
    customer_invoice_number: '',
    customer_invoice_date: '',
    is_summary_row: false,
    ...editData,
  });

  const [computedFields, setComputedFields] = useState<Partial<PurchaseRecord>>({});
  const [expandedSections, setExpandedSections] = useState({
    recordType: true,
    purchaseDoc: true,
    itemCost: true,
    spplPricing: true,
    customerPO: true,
  });

  // Compute fields when inputs change
  useEffect(() => {
    const computed = calculatePurchaseFields(formData);
    setComputedFields(computed);
  }, [formData]);

  const handleInputChange = (field: keyof PurchaseRecord, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.record_type) {
      alert('Please select a Record Type');
      return;
    }
    
    if (!formData.po_number) {
      alert('Please enter PO Number');
      return;
    }
    
    onSubmit({ ...formData, ...computedFields } as Omit<PurchaseRecord, 'id' | 'created_at' | 'updated_at' | 'created_by'>);
    onClose();
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const ComputedField = ({ label, value, formula }: { label: string; value: number | string; formula: string }) => (
    <div>
      <Label className="text-gray-600 flex items-center gap-2">
        {label}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Calculator className="w-3 h-3 text-[#007BFF]" />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p className="text-xs">{formula}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Label>
      <Input
        value={typeof value === 'number' ? value.toFixed(2) : value}
        disabled
        className="bg-gray-50 text-gray-700 cursor-not-allowed"
      />
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-[#212529]">{editData ? 'Edit' : 'Create'} Purchase Record</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            
            {/* SECTION 1: RECORD TYPE (Required) */}
            <div className="border rounded-lg">
              <button
                type="button"
                onClick={() => toggleSection('recordType')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-[#212529] flex items-center gap-2">
                  (A) RECORD TYPE <span className="text-red-500">*</span>
                </h3>
                {expandedSections.recordType ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
              
              {expandedSections.recordType && (
                <div className="p-4 pt-0 border-t">
                  <Label className="text-gray-600">Record Type *</Label>
                  <Select
                    value={formData.record_type}
                    onValueChange={(value) => handleInputChange('record_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select record type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RECORD_TYPE_OPTIONS.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* SECTION 2: PURCHASE & DOCUMENT DETAILS */}
            <div className="border rounded-lg">
              <button
                type="button"
                onClick={() => toggleSection('purchaseDoc')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-[#212529]">(B) PURCHASE & DOCUMENT DETAILS</h3>
                {expandedSections.purchaseDoc ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
              
              {expandedSections.purchaseDoc && (
                <div className="p-4 pt-0 border-t space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-gray-600">PO# *</Label>
                      <Input
                        value={formData.po_number}
                        onChange={(e) => handleInputChange('po_number', e.target.value)}
                        placeholder="PO-2024-001"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleInputChange('date', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">Principal</Label>
                      <Input
                        value={formData.principal}
                        onChange={(e) => handleInputChange('principal', e.target.value)}
                        placeholder="Company Name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-gray-600">Invoice #</Label>
                      <Input
                        value={formData.invoice_number}
                        onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                        placeholder="INV-001"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">Invoice Date</Label>
                      <Input
                        type="date"
                        value={formData.invoice_date}
                        onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">HS Code</Label>
                      <Input
                        value={formData.hs_code}
                        onChange={(e) => handleInputChange('hs_code', e.target.value)}
                        placeholder="8501.10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">BOE #</Label>
                      <Input
                        value={formData.boe_number}
                        onChange={(e) => handleInputChange('boe_number', e.target.value)}
                        placeholder="BOE-123456"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">BOE Date</Label>
                      <Input
                        type="date"
                        value={formData.boe_date}
                        onChange={(e) => handleInputChange('boe_date', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: ITEM & COST COMPONENTS */}
            <div className="border rounded-lg">
              <button
                type="button"
                onClick={() => toggleSection('itemCost')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-[#212529]">(C) ITEM & COST COMPONENTS</h3>
                {expandedSections.itemCost ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
              
              {expandedSections.itemCost && (
                <div className="p-4 pt-0 border-t space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label className="text-gray-600">Item Details</Label>
                      <Textarea
                        value={formData.item_details}
                        onChange={(e) => handleInputChange('item_details', e.target.value)}
                        placeholder="Detailed description of the item..."
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-gray-600">Part #</Label>
                      <Input
                        value={formData.part_number}
                        onChange={(e) => handleInputChange('part_number', e.target.value)}
                        placeholder="PART-001"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.unit_price}
                        onChange={(e) => handleInputChange('unit_price', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">QTY</Label>
                      <Input
                        type="number"
                        value={formData.qty}
                        onChange={(e) => handleInputChange('qty', parseInt(e.target.value) || 0)}
                        placeholder="1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ComputedField
                      label="Total Price in FE / INR"
                      value={computedFields.total_price_in_fe_inr || 0}
                      formula="Unit Price × QTY"
                    />
                    
                    <div>
                      <Label className="text-gray-600">Exchange Rate as per BOE</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={formData.exchange_rate_as_per_boe}
                        onChange={(e) => handleInputChange('exchange_rate_as_per_boe', parseFloat(e.target.value) || 0)}
                        placeholder="0.0000"
                      />
                    </div>
                    
                    <ComputedField
                      label="Equivalent INR as per BOE"
                      value={computedFields.equivalent_inr_as_per_boe || 0}
                      formula="Total Price in FE/INR × Exchange Rate"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-gray-600">Freight Charges - International</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.freight_charges_international}
                        onChange={(e) => handleInputChange('freight_charges_international', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">GST on Freight Charges</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.gst_on_freight_charges}
                        onChange={(e) => handleInputChange('gst_on_freight_charges', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">Actual Bank Transfer Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.actual_bank_transfer_amount}
                        onChange={(e) => handleInputChange('actual_bank_transfer_amount', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-gray-600">Bank Charges</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.bank_charges}
                        onChange={(e) => handleInputChange('bank_charges', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">GST on Bank Charges</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.gst_on_bank_charges}
                        onChange={(e) => handleInputChange('gst_on_bank_charges', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">IGST / GST %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.igst_gst_percentage}
                        onChange={(e) => handleInputChange('igst_gst_percentage', parseFloat(e.target.value) || 0)}
                        placeholder="18.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ComputedField
                      label="IGST on Import / CGST_SGST_IGST"
                      value={computedFields.igst_on_import_cgst_sgst_igst_local || 0}
                      formula="Equivalent INR × (IGST/GST % / 100)"
                    />
                    
                    <div>
                      <Label className="text-gray-600">Custom Duty %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.custom_duty_percentage}
                        onChange={(e) => handleInputChange('custom_duty_percentage', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <ComputedField
                      label="Custom Duty Amount"
                      value={computedFields.custom_duty_amount || 0}
                      formula="Equivalent INR × (Custom Duty % / 100)"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-gray-600">Other Charges - International</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.other_charges_international}
                        onChange={(e) => handleInputChange('other_charges_international', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">Other Charges - Local</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.other_charges_local}
                        onChange={(e) => handleInputChange('other_charges_local', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <ComputedField
                      label="Tatal Landed Price"
                      value={computedFields.total_landed_price || 0}
                      formula="Sum of all cost components"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ComputedField
                      label="Landed Unit Price"
                      value={computedFields.landed_unit_price || 0}
                      formula="Total Landed Price / QTY"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 4: SPPL PRICING & MARGIN */}
            <div className="border rounded-lg">
              <button
                type="button"
                onClick={() => toggleSection('spplPricing')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-[#212529]">(D) SPPL PRICING & MARGIN</h3>
                {expandedSections.spplPricing ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
              
              {expandedSections.spplPricing && (
                <div className="p-4 pt-0 border-t space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-gray-600">SPPL Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.sppl_price}
                        onChange={(e) => handleInputChange('sppl_price', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">Shipping Charges to Customer</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.shipping_charges_to_customer}
                        onChange={(e) => handleInputChange('shipping_charges_to_customer', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">CGST_SGST</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.cgst_sgst}
                        onChange={(e) => handleInputChange('cgst_sgst', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-gray-600">Price to Customer</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price_to_customer}
                        onChange={(e) => handleInputChange('price_to_customer', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <ComputedField
                      label="Price to SPPL"
                      value={computedFields.price_to_sppl || 0}
                      formula="Price to Customer - (Shipping + CGST_SGST)"
                    />
                    
                    <div>
                      <Label className="text-gray-600">Price to Customer (2)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price_to_customer_2}
                        onChange={(e) => handleInputChange('price_to_customer_2', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border-2 border-[#007BFF]">
                    <ComputedField
                      label="GM (Gross Margin)"
                      value={computedFields.gm || 0}
                      formula="Price to SPPL - Total Landed Price"
                    />
                    
                    <ComputedField
                      label="% Margin"
                      value={(computedFields.margin_percentage || 0).toFixed(2) + '%'}
                      formula="(GM / Price to SPPL) × 100"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 5: CUSTOMER PO & INVOICE */}
            <div className="border rounded-lg">
              <button
                type="button"
                onClick={() => toggleSection('customerPO')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-[#212529]">(E) CUSTOMER PO & INVOICE</h3>
                {expandedSections.customerPO ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
              
              {expandedSections.customerPO && (
                <div className="p-4 pt-0 border-t space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">Customer</Label>
                      <Input
                        value={formData.customer}
                        onChange={(e) => handleInputChange('customer', e.target.value)}
                        placeholder="Customer Name"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">Customer's PO</Label>
                      <Input
                        value={formData.customer_po}
                        onChange={(e) => handleInputChange('customer_po', e.target.value)}
                        placeholder="CUST-PO-001"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-gray-600">PO Date</Label>
                      <Input
                        type="date"
                        value={formData.po_date}
                        onChange={(e) => handleInputChange('po_date', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">PO Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.po_price}
                        onChange={(e) => handleInputChange('po_price', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">Quantity</Label>
                      <Input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                        placeholder="1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ComputedField
                      label="Total PO Price"
                      value={computedFields.total_po_price || 0}
                      formula="PO Price × Quantity"
                    />
                    
                    <ComputedField
                      label="GST / IGST Amount"
                      value={computedFields.gst_igst_amount || 0}
                      formula="Total PO Price × (IGST/GST % / 100)"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">Customer Invoice #</Label>
                      <Input
                        value={formData.customer_invoice_number}
                        onChange={(e) => handleInputChange('customer_invoice_number', e.target.value)}
                        placeholder="CUST-INV-001"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">Customer Invoice Date</Label>
                      <Input
                        type="date"
                        value={formData.customer_invoice_date}
                        onChange={(e) => handleInputChange('customer_invoice_date', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit}>
            {editData ? 'Update' : 'Create'} Purchase
          </Button>
        </div>
      </div>
    </div>
  );
}
