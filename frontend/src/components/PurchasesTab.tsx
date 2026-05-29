import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Upload, Search, Edit, Trash2, ChevronDown, ChevronRight, List, FolderOpen, X, Eye } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import PurchaseHeaderModal, { type PurchaseHeader } from './PurchaseHeaderModal';
import PurchaseLineItemsScreen from './PurchaseLineItemsScreen';
import PurchaseImportModal from './PurchaseImportModal';
import { FlatView, GroupedView, CompactView, DetailsDrawer } from './PurchasesTablesViews';
import EditLineItemModal from './EditLineItemModal';
import type { UserRole } from '../App';
import { apiFetch } from '../services/api';
import { canCreate, canDelete, canEdit, canExport } from '../utils/accessControl';
import { usePurchasesListQuery, useInvalidatePurchasesList } from '../hooks/purchases/usePurchasesQueries';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { purchasesQueryKeys } from '../hooks/purchases/purchasesQueryKeys';
import { isQueryColdLoading } from '../utils/queryLoading';
import { sanitizeSelectOptionsUnique } from '../utils/sanitizeSelectOptions';

// EXACT 45 FIELDS IN EXCEL ORDER
export interface PurchaseRecord {
  id: string;
  record_type: string; // Not part of 45 but required for UI filtering
  
  // === EXACT 45 EXCEL FIELDS IN ORDER ===
  
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
  
  // 13. Freight Charges – International
  freight_charges_international: number;
  
  // 14. GST on Freight Charges
  gst_on_freight_charges: number;
  
  // 15. Total Price in FE / INR (COMPUTED)
  total_price_in_fe_inr: number;
  
  // 16. Exchange Rate as per BOE
  exchange_rate_as_per_boe: number;
  
  // 17. Equivalent INR as per BOE (COMPUTED)
  equivalent_inr_as_per_boe: number;
  
  // 18. Actual Bank Transfer Amount
  actual_bank_transfer_amount: number;
  
  // 19. Bank Charges
  bank_charges: number;
  
  // 20. GST on Bank Charges
  gst_on_bank_charges: number;
  
  // 21. Basic Custom Duty
  basic_custom_duty: number;
  
  // 22. Surcharge
  surcharge: number;
  
  // 23. GST on Import / CGST_SGST_IGST on Local Purchase
  gst_on_import_cgst_sgst_igst_local: number;
  
  // 24. Interest or Fine on Custom Duty
  interest_or_fine_on_custom_duty: number;
  
  // 25. Custom Clearance Charges
  custom_clearance_charges: number;
  
  // 26. IGST/GST on Custom Clearance
  igst_gst_on_custom_clearance: number;
  
  // 27. Total Custom Clearance Charges (COMPUTED)
  total_custom_clearance_charges: number;
  
  // 28. Total Landed Price (COMPUTED)
  total_landed_price: number;
  
  // 29. Landed Unit Price (COMPUTED)
  landed_unit_price: number;
  
  // 30. Customer
  customer: string;
  
  // 31. Customer's PO
  customer_po: string;
  
  // 32. PO Date
  po_date: string;
  
  // 33. PO Price
  po_price: number;
  
  // 34. Quantity
  quantity: number;
  
  // 35. Total PO Price (COMPUTED)
  total_po_price: number;
  
  // 36. IGST / GST %
  igst_gst_percentage: number;
  
  // 37. GST / IGST Amount (COMPUTED)
  gst_igst_amount: number;
  
  // 38. Price to Customer
  price_to_customer: number;
  
  // 39. Invoice # (Customer Invoice #)
  customer_invoice_number: string;
  
  // 40. Date (Customer Invoice Date)
  customer_invoice_date: string;
  
  // 41. Shipping Charges to customer
  shipping_charges_to_customer: number;
  
  // 42. CGST_SGST
  cgst_sgst: number;
  
  // 43. Price to SPPL (COMPUTED)
  price_to_sppl: number;
  
  // 44. GM %
  gm_percentage: number;
  
  // 45. Margin
  margin: number;
  
