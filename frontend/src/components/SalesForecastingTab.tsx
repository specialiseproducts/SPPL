import { useEffect, useState } from 'react';
import { Plus, Download, Upload, Search, Edit, Trash2, Eye, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import SalesForecastingFormModal from './SalesForecastingFormModal';
import SalesForecastingImportModal from './SalesForecastingImportModal';
import CurrencyRateSettingsModal from './CurrencyRateSettingsModal';
import type { UserRole } from '../App';
import type { UserMaster } from './UserCreationTab';
import { apiFetch } from '../services/api';
import { canCreate, canDelete, canEdit, canExport, isAdmin, isDeveloper } from '../utils/accessControl';

export interface SalesForecastRecord {
  id: string;
  forecastId?: string;
  quotation_ref: string;
  quotation_date: string;
  valid_till: string;
  decision_by_date: string;
  end_customer: string;
  enquiry_details: string;
  principal: string;
  quoted_item_model: string;
  quoted_item_description: string;
  currency: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  conversion_to_inr: number;
  delivery_days: number;
  warranty_days: number;
  probability_percent: number;
  supporting_docs: string;
  employee_code: string;
  employee_name: string;
  created_at: string;
  updated_at: string;
}

export interface CurrencyRates {
  INR: number;
  Euro: number;
  USD: number;
}

interface SalesForecastingTabProps {
  userRole: UserRole;
  currentUserName: string;
  currentEmployeeCode: string;
  availableUsers: UserMaster[];
}

const initialForecasts: SalesForecastRecord[] = [
  {
    id: '1',
    quotation_ref: 'Q2024-001',
    quotation_date: '2024-01-15',
    valid_till: '2024-02-15',
    decision_by_date: '2024-02-10',
    end_customer: 'ABC Technologies Pvt Ltd, Contact: Rajesh Kumar, +91-9876543210, rajesh@abctech.com',
    enquiry_details: 'Tender # TEN/2024/001 - Budgetary Quotation for Server Infrastructure',
    principal: 'Dell Technologies',
    quoted_item_model: 'PowerEdge R750',
    quoted_item_description: 'Dell PowerEdge R750 Rack Server, 2x Intel Xeon Gold 6338, 128GB RAM, 4x 2TB SSD',
    currency: 'USD',
    unit_price: 8500,
    quantity: 5,
    total_price: 42500,
    conversion_to_inr: 3655000,
    delivery_days: 45,
    warranty_days: 1095,
    probability_percent: 75,
    supporting_docs: '/uploads/sales/quote_001.pdf',
    employee_code: 'E001',
    employee_name: 'Admin User',
    created_at: '2024-01-15T10:30:00',
    updated_at: '2024-01-15T10:30:00',
  },
  {
    id: '2',
    quotation_ref: 'Q2024-001',
    quotation_date: '2024-01-15',
    valid_till: '2024-02-15',
    decision_by_date: '2024-02-10',
    end_customer: 'ABC Technologies Pvt Ltd, Contact: Rajesh Kumar, +91-9876543210, rajesh@abctech.com',
    enquiry_details: 'Tender # TEN/2024/001 - Budgetary Quotation for Server Infrastructure',
    principal: 'Dell Technologies',
    quoted_item_model: 'PowerEdge R650',
    quoted_item_description: 'Dell PowerEdge R650 Rack Server, 2x Intel Xeon Silver 4314, 64GB RAM, 2x 1TB SSD',
    currency: 'USD',
    unit_price: 6200,
    quantity: 3,
    total_price: 18600,
    conversion_to_inr: 1599600,
    delivery_days: 45,
    warranty_days: 1095,
    probability_percent: 75,
    supporting_docs: '/uploads/sales/quote_001.pdf',
    employee_code: 'E001',
    employee_name: 'Admin User',
    created_at: '2024-01-15T10:30:00',
    updated_at: '2024-01-15T10:30:00',
  },
  {
    id: '3',
    quotation_ref: 'Q2024-002',
    quotation_date: '2024-01-20',
    valid_till: '2024-03-20',
    decision_by_date: '2024-03-15',
    end_customer: 'XYZ Manufacturing Ltd, Contact: Priya Sharma, +91-9988776655, priya@xyzmanuf.in',
    enquiry_details: 'BQ - Industrial Automation System',
    principal: 'Siemens',
    quoted_item_model: 'SIMATIC S7-1500',
    quoted_item_description: 'Siemens SIMATIC S7-1500 PLC with CPU 1515-2 PN, 500KB program memory',
    currency: 'Euro',
    unit_price: 3500,
    quantity: 10,
    total_price: 35000,
    conversion_to_inr: 3325000,
    delivery_days: 60,
    warranty_days: 730,
    probability_percent: 50,
    supporting_docs: '/uploads/sales/quote_002.pdf',
    employee_code: 'E001',
    employee_name: 'Admin User',
    created_at: '2024-01-20T14:20:00',
    updated_at: '2024-01-20T14:20:00',
  },
  {
    id: '4',
    quotation_ref: 'Q2024-003',
    quotation_date: '2024-02-01',
    valid_till: '2024-04-01',
    decision_by_date: '2024-03-25',
    end_customer: 'Global Enterprises, Contact: Amit Patel, +91-9123456789, amit@globalent.com',
    enquiry_details: 'FQ - Network Security Appliances',
    principal: 'Cisco',
    quoted_item_model: 'Firepower 2130',
    quoted_item_description: 'Cisco Firepower 2130 NGFW, 10 Gbps throughput, Advanced Malware Protection',
    currency: 'INR',
    unit_price: 450000,
    quantity: 2,
    total_price: 900000,
    conversion_to_inr: 900000,
    delivery_days: 30,
    warranty_days: 365,
    probability_percent: 90,
    supporting_docs: '/uploads/sales/quote_003.pdf',
    employee_code: 'E001',
    employee_name: 'Admin User',
    created_at: '2024-02-01T09:15:00',
    updated_at: '2024-02-01T09:15:00',
  },
];

export const DEFAULT_CURRENCY_RATES: CurrencyRates = {
  INR: 1,
  Euro: 95,
  USD: 86,
};

export function computeTotalPrice(unitPrice: number, quantity: number): number {
  const u = Number(unitPrice || 0);
  const q = Number(quantity || 0);
  return parseFloat((u * q).toFixed(2));
}

export function computeConversionToINR(
  currency: string,
  totalPrice: number,
  rates: CurrencyRates = DEFAULT_CURRENCY_RATES
): number {
  if (!currency) return 0;
  const c = currency.trim();
  if (c === 'INR') return parseFloat(totalPrice.toFixed(2));
  if (rates[c as keyof CurrencyRates] !== undefined) {
    return parseFloat((totalPrice * rates[c as keyof CurrencyRates]).toFixed(2));
  }
  return 0;
}

export default function SalesForecastingTab({
  userRole,
  currentUserName,
  currentEmployeeCode,
  availableUsers,
}: SalesForecastingTabProps) {
  const [forecasts, setForecasts] = useState<SalesForecastRecord[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRates>(DEFAULT_CURRENCY_RATES);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRateSettingsOpen, setIsRateSettingsOpen] = useState(false);
  const [editingForecast, setEditingForecast] = useState<SalesForecastRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('all');
  const [selectedPrincipal, setSelectedPrincipal] = useState<string>('all');
  const [selectedProbability, setSelectedProbability] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const privileged = isAdmin(userRole) || isDeveloper(userRole);
  const canCreateRecords = canCreate(userRole);
  const canEditRecords = canEdit(userRole);
  const canDeleteRecords = canDelete(userRole);
  const canExportRecords = canExport(userRole);

  const mapApiForecastToRecord = (item: any): SalesForecastRecord => ({
    id: item.forecastId,
    forecastId: item.forecastId,
    quotation_ref: item.quotationRef || '',
    quotation_date: item.quotationDate || '',
    valid_till: '',
    decision_by_date: '',
    end_customer: item.endCustomer || '',
    enquiry_details: '',
    principal: item.principal || '',
    quoted_item_model: item.quotedItemModel || '',
    quoted_item_description: '',
    currency: item.currency || 'INR',
    unit_price: Number(item.unitPrice || 0),
    quantity: Number(item.qty || 0),
    total_price: Number(item.totalPrice || 0),
    conversion_to_inr: Number(item.conversionToINR || 0),
    delivery_days: 0,
    warranty_days: 0,
    probability_percent: Number(item.probability || 0),
    supporting_docs: '',
    employee_code: '',
    employee_name: item.employeeName || '',
    created_at: item.createdAt || '',
    updated_at: item.updatedAt || '',
  });

  const fetchForecasts = async () => {
    const data = await apiFetch('/api/sales-forecasts');
    setForecasts((data.data || []).map((item: any) => mapApiForecastToRecord(item)));
  };

  useEffect(() => {
    fetchForecasts().catch((error) => {
      console.error('Sales forecast fetch error:', error);
      toast.error('Failed to load sales forecasts');
    });
  }, []);

  const buildPayload = (forecast: SalesForecastRecord) => ({
    quotationRef: forecast.quotation_ref,
    quotationDate: forecast.quotation_date,
    endCustomer: forecast.end_customer,
    principal: forecast.principal,
    quotedItemModel: forecast.quoted_item_model,
    currency: forecast.currency,
    unitPrice: forecast.unit_price,
    qty: forecast.quantity,
    probability: forecast.probability_percent,
    employeeName: forecast.employee_name,
  });

  const handleCreateForecast = async (forecast: SalesForecastRecord) => {
    try {
      const data = await apiFetch('/api/sales-forecasts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildPayload(forecast)),
      });

      if (!data.success) {
        throw new Error('Create failed');
      }

      await fetchForecasts();
      setIsFormModalOpen(false);
      toast.success('✅ Sales Forecast Record Created Successfully');
    } catch (error) {
      console.error('Create sales forecast error:', error);
      toast.error('Failed to create sales forecast');
    }
  };

  const handleEditForecast = async (forecast: SalesForecastRecord) => {
    try {
      const forecastId = editingForecast?.forecastId || editingForecast?.id;
      if (!forecastId) {
        throw new Error('Missing forecastId');
      }

      const data = await apiFetch(`/api/sales-forecasts/${encodeURIComponent(forecastId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildPayload(forecast)),
      });

      if (!data.success) {
        throw new Error('Update failed');
      }

      await fetchForecasts();
      setEditingForecast(null);
      toast.success('✅ Sales Forecast Record Updated Successfully');
    } catch (error) {
      console.error('Update sales forecast error:', error);
      toast.error('Failed to update sales forecast');
    }
  };

  const handleDeleteForecast = async (forecastId: string) => {
    if (window.confirm('Are you sure you want to delete this forecast record?')) {
      try {
        const data = await apiFetch(`/api/sales-forecasts/${encodeURIComponent(forecastId)}`, {
          method: 'DELETE',
        });

        if (!data.success) {
          throw new Error('Delete failed');
        }

        await fetchForecasts();
        toast.success('✅ Sales Forecast Record Deleted Successfully');
      } catch (error) {
        console.error('Delete sales forecast error:', error);
        toast.error('Failed to delete sales forecast');
      }
    }
  };

  const handleImportForecasts = (importedForecasts: SalesForecastRecord[]) => {
    setForecasts([...forecasts, ...importedForecasts]);
    setIsImportModalOpen(false);
    toast.success(`✅ ${importedForecasts.length} Sales Forecast Records Imported Successfully`);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'quotation_ref',
      'quotation_date',
      'valid_till',
      'decision_by_date',
      'end_customer',
      'enquiry_details',
      'principal',
      'quoted_item_model',
      'quoted_item_description',
      'currency',
      'unit_price',
      'quantity',
      'delivery_days',
      'warranty_days',
      'probability_percent',
      'employee_name',
    ];
    const csv = headers.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_forecasting_template.csv';
    a.click();
    toast.success('✅ Template Downloaded');
  };

  const handleExportData = () => {
    const headers = [
      'Quotation Ref #',
      'Quotation Date',
      'Valid Till',
      'Decision By Date',
      'End Customer',
      'Enquiry Details',
      'Principal',
      'Quoted Item Model',
      'Quoted Item Description',
      'Currency',
      'Unit Price',
      'QTY',
      'Total Price (without GST)',
      'Conversion to INR (without GST)',
      'Delivery Schedule (Days)',
      'Warranty (Days)',
      'Probability (%)',
      'Employee Name',
      'Created At',
    ];

    const rows = filteredForecasts.map((f) => [
      f.quotation_ref,
      f.quotation_date,
      f.valid_till,
      f.decision_by_date,
      f.end_customer,
      f.enquiry_details,
      f.principal,
      f.quoted_item_model,
      f.quoted_item_description,
      f.currency,
      f.unit_price,
      f.quantity,
      f.total_price,
      f.conversion_to_inr,
      f.delivery_days,
      f.warranty_days,
      f.probability_percent,
      f.employee_name,
      f.created_at,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_forecasting_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('✅ Data Exported Successfully');
  };

  const handleUpdateRates = (newRates: CurrencyRates) => {
    setCurrencyRates(newRates);
    setIsRateSettingsOpen(false);
    toast.success('✅ Currency Rates Updated Successfully');
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filter logic
  let filteredForecasts = privileged
    ? forecasts
    : forecasts.filter((f) => f.employee_code === currentEmployeeCode);

  if (selectedEmployee && selectedEmployee !== 'all') {
    filteredForecasts = filteredForecasts.filter((f) => f.employee_name === selectedEmployee);
  }

  if (selectedCurrency && selectedCurrency !== 'all') {
    filteredForecasts = filteredForecasts.filter((f) => f.currency === selectedCurrency);
  }

  if (selectedPrincipal && selectedPrincipal !== 'all') {
    filteredForecasts = filteredForecasts.filter((f) => f.principal === selectedPrincipal);
  }

  if (selectedProbability && selectedProbability !== 'all') {
    const minProb = parseInt(selectedProbability);
    filteredForecasts = filteredForecasts.filter((f) => f.probability_percent >= minProb);
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredForecasts = filteredForecasts.filter(
      (f) =>
        f.quotation_ref.toLowerCase().includes(term) ||
        f.end_customer.toLowerCase().includes(term) ||
        f.quoted_item_model.toLowerCase().includes(term) ||
        f.quoted_item_description.toLowerCase().includes(term)
    );
  }

  // Sorting logic
  if (sortColumn) {
    filteredForecasts = [...filteredForecasts].sort((a, b) => {
      let aVal: any = a[sortColumn as keyof SalesForecastRecord];
      let bVal: any = b[sortColumn as keyof SalesForecastRecord];

      if (sortColumn === 'quotation_date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const uniqueEmployees = Array.from(new Set(forecasts.map((f) => f.employee_name)));
  const uniqueCurrencies = Array.from(new Set(forecasts.map((f) => f.currency)));
  const uniquePrincipals = Array.from(new Set(forecasts.map((f) => f.principal))).filter(Boolean);

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    if (currency === 'INR') {
      return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (currency === 'USD') {
      return `$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (currency === 'Euro') {
      return `€ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card className="p-6">
        <div className="flex justify-end mb-6">
          <div className="flex gap-2">
            {canEditRecords && <span>
                  <Button onClick={() => setIsRateSettingsOpen(true)} variant="outline" size="icon">
                    <Settings className="w-4 h-4" />
                  </Button>
                </span>}
            {canCreateRecords && <Button onClick={() => setIsImportModalOpen(true)} variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Import from Excel
            </Button>}
            {canExportRecords && <Button onClick={handleExportData} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export Data
            </Button>}
            {canCreateRecords && <Button onClick={() => setIsFormModalOpen(true)} className="gap-2 bg-[#007BFF] hover:bg-[#0056b3]">
              <Plus className="w-4 h-4" />
              Create New Quotation
            </Button>}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {privileged && (
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {uniqueEmployees.map((emp) => (
                  <SelectItem key={emp} value={emp}>
                    {emp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={selectedPrincipal} onValueChange={setSelectedPrincipal}>
            <SelectTrigger>
              <SelectValue placeholder="All Principals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Principals</SelectItem>
              {uniquePrincipals.map((principal) => (
                <SelectItem key={principal} value={principal}>
                  {principal}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedProbability} onValueChange={setSelectedProbability}>
            <SelectTrigger>
              <SelectValue placeholder="All Probabilities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Probabilities</SelectItem>
              <SelectItem value="0">≥ 0%</SelectItem>
              <SelectItem value="25">≥ 25%</SelectItem>
              <SelectItem value="50">≥ 50%</SelectItem>
              <SelectItem value="75">≥ 75%</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search quotation ref, customer, model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap">Sr. #</TableHead>
                <TableHead
                  className="whitespace-nowrap cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('quotation_ref')}
                >
                  Quotation Ref #
                </TableHead>
                <TableHead
                  className="whitespace-nowrap cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('quotation_date')}
                >
                  Quotation Date
                </TableHead>
                <TableHead className="whitespace-nowrap">End Customer</TableHead>
                <TableHead className="whitespace-nowrap">Principal</TableHead>
                <TableHead className="whitespace-nowrap">Quoted Item Model</TableHead>
                <TableHead className="whitespace-nowrap">Currency</TableHead>
                <TableHead className="whitespace-nowrap text-right">Unit Price</TableHead>
                <TableHead className="whitespace-nowrap text-right">QTY</TableHead>
                <TableHead
                  className="whitespace-nowrap text-right cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('total_price')}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>Total Price (w/o GST)</span>
                    </TooltipTrigger>
                    <TooltipContent>Calculated: Unit Price × QTY</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead
                  className="whitespace-nowrap text-right cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('conversion_to_inr')}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>Conversion to INR (w/o GST)</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Converted using rates: Euro={currencyRates.Euro}, USD={currencyRates.USD}
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead
                  className="whitespace-nowrap text-center cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('probability_percent')}
                >
                  Probability (%)
                </TableHead>
                <TableHead className="whitespace-nowrap">Employee Name</TableHead>
                <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredForecasts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-8 text-gray-500">
                    No sales forecast records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredForecasts.map((forecast, index) => (
                  <TableRow key={forecast.id} className="hover:bg-gray-50">
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{forecast.quotation_ref}</TableCell>
                    <TableCell>{new Date(forecast.quotation_date).toLocaleDateString()}</TableCell>
                    <TableCell className="max-w-xs truncate">{forecast.end_customer}</TableCell>
                    <TableCell>{forecast.principal}</TableCell>
                    <TableCell>{forecast.quoted_item_model}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                        {forecast.currency}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(forecast.unit_price, forecast.currency)}</TableCell>
                    <TableCell className="text-right">{forecast.quantity}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(forecast.total_price, forecast.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-700">
                      {formatCurrency(forecast.conversion_to_inr, 'INR')}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                          forecast.probability_percent >= 75
                            ? 'bg-green-100 text-green-800'
                            : forecast.probability_percent >= 50
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {forecast.probability_percent}%
                      </span>
                    </TableCell>
                    <TableCell>{forecast.employee_name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        {canEditRecords && <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingForecast(forecast);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>}

                        {canDeleteRecords && <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteForecast(forecast.forecastId || forecast.id)}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredForecasts.length} of {forecasts.length} records
        </div>
      </Card>

      {canCreateRecords && <SalesForecastingFormModal
        isOpen={isFormModalOpen || editingForecast !== null}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingForecast(null);
        }}
        onSave={editingForecast ? handleEditForecast : handleCreateForecast}
        editingForecast={editingForecast}
        currentEmployeeCode={currentEmployeeCode}
        currentEmployeeName={currentUserName}
        availableUsers={availableUsers}
        isAdmin={privileged}
        currencyRates={currencyRates}
      />}

      {canCreateRecords && <SalesForecastingImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportForecasts}
        availableUsers={availableUsers}
        currencyRates={currencyRates}
      />}

      {canEditRecords && <CurrencyRateSettingsModal
        isOpen={isRateSettingsOpen}
        onClose={() => setIsRateSettingsOpen(false)}
        currentRates={currencyRates}
        onSave={handleUpdateRates}
      />}
      </div>
    </TooltipProvider>
  );
}
