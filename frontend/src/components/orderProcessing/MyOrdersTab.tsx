import { useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import type { OrderProcessingRecord } from '../../types/orderProcessing';
import { useMyOrdersQuery, useInvalidateOrderProcessing } from '../../hooks/orderProcessing/useOrderProcessingQueries';
import { deleteOrder } from '../../hooks/orderProcessing/orderProcessingApi';
import { isQueryColdLoading } from '../../utils/queryLoading';
import OrderFormModal from './OrderFormModal';
import OrderViewModal from './OrderViewModal';

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyOrdersTab() {
  const ordersQuery = useMyOrdersQuery();
  const invalidate = useInvalidateOrderProcessing();
  const orders = ordersQuery.data ?? [];
  const isLoading = isQueryColdLoading(ordersQuery);

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<OrderProcessingRecord | null>(null);
  const [viewOrder, setViewOrder] = useState<OrderProcessingRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.spplReferenceNumber?.toLowerCase().includes(q) ||
        o.organizationName?.toLowerCase().includes(q) ||
        o.customerContractPONumber?.toLowerCase().includes(q),
    );
  }, [orders, search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteOrder(deleteId);
      toast.success('Order deleted');
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleSaved = () => {
    invalidate();
    void ordersQuery.refetch();
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search by reference, organization, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button className="gap-1.5 bg-[#007BFF] hover:bg-[#0056b3]" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create New Order
          </Button>
        </div>

        <Card className="overflow-hidden border-gray-200">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference #</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Created Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-gray-500">
                      Loading orders…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-gray-500">
                      {search ? 'No matching orders found.' : 'No orders yet. Create your first order.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((order) => (
                    <TableRow key={order.orderId}>
                      <TableCell className="font-medium">{order.spplReferenceNumber || '—'}</TableCell>
                      <TableCell>{order.organizationName || '—'}</TableCell>
                      <TableCell>{order.customerContractPONumber || '—'}</TableCell>
                      <TableCell>{formatDate(order.created_at)}</TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          {order.status || 'Draft'}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(order.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewOrder(order)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditOrder(order)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setDeleteId(order.orderId)}>
                                <Trash2 className="h-4 w-4" />
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
        </Card>
      </div>

      <OrderFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={handleSaved} />
      <OrderFormModal open={!!editOrder} onClose={() => setEditOrder(null)} onSaved={handleSaved} editOrder={editOrder} />
      <OrderViewModal open={!!viewOrder} order={viewOrder} onClose={() => setViewOrder(null)} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
