import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { OrganizationCombobox } from './OrganizationCombobox';
import { usePlannerOrganizationsQuery } from '../../hooks/sales/usePlannerQueries';
import {
  useSalesHistoryMutations,
  useSalesHistoryQuery,
} from '../../hooks/sales/useSalesHistoryQueries';
import type { SalesHistoryInput, SalesHistoryRecord } from '../../types/salesHistory';

/** Same Address textarea sizing as Create New Quotation. */
const taAddress = 'min-h-[72px] max-h-[120px] resize-y';

const EMPTY_FORM: SalesHistoryInput = {
  invoiceDate: '',
  invoiceNumber: '',
  customerName: '',
  billingAddress: '',
  principal: '',
  serialNumber: '',
  warranty: '',
  partNumber: '',
  itemDescription: '',
  quantity: '',
  endUser: '',
  primaryContactEmail: '',
};

/** Fixed column widths so headers never compress or overlap. */
const COL = {
  invoiceDate: 'w-[140px] min-w-[140px] max-w-[140px]',
  invoiceNumber: 'w-[170px] min-w-[170px] max-w-[170px]',
  customerOrg: 'w-[280px] min-w-[280px] max-w-[280px]',
  billing: 'w-[320px] min-w-[320px] max-w-[320px]',
  endUser: 'w-[220px] min-w-[220px] max-w-[220px]',
  email: 'w-[250px] min-w-[250px] max-w-[250px]',
  principle: 'w-[180px] min-w-[180px] max-w-[180px]',
  partNumber: 'w-[180px] min-w-[180px] max-w-[180px]',
  description: 'w-[260px] min-w-[260px] max-w-[260px]',
  serial: 'w-[180px] min-w-[180px] max-w-[180px]',
  warranty: 'w-[130px] min-w-[130px] max-w-[130px]',
  quantity: 'w-[100px] min-w-[100px] max-w-[100px]',
  /** Wide enough for View / Edit / Delete without wrapping. */
  actions: 'w-[220px] min-w-[220px] max-w-[220px]',
} as const;

const HISTORY_TABLE_MIN_WIDTH = 2630;
/** Matches COL.invoiceDate. Inline `left` is required: compiled CSS has `left-0` but not `left-[140px]`. */
const INVOICE_DATE_WIDTH_PX = 140;
const INVOICE_NUMBER_WIDTH_PX = 170;
const HEAD_STICKY = 'sticky top-0 bg-gray-50';
const HEAD_STICKY_DATE =
  `${COL.invoiceDate} sticky left-0 top-0 z-40 bg-gray-50 whitespace-nowrap text-center`;
const HEAD_STICKY_INVOICE =
  `${COL.invoiceNumber} sticky top-0 z-40 bg-gray-50 whitespace-nowrap`;
const CELL_STICKY_DATE =
  `${COL.invoiceDate} sticky left-0 z-10 bg-white text-center text-sm`;
const CELL_STICKY_INVOICE =
  `${COL.invoiceNumber} sticky z-10 overflow-hidden bg-white font-mono text-sm`;

const STICKY_DATE_STYLE: CSSProperties = {
  position: 'sticky',
  left: 0,
  width: INVOICE_DATE_WIDTH_PX,
  minWidth: INVOICE_DATE_WIDTH_PX,
  maxWidth: INVOICE_DATE_WIDTH_PX,
};
const STICKY_INVOICE_STYLE: CSSProperties = {
  position: 'sticky',
  left: INVOICE_DATE_WIDTH_PX,
  width: INVOICE_NUMBER_WIDTH_PX,
  minWidth: INVOICE_NUMBER_WIDTH_PX,
  maxWidth: INVOICE_NUMBER_WIDTH_PX,
};
const STICKY_DATE_HEAD_STYLE: CSSProperties = { ...STICKY_DATE_STYLE, top: 0 };
const STICKY_INVOICE_HEAD_STYLE: CSSProperties = { ...STICKY_INVOICE_STYLE, top: 0 };

