import { useState } from 'react';
import { Plus, Download, Upload, Search, Edit, Trash2, Layers } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import PurchaseFormModalNew from './PurchaseFormModalNew';
import type { UserRole } from '../App';
import type { UserMaster } from './UserCreationTab';

// EXACT 45-COLUMN INTERFACE (in exact Excel order)
export interface PurchaseRecord {
  id: string;
  record_type: string; // Not part of 45 cols, but required UI field
  
  // === COLUMNS 1-45 IN EXACT ORDER ===
  
  // 1. PO#
  po_number: string;
  
  // 2. Date
  date: string;
  
  // 3. Principal
  principal: string;
  
  // 4. Invoice #
  invoice_number: string;
  
  // 5. Invoice Date
  invoice_date: string;
  
  // 6. BOE #
  boe_number: string;
  
  // 7. BOE Date
  boe_date: string;
  
  // 8. HS Code
  hs_code: string;
  
  // 9. Item Details
  item_details: string;
  
  // 10. Part #
  part_number: string;
  
  // 11. Unit Price
  unit_price: number;
  
  // 12. QTY
  qty: number;
  
  // 13. Freight Charges - International
  freight_charges_international: number;
  
  // 14. GST on Freight Charges
  gst_on_freight_charges: number;
  
  // 15. Total Price in FE / INR (COMPUTED: Unit Price × QTY)
  total_price_in_fe_inr: number;
  
  // 16. Exchange Rate as per BOE
  exchange_rate_as_per_boe: number;
  
  // 17. Equivalent INR as per BOE (COMPUTED: Total Price in FE/INR × Exchange Rate)
  equivalent_inr_as_per_boe: number;
  
  // 18. Actual Bank Transfer Amount
  actual_bank_transfer_amount: number;
  
  // 19. Bank Charges
  bank_charges: number;
  
  // 20. GST on Bank Charges
  gst_on_bank_charges: number;
  
  // 21. IGST on Import / CGST_SGST_IGST on Local Purchase
  igst_on_import_cgst_sgst_igst_local: number;
  
  // 22. Custom Duty %
  custom_duty_percentage: number;
  
  // 23. Custom Duty Amount (COMPUTED: Equivalent INR × Custom Duty %)
  custom_duty_amount: number;
  
  // 24. Other Charges - International
  other_charges_international: number;
  
  // 25. Other Charges - Local
  other_charges_local: number;
  
  // 26. Tatal Landed Price (COMPUTED: Sum of all components)
  total_landed_price: number;
  
  // 27. Landed Unit Price (COMPUTED: Total Landed Price / QTY)
  landed_unit_price: number;
  
  // 28. SPPL Price
  sppl_price: number;
  
  // 29. Shipping Charges to customer
  shipping_charges_to_customer: number;
  
  // 30. CGST_SGST
  cgst_sgst: number;
  
  // 31. Price to Customer
  price_to_customer: number;
  
  // 32. Price to SPPL (COMPUTED: Price to Customer - (Shipping + CGST_SGST))
  price_to_sppl: number;
  
  // 33. GM (COMPUTED: Price to SPPL - Total Landed Price)
  gm: number;
  
  // 34. % Margin (COMPUTED: GM / Price to SPPL)
  margin_percentage: number;
  
  // 35. Customer
  customer: string;
  
  // 36. Customer's PO
  customer_po: string;
  
  // 37. PO Date
  po_date: string;
  
  // 38. PO Price
  po_price: number;
  
  // 39. Quantity
  quantity: number;
  
  // 40. Total PO Price (COMPUTED: PO Price × Quantity)
  total_po_price: number;
  
  // 41. IGST / GST %
  igst_gst_percentage: number;
  
  // 42. GST / IGST Amount (COMPUTED: Total PO Price × IGST/GST %)
  gst_igst_amount: number;
  
  // 43. Price to Customer (duplicate header in Excel)
  price_to_customer_2: number;
  
  // 44. Invoice # (customer invoice)
  customer_invoice_number: string;
  
  // 45. Date (customer invoice date)
  customer_invoice_date: string;
  