  // System fields
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface PurchasesTabProps {
  userRole: UserRole;
  currentUserName: string;
  currentEmployeeCode: string;
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
  
  // 27. Total Custom Clearance Charges = Custom Clearance Charges + IGST/GST on Custom Clearance
  computed.total_custom_clearance_charges = (record.custom_clearance_charges || 0) + (record.igst_gst_on_custom_clearance || 0);
  
  // 28. Total Landed Price = Sum of all cost components
  computed.total_landed_price = 
    (computed.equivalent_inr_as_per_boe || 0) +
    (record.freight_charges_international || 0) +
    (record.gst_on_freight_charges || 0) +
    (record.bank_charges || 0) +
    (record.gst_on_bank_charges || 0) +
    (record.basic_custom_duty || 0) +
    (record.surcharge || 0) +
    (record.gst_on_import_cgst_sgst_igst_local || 0) +
    (record.interest_or_fine_on_custom_duty || 0) +
    (computed.total_custom_clearance_charges || 0);
  
  // 29. Landed Unit Price = Total Landed Price / QTY
  computed.landed_unit_price = (record.qty || 0) > 0 
    ? (computed.total_landed_price || 0) / (record.qty || 0) 
    : 0;
  
  // 35. Total PO Price = PO Price × Quantity
  computed.total_po_price = (record.po_price || 0) * (record.quantity || 0);
  
  // 37. GST / IGST Amount = Total PO Price × (IGST/GST % / 100)
  computed.gst_igst_amount = (computed.total_po_price || 0) * ((record.igst_gst_percentage || 0) / 100);
  
  // 43. Price to SPPL = Price to Customer - (Shipping + CGST_SGST)
  computed.price_to_sppl = (record.price_to_customer || 0) - ((record.shipping_charges_to_customer || 0) + (record.cgst_sgst || 0));
  
  // 44. GM % = ((Price to SPPL - Total Landed Price) / Total Landed Price) × 100
  computed.gm_percentage = (computed.total_landed_price || 0) > 0
    ? (((computed.price_to_sppl || 0) - (computed.total_landed_price || 0)) / (computed.total_landed_price || 0)) * 100
    : 0;
  
  // 45. Margin = Price to SPPL - Total Landed Price
  computed.margin = (computed.price_to_sppl || 0) - (computed.total_landed_price || 0);
  
  return computed;
};

export default function PurchasesTab({ userRole, currentUserName, currentEmployeeCode }: PurchasesTabProps) {
  const queryClient = useQueryClient();
  const purchasesQuery = usePurchasesListQuery();
  const invalidatePurchasesList = useInvalidatePurchasesList();
  const purchases = purchasesQuery.data ?? [];

  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const patchPurchases = (updater: (prev: PurchaseRecord[]) => PurchaseRecord[]) => {
    queryClient.setQueryData(purchasesQueryKeys.listInfinite(), (old) => {
      if (!old?.pages?.length) return old;
      const combined = old.pages.flatMap((p) => p.data);
      const updated = updater(combined);
      return {
        ...old,
        pages: old.pages.map((page, idx) =>
          idx === 0 ? { ...page, data: updated } : { ...page, data: [] },
        ),
      };
    });
  };
  
  // Multi-line PO flow
  const [currentPOHeader, setCurrentPOHeader] = useState<PurchaseHeader | null>(null);
  const [showLineItemsScreen, setShowLineItemsScreen] = useState(false);
  
  // Filters
  const [selectedRecordType, setSelectedRecordType] = useState<string>('all');
  const [selectedPrincipal, setSelectedPrincipal] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedPONumber, setSelectedPONumber] = useState<string>('all');
  
