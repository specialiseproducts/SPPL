import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '../../services/api';
import type { ExchangeRatesMap, SalesMasterAdminItem, SalesPrincipalAdminRow } from '../../types/salesForecast';
import { Button } from '../ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../ui/utils';

const SIMPLE_CATEGORIES: { id: string; label: string }[] = [
  { id: 'STATUS', label: 'Status' },
  { id: 'CURRENCY', label: 'Currency' },
  { id: 'PROBABILITY_OPTION', label: 'Probability %' },
  { id: 'CUSTOMER_SEGMENT', label: 'Customer segment' },
  { id: 'ENQUIRY_TYPE', label: 'Enquiry type' },
  { id: 'DELIVERY_DAYS', label: 'Delivery (days)' },
  { id: 'WARRANTY', label: 'Warranty' },
  { id: 'CONTACT_TITLE', label: 'Contact title' },
];

const RATE_FIELDS: { key: string; label: string }[] = [
  { key: 'Euro', label: 'Euro to INR' },
  { key: 'US$', label: 'US$ to INR' },
  { key: 'GBP', label: 'GBP to INR' },
];

interface SalesMasterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRates: ExchangeRatesMap;
  onSaveRates: (rates: ExchangeRatesMap) => void | Promise<void>;
  onMastersChanged: () => void | Promise<void>;
}