  // === SYSTEM FIELDS ===
  is_summary_row: boolean;
  original_formula?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface PurchasesTabNewProps {
  userRole: UserRole;
  currentUserName: string;
  currentEmployeeCode: string;
  availableUsers: UserMaster[];
}

const RECORD_TYPE_OPTIONS = [
  'Local Manufacturing',
  'Stock FY21–24',
  'Import – SPPL Paid',
  'FOC Imports – SPPL Duty',
];

// CANONICAL FORMULA CALCULATIONS
export const calculatePurchaseFields = (record: Partial<PurchaseRecord>): Partial<PurchaseRecord> => {
  const computed: Partial<PurchaseRecord> = { ...record };
  
  // 15. Total Price in FE / INR = Unit Price × QTY
  computed.total_price_in_fe_inr = (record.unit_price || 0) * (record.qty || 0);
  
  // 17. Equivalent INR as per BOE = Total Price in FE/INR × Exchange Rate
  computed.equivalent_inr_as_per_boe = (computed.total_price_in_fe_inr || 0) * (record.exchange_rate_as_per_boe || 0);
  
  // 23. Custom Duty Amount = Equivalent INR × (Custom Duty % / 100)
  computed.custom_duty_amount = (computed.equivalent_inr_as_per_boe || 0) * ((record.custom_duty_percentage || 0) / 100);
  
  // 21. IGST/CGST_SGST = Equivalent INR × (IGST/GST % / 100)
  computed.igst_on_import_cgst_sgst_igst_local = (computed.equivalent_inr_as_per_boe || 0) * ((record.igst_gst_percentage || 0) / 100);
  
  // 26. Total Landed Price = Sum of all components
  computed.total_landed_price = 
    (computed.equivalent_inr_as_per_boe || 0) +
    (computed.custom_duty_amount || 0) +
    (computed.igst_on_import_cgst_sgst_igst_local || 0) +
    (record.freight_charges_international || 0) +
    (record.gst_on_freight_charges || 0) +
    (record.bank_charges || 0) +
    (record.gst_on_bank_charges || 0) +
    (record.other_charges_international || 0) +
    (record.other_charges_local || 0);
  
  // 27. Landed Unit Price = Total Landed Price / QTY
  computed.landed_unit_price = (record.qty || 0) > 0 
    ? (computed.total_landed_price || 0) / (record.qty || 0) 
    : 0;
  
  // 40. Total PO Price = PO Price × Quantity
  computed.total_po_price = (record.po_price || 0) * (record.quantity || 0);
  
  // 42. GST / IGST Amount = Total PO Price × (IGST/GST % / 100)
  computed.gst_igst_amount = (computed.total_po_price || 0) * ((record.igst_gst_percentage || 0) / 100);
  
  // 32. Price to SPPL = Price to Customer - (Shipping + CGST_SGST)
  computed.price_to_sppl = (record.price_to_customer || 0) - ((record.shipping_charges_to_customer || 0) + (record.cgst_sgst || 0));
  
  // 33. GM = Price to SPPL - Total Landed Price
  computed.gm = (computed.price_to_sppl || 0) - (computed.total_landed_price || 0);
  
  // 34. % Margin = GM / Price to SPPL (if Price to SPPL != 0)
  computed.margin_percentage = (computed.price_to_sppl || 0) !== 0 
    ? ((computed.gm || 0) / (computed.price_to_sppl || 0)) * 100
    : 0;
  
  return computed;
};

export default function PurchasesTabNew({ userRole, currentUserName, currentEmployeeCode, availableUsers }: PurchasesTabNewProps) {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRecordType, setFilterRecordType] = useState<string>('all');
  const [filterPrincipal, setFilterPrincipal] = useState<string>('all');
  const [groupByPO, setGroupByPO] = useState(false);

  // Check if user has access
  const hasAccess = userRole === 'Admin' || userRole === 'Accountant';