  // View mode
  const [viewMode, setViewMode] = useState<'flat' | 'grouped' | 'compact'>('flat');
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());
  const [selectedPOForDetails, setSelectedPOForDetails] = useState<string | null>(null);
  
  // Edit line item state
  const [editingLineItem, setEditingLineItem] = useState<PurchaseRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const canCreateRecords = canCreate(userRole);
  const canEditRecords = canEdit(userRole);
  const canDeleteRecords = canDelete(userRole);
  const canExportRecords = canExport(userRole);

  useEffect(() => {
    if (purchasesQuery.isError && purchasesQuery.data === undefined) {
      console.error('Purchases fetch error:', purchasesQuery.error);
      toast.error('Failed to load purchases');
    }
  }, [purchasesQuery.isError, purchasesQuery.error, purchasesQuery.data]);

  const isInitialLoading = isQueryColdLoading(purchasesQuery);

  // Step 1: Save PO Header and move to line items
  const handleSaveHeader = (header: PurchaseHeader) => {
    setCurrentPOHeader(header);
    setIsHeaderModalOpen(false);
    setShowLineItemsScreen(true);
  };

  // Step 2: Finalize PO with all line items
  const handleFinalizePO = async (header: PurchaseHeader, lineItems: PurchaseRecord[]) => {
    if (!lineItems || lineItems.length === 0) {
      toast.error('Please add at least one line item before finalizing');
      return;
    }

    try {
      const payload = await apiFetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          header,
          lineItems,
        }),
      });
      if (!payload.success) {
        throw new Error(payload.message || 'Failed to save purchase');
      }

      void invalidatePurchasesList();
      setShowLineItemsScreen(false);
      setCurrentPOHeader(null);
      toast.success(`PO ${header.po_number} finalized with ${lineItems.length} line item(s)`);
    } catch (error) {
      console.error('Finalize purchase error:', error);
      toast.error('Failed to finalize PO. Your current UI data is preserved.');
    }
  };

  // Back to header from line items
  const handleBackToHeader = () => {
    if (window.confirm('Are you sure you want to go back? Unsaved line items will be lost.')) {
      setShowLineItemsScreen(false);
      setCurrentPOHeader(null);
    }
  };

  const handleExportData = () => {
    const headers = [
      'Record Type', 'PO#', 'Date', 'Principal', 'Invoice #', 'Invoice Date', 'BOE #', 'BOE Date',
      'HS Code', 'Item Details', 'Part #', 'Unit Price', 'QTY', 'Freight Charges – International',
      'GST on Freight Charges', 'Total Price in FE / INR', 'Exchange Rate as per BOE',
      'Equivalent INR as per BOE', 'Actual Bank Transfer Amount', 'Bank Charges',
      'GST on Bank Charges', 'Basic Custom Duty', 'Surcharge', 
      'GST on Import / CGST_SGST_IGST on Local Purchase', 'Interest or Fine on Custom Duty',
      'Custom Clearance Charges', 'IGST/GST on Custom Clearance', 'Total Custom Clearance Charges',
      'Total Landed Price', 'Landed Unit Price', 'Customer', 'Customer\'s PO', 'PO Date',
      'PO Price', 'Quantity', 'Total PO Price', 'IGST / GST %', 'GST / IGST Amount',
      'Price to Customer', 'Invoice # (Customer)', 'Date (Customer Invoice)', 
      'Shipping Charges to customer', 'CGST_SGST', 'Price to SPPL', 'GM %', 'Margin'
    ];

    const rows = filteredPurchases.map((p) => [
      p.record_type, p.po_number, p.date, p.principal, p.invoice_number, p.invoice_date,
      p.boe_number, p.boe_date, p.hs_code, p.item_details, p.part_number, p.unit_price,
      p.qty, p.freight_charges_international, p.gst_on_freight_charges, p.total_price_in_fe_inr,
      p.exchange_rate_as_per_boe, p.equivalent_inr_as_per_boe, p.actual_bank_transfer_amount,
      p.bank_charges, p.gst_on_bank_charges, p.basic_custom_duty, p.surcharge,
      p.gst_on_import_cgst_sgst_igst_local, p.interest_or_fine_on_custom_duty,
      p.custom_clearance_charges, p.igst_gst_on_custom_clearance, p.total_custom_clearance_charges,
      p.total_landed_price, p.landed_unit_price, p.customer, p.customer_po, p.po_date,
      p.po_price, p.quantity, p.total_po_price, p.igst_gst_percentage, p.gst_igst_amount,
      p.price_to_customer, p.customer_invoice_number, p.customer_invoice_date,
      p.shipping_charges_to_customer, p.cgst_sgst, p.price_to_sppl, p.gm_percentage, p.margin
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchases_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Data Exported Successfully');
  };

  const handleImportComplete = (importedPurchases: PurchaseRecord[]) => {
    const withComputedFields = importedPurchases.map(p => {
      const computed = calculatePurchaseFields(p);
      return { ...p, ...computed } as PurchaseRecord;
    });
    patchPurchases((prev) => [...prev, ...withComputedFields]);
    setIsImportModalOpen(false);
    toast.success(`${importedPurchases.length} Purchase Records Imported Successfully`);
  };

  // Get unique values for filters
  const uniquePrincipals = useMemo(
    () => sanitizeSelectOptionsUnique(purchases.map((p) => p.principal)).sort(),
    [purchases]
  );
  const uniqueCustomers = useMemo(
    () => sanitizeSelectOptionsUnique(purchases.map((p) => p.customer)).sort(),
    [purchases]
  );
  const uniquePONumbers = useMemo(
    () => sanitizeSelectOptionsUnique(purchases.map((p) => p.po_number)).sort(),
    [purchases]
  );

  // Filter purchases
  let filteredPurchases = purchases;

  if (selectedRecordType && selectedRecordType !== 'all') {
    filteredPurchases = filteredPurchases.filter(p => p.record_type === selectedRecordType);
  }

  if (selectedPrincipal && selectedPrincipal !== 'all') {
    filteredPurchases = filteredPurchases.filter(p => p.principal === selectedPrincipal);
  }

  if (selectedCustomer && selectedCustomer !== 'all') {
    filteredPurchases = filteredPurchases.filter(p => p.customer === selectedCustomer);
  }

  if (selectedPONumber && selectedPONumber !== 'all') {
    filteredPurchases = filteredPurchases.filter(p => p.po_number === selectedPONumber);
  }

  if (debouncedSearch) {
    const term = debouncedSearch.toLowerCase();
    filteredPurchases = filteredPurchases.filter(
      (p) =>
        p.po_number.toLowerCase().includes(term) ||
        p.invoice_number.toLowerCase().includes(term) ||
        p.customer.toLowerCase().includes(term) ||
        p.item_details.toLowerCase().includes(term) ||
        p.part_number.toLowerCase().includes(term)
    );
  }

  // Color coding functions
  const getMarginColor = (margin: number) => {
    if (margin < 0) return 'bg-red-100 text-red-800';
    if (margin >= 20000) return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getGMPercentageColor = (gmPercentage: number) => {
    if (gmPercentage < 0) return 'bg-red-100 text-red-800';
    if (gmPercentage >= 15) return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  // ============ GROUPING AND AGGREGATION LOGIC ============
  interface POGroup {
    po_number: string;
    date: string;
    principal: string;
    record_types: string[];
    item_count: number;
    total_landed_price: number;
    total_gm: number;
    total_price_to_sppl: number;
    avg_margin: number;
    items: PurchaseRecord[];
  }

  const groupedPurchases: POGroup[] = Object.values(
    filteredPurchases.reduce((acc, purchase) => {
      if (!acc[purchase.po_number]) {
        acc[purchase.po_number] = {
          po_number: purchase.po_number,
          date: purchase.date,
          principal: purchase.principal,
          record_types: [],
          item_count: 0,
          total_landed_price: 0,
          total_gm: 0,
          total_price_to_sppl: 0,
          avg_margin: 0,
          items: [],
        };
      }
      
      const group = acc[purchase.po_number];
      group.items.push(purchase);
      group.item_count++;
      group.total_landed_price += purchase.total_landed_price;
      group.total_gm += purchase.margin;
      group.total_price_to_sppl += purchase.price_to_sppl;
      
      if (!group.record_types.includes(purchase.record_type)) {
        group.record_types.push(purchase.record_type);
      }
      
      return acc;
    }, {} as Record<string, POGroup>)
  );

  // Calculate weighted average margin for each group
  groupedPurchases.forEach(group => {
    group.avg_margin = group.total_price_to_sppl > 0
      ? (group.total_gm / group.total_price_to_sppl) * 100
      : 0;
  });

  const togglePOExpansion = (poNumber: string) => {
    const newExpanded = new Set(expandedPOs);
    if (newExpanded.has(poNumber)) {
      newExpanded.delete(poNumber);
    } else {
      newExpanded.add(poNumber);
    }
    setExpandedPOs(newExpanded);
  };

  const handleExportPO = (poNumber: string) => {
    const poItems = filteredPurchases.filter(p => p.po_number === poNumber);
    const headers = [
      'Record Type', 'PO#', 'Date', 'Principal', 'Invoice #', 'Invoice Date', 'BOE #', 'BOE Date',
      'HS Code', 'Item Details', 'Part #', 'Unit Price', 'QTY', 'Freight Charges – International',
      'GST on Freight Charges', 'Total Price in FE / INR', 'Exchange Rate as per BOE',
      'Equivalent INR as per BOE', 'Actual Bank Transfer Amount', 'Bank Charges',
      'GST on Bank Charges', 'Basic Custom Duty', 'Surcharge', 
      'GST on Import / CGST_SGST_IGST on Local Purchase', 'Interest or Fine on Custom Duty',
      'Custom Clearance Charges', 'IGST/GST on Custom Clearance', 'Total Custom Clearance Charges',
      'Total Landed Price', 'Landed Unit Price', 'Customer', "Customer's PO", 'PO Date',
      'PO Price', 'Quantity', 'Total PO Price', 'IGST / GST %', 'GST / IGST Amount',
      'Price to Customer', 'Invoice # (Customer)', 'Date (Customer Invoice)', 
      'Shipping Charges to customer', 'CGST_SGST', 'Price to SPPL', 'GM %', 'Margin'
    ];

    const rows = poItems.map((p) => [
      p.record_type, p.po_number, p.date, p.principal, p.invoice_number, p.invoice_date,
      p.boe_number, p.boe_date, p.hs_code, p.item_details, p.part_number, p.unit_price,
      p.qty, p.freight_charges_international, p.gst_on_freight_charges, p.total_price_in_fe_inr,
      p.exchange_rate_as_per_boe, p.equivalent_inr_as_per_boe, p.actual_bank_transfer_amount,
      p.bank_charges, p.gst_on_bank_charges, p.basic_custom_duty, p.surcharge,
      p.gst_on_import_cgst_sgst_igst_local, p.interest_or_fine_on_custom_duty,
      p.custom_clearance_charges, p.igst_gst_on_custom_clearance, p.total_custom_clearance_charges,
      p.total_landed_price, p.landed_unit_price, p.customer, p.customer_po, p.po_date,
      p.po_price, p.quantity, p.total_po_price, p.igst_gst_percentage, p.gst_igst_amount,
      p.price_to_customer, p.customer_invoice_number, p.customer_invoice_date,
      p.shipping_charges_to_customer, p.cgst_sgst, p.price_to_sppl, p.gm_percentage, p.margin
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PO_${poNumber}_export.csv`;
    a.click();
    toast.success(`PO ${poNumber} Exported Successfully`);
  };

  const handleDeletePO = (poNumber: string, itemCount: number) => {
    if (window.confirm(`Delete PO ${poNumber} and all its ${itemCount} line item(s)? This cannot be undone.`)) {
      patchPurchases((prev) => prev.filter((p) => p.po_number !== poNumber));
      toast.success(`PO ${poNumber} Deleted Successfully`);
    }
  };

  // Update line item handler
  const handleUpdateLineItem = (updatedLineItem: PurchaseRecord) => {
    patchPurchases((prev) => prev.map((p) => (p.id === updatedLineItem.id ? updatedLineItem : p)));
    setIsEditModalOpen(false);
    setEditingLineItem(null);
    toast.success(`Line item updated successfully for PO ${updatedLineItem.po_number}`);
  };

  const handleDeleteLineItem = (itemId: string) => {
    patchPurchases((prev) => prev.filter((p) => p.id !== itemId));
    toast.success(`Line Item Deleted Successfully`);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card className="p-6">
          {/* Button Bar - Matching Sales Forecasting */}
          <div className="flex justify-end mb-6">
            <div className="flex gap-2">
              {canCreateRecords && <Button onClick={() => setIsImportModalOpen(true)} variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Import from Excel
              </Button>}
              {canExportRecords && <Button onClick={handleExportData} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Export Data
              </Button>}
              {canCreateRecords && <Button onClick={() => setIsHeaderModalOpen(true)} className="gap-2 bg-[#007BFF] hover:bg-[#0056b3]">
                <Plus className="w-4 h-4" />
                Create New Purchase Record
              </Button>}
            </div>
          </div>

          {/* Filters - Matching Sales Forecasting Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Select value={selectedRecordType} onValueChange={setSelectedRecordType}>
              <SelectTrigger>
                <SelectValue placeholder="All Record Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Record Types</SelectItem>
                {RECORD_TYPE_OPTIONS.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPrincipal} onValueChange={setSelectedPrincipal}>
              <SelectTrigger>
                <SelectValue placeholder="All Principals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Principals</SelectItem>
                {uniquePrincipals.map(principal => (
                  <SelectItem key={principal} value={principal}>{principal}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {uniqueCustomers.map(customer => (
                  <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPONumber} onValueChange={setSelectedPONumber}>
              <SelectTrigger>
                <SelectValue placeholder="All PO Numbers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PO Numbers</SelectItem>
                {uniquePONumbers.map(poNumber => (
                  <SelectItem key={poNumber} value={poNumber}>{poNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search PO, Invoice, Customer, Part #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* View Mode Control - Segmented Control */}
          <div className="flex items-center gap-4 mb-6">
            <span className="text-sm font-medium text-gray-700">View:</span>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1" role="group" aria-label="Change table view">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setViewMode('flat')}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'flat'
                        ? 'bg-[#007BFF] text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <List className="w-4 h-4" />
                    <span>Flat</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show every line item (default).</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setViewMode('compact')}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'compact'
                        ? 'bg-[#007BFF] text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                    <span>Compact</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show one summary row per PO (hide line items). Useful to view PO-level totals.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Table Views - Conditional Based on View Mode */}
          {isInitialLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading purchase records…</div>
          ) : null}
          {!isInitialLoading && viewMode === 'flat' && (
            <FlatView
              viewMode={viewMode}
              filteredPurchases={filteredPurchases}
              groupedPurchases={groupedPurchases}
              expandedPOs={expandedPOs}
              onToggleExpand={togglePOExpansion}
              onExportPO={handleExportPO}
              onDeletePO={(poNumber, itemCount) => {
                if (!canDeleteRecords) return;
                handleDeletePO(poNumber, itemCount);
              }}
              onViewDetails={(po) => setSelectedPOForDetails(po)}
              onEditLineItem={(item) => {
                if (!canEditRecords) return;
                setEditingLineItem(item);
                setIsEditModalOpen(true);
              }}
              onDeleteLineItem={(itemId) => {
                if (!canDeleteRecords) return;
                handleDeleteLineItem(itemId);
              }}
              getMarginColor={getMarginColor}
              getGMPercentageColor={getGMPercentageColor}
            />
          )}

          {purchasesQuery.hasNextPage && (
            <div className="flex justify-end border-t px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                disabled={purchasesQuery.isFetchingNextPage}
                onClick={() => void purchasesQuery.fetchNextPage()}
              >
                {purchasesQuery.isFetchingNextPage ? 'Loading…' : 'Load more purchases'}
              </Button>
            </div>
          )}

          {!isInitialLoading && viewMode === 'compact' && (
            <CompactView
              viewMode={viewMode}
              filteredPurchases={filteredPurchases}
              groupedPurchases={groupedPurchases}
              expandedPOs={expandedPOs}
              onToggleExpand={togglePOExpansion}
              onExportPO={handleExportPO}
              onDeletePO={(poNumber, itemCount) => {
                if (!canDeleteRecords) return;
                handleDeletePO(poNumber, itemCount);
              }}
              onViewDetails={(po) => setSelectedPOForDetails(po)}
              getMarginColor={getMarginColor}
              getGMPercentageColor={getGMPercentageColor}
            />
          )}
        </Card>

        {/* Details Drawer for Compact View */}
        {selectedPOForDetails && (
          <DetailsDrawer
            isOpen={true}
            poNumber={selectedPOForDetails}
            items={filteredPurchases.filter(p => p.po_number === selectedPOForDetails)}
            onClose={() => setSelectedPOForDetails(null)}
            onUpdateLineItem={(item) => {
              if (!canEditRecords) return;
              handleUpdateLineItem(item);
            }}
            onDeleteLineItem={(itemId) => {
              if (!canDeleteRecords) return;
              handleDeleteLineItem(itemId);
            }}
            getMarginColor={getMarginColor}
            getGMPercentageColor={getGMPercentageColor}
          />
        )}

        {/* Modals & Screens */}
        {canCreateRecords && isHeaderModalOpen && (
          <PurchaseHeaderModal
            isOpen={isHeaderModalOpen}
            onClose={() => setIsHeaderModalOpen(false)}
            onSaveContinue={handleSaveHeader}
            editingHeader={null}
            currentEmployeeCode={currentEmployeeCode}
          />
        )}

        {showLineItemsScreen && currentPOHeader && (
          <PurchaseLineItemsScreen
            poHeader={currentPOHeader}
            onBack={handleBackToHeader}
            onFinalizePO={handleFinalizePO}
          />
        )}

        {canCreateRecords && isImportModalOpen && (
          <PurchaseImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImportComplete={handleImportComplete}
            currentEmployeeCode={currentEmployeeCode}
          />
        )}
        
        {canEditRecords && isEditModalOpen && editingLineItem && (
          <EditLineItemModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            lineItem={editingLineItem}
            onUpdate={handleUpdateLineItem}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

export { RECORD_TYPE_OPTIONS };