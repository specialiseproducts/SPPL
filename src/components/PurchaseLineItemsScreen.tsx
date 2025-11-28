import { useState } from 'react';
import { Plus, Download, Upload, Edit, Trash2, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import type { PurchaseRecord } from './PurchasesTab';
import type { PurchaseHeader } from './PurchaseHeaderModal';
import PurchaseLineItemModal from './PurchaseLineItemModal';
import { Badge } from './ui/badge';

interface PurchaseLineItemsScreenProps {
  poHeader: PurchaseHeader;
  onBack: () => void;
  onFinalizePO: (header: PurchaseHeader, lineItems: PurchaseRecord[]) => void;
}

export default function PurchaseLineItemsScreen({
  poHeader,
  onBack,
  onFinalizePO,
}: PurchaseLineItemsScreenProps) {
  const [lineItems, setLineItems] = useState<PurchaseRecord[]>([]);
  const [isLineItemModalOpen, setIsLineItemModalOpen] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<PurchaseRecord | null>(null);
  const [groupByPO, setGroupByPO] = useState(false);
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set([poHeader.po_number]));

  const handleAddLineItem = (lineItem: PurchaseRecord) => {
    if (editingLineItem) {
      setLineItems(lineItems.map(item => item.id === lineItem.id ? lineItem : item));
      toast.success('✅ Line Item Updated Successfully');
    } else {
      setLineItems([...lineItems, lineItem]);
      toast.success('✅ Line Item Added Successfully');
    }
    setIsLineItemModalOpen(false);
    setEditingLineItem(null);
  };

  const handleEditLineItem = (lineItem: PurchaseRecord) => {
    setEditingLineItem(lineItem);
    setIsLineItemModalOpen(true);
  };

  const handleDeleteLineItem = (lineItemId: string) => {
    if (window.confirm('Are you sure you want to delete this line item?')) {
      setLineItems(lineItems.filter(item => item.id !== lineItemId));
      toast.success('✅ Line Item Deleted');
    }
  };

  const handleDuplicateLineItem = (lineItem: PurchaseRecord) => {
    const duplicated: PurchaseRecord = {
      ...lineItem,
      id: `${poHeader.id}-line-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setLineItems([...lineItems, duplicated]);
    toast.success('✅ Line Item Duplicated');
  };

  const handleExportPO = () => {
    const headers = [
      'PO#', 'Date', 'Principal', 'Invoice #', 'Invoice Date', 'BOE #', 'BOE Date',
      'HS Code', 'Item Details', 'Part #', 'Unit Price', 'QTY', 'Freight Charges – International',
      'GST on Freight Charges', 'Total Price in FE / INR', 'Exchange Rate as per BOE',
      'Equivalent INR as per BOE', 'Actual Bank Transfer Amount', 'Bank Charges',
      'GST on Bank Charges', 'Basic Custom Duty', 'Surcharge', 
      'GST on Import / CGST_SGST_IGST on Local Purchase', 'Interest or Fine on Custom Duty',
      'Custom Clearance Charges', 'IGST/GST on Custom Clearance', 'Total Custom Clearance Charges',
      'Total Landed Price', 'Landed Unit Price', 'Customer', 'Customer\'s PO', 'PO Date',
      'PO Price', 'Quantity', 'Total PO Price', 'IGST / GST %', 'GST / IGST Amount',
      'Price to Customer', 'Customer Invoice #', 'Customer Invoice Date', 
      'Shipping Charges to customer', 'CGST_SGST', 'Price to SPPL', 'GM %', 'Margin'
    ];

    const rows = lineItems.map((item) => [
      item.po_number, item.date, item.principal, item.invoice_number, item.invoice_date,
      item.boe_number, item.boe_date, item.hs_code, item.item_details, item.part_number,
      item.unit_price, item.qty, item.freight_charges_international, item.gst_on_freight_charges,
      item.total_price_in_fe_inr, item.exchange_rate_as_per_boe, item.equivalent_inr_as_per_boe,
      item.actual_bank_transfer_amount, item.bank_charges, item.gst_on_bank_charges,
      item.basic_custom_duty, item.surcharge, item.gst_on_import_cgst_sgst_igst_local,
      item.interest_or_fine_on_custom_duty, item.custom_clearance_charges,
      item.igst_gst_on_custom_clearance, item.total_custom_clearance_charges,
      item.total_landed_price, item.landed_unit_price, item.customer, item.customer_po,
      item.po_date, item.po_price, item.quantity, item.total_po_price, item.igst_gst_percentage,
      item.gst_igst_amount, item.price_to_customer, item.customer_invoice_number,
      item.customer_invoice_date, item.shipping_charges_to_customer, item.cgst_sgst,
      item.price_to_sppl, item.gm_percentage, item.margin
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PO_${poHeader.po_number}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('✅ PO Exported Successfully');
  };

  const handleFinalizePO = () => {
    if (lineItems.length === 0) {
      alert('Please add at least one line item before finalizing the PO.');
      return;
    }
    
    if (window.confirm(`Finalize PO ${poHeader.po_number} with ${lineItems.length} line item(s)?`)) {
      onFinalizePO(poHeader, lineItems);
      toast.success('✅ PO Finalized Successfully');
    }
  };

  const togglePOExpansion = (poNumber: string) => {
    const newExpanded = new Set(expandedPOs);
    if (newExpanded.has(poNumber)) {
      newExpanded.delete(poNumber);
    } else {
      newExpanded.add(poNumber);
    }
    setExpandedPOs(newExpanded);
  };

  // Calculate summary
  const totalLandedCost = lineItems.reduce((sum, item) => sum + (item.total_landed_price || 0), 0);
  const totalMargin = lineItems.reduce((sum, item) => sum + (item.margin || 0), 0);
  const avgMarginPercentage = lineItems.length > 0
    ? lineItems.reduce((sum, item) => sum + (item.gm_percentage || 0), 0) / lineItems.length
    : 0;

  const getMarginColor = (margin: number) => {
    if (margin < 0) return 'text-red-600';
    if (margin >= 20000) return 'text-green-600';
    return 'text-yellow-600';
  };

  const getGMPercentageColor = (gmPercentage: number) => {
    if (gmPercentage < 0) return 'bg-red-100 text-red-800';
    if (gmPercentage >= 15) return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header Section */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-[#212529] mb-2">
                PO Line Items Management
              </h2>
              <div className="space-y-1 text-sm text-gray-600">
                <p><span className="font-medium">PO#:</span> {poHeader.po_number}</p>
                <p><span className="font-medium">Principal:</span> {poHeader.principal}</p>
                <p><span className="font-medium">Customer:</span> {poHeader.customer || 'N/A'}</p>
                <p><span className="font-medium">Record Type:</span> <Badge variant="outline">{poHeader.record_type}</Badge></p>
              </div>
            </div>
            <Button variant="outline" onClick={onBack}>
              ← Back to Header
            </Button>
          </div>

          {/* Button Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setEditingLineItem(null);
                  setIsLineItemModalOpen(true);
                }}
                className="gap-2 bg-[#007BFF] hover:bg-[#0056b3]"
              >
                <Plus className="w-4 h-4" />
                Add Line Item
              </Button>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Import Excel
              </Button>
              <Button onClick={handleExportPO} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Export PO
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupByPO}
                  onChange={(e) => setGroupByPO(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Group by PO#
              </label>
            </div>
          </div>
        </Card>

        {/* Summary Card */}
        {lineItems.length > 0 && (
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-medium text-gray-900 mb-4">PO Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Line Items</p>
                <p className="text-2xl font-semibold text-blue-600">{lineItems.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Landed Cost</p>
                <p className="text-2xl font-semibold text-gray-900">
                  ₹{totalLandedCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Margin</p>
                <p className={`text-2xl font-semibold ${getMarginColor(totalMargin)}`}>
                  ₹{totalMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average GM %</p>
                <p className={`text-2xl font-semibold ${avgMarginPercentage < 0 ? 'text-red-600' : avgMarginPercentage >= 15 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {avgMarginPercentage.toFixed(2)}%
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Line Items Table */}
        <Card className="p-6">
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="whitespace-nowrap">Line #</TableHead>
                  {groupByPO && <TableHead className="whitespace-nowrap">PO#</TableHead>}
                  <TableHead className="whitespace-nowrap">Item Details</TableHead>
                  <TableHead className="whitespace-nowrap">Part #</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Unit Price</TableHead>
                  <TableHead className="whitespace-nowrap text-right">QTY</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Total Landed Price</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Price to SPPL</TableHead>
                  <TableHead className="whitespace-nowrap text-right">GM %</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Margin</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={groupByPO ? 11 : 10} className="text-center py-12 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <p>No line items added yet</p>
                        <Button
                          onClick={() => {
                            setEditingLineItem(null);
                            setIsLineItemModalOpen(true);
                          }}
                          variant="outline"
                          className="gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add First Line Item
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : groupByPO ? (
                  <>
                    <TableRow
                      className="bg-gray-100 hover:bg-gray-200 cursor-pointer"
                      onClick={() => togglePOExpansion(poHeader.po_number)}
                    >
                      <TableCell colSpan={11}>
                        <div className="flex items-center gap-2">
                          {expandedPOs.has(poHeader.po_number) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <span className="font-medium">{poHeader.po_number}</span>
                          <Badge variant="secondary">{lineItems.length} line items</Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedPOs.has(poHeader.po_number) && lineItems.map((item, index) => (
                      <TableRow key={item.id} className="hover:bg-gray-50">
                        <TableCell className="pl-8">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.po_number}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.item_details}</TableCell>
                        <TableCell>{item.part_number}</TableCell>
                        <TableCell className="text-right">₹{item.unit_price.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{item.qty}</TableCell>
                        <TableCell className="text-right font-medium text-green-700">
                          ₹{item.total_landed_price.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium text-blue-700">
                          ₹{item.price_to_sppl.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${getGMPercentageColor(item.gm_percentage)}`}>
                            {item.gm_percentage.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${getMarginColor(item.margin)}`}>
                          ₹{item.margin.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleEditLineItem(item)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleDuplicateLineItem(item)}>
                                  <Copy className="w-4 h-4 text-blue-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Duplicate</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteLineItem(item.id)}>
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : (
                  lineItems.map((item, index) => (
                    <TableRow key={item.id} className="hover:bg-gray-50">
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="max-w-xs truncate">{item.item_details}</TableCell>
                      <TableCell>{item.part_number}</TableCell>
                      <TableCell className="text-right">₹{item.unit_price.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.qty}</TableCell>
                      <TableCell className="text-right font-medium text-green-700">
                        ₹{item.total_landed_price.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-700">
                        ₹{item.price_to_sppl.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${getGMPercentageColor(item.gm_percentage)}`}>
                          {item.gm_percentage.toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${getMarginColor(item.margin)}`}>
                        ₹{item.margin.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleEditLineItem(item)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleDuplicateLineItem(item)}>
                                <Copy className="w-4 h-4 text-blue-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Duplicate</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteLineItem(item.id)}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Finalize Button */}
          {lineItems.length > 0 && (
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleFinalizePO}
                size="lg"
                className="bg-green-600 hover:bg-green-700"
              >
                Finalize PO ({lineItems.length} line items)
              </Button>
            </div>
          )}
        </Card>

        {/* Line Item Modal */}
        {isLineItemModalOpen && (
          <PurchaseLineItemModal
            isOpen={isLineItemModalOpen}
            onClose={() => {
              setIsLineItemModalOpen(false);
              setEditingLineItem(null);
            }}
            onSubmit={handleAddLineItem}
            editingLineItem={editingLineItem}
            poHeader={poHeader}
            lineNumber={lineItems.length + 1}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