  if (!hasAccess) {
    return (
      <Card className="p-8">
        <div className="text-center py-12">
          <h2 className="text-[#212529] mb-2">Access Denied</h2>
          <p className="text-gray-500">
            You do not have permission to access the Purchases module.
          </p>
        </div>
      </Card>
    );
  }

  const handleCreate = (data: Omit<PurchaseRecord, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    const computed = calculatePurchaseFields(data);
    const newPurchase: PurchaseRecord = {
      ...data,
      ...computed,
      id: Date.now().toString(),
      created_by: currentUserName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as PurchaseRecord;
    
    setPurchases([...purchases, newPurchase]);
    toast.success('Purchase record created successfully');
  };

  const handleEdit = (data: Omit<PurchaseRecord, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    if (!editingPurchase) return;
    
    const computed = calculatePurchaseFields(data);
    const updated: PurchaseRecord = {
      ...editingPurchase,
      ...data,
      ...computed,
      updated_at: new Date().toISOString(),
    } as PurchaseRecord;
    
    setPurchases(purchases.map(p => p.id === editingPurchase.id ? updated : p));
    setEditingPurchase(null);
    toast.success('Purchase record updated successfully');
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this purchase record?')) {
      setPurchases(purchases.filter(p => p.id !== id));
      toast.success('Purchase record deleted successfully');
    }
  };

  const handleImport = (importedPurchases: PurchaseRecord[]) => {
    const withComputedFields = importedPurchases.map(p => {
      const computed = calculatePurchaseFields(p);
      return { ...p, ...computed } as PurchaseRecord;
    });
    setPurchases([...purchases, ...withComputedFields]);
    toast.success(`Imported ${importedPurchases.length} purchase records successfully`);
  };