export default function SalesMasterSettingsModal({
  isOpen,
  onClose,
  currentRates,
  onSaveRates,
  onMastersChanged,
}: SalesMasterSettingsModalProps) {
  const [tab, setTab] = useState('lists');
  const [listCat, setListCat] = useState('STATUS');
  const [items, setItems] = useState<SalesMasterAdminItem[]>([]);
  const [principals, setPrincipals] = useState<SalesPrincipalAdminRow[]>([]);
  const [newValue, setNewValue] = useState('');
  const [rates, setRates] = useState<ExchangeRatesMap>({ INR: 1, ...currentRates });
  const [rateErrors, setRateErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [pName, setPName] = useState('');
  const [pCode, setPCode] = useState('');
  const [pActive, setPActive] = useState(true);
  const [pPrevSk, setPPrevSk] = useState<string | null>(null);
  const ratesFormRef = useRef<HTMLFormElement>(null);

  const loadList = useCallback(async () => {
    const res = (await apiFetch(`/api/sales-forecasts/master-admin/${encodeURIComponent(listCat)}`)) as {
      data?: { items?: SalesMasterAdminItem[] };
    };
    setItems(res?.data?.items ?? []);
  }, [listCat]);

  const loadPrincipals = useCallback(async () => {
    const res = (await apiFetch(`/api/sales-forecasts/master-admin/PRINCIPAL_MAP`)) as {
      data?: { principals?: SalesPrincipalAdminRow[] };
    };
    setPrincipals(res?.data?.principals ?? []);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setRates({ INR: 1, ...currentRates });
    setRateErrors({});
    void loadPrincipals();
  }, [isOpen, currentRates, loadPrincipals]);

  useEffect(() => {
    if (!isOpen || tab !== 'lists') return;
    void loadList().catch(() => toast.error('Failed to load master list'));
  }, [isOpen, tab, listCat, loadList]);

  const toggleItem = async (sk: string, value: string, isActive: boolean) => {
    setBusy(true);
    try {
      await apiFetch(`/api/sales-forecasts/master-admin/${encodeURIComponent(listCat)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sk, value, isActive: !isActive }),
      });
      toast.success('Updated');
      await loadList();
      await onMastersChanged();
    } catch {
      toast.error('Update failed');
    } finally {
      setBusy(false);
    }
  };

  const addItem = async () => {
    const v = newValue.trim();
    if (!v) return;
    setBusy(true);
    try {
      await apiFetch(`/api/sales-forecasts/master-admin/${encodeURIComponent(listCat)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: v }),
      });
      toast.success('Added');
      setNewValue('');
      await loadList();
      await onMastersChanged();
    } catch {
      toast.error('Add failed');
    } finally {
      setBusy(false);
    }
  };

  const savePrincipal = async () => {
    const name = pName.trim();
    const code = pCode.trim().toUpperCase();
    if (!name || !code) {
      toast.error('Principle name and short code are required');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/api/sales-forecasts/master-admin/principal-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principalName: name,
          shortCode: code,
          isActive: pActive,
          previousSk: pPrevSk || undefined,
        }),
      });
      toast.success('Principle saved');
      setPName('');
      setPCode('');
      setPActive(true);
      setPPrevSk(null);
      await loadPrincipals();
      await onMastersChanged();
    } catch {
      toast.error('Save failed');
    } finally {
      setBusy(false);
    }
  };

  const editPrincipal = (row: SalesPrincipalAdminRow) => {
    setPName(row.principalName);
    setPCode(row.shortCode);
    setPActive(row.isActive);
    setPPrevSk(row.sk);
  };

  const togglePrincipal = async (row: SalesPrincipalAdminRow) => {
    setBusy(true);
    try {
      await apiFetch('/api/sales-forecasts/master-admin/principal-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principalName: row.principalName,
          shortCode: row.shortCode,
          isActive: !row.isActive,
          previousSk: row.sk,
        }),
      });
      toast.success('Updated');
      await loadPrincipals();
      await onMastersChanged();
    } catch {
      toast.error('Update failed');
    } finally {
      setBusy(false);
    }
  };

  const validateRates = () => {
    const e: Record<string, string> = {};
    for (const { key } of RATE_FIELDS) {
      const v = Number(rates[key]);
      if (!v || v <= 0) e[key] = 'Rate must be greater than 0';
    }
    setRateErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveRates = async () => {
    if (!validateRates()) return;
    setBusy(true);
    try {
      await Promise.resolve(onSaveRates({ ...rates, INR: 1 }));
    } finally {
      setBusy(false);
    }
  };

  const onRatesFormSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    void handleSaveRates();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex shrink-0 flex-col gap-0 overflow-hidden p-6',
          'box-border h-[700px] w-[960px] max-w-[960px] min-h-0 min-w-0 sm:max-w-[960px]',
        )}
      >
        <DialogHeader className="shrink-0 border-b pb-4 text-left sm:text-left">
          <DialogTitle>Sales master data</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2">
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="lists">Lists</TabsTrigger>
              <TabsTrigger value="principals">Principles</TabsTrigger>
              <TabsTrigger value="rates">FX rates</TabsTrigger>
            </TabsList>

            <TabsContent value="lists" className="mt-0 space-y-4 outline-none data-[state=inactive]:hidden">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    className="border-input bg-background h-9 w-full min-w-[180px] rounded-md border px-3 text-sm"
                    value={listCat}
                    onChange={(e) => setListCat(e.target.value)}
                  >
                    {SIMPLE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex min-w-[240px] flex-1 flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1 space-y-2">
                    <Label htmlFor="list-new-value">New value</Label>
                    <Input
                      id="list-new-value"
                      placeholder="New value"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                    />
                  </div>
                  <Button type="button" onClick={() => void addItem()} disabled={busy}>
                    Add
                  </Button>
                </div>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Value</TableHead>
                      <TableHead className="w-[120px] text-center">Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-muted-foreground py-8 text-center">
                          No items.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((row) => (
                        <TableRow key={row.sk}>
                          <TableCell className="font-medium">{row.value}</TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={row.isActive}
                              disabled={busy}
                              onCheckedChange={() => void toggleItem(row.sk, row.value, row.isActive)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="principals" className="mt-0 space-y-4 outline-none data-[state=inactive]:hidden">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Principle name</Label>
                  <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="e.g. Vortran" />
                </div>
                <div className="space-y-2">
                  <Label>Short code</Label>
                  <Input
                    value={pCode}
                    onChange={(e) => setPCode(e.target.value)}
                    placeholder="e.g. VOR"
                    className="font-mono uppercase"
                  />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex items-center gap-2 pb-2">
                    <Switch checked={pActive} onCheckedChange={setPActive} id="p-act" />
                    <Label htmlFor="p-act" className="font-normal">
                      Active
                    </Label>
                  </div>
                  <Button type="button" onClick={() => void savePrincipal()} disabled={busy}>
                    {pPrevSk ? 'Update' : 'Add'}
                  </Button>
                  {pPrevSk ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => (setPPrevSk(null), setPName(''), setPCode(''), setPActive(true))}
                    >
                      Cancel edit
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Principle</TableHead>
                      <TableHead className="w-[100px]">Code</TableHead>
                      <TableHead className="w-[100px] text-center">Active</TableHead>
                      <TableHead className="w-[140px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {principals.map((row) => (
                      <TableRow key={row.sk}>
                        <TableCell>{row.principalName}</TableCell>
                        <TableCell className="font-mono text-sm">{row.shortCode}</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={row.isActive} disabled={busy} onCheckedChange={() => void togglePrincipal(row)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="outline" size="sm" onClick={() => editPrincipal(row)}>
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="rates" className="mt-0 outline-none data-[state=inactive]:hidden">
              <form
                ref={ratesFormRef}
                id="sales-master-rates-form"
                onSubmit={onRatesFormSubmit}
                className="space-y-4 pb-2"
              >
                <div className="space-y-2">
                  <Label>INR (base)</Label>
                  <Input type="number" value={1} disabled className="bg-muted" />
                </div>
                {RATE_FIELDS.map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`r-${key}`}>{label}</Label>
                    <Input
                      id={`r-${key}`}
                      type="number"
                      step="0.01"
                      value={rates[key] ?? ''}
                      onChange={(e) => setRates((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                      className={rateErrors[key] ? 'border-red-500' : ''}
                    />
                    {rateErrors[key] ? <p className="text-sm text-red-600">{rateErrors[key]}</p> : null}
                  </div>
                ))}
                <button type="submit" className="sr-only">
                  Save rates
                </button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          {tab === 'rates' ? (
            <Button type="button" disabled={busy} onClick={() => void handleSaveRates()}>
              Save rates
            </Button>
          ) : null}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
