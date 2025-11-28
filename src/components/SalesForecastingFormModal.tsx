import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { SalesForecastRecord, CurrencyRates } from './SalesForecastingTab';
import { computeTotalPrice, computeConversionToINR } from './SalesForecastingTab';
import type { UserMaster } from './UserCreationTab';

interface SalesForecastingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (forecast: SalesForecastRecord) => void;
  editingForecast: SalesForecastRecord | null;
  currentEmployeeCode: string;
  currentEmployeeName: string;
  availableUsers: UserMaster[];
  isAdmin: boolean;
  currencyRates: CurrencyRates;
}

export default function SalesForecastingFormModal({
  isOpen,
  onClose,
  onSave,
  editingForecast,
  currentEmployeeCode,
  currentEmployeeName,
  availableUsers,
  isAdmin,
  currencyRates,
}: SalesForecastingFormModalProps) {
  const [formData, setFormData] = useState({
    quotation_ref: '',
    quotation_date: '',
    valid_till: '',
    decision_by_date: '',
    end_customer: '',
    enquiry_details: '',
    principal: '',
    quoted_item_model: '',
    quoted_item_description: '',
    currency: 'INR',
    unit_price: '',
    quantity: '',
    delivery_days: '',
    warranty_days: '',
    probability_percent: '',
    supporting_docs: '',
    employee_name: currentEmployeeName,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingForecast) {
      setFormData({
        quotation_ref: editingForecast.quotation_ref,
        quotation_date: editingForecast.quotation_date,
        valid_till: editingForecast.valid_till,
        decision_by_date: editingForecast.decision_by_date,
        end_customer: editingForecast.end_customer,
        enquiry_details: editingForecast.enquiry_details,
        principal: editingForecast.principal,
        quoted_item_model: editingForecast.quoted_item_model,
        quoted_item_description: editingForecast.quoted_item_description,
        currency: editingForecast.currency,
        unit_price: editingForecast.unit_price.toString(),
        quantity: editingForecast.quantity.toString(),
        delivery_days: editingForecast.delivery_days.toString(),
        warranty_days: editingForecast.warranty_days.toString(),
        probability_percent: editingForecast.probability_percent.toString(),
        supporting_docs: editingForecast.supporting_docs,
        employee_name: editingForecast.employee_name,
      });
    } else {
      setFormData({
        quotation_ref: '',
        quotation_date: '',
        valid_till: '',
        decision_by_date: '',
        end_customer: '',
        enquiry_details: '',
        principal: '',
        quoted_item_model: '',
        quoted_item_description: '',
        currency: 'INR',
        unit_price: '',
        quantity: '',
        delivery_days: '',
        warranty_days: '',
        probability_percent: '',
        supporting_docs: '',
        employee_name: currentEmployeeName,
      });
    }
    setErrors({});
  }, [editingForecast, isOpen, currentEmployeeName]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.quotation_ref.trim()) newErrors.quotation_ref = 'Quotation Ref # is required';
    if (!formData.quotation_date) newErrors.quotation_date = 'Quotation Date is required';
    if (!formData.end_customer.trim()) newErrors.end_customer = 'End Customer is required';
    if (!formData.quoted_item_model.trim()) newErrors.quoted_item_model = 'Quoted Item Model is required';
    if (!formData.currency) newErrors.currency = 'Currency is required';
    if (!formData.unit_price || parseFloat(formData.unit_price) < 0) newErrors.unit_price = 'Valid Unit Price is required';
    if (!formData.quantity || parseInt(formData.quantity) < 1) newErrors.quantity = 'Quantity must be at least 1';
    if (formData.probability_percent && (parseFloat(formData.probability_percent) < 0 || parseFloat(formData.probability_percent) > 100)) {
      newErrors.probability_percent = 'Probability must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const unitPrice = parseFloat(formData.unit_price);
    const quantity = parseInt(formData.quantity);
    const totalPrice = computeTotalPrice(unitPrice, quantity);
    const conversionToINR = computeConversionToINR(formData.currency, totalPrice, currencyRates);

    const selectedUser = availableUsers.find((u) => u.employee_name === formData.employee_name);
    const employeeCode = selectedUser?.employee_code || currentEmployeeCode;

    const forecast: SalesForecastRecord = {
      id: editingForecast?.id || `SF-${Date.now()}`,
      quotation_ref: formData.quotation_ref.trim(),
      quotation_date: formData.quotation_date,
      valid_till: formData.valid_till,
      decision_by_date: formData.decision_by_date,
      end_customer: formData.end_customer.trim(),
      enquiry_details: formData.enquiry_details.trim(),
      principal: formData.principal.trim(),
      quoted_item_model: formData.quoted_item_model.trim(),
      quoted_item_description: formData.quoted_item_description.trim(),
      currency: formData.currency,
      unit_price: unitPrice,
      quantity: quantity,
      total_price: totalPrice,
      conversion_to_inr: conversionToINR,
      delivery_days: formData.delivery_days ? parseInt(formData.delivery_days) : 0,
      warranty_days: formData.warranty_days ? parseInt(formData.warranty_days) : 0,
      probability_percent: formData.probability_percent ? parseFloat(formData.probability_percent) : 0,
      supporting_docs: formData.supporting_docs.trim(),
      employee_code: employeeCode,
      employee_name: formData.employee_name,
      created_at: editingForecast?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSave(forecast);
  };

  const totalPrice = computeTotalPrice(parseFloat(formData.unit_price) || 0, parseInt(formData.quantity) || 0);
  const conversionToINR = computeConversionToINR(formData.currency, totalPrice, currencyRates);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-[#212529]">{editingForecast ? 'Edit Quotation Item' : 'Create New Quotation Item'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="quotation_ref">
                  Quotation Ref # <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quotation_ref"
                  value={formData.quotation_ref}
                  onChange={(e) => setFormData({ ...formData, quotation_ref: e.target.value })}
                  placeholder="Q2024-001"
                />
                {errors.quotation_ref && <p className="text-sm text-red-500 mt-1">{errors.quotation_ref}</p>}
              </div>

              <div>
                <Label htmlFor="quotation_date">
                  Quotation Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quotation_date"
                  type="date"
                  value={formData.quotation_date}
                  onChange={(e) => setFormData({ ...formData, quotation_date: e.target.value })}
                />
                {errors.quotation_date && <p className="text-sm text-red-500 mt-1">{errors.quotation_date}</p>}
              </div>

              <div>
                <Label htmlFor="valid_till">Valid Till</Label>
                <Input
                  id="valid_till"
                  type="date"
                  value={formData.valid_till}
                  onChange={(e) => setFormData({ ...formData, valid_till: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="decision_by_date">Decision by Probable Date</Label>
                <Input
                  id="decision_by_date"
                  type="date"
                  value={formData.decision_by_date}
                  onChange={(e) => setFormData({ ...formData, decision_by_date: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="end_customer">
                  End Customer Organization / End User Name and Contact Details <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="end_customer"
                  value={formData.end_customer}
                  onChange={(e) => setFormData({ ...formData, end_customer: e.target.value })}
                  placeholder="Organization Name, Contact Person, Phone, Email"
                  rows={3}
                />
                {errors.end_customer && <p className="text-sm text-red-500 mt-1">{errors.end_customer}</p>}
              </div>

              <div>
                <Label htmlFor="enquiry_details">Enquiry Details (Tender # or BQ / FQ)</Label>
                <Textarea
                  id="enquiry_details"
                  value={formData.enquiry_details}
                  onChange={(e) => setFormData({ ...formData, enquiry_details: e.target.value })}
                  placeholder="Tender # TEN/2024/001 - Budgetary Quotation"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="principal">Principal (Only Name)</Label>
                <Input
                  id="principal"
                  value={formData.principal}
                  onChange={(e) => setFormData({ ...formData, principal: e.target.value })}
                  placeholder="Dell Technologies"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="quoted_item_model">
                  Quoted items Model # <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quoted_item_model"
                  value={formData.quoted_item_model}
                  onChange={(e) => setFormData({ ...formData, quoted_item_model: e.target.value })}
                  placeholder="PowerEdge R750"
                />
                {errors.quoted_item_model && <p className="text-sm text-red-500 mt-1">{errors.quoted_item_model}</p>}
              </div>

              <div>
                <Label htmlFor="quoted_item_description">Quoted Item Description</Label>
                <Textarea
                  id="quoted_item_description"
                  value={formData.quoted_item_description}
                  onChange={(e) => setFormData({ ...formData, quoted_item_description: e.target.value })}
                  placeholder="Detailed description of the quoted item"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="currency">
                  Currency <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="Euro">Euro</SelectItem>
                  </SelectContent>
                </Select>
                {errors.currency && <p className="text-sm text-red-500 mt-1">{errors.currency}</p>}
              </div>

              <div>
                <Label htmlFor="unit_price">
                  Unit Price <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                  placeholder="8500.00"
                />
                {errors.unit_price && <p className="text-sm text-red-500 mt-1">{errors.unit_price}</p>}
              </div>

              <div>
                <Label htmlFor="quantity">
                  QTY <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="5"
                />
                {errors.quantity && <p className="text-sm text-red-500 mt-1">{errors.quantity}</p>}
              </div>

              <div>
                <Label htmlFor="total_price">Total Price (without GST)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="total_price"
                    type="text"
                    value={totalPrice.toFixed(2)}
                    disabled
                    className="bg-gray-100 text-gray-700"
                  />
                  <span className="text-sm text-gray-600">{formData.currency}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Calculated: Unit Price × QTY</p>
              </div>

              <div>
                <Label htmlFor="conversion_to_inr">Conversion to INR (without GST)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="conversion_to_inr"
                    type="text"
                    value={conversionToINR.toFixed(2)}
                    disabled
                    className="bg-gray-100 text-gray-700"
                  />
                  <span className="text-sm text-gray-600">INR</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Calculated using currency rates. Update rates in Settings.
                </p>
              </div>

              <div>
                <Label htmlFor="delivery_days">Delivery Schedule in Days</Label>
                <Input
                  id="delivery_days"
                  type="number"
                  value={formData.delivery_days}
                  onChange={(e) => setFormData({ ...formData, delivery_days: e.target.value })}
                  placeholder="45"
                />
              </div>

              <div>
                <Label htmlFor="warranty_days">Warranty in days</Label>
                <Input
                  id="warranty_days"
                  type="number"
                  value={formData.warranty_days}
                  onChange={(e) => setFormData({ ...formData, warranty_days: e.target.value })}
                  placeholder="365"
                />
              </div>

              <div>
                <Label htmlFor="probability_percent">Probability of Receiving PO (%)</Label>
                <Input
                  id="probability_percent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.probability_percent}
                  onChange={(e) => setFormData({ ...formData, probability_percent: e.target.value })}
                  placeholder="75"
                />
                {errors.probability_percent && <p className="text-sm text-red-500 mt-1">{errors.probability_percent}</p>}
              </div>

              <div>
                <Label htmlFor="supporting_docs">Supporting Documents (upload / link)</Label>
                <Input
                  id="supporting_docs"
                  value={formData.supporting_docs}
                  onChange={(e) => setFormData({ ...formData, supporting_docs: e.target.value })}
                  placeholder="/uploads/sales/quote_001.pdf"
                />
              </div>

              {isAdmin && (
                <div>
                  <Label htmlFor="employee_name">Employee Name</Label>
                  <Select
                    value={formData.employee_name}
                    onValueChange={(value) => setFormData({ ...formData, employee_name: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.employee_code} value={user.employee_name}>
                          {user.employee_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#007BFF] hover:bg-[#0056b3]">
              {editingForecast ? 'Update' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