  const handleExport = () => {
    // Export to CSV with all 45 columns
    const headers = [
      'Record Type', 'PO#', 'Date', 'Principal', 'Invoice #', 'Invoice Date', 'BOE #', 'BOE Date',
      'HS Code', 'Item Details', 'Part #', 'Unit Price', 'QTY', 'Freight Charges - International',
      'GST on Freight Charges', 'Total Price in FE / INR', 'Exchange Rate as per BOE',
      'Equivalent INR as per BOE', 'Actual Bank Transfer Amount', 'Bank Charges',
      'GST on Bank Charges', 'IGST on Import / CGST_SGST_IGST on Local Purchase', 'Custom Duty %',
      'Custom Duty Amount', 'Other Charges - International', 'Other Charges - Local',
      'Tatal Landed Price', 'Landed Unit Price', 'SPPL Price', 'Shipping Charges to customer',
      'CGST_SGST', 'Price to Customer', 'Price to SPPL', 'GM', '% Margin', 'Customer',
      'Customer\'s PO', 'PO Date', 'PO Price', 'Quantity', 'Total PO Price', 'IGST / GST %',
      'GST / IGST Amount', 'Price to Customer (2)', 'Invoice # (Customer)', 'Date (Customer Invoice)'
    ];
    
    const csvContent = [
      headers.join(','),
      ...filteredPurchases.map(p => [
        p.record_type, p.po_number, p.date, p.principal, p.invoice_number, p.invoice_date,
        p.boe_number, p.boe_date, p.hs_code, p.item_details, p.part_number, p.unit_price,
        p.qty, p.freight_charges_international, p.gst_on_freight_charges, p.total_price_in_fe_inr,
        p.exchange_rate_as_per_boe, p.equivalent_inr_as_per_boe, p.actual_bank_transfer_amount,
        p.bank_charges, p.gst_on_bank_charges, p.igst_on_import_cgst_sgst_igst_local,
        p.custom_duty_percentage, p.custom_duty_amount, p.other_charges_international,
        p.other_charges_local, p.total_landed_price, p.landed_unit_price, p.sppl_price,
        p.shipping_charges_to_customer, p.cgst_sgst, p.price_to_customer, p.price_to_sppl,
        p.gm, p.margin_percentage, p.customer, p.customer_po, p.po_date, p.po_price,
        p.quantity, p.total_po_price, p.igst_gst_percentage, p.gst_igst_amount,
        p.price_to_customer_2, p.customer_invoice_number, p.customer_invoice_date
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchases_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Exported purchase records successfully');
  };

  // Filter purchases
  const filteredPurchases = purchases.filter(purchase => {
    const matchesSearch = searchQuery === '' || 
      purchase.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      purchase.item_details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      purchase.part_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      purchase.customer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRecordType = filterRecordType === 'all' || purchase.record_type === filterRecordType;
    const matchesPrincipal = filterPrincipal === 'all' || purchase.principal === filterPrincipal;
    
    return matchesSearch && matchesRecordType && matchesPrincipal;
  });

  // Get unique principals
  const uniquePrincipals = Array.from(new Set(purchases.map(p => p.principal))).filter(Boolean);

  // Group by PO if enabled
  const groupedPurchases = groupByPO 
    ? Object.entries(
        filteredPurchases.reduce((acc, p) => {
          if (!acc[p.po_number]) acc[p.po_number] = [];
          acc[p.po_number].push(p);
          return acc;
        }, {} as Record<string, PurchaseRecord[]>)
      )
    : [];

  // Get margin color
  const getMarginColor = (margin: number, gm: number) => {
    if (gm < 0 || margin < 0) return 'bg-red-50 text-red-700';
    if (margin >= 15) return 'bg-green-50 text-green-700';
    return 'bg-yellow-50 text-yellow-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#212529]">Purchases Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage costing sheet with 45 columns, duties, margins & multi-line POs
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsImportModalOpen(true)} variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Import Excel
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm" disabled={purchases.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Purchase
          </Button>
        </div>
      </div>

      {/* Color Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-600">Color Legend:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-gray-600">Healthy (GM ≥ 0, Margin ≥ 15%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span className="text-gray-600">Check (0% &lt; Margin &lt; 15%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span className="text-gray-600">Issue (Negative GM/Margin)</span>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search PO#, Item, Part#, Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={filterRecordType} onValueChange={setFilterRecordType}>
            <SelectTrigger>
              <SelectValue placeholder="Record Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Record Types</SelectItem>
              {RECORD_TYPE_OPTIONS.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPrincipal} onValueChange={setFilterPrincipal}>
            <SelectTrigger>
              <SelectValue placeholder="Principal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Principals</SelectItem>
              {uniquePrincipals.map(principal => (
                <SelectItem key={principal} value={principal}>{principal}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={groupByPO ? 'default' : 'outline'}
            onClick={() => setGroupByPO(!groupByPO)}
            className="w-full"
          >
            <Layers className="w-4 h-4 mr-2" />
            {groupByPO ? 'Ungroup' : 'Group by PO#'}
          </Button>
        </div>
      </Card>

      {/* Records Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {filteredPurchases.length} of {purchases.length} purchase records
          {groupByPO && ` grouped into ${groupedPurchases.length} POs`}
        </p>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-white z-10">Sr. #</TableHead>
                <TableHead className="min-w-[150px]">Record Type</TableHead>
                <TableHead className="min-w-[120px]">PO#</TableHead>
                <TableHead className="min-w-[100px]">Date</TableHead>
                <TableHead className="min-w-[150px]">Principal</TableHead>
                <TableHead className="min-w-[120px]">Invoice #</TableHead>
                <TableHead className="min-w-[100px]">Invoice Date</TableHead>
                <TableHead className="min-w-[120px]">BOE #</TableHead>
                <TableHead className="min-w-[100px]">BOE Date</TableHead>
                <TableHead className="min-w-[100px]">HS Code</TableHead>
                <TableHead className="min-w-[200px]">Item Details</TableHead>
                <TableHead className="min-w-[120px]">Part #</TableHead>
                <TableHead className="min-w-[100px]">Unit Price</TableHead>
                <TableHead className="min-w-[80px]">QTY</TableHead>
                <TableHead className="min-w-[120px]">Freight Intl</TableHead>
                <TableHead className="min-w-[120px]">GST Freight</TableHead>
                <TableHead className="min-w-[120px]">Total FE/INR</TableHead>
                <TableHead className="min-w-[120px]">Exch Rate BOE</TableHead>
                <TableHead className="min-w-[120px]">Equiv INR BOE</TableHead>
                <TableHead className="min-w-[120px]">Bank Transfer</TableHead>
                <TableHead className="min-w-[100px]">Bank Charges</TableHead>
                <TableHead className="min-w-[120px]">GST Bank</TableHead>
                <TableHead className="min-w-[120px]">IGST/CGST_SGST</TableHead>
                <TableHead className="min-w-[100px]">Duty %</TableHead>
                <TableHead className="min-w-[120px]">Duty Amount</TableHead>
                <TableHead className="min-w-[120px]">Other Intl</TableHead>
                <TableHead className="min-w-[120px]">Other Local</TableHead>
                <TableHead className="min-w-[120px]">Total Landed</TableHead>
                <TableHead className="min-w-[120px]">Landed Unit</TableHead>
                <TableHead className="min-w-[100px]">SPPL Price</TableHead>
                <TableHead className="min-w-[120px]">Ship to Cust</TableHead>
                <TableHead className="min-w-[100px]">CGST_SGST</TableHead>
                <TableHead className="min-w-[120px]">Price to Cust</TableHead>
                <TableHead className="min-w-[120px]">Price to SPPL</TableHead>
                <TableHead className="min-w-[100px]">GM</TableHead>
                <TableHead className="min-w-[100px]">% Margin</TableHead>
                <TableHead className="min-w-[150px]">Customer</TableHead>
                <TableHead className="min-w-[120px]">Cust PO</TableHead>
                <TableHead className="min-w-[100px]">PO Date</TableHead>
                <TableHead className="min-w-[100px]">PO Price</TableHead>
                <TableHead className="min-w-[80px]">Quantity</TableHead>
                <TableHead className="min-w-[120px]">Total PO Price</TableHead>
                <TableHead className="min-w-[100px]">GST %</TableHead>
                <TableHead className="min-w-[120px]">GST Amount</TableHead>
                <TableHead className="min-w-[120px]">Price Cust (2)</TableHead>
                <TableHead className="min-w-[120px]">Cust Inv#</TableHead>
                <TableHead className="min-w-[100px]">Cust Inv Date</TableHead>
                <TableHead className="sticky right-0 bg-white z-10 min-w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!groupByPO && filteredPurchases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={47} className="text-center py-8 text-gray-500">
                    No purchase records found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
              
              {!groupByPO && filteredPurchases.map((purchase, index) => (
                <TableRow key={purchase.id} className={purchase.is_summary_row ? 'bg-blue-50' : ''}>
                  <TableCell className="sticky left-0 bg-white z-10">{index + 1}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-[#007BFF] text-white border-[#007BFF]">
                      {purchase.record_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{purchase.po_number}</TableCell>
                  <TableCell>{purchase.date}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{purchase.principal}</Badge>
                  </TableCell>
                  <TableCell>{purchase.invoice_number}</TableCell>
                  <TableCell>{purchase.invoice_date}</TableCell>
                  <TableCell>{purchase.boe_number}</TableCell>
                  <TableCell>{purchase.boe_date}</TableCell>
                  <TableCell>{purchase.hs_code}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{purchase.item_details}</TableCell>
                  <TableCell>{purchase.part_number}</TableCell>
                  <TableCell className="text-right">₹{purchase.unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{purchase.qty}</TableCell>
                  <TableCell className="text-right">₹{purchase.freight_charges_international.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{purchase.gst_on_freight_charges.toFixed(2)}</TableCell>
                  <TableCell className="text-right bg-blue-50">₹{purchase.total_price_in_fe_inr.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{purchase.exchange_rate_as_per_boe.toFixed(4)}</TableCell>
                  <TableCell className="text-right bg-blue-50">₹{purchase.equivalent_inr_as_per_boe.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{purchase.actual_bank_transfer_amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{purchase.bank_charges.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{purchase.gst_on_bank_charges.toFixed(2)}</TableCell>
                  <TableCell className="text-right bg-blue-50">₹{purchase.igst_on_import_cgst_sgst_igst_local.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{purchase.custom_duty_percentage.toFixed(2)}%</TableCell>
                  <TableCell className="text-right bg-blue-50">₹{purchase.custom_duty_amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{purchase.other_charges_international.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{purchase.other_charges_local.toFixed(2)}</TableCell>
                  <TableCell className="text-right bg-blue-50 font-medium">₹{purchase.total_landed_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right bg-blue-50">₹{purchase.landed_unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{purchase.sppl_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{purchase.shipping_charges_to_customer.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{purchase.cgst_sgst.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{purchase.price_to_customer.toFixed(2)}</TableCell>
                  <TableCell className="text-right bg-blue-50">₹{purchase.price_to_sppl.toFixed(2)}</TableCell>
                  <TableCell className={`text-right font-medium ${getMarginColor(purchase.margin_percentage, purchase.gm)}`}>
                    ₹{purchase.gm.toFixed(2)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getMarginColor(purchase.margin_percentage, purchase.gm)}`}>
                    {purchase.margin_percentage.toFixed(2)}%
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{purchase.customer}</Badge>
                  </TableCell>
                  <TableCell>{purchase.customer_po}</TableCell>
                  <TableCell>{purchase.po_date}</TableCell>
                  <TableCell className="text-right">₹{purchase.po_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{purchase.quantity}</TableCell>
                  <TableCell className="text-right bg-blue-50">₹{purchase.total_po_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{purchase.igst_gst_percentage.toFixed(2)}%</TableCell>
                  <TableCell className="text-right bg-blue-50">₹{purchase.gst_igst_amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{(purchase.price_to_customer_2 || 0).toFixed(2)}</TableCell>
                  <TableCell>{purchase.customer_invoice_number}</TableCell>
                  <TableCell>{purchase.customer_invoice_date}</TableCell>
                  <TableCell className="sticky right-0 bg-white z-10">
                    <div className="flex gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingPurchase(purchase)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(purchase.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {/* Grouped View */}
              {groupByPO && groupedPurchases.map(([poNumber, items]) => {
                const totalLanded = items.reduce((sum, item) => sum + item.total_landed_price, 0);
                const totalGM = items.reduce((sum, item) => sum + item.gm, 0);
                const avgMargin = items.reduce((sum, item) => sum + item.margin_percentage, 0) / items.length;
                
                return (
                  <TableRow key={poNumber} className="bg-gray-50 font-medium">
                    <TableCell className="sticky left-0 bg-gray-50 z-10"></TableCell>
                    <TableCell colSpan={2}>
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        <span className="font-medium">PO: {poNumber}</span>
                        <Badge variant="outline">{items.length} items</Badge>
                      </div>
                    </TableCell>
                    <TableCell>{items[0].date}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{items[0].principal}</Badge>
                    </TableCell>
                    <TableCell colSpan={22}></TableCell>
                    <TableCell className="text-right font-medium">₹{totalLanded.toFixed(2)}</TableCell>
                    <TableCell colSpan={5}></TableCell>
                    <TableCell className={`text-right font-medium ${getMarginColor(avgMargin, totalGM)}`}>
                      ₹{totalGM.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${getMarginColor(avgMargin, totalGM)}`}>
                      {avgMargin.toFixed(2)}%
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{items[0].customer}</Badge>
                    </TableCell>
                    <TableCell colSpan={12}></TableCell>
                    <TableCell className="sticky right-0 bg-gray-50 z-10">
                      <Button variant="ghost" size="sm" onClick={() => setGroupByPO(false)}>
                        View Items
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modals */}
      {(isCreateModalOpen || editingPurchase) && (
        <PurchaseFormModalNew
          isOpen={isCreateModalOpen || !!editingPurchase}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingPurchase(null);
          }}
          onSubmit={editingPurchase ? handleEdit : handleCreate}
          editData={editingPurchase || undefined}
          availableUsers={availableUsers}
        />
      )}

      {isImportModalOpen && (
        <PurchaseImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImport}
        />
      )}
    </div>
  );
}