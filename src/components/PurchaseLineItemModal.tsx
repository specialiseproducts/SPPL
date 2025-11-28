import { useState, useEffect } from 'react';
import { X, Calculator, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { PurchaseRecord } from './PurchasesTab';
import { calculatePurchaseFields } from './PurchasesTab';
import type { PurchaseHeader } from './PurchaseHeaderModal';

interface PurchaseLineItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lineItem: PurchaseRecord) => void;
  editingLineItem: PurchaseRecord | null;
  poHeader: PurchaseHeader;
  lineNumber: number;
  onEditHeader?: () => void;
}

export default function PurchaseLineItemModal({
  isOpen,
  onClose,
  onSubmit,
  editingLineItem,
  poHeader,
  lineNumber,
  onEditHeader,
}: PurchaseLineItemModalProps) {
  const [formData, setFormData] = useState<Partial<PurchaseRecord>>({
    // Header fields (read-only, prefilled from PO Header)
    record_type: poHeader.record_type,
    po_number: poHeader.po_number,
    date: poHeader.date,
    principal: poHeader.principal,
    invoice_number: poHeader.invoice_number,
    invoice_date: poHeader.invoice_date,
    boe_number: poHeader.boe_number,
    boe_date: poHeader.boe_date,
    
    // Line item specific fields (all remaining fields from Excel)
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

  const [addAnother, setAddAnother] = useState(false);
  const [openSections, setOpenSections] = useState({
    document: true,
    item: true,
    cost: false,
    customer: false,
  });

  useEffect(() => {
    if (editingLineItem) {
      setFormData(editingLineItem);
    }
  }, [editingLineItem]);

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
    
    if (!formData.item_details || !formData.unit_price || !formData.qty) {
      alert('Please fill in all required fields (Item Details, Unit Price, QTY)');
      return;
    }

    const calculated = calculatePurchaseFields(formData);
    
    const lineItemData: PurchaseRecord = {
      id: editingLineItem?.id || `${poHeader.id}-line-${Date.now()}`,
      record_type: poHeader.record_type,
      po_number: poHeader.po_number,
      date: poHeader.date,
      principal: poHeader.principal,
      invoice_number: poHeader.invoice_number,
      invoice_date: poHeader.invoice_date,
      boe_number: poHeader.boe_number,
      boe_date: poHeader.boe_date,
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
      created_by: editingLineItem?.created_by || poHeader.created_by,
      created_at: editingLineItem?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSubmit(lineItemData);

    // If "Add another" is checked, reset form for next line item
    if (addAnother && !editingLineItem) {
      setFormData({
        record_type: poHeader.record_type,
        po_number: poHeader.po_number,
        date: poHeader.date,
        principal: poHeader.principal,
        invoice_number: poHeader.invoice_number,
        invoice_date: poHeader.invoice_date,
        boe_number: poHeader.boe_number,
        boe_date: poHeader.boe_date,
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
        basic_custom_duty: 0,
        surcharge: 0,
        gst_on_import_cgst_sgst_igst_local: 0,
        interest_or_fine_on_custom_duty: 0,
        custom_clearance_charges: 0,
        igst_gst_on_custom_clearance: 0,
        customer: '',
        customer_po: '',
        po_date: '',
        po_price: 0,
        quantity: 0,
        igst_gst_percentage: 18,
        price_to_customer: 0,
        customer_invoice_number: '',
        customer_invoice_date: '',
        shipping_charges_to_customer: 0,
        cgst_sgst: 0,
      });
    }
  };

  if (!isOpen) return null;

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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
      <Label htmlFor={id} className="flex items-center gap-2 text-gray-600">
        <Calculator className="w-4 h-4 text-blue-600" />
        {label} <span className="text-xs text-gray-400">(computed)</span>
      </Label>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Input
                id={id}
                type="number"
                value={typeof value === 'number' ? value.toFixed(2) : value}
                disabled
                className="bg-gray-50 border-gray-200 cursor-not-allowed text-gray-700"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm font-medium">This field is calculated automatically</p>
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
        <div className="flex-shrink-0 p-6 border-b sticky top-0 bg-white z-10 rounded-t-lg">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-[#212529]">
                {editingLineItem ? 'Edit Line Item' : `Add Line Item #${lineNumber}`}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Enter line item details. All computed fields will auto-calculate.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* PO Header Summary (Read-only) */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-gray-600">PO#:</span>{' '}
                  <span className="font-medium text-blue-700">{poHeader.po_number}</span>
                </div>
                <div className="h-4 w-px bg-gray-300" />
                <div>
                  <span className="text-gray-600">Principal:</span>{' '}
                  <span className="font-medium">{poHeader.principal}</span>
                </div>
                <div className="h-4 w-px bg-gray-300" />
                <div>
                  <span className="text-gray-600">Record Type:</span>{' '}
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                    {poHeader.record_type}
                  </span>
                </div>
              </div>
              {onEditHeader && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onEditHeader}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Edit Header
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            
            {/* ============ DOCUMENT DETAILS SECTION ============ */}
            <Collapsible open={openSections.document}>
              <CollapsibleTrigger
                onClick={() => toggleSection('document')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                type="button"
              >
                <span className="font-medium text-gray-900">Document Details</span>
                {openSections.document ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 9. HS Code */}
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

            {/* ============ ITEM & COST COMPONENTS SECTION ============ */}
            <Collapsible open={openSections.item}>
              <CollapsibleTrigger
                onClick={() => toggleSection('item')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                type="button"
              >
                <span className="font-medium text-gray-900">Item & Cost Components</span>
                {openSections.item ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 10. Item Details */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="item_details">
                      Item Details <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="item_details"
                      value={formData.item_details}
                      onChange={(e) => handleInputChange('item_details', e.target.value)}
                      required
                      placeholder="e.g., Computer Parts - Motherboard"
                    />
                  </div>

                  {/* 11. Part # */}
                  <div className="space-y-2">
                    <Label htmlFor="part_number">Part #</Label>
                    <Input
                      id="part_number"
                      value={formData.part_number}
                      onChange={(e) => handleInputChange('part_number', e.target.value)}
                      placeholder="e.g., MB-XYZ-123"
                    />
                  </div>

                  {/* 12. Unit Price */}
                  <div className="space-y-2">
                    <Label htmlFor="unit_price">
                      Unit Price <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      value={formData.unit_price}
                      onChange={(e) => handleInputChange('unit_price', parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>

                  {/* 13. QTY */}
                  <div className="space-y-2">
                    <Label htmlFor="qty">
                      QTY <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="qty"
                      type="number"
                      value={formData.qty}
                      onChange={(e) => handleInputChange('qty', parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>

                  {/* 14. Freight Charges - International */}
                  <div className="space-y-2">
                    <Label htmlFor="freight_charges_international">Freight Charges - International</Label>
                    <Input
                      id="freight_charges_international"
                      type="number"
                      step="0.01"
                      value={formData.freight_charges_international}
                      onChange={(e) => handleInputChange('freight_charges_international', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* 15. GST on Freight Charges */}
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

                  {/* 16. Total Price in FE / INR (COMPUTED) */}
                  <ComputedField
                    id="total_price_in_fe_inr"
                    label="Total Price in FE / INR"
                    value={formData.total_price_in_fe_inr || 0}
                    tooltip="Formula: Unit Price × QTY"
                  />

                  {/* 17. Exchange Rate as per BOE */}
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

                  {/* 18. Equivalent INR as per BOE (COMPUTED) */}
                  <ComputedField
                    id="equivalent_inr_as_per_boe"
                    label="Equivalent INR as per BOE"
                    value={formData.equivalent_inr_as_per_boe || 0}
                    tooltip="Formula: Total Price in FE/INR × Exchange Rate as per BOE"
                  />

                  {/* 19. Actual Bank Transfer Amount */}
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

                  {/* 20. Bank Charges */}
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

                  {/* 21. GST on Bank Charges */}
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

                  {/* 22. Basic Custom Duty */}
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

                  {/* 23. Surcharge */}
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

                  {/* 24. GST on Import / CGST_SGST_IGST on Local Purchase */}
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

                  {/* 25. Interest or Fine on Custom Duty */}
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

                  {/* 26. Custom Clearance Charges */}
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

                  {/* 27. IGST/GST on Custom Clearance */}
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

                  {/* 28. Total Custom Clearance Charges (COMPUTED) */}
                  <ComputedField
                    id="total_custom_clearance_charges"
                    label="Total Custom Clearance Charges"
                    value={formData.total_custom_clearance_charges || 0}
                    tooltip="Formula: Custom Clearance Charges + IGST/GST on Custom Clearance"
                  />

                  {/* 29. Total Landed Price (COMPUTED) */}
                  <ComputedField
                    id="total_landed_price"
                    label="Total Landed Price"
                    value={formData.total_landed_price || 0}
                    tooltip="Formula: Sum of Equivalent INR, freight, duties, taxes, and clearance charges"
                  />

                  {/* 30. Landed Unit Price (COMPUTED) */}
                  <ComputedField
                    id="landed_unit_price"
                    label="Landed Unit Price"
                    value={formData.landed_unit_price || 0}
                    tooltip="Formula: Total Landed Price / QTY"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ============ CUSTOMER PO & INVOICE SECTION ============ */}
            <Collapsible open={openSections.customer}>
              <CollapsibleTrigger
                onClick={() => toggleSection('customer')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                type="button"
              >
                <span className="font-medium text-gray-900">Customer PO & Invoice Details</span>
                {openSections.customer ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 31. Customer */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="customer">Customer</Label>
                    <Input
                      id="customer"
                      value={formData.customer}
                      onChange={(e) => handleInputChange('customer', e.target.value)}
                      placeholder="e.g., Tech Solutions Ltd"
                    />
                  </div>

                  {/* 32. Customer's PO */}
                  <div className="space-y-2">
                    <Label htmlFor="customer_po">Customer's PO</Label>
                    <Input
                      id="customer_po"
                      value={formData.customer_po}
                      onChange={(e) => handleInputChange('customer_po', e.target.value)}
                      placeholder="e.g., CUST-PO-001"
                    />
                  </div>

                  {/* 33. PO Date */}
                  <div className="space-y-2">
                    <Label htmlFor="po_date">PO Date</Label>
                    <Input
                      id="po_date"
                      type="date"
                      value={formData.po_date}
                      onChange={(e) => handleInputChange('po_date', e.target.value)}
                    />
                  </div>

                  {/* 34. PO Price */}
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

                  {/* 35. Quantity */}
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                    />
                  </div>

                  {/* 36. Total PO Price (COMPUTED) */}
                  <ComputedField
                    id="total_po_price"
                    label="Total PO Price"
                    value={formData.total_po_price || 0}
                    tooltip="Formula: PO Price × Quantity"
                  />

                  {/* 37. IGST / GST % */}
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

                  {/* 38. GST / IGST Amount (COMPUTED) */}
                  <ComputedField
                    id="gst_igst_amount"
                    label="GST / IGST Amount"
                    value={formData.gst_igst_amount || 0}
                    tooltip="Formula: Total PO Price × (IGST/GST % / 100)"
                  />

                  {/* 39. Price to Customer */}
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

                  {/* 40. Invoice # (customer invoice #) */}
                  <div className="space-y-2">
                    <Label htmlFor="customer_invoice_number">Invoice # (customer invoice #)</Label>
                    <Input
                      id="customer_invoice_number"
                      value={formData.customer_invoice_number}
                      onChange={(e) => handleInputChange('customer_invoice_number', e.target.value)}
                      placeholder="e.g., CINV-001"
                    />
                  </div>

                  {/* 41. Date (customer invoice date) */}
                  <div className="space-y-2">
                    <Label htmlFor="customer_invoice_date">Date (customer invoice date)</Label>
                    <Input
                      id="customer_invoice_date"
                      type="date"
                      value={formData.customer_invoice_date}
                      onChange={(e) => handleInputChange('customer_invoice_date', e.target.value)}
                    />
                  </div>

                  {/* 42. Shipping Charges to customer */}
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

                  {/* 43. CGST_SGST */}
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

                  {/* 44. Price to SPPL (COMPUTED) */}
                  <ComputedField
                    id="price_to_sppl"
                    label="Price to SPPL"
                    value={formData.price_to_sppl || 0}
                    tooltip="Formula: Price to Customer - (Shipping Charges to customer + CGST_SGST)"
                  />

                  {/* 45. GM % (COMPUTED) */}
                  <ComputedField
                    id="gm_percentage"
                    label="GM %"
                    value={formData.gm_percentage || 0}
                    tooltip="Formula: ((Price to SPPL - Total Landed Price) / Total Landed Price) × 100"
                  />

                  {/* 46. Margin (COMPUTED) */}
                  <ComputedField
                    id="margin"
                    label="Margin"
                    value={formData.margin || 0}
                    tooltip="Formula: Price to SPPL - Total Landed Price"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t bg-gray-50 p-6">
            {!editingLineItem && (
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addAnother}
                    onChange={(e) => setAddAnother(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>Add another line item after saving (bulk entry)</span>
                </label>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#007BFF] hover:bg-[#0056b3]">
                {editingLineItem ? 'Update Line Item' : 'Add Line Item'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}