function displayCell(value: string | number | null | undefined): string {
  if (value === undefined || value === null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

function TruncatedText({ value }: { value: string | number | null | undefined }) {
  const text = displayCell(value);
  return (
    <span className="block max-w-full truncate" title={text === '—' ? undefined : text}>
      {text}
    </span>
  );
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return displayCell(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ViewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="text-sm text-[#212529] break-words">{value}</div>
    </div>
  );
}

function ViewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-[#212529]">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Sales History tab — historical invoice records.
 * Reuses OrganizationCombobox + planner organizations API from Create New Quotation.
 */
export default function SalesHistoryTab() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SalesHistoryRecord | null>(null);
  const [form, setForm] = useState<SalesHistoryInput>(EMPTY_FORM);
  const tableViewportRef = useRef<HTMLDivElement>(null);
  const [tableViewportWidth, setTableViewportWidth] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const el = tableViewportRef.current;
    if (!el) return;
    const update = () => setTableViewportWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const listParams = useMemo(
    () => ({
      q: debouncedSearch || undefined,
    }),
    [debouncedSearch],
  );

  const listQuery = useSalesHistoryQuery(listParams, true);
  const organizationsQuery = usePlannerOrganizationsQuery(formOpen || detailOpen);
  const { create, update, remove } = useSalesHistoryMutations();
  const rows = listQuery.data?.data || [];
  const busy = create.isPending || update.isPending || remove.isPending;

  const activeOrganizations = useMemo(
    () => (organizationsQuery.data ?? []).filter((o) => o.isActive),
    [organizationsQuery.data],
  );

  const organizationAddressByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of activeOrganizations) {
      const name = org.organizationName.trim();
      if (name) map.set(name.toLowerCase(), org.address.trim());
    }
    return map;
  }, [activeOrganizations]);

  const organizationOptions = useMemo(() => {
    const names = activeOrganizations.map((o) => o.organizationName).filter(Boolean);
    const current = String(form.customerName || '').trim();
    if (current && !names.some((n) => n.toLowerCase() === current.toLowerCase())) {
      return [...names, current];
    }
    return names;
  }, [activeOrganizations, form.customerName]);

  const getOrganizationAddress = useCallback(
    (name: string) => organizationAddressByName.get(name.trim().toLowerCase()) ?? '',
    [organizationAddressByName],
  );

  /** Same behaviour as Create New Quotation: selecting org fills Address when known. */
  const handleCustomerOrganizationChange = (organizationName: string, address: string) => {
    const trimmed = organizationName.trim();
    setForm((prev) => ({
      ...prev,
      customerName: trimmed,
      ...(address ? { billingAddress: address } : {}),
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (row: SalesHistoryRecord) => {
    setEditingId(row.recordId);
    setForm({
      invoiceDate: row.invoiceDate || '',
      invoiceNumber: row.invoiceNumber || '',
      customerName: row.customerName || '',
      billingAddress: row.billingAddress || '',
      principal: row.principal || '',
      serialNumber: row.serialNumber || '',
      warranty: row.warranty || '',
      partNumber: row.partNumber || '',
      itemDescription: row.itemDescription || '',
      quantity: row.quantity ?? '',
      endUser: row.endUser || '',
      primaryContactEmail: row.primaryContactEmail || '',
    });
    setFormOpen(true);
  };

  const openDetail = (row: SalesHistoryRecord) => {
    setDetail(row);
    setDetailOpen(true);
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!String(form.customerName || '').trim()) {
      toast.error('Customer Organization is required');
      return;
    }
    if (!String(form.principal || '').trim()) {
      toast.error('Principle is required');
      return;
    }
    try {
      if (editingId) {
        await update.mutateAsync({ recordId: editingId, body: form });
        toast.success('Record updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Record saved');
      }
      setFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const onDelete = async (row: SalesHistoryRecord) => {
    if (!window.confirm(`Delete historical record ${row.invoiceNumber || row.recordId}?`)) return;
    try {
      await remove.mutateAsync(row.recordId);
      toast.success('Record deleted');
      if (detail?.recordId === row.recordId) {
        setDetailOpen(false);
        setDetail(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const setField =
    (key: keyof SalesHistoryInput) =>
    (value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  const colCount = 13;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#212529]">Sales History</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Historical sales invoices and part shipments (approximately the last five years).
            Independent of live quotations.
          </p>
        </div>
        <Button type="button" onClick={openCreate} disabled={busy}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Add Historical Record
        </Button>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 size-3.5 -translate-y-1/2 text-gray-400"
          style={{ left: 10 }}
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice, customer organization, principle, part, serial…"
          className="h-9 bg-white text-sm"
          style={{ paddingLeft: 32 }}
          aria-label="Search sales history"
        />
      </div>

      <div
        ref={tableViewportRef}
        className="min-h-[280px] max-h-[min(560px,calc(100vh-320px))] overflow-auto rounded-md border [&_[data-slot=table-container]]:overflow-visible"
      >
        <Table
          className="table-fixed"
          style={{ width: HISTORY_TABLE_MIN_WIDTH, minWidth: HISTORY_TABLE_MIN_WIDTH }}
        >
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className={HEAD_STICKY_DATE} style={STICKY_DATE_HEAD_STYLE}>
                Invoice Date
              </TableHead>
              <TableHead className={HEAD_STICKY_INVOICE} style={STICKY_INVOICE_HEAD_STYLE}>
                Invoice Number
              </TableHead>
              <TableHead className={`${COL.customerOrg} ${HEAD_STICKY} whitespace-nowrap`}>
                Customer Organization
              </TableHead>
              <TableHead className={`${COL.billing} ${HEAD_STICKY} whitespace-nowrap`}>
                Billing Address
              </TableHead>
              <TableHead className={`${COL.endUser} ${HEAD_STICKY} whitespace-nowrap`}>
                End User / POC
              </TableHead>
              <TableHead className={`${COL.email} ${HEAD_STICKY} whitespace-nowrap`}>
                Primary Contact Email
              </TableHead>
              <TableHead className={`${COL.principle} ${HEAD_STICKY} whitespace-nowrap`}>
                Principle
              </TableHead>
              <TableHead className={`${COL.partNumber} ${HEAD_STICKY} whitespace-nowrap`}>
                Part Number
              </TableHead>
              <TableHead className={`${COL.description} ${HEAD_STICKY} whitespace-nowrap`}>
                Item Description
              </TableHead>
              <TableHead className={`${COL.serial} ${HEAD_STICKY} whitespace-nowrap`}>
                Serial Number
              </TableHead>
              <TableHead className={`${COL.warranty} ${HEAD_STICKY} whitespace-nowrap`}>
                Warranty
              </TableHead>
              <TableHead className={`${COL.quantity} ${HEAD_STICKY} whitespace-nowrap text-center`}>
                Quantity
              </TableHead>
              <TableHead className={`${COL.actions} ${HEAD_STICKY} whitespace-nowrap text-center`}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isPending || listQuery.isError || rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colCount} className="h-[240px] p-0">
                  <div
                    className={`sticky left-0 flex h-[240px] items-center justify-center px-4 text-sm ${
                      listQuery.isError ? 'text-red-600' : 'text-muted-foreground'
                    }`}
                    style={{ width: tableViewportWidth > 0 ? tableViewportWidth : '100%' }}
                  >
                    {listQuery.isPending
                      ? 'Loading sales history…'
                      : listQuery.isError
                        ? 'Failed to load sales history'
                        : 'No historical sales records yet.'}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.recordId} className="group">
                  <TableCell className={CELL_STICKY_DATE} style={STICKY_DATE_STYLE}>
                    {formatDate(row.invoiceDate)}
                  </TableCell>
                  <TableCell className={CELL_STICKY_INVOICE} style={STICKY_INVOICE_STYLE}>
                    <TruncatedText value={row.invoiceNumber} />
                  </TableCell>
                  <TableCell className={`${COL.customerOrg} overflow-hidden text-sm`}>
                    <TruncatedText value={row.customerName} />
                  </TableCell>
                  <TableCell className={`${COL.billing} overflow-hidden text-sm`}>
                    <TruncatedText value={row.billingAddress} />
                  </TableCell>
                  <TableCell className={`${COL.endUser} overflow-hidden text-sm`}>
                    <TruncatedText value={row.endUser} />
                  </TableCell>
                  <TableCell className={`${COL.email} overflow-hidden text-sm`}>
                    <TruncatedText value={row.primaryContactEmail} />
                  </TableCell>
                  <TableCell className={`${COL.principle} overflow-hidden text-sm`}>
                    <TruncatedText value={row.principal} />
                  </TableCell>
                  <TableCell className={`${COL.partNumber} overflow-hidden font-mono text-sm`}>
                    <TruncatedText value={row.partNumber} />
                  </TableCell>
                  <TableCell className={`${COL.description} overflow-hidden text-sm`}>
                    <TruncatedText value={row.itemDescription} />
                  </TableCell>
                  <TableCell className={`${COL.serial} overflow-hidden font-mono text-sm`}>
                    <TruncatedText value={row.serialNumber} />
                  </TableCell>
                  <TableCell className={`${COL.warranty} overflow-hidden text-sm`}>
                    <TruncatedText value={row.warranty} />
                  </TableCell>
                  <TableCell className={`${COL.quantity} text-center text-sm tabular-nums`}>
                    {row.quantity != null && String(row.quantity).trim() !== ''
                      ? row.quantity
                      : '—'}
                  </TableCell>
                  <TableCell className={`${COL.actions} text-center`}>
                    <div className="flex flex-nowrap items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => openDetail(row)}
                      >
                        View
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-red-600 hover:text-red-700"
                        disabled={busy}
                        onClick={() => void onDelete(row)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Historical Record' : 'Add Historical Record'}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-5 py-2" onSubmit={(e) => void onSave(e)}>
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-[#212529]">Invoice</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="f-invoice-date">Invoice Date *</Label>
                  <Input
                    id="f-invoice-date"
                    type="date"
                    required
                    value={form.invoiceDate}
                    onChange={(e) => setField('invoiceDate')(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="f-invoice-number">Invoice Number *</Label>
                  <Input
                    id="f-invoice-number"
                    required
                    className="font-mono"
                    value={form.invoiceNumber}
                    onChange={(e) => setField('invoiceNumber')(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-[#212529]">Customer</h4>
              <OrganizationCombobox
                label="Customer Organization"
                value={form.customerName || ''}
                options={organizationOptions}
                getAddressForOrganization={getOrganizationAddress}
                onChange={handleCustomerOrganizationChange}
                placeholder="Search or select organization…"
                disabled={busy || organizationsQuery.isPending}
              />
              <div className="space-y-2">
                <Label htmlFor="f-billing">Billing Address</Label>
                <Textarea
                  id="f-billing"
                  className={taAddress}
                  rows={3}
                  value={form.billingAddress || ''}
                  onChange={(e) => setField('billingAddress')(e.target.value)}
                  placeholder="Street, city, postal code…"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="f-end-user">End User / POC</Label>
                  <Input
                    id="f-end-user"
                    value={form.endUser || ''}
                    onChange={(e) => setField('endUser')(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="f-email">Primary Contact Email</Label>
                  <Input
                    id="f-email"
                    type="email"
                    value={form.primaryContactEmail || ''}
                    onChange={(e) => setField('primaryContactEmail')(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-[#212529]">Product</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="f-principle">Principle *</Label>
                  <Input
                    id="f-principle"
                    required
                    value={form.principal}
                    onChange={(e) => setField('principal')(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="f-part">Part Number *</Label>
                  <Input
                    id="f-part"
                    required
                    className="font-mono"
                    value={form.partNumber}
                    onChange={(e) => setField('partNumber')(e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="f-desc">Item Description *</Label>
                  <Textarea
                    id="f-desc"
                    required
                    rows={2}
                    value={form.itemDescription}
                    onChange={(e) => setField('itemDescription')(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="f-serial">Serial Number</Label>
                  <Input
                    id="f-serial"
                    className="font-mono"
                    value={form.serialNumber || ''}
                    onChange={(e) => setField('serialNumber')(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="f-warranty">Warranty</Label>
                  <Input
                    id="f-warranty"
                    value={form.warranty || ''}
                    onChange={(e) => setField('warranty')(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="f-qty">Quantity</Label>
                  <Input
                    id="f-qty"
                    type="number"
                    min={0}
                    step="any"
                    value={form.quantity ?? ''}
                    onChange={(e) => setField('quantity')(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Save Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historical Record</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4 py-2">
              <ViewSection title="Invoice">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ViewField label="Invoice Date" value={formatDate(detail.invoiceDate)} />
                  <ViewField label="Invoice Number" value={displayCell(detail.invoiceNumber)} />
                </div>
              </ViewSection>
              <ViewSection title="Customer">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ViewField
                    label="Customer Organization"
                    value={displayCell(detail.customerName)}
                  />
                  <ViewField label="End User / POC" value={displayCell(detail.endUser)} />
                  <ViewField
                    label="Primary Contact Email"
                    value={displayCell(detail.primaryContactEmail)}
                  />
                  <div className="sm:col-span-2">
                    <ViewField label="Billing Address" value={displayCell(detail.billingAddress)} />
                  </div>
                </div>
              </ViewSection>
              <ViewSection title="Product">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ViewField label="Principle" value={displayCell(detail.principal)} />
                  <ViewField label="Part Number" value={displayCell(detail.partNumber)} />
                  <div className="sm:col-span-2">
                    <ViewField
                      label="Item Description"
                      value={displayCell(detail.itemDescription)}
                    />
                  </div>
                  <ViewField label="Serial Number" value={displayCell(detail.serialNumber)} />
                  <ViewField label="Warranty" value={displayCell(detail.warranty)} />
                  <ViewField
                    label="Quantity"
                    value={detail.quantity != null ? String(detail.quantity) : '—'}
                  />
                </div>
              </ViewSection>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
                  Close
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDetailOpen(false);
                    openEdit(detail);
                  }}
                >
                  Edit
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
