import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import type { PurchaseRecord } from './PurchasesTab';
import { RECORD_TYPE_OPTIONS, calculatePurchaseFields } from './PurchasesTab';
import type { UserMaster } from './UserCreationTab';

interface PurchaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (purchase: PurchaseRecord) => void;
  editingPurchase: PurchaseRecord | null;
  currentEmployeeCode: string;
  availableUsers: UserMaster[];
}

export default function PurchaseFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingPurchase,
  currentEmployeeCode,
}: PurchaseFormModalProps) {
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
    total_price_in_fe_inr: 0,
    exchange_rate_as_per_boe: 0,
    equivalent_inr_as_per_boe: 0,
    actual_bank_transfer_amount: 0,
    bank_charges: 0,
    gst_on_bank_charges: 0,
    basic_custom_duty: 0,
    surcharge: 0,
    gst_on_import_cgst_sgst_igst_local: 0,
    interest_or_fine_on_custom_duty: 0,
    custom_clearance_charges: 0,
    igst_gst_on_custom_clearance: 0,
    total_custom_clearance_charges: 0,
    total_landed_price: 0,
    landed_unit_price: 0,
    customer: '',
    customer_po: '',
    po_date: '',
    po_price: 0,
    quantity: 0,
    total_po_price: 0,
    igst_gst_percentage: 18,
    gst_igst_amount: 0,
    price_to_customer: 0,
    customer_invoice_number: '',
    customer_invoice_date: '',
    shipping_charges_to_customer: 0,
    cgst_sgst: 0,
    price_to_sppl: 0,
    gm_percentage: 0,
    margin: 0,
  });

  const [openSections, setOpenSections] = useState({
    recordType: true,
    purchaseDetails: true,
    itemCost: false,
    spplPricing: false,
    customerPO: false,
  });

  useEffect(() => {
    if (editingPurchase) {
      setFormData(editingPurchase);
    }
  }, [editingPurchase]);

  const handleInputChange = (field: keyof PurchaseRecord, value: any) => {
    const updatedData = { ...formData, [field]: value };
    const calculated = calculatePurchaseFields(updatedData);
    setFormData({
      ...updatedData,
      ...calculated,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.record_type) {
      alert('Please select a Record Type');
      return;
    }
    
    if (!formData.po_number || !formData.principal || !formData.item_details) {
      alert('Please fill in all required fields (PO#, Principal, Item Details)');
      return;
    }

    const calculated = calculatePurchaseFields(formData);
    
    const purchaseData: PurchaseRecord = {
      id: editingPurchase?.id || Date.now().toString(),
      record_type: formData.record_type || '',
      po_number: formData.po_number || '',
      date: formData.date || '',
      principal: formData.principal || '',
      invoice_number: formData.invoice_number || '',
      invoice_date: formData.invoice_date || '',
      boe_number: formData.boe_number || '',
      boe_date: formData.boe_date || '',
      hs_code: formData.hs_code || '',
      item_details: formData.item_details || '',
      part_number: formData.part_number || '',
      unit_price: formData.unit_price || 0,
      qty: formData.qty || 0,
      freight_charges_international: formData.freight_charges_international || 0,
      gst_on_freight_charges: formData.gst_on_freight_charges || 0,
      total_price_in_fe_inr: calculated.total_price_in_fe_inr || 0,
      exchange_rate_as_per_boe: formData.exchange_rate_as_per_boe || 0,
      equivalent_inr_as_per_boe: calculated.equivalent_inr_as_per_boe || 0,
      actual_bank_transfer_amount: formData.actual_bank_transfer_amount || 0,
      bank_charges: formData.bank_charges || 0,
      gst_on_bank_charges: formData.gst_on_bank_charges || 0,
      basic_custom_duty: formData.basic_custom_duty || 0,
      surcharge: formData.surcharge || 0,
      gst_on_import_cgst_sgst_igst_local: formData.gst_on_import_cgst_sgst_igst_local || 0,
      interest_or_fine_on_custom_duty: formData.interest_or_fine_on_custom_duty || 0,
      custom_clearance_charges: formData.custom_clearance_charges || 0,
      igst_gst_on_custom_clearance: formData.igst_gst_on_custom_clearance || 0,
      total_custom_clearance_charges: calculated.total_custom_clearance_charges || 0,
      total_landed_price: calculated.total_landed_price || 0,
      landed_unit_price: calculated.landed_unit_price || 0,
      customer: formData.customer || '',
      customer_po: formData.customer_po || '',
      po_date: formData.po_date || '',
      po_price: formData.po_price || 0,
      quantity: formData.quantity || 0,
      total_po_price: calculated.total_po_price || 0,
      igst_gst_percentage: formData.igst_gst_percentage || 18,
      gst_igst_amount: calculated.gst_igst_amount || 0,
      price_to_customer: formData.price_to_customer || 0,
      customer_invoice_number: formData.customer_invoice_number || '',
      customer_invoice_date: formData.customer_invoice_date || '',
      shipping_charges_to_customer: formData.shipping_charges_to_customer || 0,
      cgst_sgst: formData.cgst_sgst || 0,
      price_to_sppl: calculated.price_to_sppl || 0,
      gm_percentage: calculated.gm_percentage || 0,
      margin: calculated.margin || 0,
      created_by: editingPurchase?.created_by || currentEmployeeCode,
      created_at: editingPurchase?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSubmit(purchaseData);
  };

  if (!isOpen) return null;

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Computed field component
  const ComputedField = ({ 
    id, 
    label, 
    value, 
    tooltip 
  }: { 
    id: string; 
    label: string; 
    value: string | number; 
    tooltip: string;
  }) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-blue-600" />
        {label}
      </Label>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Input
              id={id}
              type="number"
              value={typeof value === 'number' ? value.toFixed(2) : value}
              disabled
              className="bg-gray-50 border-gray-200 cursor-not-allowed text-gray-700"
            />
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">This field is calculated automatically based on inputs.</p>
            <p className="text-xs text-gray-300 mt-1">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-6xl my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10 rounded-t-lg">
          <h2 className="text-[#212529]">
            {editingPurchase ? 'Edit Purchase Record' : 'Create New Purchase Record'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            
            {/* ============================================================ */}
            {/* (A) RECORD TYPE */}
            {/* ============================================================ */}
            <Collapsible open={openSections.recordType}>
              <CollapsibleTrigger
                onClick={() => toggleSection('recordType')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-900">(A) RECORD TYPE</span>
                {openSections.recordType ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 p-4 border rounded-lg bg-white">
                <div className="space-y-2">
                  <Label htmlFor="record_type">Record Type *</Label>
                  <Select
                    value={formData.record_type}
                    onValueChange={(value) => handleInputChange('record_type', value)}
                    required
                  >
                    <SelectTrigger id="record_type">
                      <SelectValue placeholder="Select record type" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECORD_TYPE_OPTIONS.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ============================================================ */}
            {/* (B) PURCHASE & DOCUMENT DETAILS */}
            {/* ============================================================ */}
            <Collapsible open={openSections.purchaseDetails}>
              <CollapsibleTrigger
                onClick={() => toggleSection('purchaseDetails')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-900">(B) PURCHASE & DOCUMENT DETAILS</span>
                {openSections.purchaseDetails ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 p-4 border rounded-lg bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. PO# */}
                  <div className="space-y-2">
                    <Label htmlFor="po_number">PO# *</Label>
                    <Input
                      id="po_number"
                      value={formData.po_number}
                      onChange={(e) => handleInputChange('po_number', e.target.value)}
                      required
                      placeholder="e.g., PO-2024-001"
                    />
                  </div>

                  {/* 2. Date */}
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                    />
                  </div>

                  {/* 3. Principal */}
                  <div className="space-y-2">
                    <Label htmlFor="principal">Principal *</Label>
                    <Input
                      id="principal"
                      value={formData.principal}
                      onChange={(e) => handleInputChange('principal', e.target.value)}
                      required
                      placeholder="e.g., ABC Corporation"
                    />
                  </div>

                  {/* 4. Invoice # */}
                  <div className="space-y-2">
                    <Label htmlFor="invoice_number">Invoice #</Label>
                    <Input
                      id="invoice_number"
                      value={formData.invoice_number}
                      onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                      placeholder="e.g., INV-2024-001"
                    />
                  </div>

                  {/* 5. Invoice Date */}
                  <div className="space-y-2">
                    <Label htmlFor="invoice_date">Invoice Date</Label>
                    <Input
                      id="invoice_date"
                      type="date"
                      value={formData.invoice_date}
                      onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                    />
                  </div>

                  {/* 6. BOE # */}
                  <div className="space-y-2">
                    <Label htmlFor="boe_number">BOE #</Label>
                    <Input
                      id="boe_number"
                      value={formData.boe_number}
                      onChange={(e) => handleInputChange('boe_number', e.target.value)}
                      placeholder="e.g., BOE-2024-001"
                    />
                  </div>

                  {/* 7. BOE Date */}
                  <div className="space-y-2">
                    <Label htmlFor="boe_date">BOE Date</Label>
                    <Input
                      id="boe_date"
                      type="date"
                      value={formData.boe_date}
                      onChange={(e) => handleInputChange('boe_date', e.target.value)}
                    />
                  </div>

                  {/* 8. HS Code */}
                  <div className="space-y-2">
                    <Label htmlFor="hs_code">HS Code</Label>
                    <Input
                      id="hs_code"
                      value={formData.hs_code}
                      onChange={(e) => handleInputChange('hs_code', e.target.value)}
                      placeholder="e.g., 8471.30.00"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ============================================================ */}
            {/* (C) ITEM & COST COMPONENTS */}
            {/* ============================================================ */}
            <Collapsible open={openSections.itemCost}>
              <CollapsibleTrigger
                onClick={() => toggleSection('itemCost')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-900">(C) ITEM & COST COMPONENTS</span>
                {openSections.itemCost ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 p-4 border rounded-lg bg-white space-y-6">
                
                {/* Item Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 9. Item Details */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="item_details">Item Details *</Label>
                    <Input
                      id="item_details"
                      value={formData.item_details}
                      onChange={(e) => handleInputChange('item_details', e.target.value)}
                      required
                      placeholder="e.g., Computer Parts - Motherboard"
                    />
                  </div>

                  {/* 10. Part # */}
                  <div className="space-y-2">
                    <Label htmlFor="part_number">Part #</Label>
                    <Input
                      id="part_number"
                      value={formData.part_number}
                      onChange={(e) => handleInputChange('part_number', e.target.value)}
                      placeholder="e.g., MB-XYZ-123"
                    />
                  </div>

                  {/* 11. Unit Price */}
                  <div className="space-y-2">
                    <Label htmlFor="unit_price">Unit Price *</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      value={formData.unit_price}
                      onChange={(e) => handleInputChange('unit_price', parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>

                  {/* 12. QTY */}
                  <div className="space-y-2">
                    <Label htmlFor="qty">QTY *</Label>
                    <Input
                      id="qty"
                      type="number"
                      value={formData.qty}
                      onChange={(e) => handleInputChange('qty', parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>

                  {/* 13. Freight Charges – International */}
                  <div className="space-y-2">
                    <Label htmlFor="freight_charges_international">Freight Charges – International</Label>
                    <Input
                      id="freight_charges_international"
                      type="number"
                      step="0.01"
                      value={formData.freight_charges_international}
                      onChange={(e) => handleInputChange('freight_charges_international', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 14. GST on Freight Charges */}
                  <div className="space-y-2">
                    <Label htmlFor="gst_on_freight_charges">GST on Freight Charges</Label>
                    <Input
                      id="gst_on_freight_charges"
                      type="number"
                      step="0.01"
                      value={formData.gst_on_freight_charges}
                      onChange={(e) => handleInputChange('gst_on_freight_charges', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 15. Total Price in FE / INR (COMPUTED) */}
                  <ComputedField
                    id="total_price_in_fe_inr"
                    label="Total Price in FE / INR"
                    value={formData.total_price_in_fe_inr || 0}
                    tooltip="Formula: Unit Price × QTY"
                  />

                  {/* 16. Exchange Rate as per BOE */}
                  <div className="space-y-2">
                    <Label htmlFor="exchange_rate_as_per_boe">Exchange Rate as per BOE</Label>
                    <Input
                      id="exchange_rate_as_per_boe"
                      type="number"
                      step="0.01"
                      value={formData.exchange_rate_as_per_boe}
                      onChange={(e) => handleInputChange('exchange_rate_as_per_boe', parseFloat(e.target.value) || 0)}
                      placeholder="e.g., 83.5"
                    />
                  </div>

                  {/* 17. Equivalent INR as per BOE (COMPUTED) */}
                  <ComputedField
                    id="equivalent_inr_as_per_boe"
                    label="Equivalent INR as per BOE"
                    value={formData.equivalent_inr_as_per_boe || 0}
                    tooltip="Formula: Total Price in FE/INR × Exchange Rate as per BOE"
                  />

                  {/* 18. Actual Bank Transfer Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="actual_bank_transfer_amount">Actual Bank Transfer Amount</Label>
                    <Input
                      id="actual_bank_transfer_amount"
                      type="number"
                      step="0.01"
                      value={formData.actual_bank_transfer_amount}
                      onChange={(e) => handleInputChange('actual_bank_transfer_amount', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 19. Bank Charges */}
                  <div className="space-y-2">
                    <Label htmlFor="bank_charges">Bank Charges</Label>
                    <Input
                      id="bank_charges"
                      type="number"
                      step="0.01"
                      value={formData.bank_charges}
                      onChange={(e) => handleInputChange('bank_charges', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 20. GST on Bank Charges */}
                  <div className="space-y-2">
                    <Label htmlFor="gst_on_bank_charges">GST on Bank Charges</Label>
                    <Input
                      id="gst_on_bank_charges"
                      type="number"
                      step="0.01"
                      value={formData.gst_on_bank_charges}
                      onChange={(e) => handleInputChange('gst_on_bank_charges', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 21. Basic Custom Duty */}
                  <div className="space-y-2">
                    <Label htmlFor="basic_custom_duty">Basic Custom Duty</Label>
                    <Input
                      id="basic_custom_duty"
                      type="number"
                      step="0.01"
                      value={formData.basic_custom_duty}
                      onChange={(e) => handleInputChange('basic_custom_duty', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 22. Surcharge */}
                  <div className="space-y-2">
                    <Label htmlFor="surcharge">Surcharge</Label>
                    <Input
                      id="surcharge"
                      type="number"
                      step="0.01"
                      value={formData.surcharge}
                      onChange={(e) => handleInputChange('surcharge', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 23. GST on Import / CGST_SGST_IGST on Local Purchase */}
                  <div className="space-y-2">
                    <Label htmlFor="gst_on_import_cgst_sgst_igst_local">GST on Import / CGST_SGST_IGST on Local Purchase</Label>
                    <Input
                      id="gst_on_import_cgst_sgst_igst_local"
                      type="number"
                      step="0.01"
                      value={formData.gst_on_import_cgst_sgst_igst_local}
                      onChange={(e) => handleInputChange('gst_on_import_cgst_sgst_igst_local', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 24. Interest or Fine on Custom Duty */}
                  <div className="space-y-2">
                    <Label htmlFor="interest_or_fine_on_custom_duty">Interest or Fine on Custom Duty</Label>
                    <Input
                      id="interest_or_fine_on_custom_duty"
                      type="number"
                      step="0.01"
                      value={formData.interest_or_fine_on_custom_duty}
                      onChange={(e) => handleInputChange('interest_or_fine_on_custom_duty', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 25. Custom Clearance Charges */}
                  <div className="space-y-2">
                    <Label htmlFor="custom_clearance_charges">Custom Clearance Charges</Label>
                    <Input
                      id="custom_clearance_charges"
                      type="number"
                      step="0.01"
                      value={formData.custom_clearance_charges}
                      onChange={(e) => handleInputChange('custom_clearance_charges', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 26. IGST/GST on Custom Clearance */}
                  <div className="space-y-2">
                    <Label htmlFor="igst_gst_on_custom_clearance">IGST/GST on Custom Clearance</Label>
                    <Input
                      id="igst_gst_on_custom_clearance"
                      type="number"
                      step="0.01"
                      value={formData.igst_gst_on_custom_clearance}
                      onChange={(e) => handleInputChange('igst_gst_on_custom_clearance', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 27. Total Custom Clearance Charges (COMPUTED) */}
                  <ComputedField
                    id="total_custom_clearance_charges"
                    label="Total Custom Clearance Charges"
                    value={formData.total_custom_clearance_charges || 0}
                    tooltip="Formula: Custom Clearance Charges + IGST/GST on Custom Clearance"
                  />

                  {/* 28. Total Landed Price (COMPUTED) */}
                  <ComputedField
                    id="total_landed_price"
                    label="Total Landed Price"
                    value={formData.total_landed_price || 0}
                    tooltip="Formula: Sum of all cost components including freight, duties, taxes, and clearance charges"
                  />

                  {/* 29. Landed Unit Price (COMPUTED) */}
                  <ComputedField
                    id="landed_unit_price"
                    label="Landed Unit Price"
                    value={formData.landed_unit_price || 0}
                    tooltip="Formula: Total Landed Price / QTY"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ============================================================ */}
            {/* (D) SPPL PRICING & MARGINS */}
            {/* ============================================================ */}
            <Collapsible open={openSections.spplPricing}>
              <CollapsibleTrigger
                onClick={() => toggleSection('spplPricing')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-900">(D) SPPL PRICING & MARGINS</span>
                {openSections.spplPricing ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 p-4 border rounded-lg bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 38. Price to Customer */}
                  <div className="space-y-2">
                    <Label htmlFor="price_to_customer">Price to Customer</Label>
                    <Input
                      id="price_to_customer"
                      type="number"
                      step="0.01"
                      value={formData.price_to_customer}
                      onChange={(e) => handleInputChange('price_to_customer', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 41. Shipping Charges to customer */}
                  <div className="space-y-2">
                    <Label htmlFor="shipping_charges_to_customer">Shipping Charges to customer</Label>
                    <Input
                      id="shipping_charges_to_customer"
                      type="number"
                      step="0.01"
                      value={formData.shipping_charges_to_customer}
                      onChange={(e) => handleInputChange('shipping_charges_to_customer', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 42. CGST_SGST */}
                  <div className="space-y-2">
                    <Label htmlFor="cgst_sgst">CGST_SGST</Label>
                    <Input
                      id="cgst_sgst"
                      type="number"
                      step="0.01"
                      value={formData.cgst_sgst}
                      onChange={(e) => handleInputChange('cgst_sgst', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 43. Price to SPPL (COMPUTED) */}
                  <ComputedField
                    id="price_to_sppl"
                    label="Price to SPPL"
                    value={formData.price_to_sppl || 0}
                    tooltip="Formula: Price to Customer - (Shipping Charges to customer + CGST_SGST)"
                  />

                  {/* 44. GM % (COMPUTED) */}
                  <ComputedField
                    id="gm_percentage"
                    label="GM %"
                    value={formData.gm_percentage || 0}
                    tooltip="Formula: ((Price to SPPL - Total Landed Price) / Total Landed Price) × 100"
                  />

                  {/* 45. Margin (COMPUTED) */}
                  <ComputedField
                    id="margin"
                    label="Margin"
                    value={formData.margin || 0}
                    tooltip="Formula: Price to SPPL - Total Landed Price"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ============================================================ */}
            {/* (E) CUSTOMER PO & INVOICE DETAILS */}
            {/* ============================================================ */}
            <Collapsible open={openSections.customerPO}>
              <CollapsibleTrigger
                onClick={() => toggleSection('customerPO')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-900">(E) CUSTOMER PO & INVOICE DETAILS</span>
                {openSections.customerPO ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 p-4 border rounded-lg bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 30. Customer */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="customer">Customer</Label>
                    <Input
                      id="customer"
                      value={formData.customer}
                      onChange={(e) => handleInputChange('customer', e.target.value)}
                      placeholder="e.g., Tech Solutions Ltd"
                    />
                  </div>

                  {/* 31. Customer's PO */}
                  <div className="space-y-2">
                    <Label htmlFor="customer_po">Customer's PO</Label>
                    <Input
                      id="customer_po"
                      value={formData.customer_po}
                      onChange={(e) => handleInputChange('customer_po', e.target.value)}
                      placeholder="e.g., CUST-PO-001"
                    />
                  </div>

                  {/* 32. PO Date */}
                  <div className="space-y-2">
                    <Label htmlFor="po_date">PO Date</Label>
                    <Input
                      id="po_date"
                      type="date"
                      value={formData.po_date}
                      onChange={(e) => handleInputChange('po_date', e.target.value)}
                    />
                  </div>

                  {/* 33. PO Price */}
                  <div className="space-y-2">
                    <Label htmlFor="po_price">PO Price</Label>
                    <Input
                      id="po_price"
                      type="number"
                      step="0.01"
                      value={formData.po_price}
                      onChange={(e) => handleInputChange('po_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 34. Quantity */}
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                    />
                  </div>

                  {/* 35. Total PO Price (COMPUTED) */}
                  <ComputedField
                    id="total_po_price"
                    label="Total PO Price"
                    value={formData.total_po_price || 0}
                    tooltip="Formula: PO Price × Quantity"
                  />

                  {/* 36. IGST / GST % */}
                  <div className="space-y-2">
                    <Label htmlFor="igst_gst_percentage">IGST / GST %</Label>
                    <Input
                      id="igst_gst_percentage"
                      type="number"
                      step="0.01"
                      value={formData.igst_gst_percentage}
                      onChange={(e) => handleInputChange('igst_gst_percentage', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 37. GST / IGST Amount (COMPUTED) */}
                  <ComputedField
                    id="gst_igst_amount"
                    label="GST / IGST Amount"
                    value={formData.gst_igst_amount || 0}
                    tooltip="Formula: Total PO Price × (IGST/GST % / 100)"
                  />

                  {/* 39. Invoice # (Customer Invoice #) */}
                  <div className="space-y-2">
                    <Label htmlFor="customer_invoice_number">Invoice # (Customer Invoice #)</Label>
                    <Input
                      id="customer_invoice_number"
                      value={formData.customer_invoice_number}
                      onChange={(e) => handleInputChange('customer_invoice_number', e.target.value)}
                      placeholder="e.g., CINV-001"
                    />
                  </div>

                  {/* 40. Date (Customer Invoice Date) */}
                  <div className="space-y-2">
                    <Label htmlFor="customer_invoice_date">Date (Customer Invoice Date)</Label>
                    <Input
                      id="customer_invoice_date"
                      type="date"
                      value={formData.customer_invoice_date}
                      onChange={(e) => handleInputChange('customer_invoice_date', e.target.value)}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50 sticky bottom-0 rounded-b-lg">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#007BFF] hover:bg-[#0056b3]">
              {editingPurchase ? 'Update Purchase' : 'Create Purchase'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
