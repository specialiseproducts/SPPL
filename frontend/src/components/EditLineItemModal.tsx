import { useState, useEffect } from 'react';
import { X, Calculator, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { PurchaseRecord } from './PurchasesTab';
import { calculatePurchaseFields } from './PurchasesTab';

interface EditLineItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (lineItem: PurchaseRecord) => void;
  lineItem: PurchaseRecord;
}

export default function EditLineItemModal({
  isOpen,
  onClose,
  onUpdate,
  lineItem,
}: EditLineItemModalProps) {
  const [formData, setFormData] = useState<PurchaseRecord>(lineItem);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (lineItem) {
      setFormData(lineItem);
      setErrors({});
    }
  }, [lineItem]);

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
    
    // Step 1: Validate required fields
    const validationErrors: Record<string, boolean> = {};
    if (!formData.item_details) validationErrors.item_details = true;
    if (!formData.unit_price || formData.unit_price === 0) validationErrors.unit_price = true;
    if (!formData.qty || formData.qty === 0) validationErrors.qty = true;
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Step 2: Show saving state and save data
    setIsSaving(true);
    
    const calculated = calculatePurchaseFields(formData);
    const updatedLineItem: PurchaseRecord = {
      ...formData,
      ...calculated,
      updated_at: new Date().toISOString(),
    };

    // Simulate API delay (0.3-0.6s)
    setTimeout(() => {
      setIsSaving(false);
      // Step 3-6: Modal closes, table updates handled by parent
      onUpdate(updatedLineItem);
    }, 400);
  };

  if (!isOpen || !lineItem || !formData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl flex flex-col transform transition-all duration-300" style={{ height: '92vh', maxHeight: '92vh' }}>
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0 bg-white rounded-t-lg">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Edit Line Item – PO#: {formData.po_number} | Principal: {formData.principal}
            </h2>
            <p className="text-sm text-gray-600 mt-1">Update the line item details below (All 46 fields in exact order)</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6 space-y-8">
          
          {/* Section A: Document Details (Fields 1-9) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
              A. Document Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Field 1: Record Type */}
              <div>
                <Label htmlFor="record_type">1. Record Type</Label>
                <Select
                  value={formData.record_type}
                  disabled
                >
                  <SelectTrigger className="bg-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Import">Import</SelectItem>
                    <SelectItem value="Local Purchase">Local Purchase</SelectItem>
                    <SelectItem value="Sample">Sample</SelectItem>
                    <SelectItem value="Stock Transfer">Stock Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Field 2: PO# */}
              <div>
                <Label htmlFor="po_number">2. PO#</Label>
                <Input
                  id="po_number"
                  value={formData.po_number}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              {/* Field 3: Date */}
              <div>
                <Label htmlFor="date">3. Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                />
              </div>

              {/* Field 4: Principal */}
              <div>
                <Label htmlFor="principal">4. Principal</Label>
                <Input
                  id="principal"
                  value={formData.principal}
                  onChange={(e) => handleInputChange('principal', e.target.value)}
                />
              </div>

              {/* Field 5: Invoice # */}
              <div>
                <Label htmlFor="invoice_number">5. Invoice #</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                />
              </div>

              {/* Field 6: Invoice Date */}
              <div>
                <Label htmlFor="invoice_date">6. Invoice Date</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                />
              </div>

              {/* Field 7: BOE # */}
              <div>
                <Label htmlFor="boe_number">7. BOE #</Label>
                <Input
                  id="boe_number"
                  value={formData.boe_number}
                  onChange={(e) => handleInputChange('boe_number', e.target.value)}
                />
              </div>

              {/* Field 8: BOE Date */}
              <div>
                <Label htmlFor="boe_date">8. BOE Date</Label>
                <Input
                  id="boe_date"
                  type="date"
                  value={formData.boe_date}
                  onChange={(e) => handleInputChange('boe_date', e.target.value)}
                />
              </div>

              {/* Field 9: HS Code */}
              <div>
                <Label htmlFor="hs_code">9. HS Code</Label>
                <Input
                  id="hs_code"
                  value={formData.hs_code}
                  onChange={(e) => handleInputChange('hs_code', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section B: Item & Pricing Basics (Fields 10-13) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
              B. Item & Pricing Basics
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Field 10: Item Details */}
              <div className="col-span-2">
                <Label htmlFor="item_details">10. Item Details *</Label>
                <Input
                  id="item_details"
                  value={formData.item_details}
                  onChange={(e) => {
                    handleInputChange('item_details', e.target.value);
                    if (errors.item_details) setErrors({ ...errors, item_details: false });
                  }}
                  className={errors.item_details ? 'border-red-500' : ''}
                  required
                />
                {errors.item_details && <p className="text-red-500 text-sm mt-1">This field is required</p>}
              </div>

              {/* Field 11: Part # */}
              <div>
                <Label htmlFor="part_number">11. Part #</Label>
                <Input
                  id="part_number"
                  value={formData.part_number}
                  onChange={(e) => handleInputChange('part_number', e.target.value)}
                />
              </div>

              {/* Field 12: Unit Price */}
              <div>
                <Label htmlFor="unit_price">12. Unit Price *</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => {
                    handleInputChange('unit_price', parseFloat(e.target.value) || 0);
                    if (errors.unit_price) setErrors({ ...errors, unit_price: false });
                  }}
                  className={errors.unit_price ? 'border-red-500' : ''}
                  required
                />
                {errors.unit_price && <p className="text-red-500 text-sm mt-1">This field is required</p>}
              </div>

              {/* Field 13: QTY */}
              <div>
                <Label htmlFor="qty">13. QTY *</Label>
                <Input
                  id="qty"
                  type="number"
                  step="0.01"
                  value={formData.qty}
                  onChange={(e) => {
                    handleInputChange('qty', parseFloat(e.target.value) || 0);
                    if (errors.qty) setErrors({ ...errors, qty: false });
                  }}
                  className={errors.qty ? 'border-red-500' : ''}
                  required
                />
                {errors.qty && <p className="text-red-500 text-sm mt-1">This field is required</p>}
              </div>
            </div>
          </div>

          {/* Section C: Freight & Pricing (Fields 14-21) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
              C. Freight & Pricing
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Field 14: Freight Charges - International */}
              <div>
                <Label htmlFor="freight_charges_international">14. Freight Charges - International</Label>
                <Input
                  id="freight_charges_international"
                  type="number"
                  step="0.01"
                  value={formData.freight_charges_international}
                  onChange={(e) => handleInputChange('freight_charges_international', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 15: GST on Freight Charges */}
              <div>
                <Label htmlFor="gst_on_freight_charges">15. GST on Freight Charges</Label>
                <Input
                  id="gst_on_freight_charges"
                  type="number"
                  step="0.01"
                  value={formData.gst_on_freight_charges}
                  onChange={(e) => handleInputChange('gst_on_freight_charges', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 16: Total Price in FE / INR (AUTO-CALCULATED) */}
              <div>
                <Label htmlFor="total_price_in_fe_inr">
                  16. Total Price in FE / INR
                  <Calculator className="inline w-4 h-4 ml-1 text-blue-600" />
                </Label>
                <Input
                  id="total_price_in_fe_inr"
                  type="number"
                  step="0.01"
                  value={formData.total_price_in_fe_inr}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              {/* Field 17: Exchange Rate as per BOE */}
              <div>
                <Label htmlFor="exchange_rate_as_per_boe">17. Exchange Rate as per BOE</Label>
                <Input
                  id="exchange_rate_as_per_boe"
                  type="number"
                  step="0.0001"
                  value={formData.exchange_rate_as_per_boe}
                  onChange={(e) => handleInputChange('exchange_rate_as_per_boe', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 18: Equivalent INR as per BOE (AUTO-CALCULATED) */}
              <div>
                <Label htmlFor="equivalent_inr_as_per_boe">
                  18. Equivalent INR as per BOE
                  <Calculator className="inline w-4 h-4 ml-1 text-blue-600" />
                </Label>
                <Input
                  id="equivalent_inr_as_per_boe"
                  type="number"
                  step="0.01"
                  value={formData.equivalent_inr_as_per_boe}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              {/* Field 19: Actual Bank Transfer Amount */}
              <div>
                <Label htmlFor="actual_bank_transfer_amount">19. Actual Bank Transfer Amount</Label>
                <Input
                  id="actual_bank_transfer_amount"
                  type="number"
                  step="0.01"
                  value={formData.actual_bank_transfer_amount}
                  onChange={(e) => handleInputChange('actual_bank_transfer_amount', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 20: Bank Charges */}
              <div>
                <Label htmlFor="bank_charges">20. Bank Charges</Label>
                <Input
                  id="bank_charges"
                  type="number"
                  step="0.01"
                  value={formData.bank_charges}
                  onChange={(e) => handleInputChange('bank_charges', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 21: GST on Bank Charges */}
              <div>
                <Label htmlFor="gst_on_bank_charges">21. GST on Bank Charges</Label>
                <Input
                  id="gst_on_bank_charges"
                  type="number"
                  step="0.01"
                  value={formData.gst_on_bank_charges}
                  onChange={(e) => handleInputChange('gst_on_bank_charges', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Section D: Duties & Taxes (Fields 22-25) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
              D. Duties & Taxes
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Field 22: Basic Custom Duty */}
              <div>
                <Label htmlFor="basic_custom_duty">22. Basic Custom Duty</Label>
                <Input
                  id="basic_custom_duty"
                  type="number"
                  step="0.01"
                  value={formData.basic_custom_duty}
                  onChange={(e) => handleInputChange('basic_custom_duty', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 23: Surcharge */}
              <div>
                <Label htmlFor="surcharge">23. Surcharge</Label>
                <Input
                  id="surcharge"
                  type="number"
                  step="0.01"
                  value={formData.surcharge}
                  onChange={(e) => handleInputChange('surcharge', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 24: IGST on Import / CGST_SGST_IGST on Local Purchase */}
              <div>
                <Label htmlFor="gst_on_import_cgst_sgst_igst_local">24. IGST on Import / CGST_SGST_IGST on Local Purchase</Label>
                <Input
                  id="gst_on_import_cgst_sgst_igst_local"
                  type="number"
                  step="0.01"
                  value={formData.gst_on_import_cgst_sgst_igst_local}
                  onChange={(e) => handleInputChange('gst_on_import_cgst_sgst_igst_local', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 25: Interest or Fine on Custom Duty */}
              <div>
                <Label htmlFor="interest_or_fine_on_custom_duty">25. Interest or Fine on Custom Duty</Label>
                <Input
                  id="interest_or_fine_on_custom_duty"
                  type="number"
                  step="0.01"
                  value={formData.interest_or_fine_on_custom_duty}
                  onChange={(e) => handleInputChange('interest_or_fine_on_custom_duty', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Section E: Custom Clearance (Fields 26-30) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
              E. Custom Clearance
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Field 26: Custom Clearance Charges */}
              <div>
                <Label htmlFor="custom_clearance_charges">26. Custom Clearance Charges</Label>
                <Input
                  id="custom_clearance_charges"
                  type="number"
                  step="0.01"
                  value={formData.custom_clearance_charges}
                  onChange={(e) => handleInputChange('custom_clearance_charges', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 27: IGST/GST on Custom Clearance */}
              <div>
                <Label htmlFor="igst_gst_on_custom_clearance">27. IGST/GST on Custom Clearance</Label>
                <Input
                  id="igst_gst_on_custom_clearance"
                  type="number"
                  step="0.01"
                  value={formData.igst_gst_on_custom_clearance}
                  onChange={(e) => handleInputChange('igst_gst_on_custom_clearance', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 28: Total Custom Clearance Charges (AUTO-CALCULATED) */}
              <div>
                <Label htmlFor="total_custom_clearance_charges">
                  28. Total Custom Clearance Charges
                  <Calculator className="inline w-4 h-4 ml-1 text-blue-600" />
                </Label>
                <Input
                  id="total_custom_clearance_charges"
                  type="number"
                  step="0.01"
                  value={formData.total_custom_clearance_charges}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              {/* Field 29: Total Landed Price (AUTO-CALCULATED) */}
              <div>
                <Label htmlFor="total_landed_price">
                  29. Tatal Landed Price
                  <Calculator className="inline w-4 h-4 ml-1 text-blue-600" />
                </Label>
                <Input
                  id="total_landed_price"
                  type="number"
                  step="0.01"
                  value={formData.total_landed_price}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              {/* Field 30: Landed Unit Price (AUTO-CALCULATED) */}
              <div>
                <Label htmlFor="landed_unit_price">
                  30. Landed Unit Price
                  <Calculator className="inline w-4 h-4 ml-1 text-blue-600" />
                </Label>
                <Input
                  id="landed_unit_price"
                  type="number"
                  step="0.01"
                  value={formData.landed_unit_price}
                  disabled
                  className="bg-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Section F: Customer Details (Fields 31-43) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
              F. Customer Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Field 31: Customer */}
              <div>
                <Label htmlFor="customer">31. Customer</Label>
                <Input
                  id="customer"
                  value={formData.customer}
                  onChange={(e) => handleInputChange('customer', e.target.value)}
                />
              </div>

              {/* Field 32: Customer's PO */}
              <div>
                <Label htmlFor="customer_po">32. Customer's PO</Label>
                <Input
                  id="customer_po"
                  value={formData.customer_po}
                  onChange={(e) => handleInputChange('customer_po', e.target.value)}
                />
              </div>

              {/* Field 33: PO Date */}
              <div>
                <Label htmlFor="po_date">33. PO Date</Label>
                <Input
                  id="po_date"
                  type="date"
                  value={formData.po_date}
                  onChange={(e) => handleInputChange('po_date', e.target.value)}
                />
              </div>

              {/* Field 34: PO Price */}
              <div>
                <Label htmlFor="po_price">34. PO Price</Label>
                <Input
                  id="po_price"
                  type="number"
                  step="0.01"
                  value={formData.po_price}
                  onChange={(e) => handleInputChange('po_price', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 35: Quantity */}
              <div>
                <Label htmlFor="quantity">35. Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange('quantity', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 36: Total PO Price (AUTO-CALCULATED) */}
              <div>
                <Label htmlFor="total_po_price">
                  36. Total PO Price
                  <Calculator className="inline w-4 h-4 ml-1 text-blue-600" />
                </Label>
                <Input
                  id="total_po_price"
                  type="number"
                  step="0.01"
                  value={formData.total_po_price}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              {/* Field 37: IGST / GST % */}
              <div>
                <Label htmlFor="igst_gst_percentage">37. IGST / GST %</Label>
                <Input
                  id="igst_gst_percentage"
                  type="number"
                  step="0.01"
                  value={formData.igst_gst_percentage}
                  onChange={(e) => handleInputChange('igst_gst_percentage', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 38: GST / IGST Amount */}
              <div>
                <Label htmlFor="gst_igst_amount">38. GST / IGST Amount</Label>
                <Input
                  id="gst_igst_amount"
                  type="number"
                  step="0.01"
                  value={formData.gst_igst_amount}
                  onChange={(e) => handleInputChange('gst_igst_amount', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 39: Price to Customer */}
              <div>
                <Label htmlFor="price_to_customer">39. Price to Customer</Label>
                <Input
                  id="price_to_customer"
                  type="number"
                  step="0.01"
                  value={formData.price_to_customer}
                  onChange={(e) => handleInputChange('price_to_customer', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 40: Customer Invoice # */}
              <div>
                <Label htmlFor="customer_invoice_number">40. Invoice # (Customer Invoice #)</Label>
                <Input
                  id="customer_invoice_number"
                  value={formData.customer_invoice_number}
                  onChange={(e) => handleInputChange('customer_invoice_number', e.target.value)}
                />
              </div>

              {/* Field 41: Customer Invoice Date */}
              <div>
                <Label htmlFor="customer_invoice_date">41. Date (Customer Invoice Date)</Label>
                <Input
                  id="customer_invoice_date"
                  type="date"
                  value={formData.customer_invoice_date}
                  onChange={(e) => handleInputChange('customer_invoice_date', e.target.value)}
                />
              </div>

              {/* Field 42: Shipping Charges to customer */}
              <div>
                <Label htmlFor="shipping_charges_to_customer">42. Shipping Charges to customer</Label>
                <Input
                  id="shipping_charges_to_customer"
                  type="number"
                  step="0.01"
                  value={formData.shipping_charges_to_customer}
                  onChange={(e) => handleInputChange('shipping_charges_to_customer', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 43: CGST_SGST */}
              <div>
                <Label htmlFor="cgst_sgst">43. CGST_SGST</Label>
                <Input
                  id="cgst_sgst"
                  type="number"
                  step="0.01"
                  value={formData.cgst_sgst}
                  onChange={(e) => handleInputChange('cgst_sgst', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Section G: SPPL Pricing & Margin (Fields 44-46) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
              G. SPPL Pricing & Margin
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Field 44: Price to SPPL */}
              <div>
                <Label htmlFor="price_to_sppl">44. Price to SPPL</Label>
                <Input
                  id="price_to_sppl"
                  type="number"
                  step="0.01"
                  value={formData.price_to_sppl}
                  onChange={(e) => handleInputChange('price_to_sppl', parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Field 45: GM % (AUTO-CALCULATED) */}
              <div>
                <Label htmlFor="gm_percentage">
                  45. GM %
                  <Calculator className="inline w-4 h-4 ml-1 text-blue-600" />
                </Label>
                <Input
                  id="gm_percentage"
                  type="number"
                  step="0.01"
                  value={formData.gm_percentage}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              {/* Field 46: Margin (AUTO-CALCULATED) */}
              <div>
                <Label htmlFor="margin">
                  46. Margin
                  <Calculator className="inline w-4 h-4 ml-1 text-blue-600" />
                </Label>
                <Input
                  id="margin"
                  type="number"
                  step="0.01"
                  value={formData.margin}
                  disabled
                  className="bg-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-6 border-t bg-white">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#007BFF] hover:bg-[#0056b3]">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Line Item'}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}