import { ChevronDown, ChevronRight, Download, Plus, Eye, Trash2, Edit } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import type { PurchaseRecord } from './PurchasesTab';
import { Fragment, useState } from 'react';
import EditLineItemModal from './EditLineItemModal';

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

interface PurchasesViewProps {
  viewMode: 'flat' | 'grouped' | 'compact';
  filteredPurchases: PurchaseRecord[];
  groupedPurchases: POGroup[];
  expandedPOs: Set<string>;
  onToggleExpand: (poNumber: string) => void;
  onExportPO: (poNumber: string) => void;
  onDeletePO: (poNumber: string, itemCount: number) => void;
  onViewDetails: (poNumber: string) => void;
  onEditLineItem?: (item: PurchaseRecord) => void;
  onDeleteLineItem?: (itemId: string) => void;
  getMarginColor: (margin: number) => string;
  getGMPercentageColor: (gmPercentage: number) => string;
}

// Flat View - One row per line item with ALL 48 columns
export function FlatView({
  filteredPurchases,
  onEditLineItem,
  onDeleteLineItem,
  getMarginColor,
  getGMPercentageColor,
}: PurchasesViewProps) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            {/* First 4 columns - Sticky */}
            <TableHead className="whitespace-nowrap sticky left-0 bg-gray-50 z-10" style={{ minWidth: '80px' }}>Sr. #</TableHead>
            <TableHead className="whitespace-nowrap sticky left-[80px] bg-gray-50 z-10" style={{ minWidth: '200px' }}>Record Type</TableHead>
            <TableHead className="whitespace-nowrap sticky left-[280px] bg-gray-50 z-10" style={{ minWidth: '150px' }}>PO#</TableHead>
            <TableHead className="whitespace-nowrap sticky left-[430px] bg-gray-50 z-10" style={{ minWidth: '130px' }}>Date</TableHead>
            
            {/* Scrollable columns */}
            <TableHead className="whitespace-nowrap" style={{ minWidth: '200px' }}>Principal</TableHead>
            <TableHead className="whitespace-nowrap" style={{ minWidth: '150px' }}>Invoice #</TableHead>
            <TableHead className="whitespace-nowrap" style={{ minWidth: '150px' }}>Invoice Date</TableHead>
            <TableHead className="whitespace-nowrap" style={{ minWidth: '150px' }}>BOE #</TableHead>
            <TableHead className="whitespace-nowrap" style={{ minWidth: '150px' }}>BOE Date</TableHead>
            <TableHead className="whitespace-nowrap" style={{ minWidth: '150px' }}>HS Code</TableHead>
            <TableHead className="whitespace-nowrap" style={{ minWidth: '350px' }}>Item Details</TableHead>
            <TableHead className="whitespace-nowrap" style={{ minWidth: '150px' }}>Part #</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '130px' }}>Unit Price</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '100px' }}>QTY</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '180px' }}>Freight Charges - International</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '180px' }}>GST on Freight Charges</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '180px' }}>Total Price in FE / INR</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '180px' }}>Exchange Rate as per BOE</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '180px' }}>Equivalent INR as per BOE</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '200px' }}>Actual Bank Transfer Amount</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '130px' }}>Bank Charges</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '180px' }}>GST on Bank Charges</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '180px' }}>Basic Custom Duty</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '130px' }}>Surcharge</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '280px' }}>IGST on Import / CGST_SGST_IGST on Local Purchase</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '220px' }}>Interest or Fine on Custom Duty</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '200px' }}>Custom Clearance Charges</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '220px' }}>IGST/GST on Custom Clearance</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '220px' }}>Total Custom Clearance Charges</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '180px' }}>Tatal Landed Price</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '180px' }}>Landed Unit Price</TableHead>
            <TableHead className="whitespace-nowrap" style={{ minWidth: '200px' }}>Customer</TableHead>
            <TableHead className="whitespace-nowrap" style={{ minWidth: '150px' }}>Customer's PO</TableHead>
            <TableHead className="whitespace-nowrap" style={{ minWidth: '130px' }}>PO Date</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '130px' }}>PO Price</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '100px' }}>Quantity</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '150px' }}>Total PO Price</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '130px' }}>IGST / GST %</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '180px' }}>GST / IGST Amount</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '180px' }}>Price to Customer</TableHead>
            <TableHead className="whitespace-nowrap" style={{ minWidth: '200px' }}>Invoice # (Customer Invoice #)</TableHead>
            <TableHead className="whitespace-nowrap" style={{ minWidth: '200px' }}>Date (Customer Invoice Date)</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '200px' }}>Shipping Charges to customer</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '130px' }}>CGST_SGST</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '150px' }}>Price to SPPL</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '100px' }}>GM %</TableHead>
            <TableHead className="whitespace-nowrap text-right" style={{ minWidth: '130px' }}>Margin</TableHead>
            <TableHead className="whitespace-nowrap text-center" style={{ minWidth: '120px' }}>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredPurchases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={48} className="text-center py-8 text-gray-500">
                No purchase records found
              </TableCell>
            </TableRow>
          ) : (
            filteredPurchases.map((purchase, index) => (
              <TableRow key={purchase.id} className="hover:bg-gray-50">
                {/* First 4 columns - Sticky */}
                <TableCell className="sticky left-0 bg-white z-10">{index + 1}</TableCell>
                <TableCell className="sticky left-[80px] bg-white z-10">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                    {purchase.record_type}
                  </span>
                </TableCell>
                <TableCell className="font-medium sticky left-[280px] bg-white z-10">{purchase.po_number}</TableCell>
                <TableCell className="sticky left-[430px] bg-white z-10">{purchase.date}</TableCell>
                
                {/* Scrollable columns */}
                <TableCell>{purchase.principal}</TableCell>
                <TableCell>{purchase.invoice_number}</TableCell>
                <TableCell>{purchase.invoice_date}</TableCell>
                <TableCell>{purchase.boe_number}</TableCell>
                <TableCell>{purchase.boe_date}</TableCell>
                <TableCell>{purchase.hs_code}</TableCell>
                <TableCell className="max-w-xs">{purchase.item_details}</TableCell>
                <TableCell>{purchase.part_number}</TableCell>
                <TableCell className="text-right">₹{purchase.unit_price.toLocaleString()}</TableCell>
                <TableCell className="text-right">{purchase.qty}</TableCell>
                <TableCell className="text-right">₹{purchase.freight_charges_international.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.gst_on_freight_charges.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.total_price_in_fe_inr.toLocaleString()}</TableCell>
                <TableCell className="text-right">{purchase.exchange_rate_as_per_boe.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.equivalent_inr_as_per_boe.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.actual_bank_transfer_amount.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.bank_charges.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.gst_on_bank_charges.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.basic_custom_duty.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.surcharge.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.gst_on_import_cgst_sgst_igst_local.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.interest_or_fine_on_custom_duty.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.custom_clearance_charges.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.igst_gst_on_custom_clearance.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.total_custom_clearance_charges.toLocaleString()}</TableCell>
                <TableCell className="text-right font-medium text-green-700">₹{purchase.total_landed_price.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.landed_unit_price.toLocaleString()}</TableCell>
                <TableCell>{purchase.customer}</TableCell>
                <TableCell>{purchase.customer_po}</TableCell>
                <TableCell>{purchase.po_date}</TableCell>
                <TableCell className="text-right">₹{purchase.po_price.toLocaleString()}</TableCell>
                <TableCell className="text-right">{purchase.quantity}</TableCell>
                <TableCell className="text-right">₹{purchase.total_po_price.toLocaleString()}</TableCell>
                <TableCell className="text-right">{purchase.igst_gst_percentage}%</TableCell>
                <TableCell className="text-right">₹{purchase.gst_igst_amount.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.price_to_customer.toLocaleString()}</TableCell>
                <TableCell>{purchase.customer_invoice_number}</TableCell>
                <TableCell>{purchase.customer_invoice_date}</TableCell>
                <TableCell className="text-right">₹{purchase.shipping_charges_to_customer.toLocaleString()}</TableCell>
                <TableCell className="text-right">₹{purchase.cgst_sgst.toLocaleString()}</TableCell>
                <TableCell className="text-right font-medium text-blue-700">₹{purchase.price_to_sppl.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs ${getGMPercentageColor(
                      purchase.gm_percentage
                    )}`}
                  >
                    {purchase.gm_percentage.toFixed(2)}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs ${getMarginColor(
                      purchase.margin
                    )}`}
                  >
                    ₹{purchase.margin.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditLineItem?.(purchase)}
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onDeleteLineItem?.(purchase.id)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Grouped View - PO headers with expandable line items
export function GroupedView({
  groupedPurchases,
  expandedPOs,
  onToggleExpand,
  onExportPO,
  getMarginColor,
  getGMPercentageColor,
}: PurchasesViewProps) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="whitespace-nowrap w-10"></TableHead>
            <TableHead className="whitespace-nowrap">Sr. #</TableHead>
            <TableHead className="whitespace-nowrap">Record Type</TableHead>
            <TableHead className="whitespace-nowrap">PO#</TableHead>
            <TableHead className="whitespace-nowrap">Date</TableHead>
            <TableHead className="whitespace-nowrap">Principal</TableHead>
            <TableHead className="whitespace-nowrap text-right"># Items</TableHead>
            <TableHead className="whitespace-nowrap text-right">Total Landed Price</TableHead>
            <TableHead className="whitespace-nowrap text-right">Total GM</TableHead>
            <TableHead className="whitespace-nowrap text-right">Avg % Margin</TableHead>
            <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedPurchases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                No purchase records found
              </TableCell>
            </TableRow>
          ) : (
            groupedPurchases.map((group, groupIndex) => {
              const isExpanded = expandedPOs.has(group.po_number);
              return (
                <Fragment key={group.po_number}>
                  {/* PO Header Row */}
                  <TableRow
                    className="bg-[#F6F8FA] hover:bg-[#EEF1F4] border-b-2 border-[#E6E9EF] cursor-pointer"
                    onClick={() => onToggleExpand(group.po_number)}
                  >
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                        ) : (
                          <ChevronRight className="w-4 h-4 transition-transform duration-200" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-semibold">{groupIndex + 1}</TableCell>
                    <TableCell>
                      {group.record_types.length === 1 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          {group.record_types[0]}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                          Mixed
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{group.po_number}</TableCell>
                    <TableCell>{group.date}</TableCell>
                    <TableCell>{group.principal}</TableCell>
                    <TableCell className="text-right font-semibold">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                        {group.item_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-700">
                      ₹{group.total_landed_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-blue-700">
                      ₹{group.total_gm.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${getGMPercentageColor(
                          group.avg_margin
                        )}`}
                      >
                        {group.avg_margin.toFixed(2)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onExportPO(group.po_number);
                          }}
                          title="Export PO"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Line Items (when expanded) */}
                  {isExpanded &&
                    group.items.map((item, itemIndex) => (
                      <TableRow
                        key={item.id}
                        className="hover:bg-[#FAFBFF] transition-colors duration-150"
                        style={{
                          animation: 'fadeIn 0.2s ease-out',
                        }}
                      >
                        <TableCell></TableCell>
                        <TableCell className="text-gray-500 pl-8">{groupIndex + 1}.{itemIndex + 1}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">
                            {item.record_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm">{item.po_number}</TableCell>
                        <TableCell className="text-gray-600 text-sm">{item.date}</TableCell>
                        <TableCell className="text-gray-600 text-sm max-w-xs truncate">
                          {item.item_details}
                        </TableCell>
                        <TableCell className="text-right text-sm text-gray-500">-</TableCell>
                        <TableCell className="text-right text-sm text-green-600">
                          ₹{item.total_landed_price.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm text-blue-600">
                          ₹{item.margin.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${getGMPercentageColor(
                              item.gm_percentage
                            )}`}
                          >
                            {item.gm_percentage.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Compact View - One summary row per PO
export function CompactView({
  groupedPurchases,
  onViewDetails,
  onExportPO,
  onDeletePO,
  getGMPercentageColor,
}: PurchasesViewProps) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="whitespace-nowrap">Sr. #</TableHead>
            <TableHead className="whitespace-nowrap">Record Type</TableHead>
            <TableHead className="whitespace-nowrap">PO#</TableHead>
            <TableHead className="whitespace-nowrap">Date</TableHead>
            <TableHead className="whitespace-nowrap">Principal</TableHead>
            <TableHead className="whitespace-nowrap text-right"># Items</TableHead>
            <TableHead className="whitespace-nowrap text-right">Total Landed Price</TableHead>
            <TableHead className="whitespace-nowrap text-right">Total GM</TableHead>
            <TableHead className="whitespace-nowrap text-right">Avg % Margin</TableHead>
            <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedPurchases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                No purchase records found
              </TableCell>
            </TableRow>
          ) : (
            groupedPurchases.map((group, index) => (
              <TableRow
                key={group.po_number}
                className="hover:bg-[#FAFBFF] hover:border-l-2 hover:border-l-[#007BFF] transition-all duration-150"
              >
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  {group.record_types.length === 1 ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                      {group.record_types[0]}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                      Mixed
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{group.po_number}</TableCell>
                <TableCell>{group.date}</TableCell>
                <TableCell>{group.principal}</TableCell>
                <TableCell className="text-right font-semibold">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                    {group.item_count}
                  </span>
                </TableCell>
                <TableCell className="text-right font-semibold text-green-700">
                  ₹{group.total_landed_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right font-semibold text-blue-700">
                  ₹{group.total_gm.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${getGMPercentageColor(
                      group.avg_margin
                    )}`}
                  >
                    {group.avg_margin.toFixed(2)}%
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewDetails(group.po_number)}
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeletePO(group.po_number, group.item_count)}
                      title="Delete PO"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Details Drawer for Compact View
interface DetailsDrawerProps {
  isOpen: boolean;
  poNumber: string;
  items: PurchaseRecord[];
  onClose: () => void;
  onUpdateLineItem: (lineItem: PurchaseRecord) => void;
  onDeleteLineItem: (lineItemId: string) => void;
  getMarginColor: (margin: number) => string;
  getGMPercentageColor: (gmPercentage: number) => string;
}

export function DetailsDrawer({
  isOpen,
  poNumber,
  items,
  onClose,
  onUpdateLineItem,
  onDeleteLineItem,
  getMarginColor,
  getGMPercentageColor,
}: DetailsDrawerProps) {
  const [editingItem, setEditingItem] = useState<PurchaseRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (!isOpen) return null;

  // Get PO header info from first item
  const poHeaderInfo = items.length > 0 ? items[0] : null;

  const handleEdit = (item: PurchaseRecord) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleUpdate = (updatedItem: PurchaseRecord) => {
    onUpdateLineItem(updatedItem);
    setIsEditModalOpen(false);
    setEditingItem(null);
  };

  const handleDelete = (itemId: string) => {
    if (window.confirm('Are you sure you want to delete this line item?')) {
      onDeleteLineItem(itemId);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
        <div
          className="bg-white w-full max-w-6xl h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">PO Details: {poNumber}</h2>
                <div className="flex gap-6 mt-2 text-sm text-gray-600">
                  <span><strong>Principal:</strong> {poHeaderInfo?.principal || 'N/A'}</span>
                  <span><strong>Record Type:</strong> {poHeaderInfo?.record_type || 'N/A'}</span>
                  <span><strong>Date:</strong> {poHeaderInfo?.date || 'N/A'}</span>
                  <span><strong>Line Items:</strong> {items.length}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <Eye className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Line Items Table with ALL 44 fields */}
          <div className="p-6">
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="sticky left-0 bg-gray-50 z-10 whitespace-nowrap">Sr. #</TableHead>
                    <TableHead className="whitespace-nowrap">Principal</TableHead>
                    <TableHead className="whitespace-nowrap">Invoice #</TableHead>
                    <TableHead className="whitespace-nowrap">Invoice Date</TableHead>
                    <TableHead className="whitespace-nowrap">BOE #</TableHead>
                    <TableHead className="whitespace-nowrap">BOE Date</TableHead>
                    <TableHead className="whitespace-nowrap">HS Code</TableHead>
                    <TableHead className="whitespace-nowrap" style={{ minWidth: '300px' }}>Item Details</TableHead>
                    <TableHead className="whitespace-nowrap">Part #</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Unit Price</TableHead>
                    <TableHead className="whitespace-nowrap text-right">QTY</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Freight Charges - International</TableHead>
                    <TableHead className="whitespace-nowrap text-right">GST on Freight Charges</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Total Price in FE / INR</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Exchange Rate as per BOE</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Equivalent INR as per BOE</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Actual Bank Transfer Amount</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Bank Charges</TableHead>
                    <TableHead className="whitespace-nowrap text-right">GST on Bank Charges</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Basic Custom Duty</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Surcharge</TableHead>
                    <TableHead className="whitespace-nowrap text-right">IGST on Import / CGST_SGST_IGST on Local Purchase</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Interest or Fine on Custom Duty</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Custom Clearance Charges</TableHead>
                    <TableHead className="whitespace-nowrap text-right">IGST/GST on Custom Clearance</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Total Custom Clearance Charges</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Tatal Landed Price</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Landed Unit Price</TableHead>
                    <TableHead className="whitespace-nowrap">Customer</TableHead>
                    <TableHead className="whitespace-nowrap">Customer's PO</TableHead>
                    <TableHead className="whitespace-nowrap">PO Date</TableHead>
                    <TableHead className="whitespace-nowrap text-right">PO Price</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Quantity</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Total PO Price</TableHead>
                    <TableHead className="whitespace-nowrap text-right">IGST / GST %</TableHead>
                    <TableHead className="whitespace-nowrap text-right">GST / IGST Amount</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Price to Customer</TableHead>
                    <TableHead className="whitespace-nowrap">Invoice # (Customer Invoice #)</TableHead>
                    <TableHead className="whitespace-nowrap">Date (Customer Invoice Date)</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Shipping Charges to customer</TableHead>
                    <TableHead className="whitespace-nowrap text-right">CGST_SGST</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Price to SPPL</TableHead>
                    <TableHead className="whitespace-nowrap text-right">GM %</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Margin</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id} className="hover:bg-gray-50">
                      <TableCell className="sticky left-0 bg-white z-10">{index + 1}</TableCell>
                      <TableCell>{item.principal}</TableCell>
                      <TableCell>{item.invoice_number}</TableCell>
                      <TableCell>{item.invoice_date}</TableCell>
                      <TableCell>{item.boe_number}</TableCell>
                      <TableCell>{item.boe_date}</TableCell>
                      <TableCell>{item.hs_code}</TableCell>
                      <TableCell className="max-w-xs">{item.item_details}</TableCell>
                      <TableCell>{item.part_number}</TableCell>
                      <TableCell className="text-right">₹{item.unit_price.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.qty}</TableCell>
                      <TableCell className="text-right">₹{item.freight_charges_international.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.gst_on_freight_charges.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.total_price_in_fe_inr.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.exchange_rate_as_per_boe.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.equivalent_inr_as_per_boe.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.actual_bank_transfer_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.bank_charges.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.gst_on_bank_charges.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.basic_custom_duty.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.surcharge.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.gst_on_import_cgst_sgst_igst_local.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.interest_or_fine_on_custom_duty.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.custom_clearance_charges.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.igst_gst_on_custom_clearance.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.total_custom_clearance_charges.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-green-700">
                        ₹{item.total_landed_price.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">₹{item.landed_unit_price.toLocaleString()}</TableCell>
                      <TableCell>{item.customer}</TableCell>
                      <TableCell>{item.customer_po}</TableCell>
                      <TableCell>{item.po_date}</TableCell>
                      <TableCell className="text-right">₹{item.po_price.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">₹{item.total_po_price.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.igst_gst_percentage}%</TableCell>
                      <TableCell className="text-right">₹{item.gst_igst_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.price_to_customer.toLocaleString()}</TableCell>
                      <TableCell>{item.customer_invoice_number}</TableCell>
                      <TableCell>{item.customer_invoice_date}</TableCell>
                      <TableCell className="text-right">₹{item.shipping_charges_to_customer.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.cgst_sgst.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-blue-700">
                        ₹{item.price_to_sppl.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs ${getGMPercentageColor(
                            item.gm_percentage
                          )}`}
                        >
                          {item.gm_percentage.toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs ${getMarginColor(
                            item.margin
                          )}`}
                        >
                          ₹{item.margin.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(item)}
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(item.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
      {editingItem && (
        <EditLineItemModal
          isOpen={isEditModalOpen}
          lineItem={editingItem}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingItem(null);
          }}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
}