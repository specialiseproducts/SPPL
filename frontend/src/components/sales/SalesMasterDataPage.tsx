import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../../services/api';
import type {
  ExchangeRatesMap,
  SalesMasterAdminItem,
  SalesOrganizationAdminRow,
  SalesOrganizationPartRow,
  SalesPrincipalAdminRow,
  SalesPrincipalModelRow,
} from '../../types/salesForecast';
import { DEFAULT_EXCHANGE_RATES } from '../../hooks/sales/salesApi';
import { salesQueryKeys } from '../../hooks/sales/salesQueryKeys';
import {
  useInvalidateSalesMasters,
  useInvalidateSalesRates,
  useMasterAdminListQuery,
  useMasterAdminModelsQuery,
  useMasterAdminOrganizationsQuery,
  useMasterAdminPartsQuery,
  useMasterAdminPrincipalsQuery,
  useSalesRatesQuery,
} from '../../hooks/sales/useSalesQueries';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
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

interface SalesMasterDataPageProps {
  /** Called after list/principal changes so quotation dropdowns can refresh when user returns to those tabs. */
  onMastersChanged?: () => void | Promise<void>;
}

export default function SalesMasterDataPage({ onMastersChanged }: SalesMasterDataPageProps) {
  const queryClient = useQueryClient();
  const invalidateMasters = useInvalidateSalesMasters();
  const invalidateRates = useInvalidateSalesRates();

  const [sectionTab, setSectionTab] = useState('lists');
  const [listCat, setListCat] = useState('STATUS');
  const [newValue, setNewValue] = useState('');
  const [rates, setRates] = useState<ExchangeRatesMap>(DEFAULT_EXCHANGE_RATES);
  const [rateErrors, setRateErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [pName, setPName] = useState('');
  const [pCode, setPCode] = useState('');
  const [pActive, setPActive] = useState(true);
  const [pPrevSk, setPPrevSk] = useState<string | null>(null);

  const [oName, setOName] = useState('');
  const [oAddress, setOAddress] = useState('');
  const [oActive, setOActive] = useState(true);
  const [oPrevSk, setOPrevSk] = useState<string | null>(null);

  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [ptNumber, setPtNumber] = useState('');
  const [ptDesc, setPtDesc] = useState('');
  const [ptActive, setPtActive] = useState(true);
  const [ptEditPartId, setPtEditPartId] = useState<string | null>(null);

  const [selectedPrincipalId, setSelectedPrincipalId] = useState('');
  const [mNumber, setMNumber] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mActive, setMActive] = useState(true);
  const [mEditModelId, setMEditModelId] = useState<string | null>(null);

  const ratesQuery = useSalesRatesQuery();
  const listQuery = useMasterAdminListQuery(listCat, sectionTab === 'lists');
  const organizationsQuery = useMasterAdminOrganizationsQuery(true);
  const principalsQuery = useMasterAdminPrincipalsQuery(true);
  const partsQuery = useMasterAdminPartsQuery(
    selectedOrganizationId,
    sectionTab === 'parts' && !!selectedOrganizationId,
  );
  const modelsQuery = useMasterAdminModelsQuery(
    selectedPrincipalId,
    sectionTab === 'models' && !!selectedPrincipalId,
  );

  const items = listQuery.data ?? [];
  const organizations = organizationsQuery.data ?? [];
  const principals = principalsQuery.data ?? [];
  const parts = partsQuery.data ?? [];
  const models = modelsQuery.data ?? [];

  const activeOrganizations = useMemo(
    () =>
      organizations
        .filter((o) => o.isActive)
        .sort((a, b) =>
          a.organizationName.localeCompare(b.organizationName, undefined, { sensitivity: 'base' }),
        ),
    [organizations],
  );

  const activePrincipals = useMemo(
    () =>
      principals
        .filter((p) => p.isActive)
        .sort((a, b) =>
          a.principalName.localeCompare(b.principalName, undefined, { sensitivity: 'base' }),
        ),
    [principals],
  );

  useEffect(() => {
    if (ratesQuery.data) {
      setRates(ratesQuery.data);
    }
  }, [ratesQuery.data]);

  useEffect(() => {
    if (ratesQuery.isError && !ratesQuery.data) {
      toast.error('Failed to load currency rates');
    }
  }, [ratesQuery.isError, ratesQuery.data]);

  useEffect(() => {
    if (principalsQuery.isError && !principalsQuery.data) {
      toast.error('Failed to load principals');
    }
  }, [principalsQuery.isError, principalsQuery.data]);

  useEffect(() => {
    if (organizationsQuery.isError && !organizationsQuery.data) {
      toast.error('Failed to load customer organizations');
    }
  }, [organizationsQuery.isError, organizationsQuery.data]);

  useEffect(() => {
    if (listQuery.isError && sectionTab === 'lists') {
      toast.error('Failed to load master list');
    }
  }, [listQuery.isError, sectionTab]);

  const notifyMastersChanged = async () => {
    void invalidateMasters();
    if (onMastersChanged) await onMastersChanged();
  };

  const invalidateList = () => {
    void queryClient.invalidateQueries({ queryKey: salesQueryKeys.masterAdminList(listCat) });
  };

  const invalidatePrincipals = () => {
    void queryClient.invalidateQueries({ queryKey: salesQueryKeys.masterAdminPrincipals() });
  };

  const invalidateOrganizations = () => {
    void queryClient.invalidateQueries({ queryKey: salesQueryKeys.masterAdminOrganizations() });
  };

  const invalidateParts = () => {
    if (!selectedOrganizationId) return;
    void queryClient.invalidateQueries({
      queryKey: salesQueryKeys.masterAdminParts(selectedOrganizationId),
    });
  };

  const invalidateModels = () => {
    if (!selectedPrincipalId) return;
    void queryClient.invalidateQueries({
      queryKey: salesQueryKeys.masterAdminModels(selectedPrincipalId),
    });
    void queryClient.invalidateQueries({
      queryKey: salesQueryKeys.modelsByPrincipal(selectedPrincipalId, true),
    });
  };

  const toggleItemMutation = useMutation({
    mutationFn: async ({ sk, value, isActive }: { sk: string; value: string; isActive: boolean }) => {
      await apiFetch(`/api/sales-forecasts/master-admin/${encodeURIComponent(listCat)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sk, value, isActive: !isActive }),
      });
    },
    onSuccess: async () => {
      toast.success('Updated');
      invalidateList();
      await notifyMastersChanged();
    },
    onError: () => toast.error('Update failed'),
  });

  const addItemMutation = useMutation({
    mutationFn: async (value: string) => {
      await apiFetch(`/api/sales-forecasts/master-admin/${encodeURIComponent(listCat)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
    },
    onSuccess: async () => {
      toast.success('Added');
      setNewValue('');
      invalidateList();
      await notifyMastersChanged();
    },
    onError: () => toast.error('Add failed'),
  });

  const savePrincipalMutation = useMutation({
    mutationFn: async (body: {
      principalName: string;
      shortCode: string;
      isActive: boolean;
      previousSk?: string;
    }) => {
      await apiFetch('/api/sales-forecasts/master-admin/principal-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      toast.success('Principal saved');
      setPName('');
      setPCode('');
      setPActive(true);
      setPPrevSk(null);
      invalidatePrincipals();
      await notifyMastersChanged();
    },
    onError: () => toast.error('Save failed'),
  });

  const saveModelMutation = useMutation({
    mutationFn: async (body: {
      principalId: string;
      principalName: string;
      modelNumber: string;
      productDescription: string;
      isActive: boolean;
      modelId?: string;
    }) => {
      await apiFetch('/api/sales-forecasts/master-admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      toast.success('Model saved');
      setMNumber('');
      setMDesc('');
      setMActive(true);
      setMEditModelId(null);
      invalidateModels();
      await notifyMastersChanged();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
    },
  });

  const toggleModelMutation = useMutation({
    mutationFn: async (row: SalesPrincipalModelRow) => {
      await apiFetch('/api/sales-forecasts/master-admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principalId: row.principalId,
          principalName: row.principalName,
          modelNumber: row.modelNumber,
          productDescription: row.productDescription,
          isActive: !row.isActive,
          modelId: row.modelId,
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Updated');
      invalidateModels();
      await notifyMastersChanged();
    },
    onError: () => toast.error('Update failed'),
  });

  const togglePrincipalMutation = useMutation({
    mutationFn: async (row: SalesPrincipalAdminRow) => {
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
    },
    onSuccess: async () => {
      toast.success('Updated');
      invalidatePrincipals();
      await notifyMastersChanged();
    },
    onError: () => toast.error('Update failed'),
  });

  const saveOrganizationMutation = useMutation({
    mutationFn: async (body: {
      organizationName: string;
      address: string;
      isActive: boolean;
      previousSk?: string;
    }) => {
      await apiFetch('/api/sales-forecasts/master-admin/organization-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      toast.success('Customer organization saved');
      setOName('');
      setOAddress('');
      setOActive(true);
      setOPrevSk(null);
      invalidateOrganizations();
      await notifyMastersChanged();
    },
    onError: () => toast.error('Save failed'),
  });

  const toggleOrganizationMutation = useMutation({
    mutationFn: async (row: SalesOrganizationAdminRow) => {
      await apiFetch('/api/sales-forecasts/master-admin/organization-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: row.organizationName,
          address: row.address,
          isActive: !row.isActive,
          previousSk: row.sk,
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Updated');
      invalidateOrganizations();
      await notifyMastersChanged();
    },
    onError: () => toast.error('Update failed'),
  });

  const savePartMutation = useMutation({
    mutationFn: async (body: {
      organizationId: string;
      organizationName: string;
      partNumber: string;
      itemDescription: string;
      isActive: boolean;
      partId?: string;
    }) => {
      await apiFetch('/api/sales-forecasts/master-admin/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      toast.success('Part number saved');
      setPtNumber('');
      setPtDesc('');
      setPtActive(true);
      setPtEditPartId(null);
      invalidateParts();
      await notifyMastersChanged();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
    },
  });

  const togglePartMutation = useMutation({
    mutationFn: async (row: SalesOrganizationPartRow) => {
      await apiFetch('/api/sales-forecasts/master-admin/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: row.organizationId,
          organizationName: row.organizationName,
          partNumber: row.partNumber,
          itemDescription: row.itemDescription,
          isActive: !row.isActive,
          partId: row.partId,
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Updated');
      invalidateParts();
      await notifyMastersChanged();
    },
    onError: () => toast.error('Update failed'),
  });

  const saveRatesMutation = useMutation({
    mutationFn: async (payload: ExchangeRatesMap) => {
      const data = await apiFetch('/api/sales-forecasts/rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, INR: 1 }),
      });
      return { INR: 1, ...(data?.data as ExchangeRatesMap) };
    },
    onSuccess: (nextRates) => {
      setRates(nextRates);
      toast.success('Currency rates saved');
      void invalidateRates();
    },
    onError: () => toast.error('Failed to save rates'),
  });

  const toggleItem = async (sk: string, value: string, isActive: boolean) => {
    setBusy(true);
    try {
      await toggleItemMutation.mutateAsync({ sk, value, isActive });
    } finally {
      setBusy(false);
    }
  };

  const addItem = async () => {
    const v = newValue.trim();
    if (!v) return;
    setBusy(true);
    try {
      await addItemMutation.mutateAsync(v);
    } finally {
      setBusy(false);
    }
  };

  const savePrincipal = async () => {
    const name = pName.trim();
    const code = pCode.trim().toUpperCase();
    if (!name || !code) {
      toast.error('Principal name and short code are required');
      return;
    }
    setBusy(true);
    try {
      await savePrincipalMutation.mutateAsync({
        principalName: name,
        shortCode: code,
        isActive: pActive,
        previousSk: pPrevSk || undefined,
      });
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
      await togglePrincipalMutation.mutateAsync(row);
    } finally {
      setBusy(false);
    }
  };

  const saveOrganization = async () => {
    const name = oName.trim();
    const address = oAddress.trim();
    if (!name || !address) {
      toast.error('Customer organization and address are required');
      return;
    }
    setBusy(true);
    try {
      await saveOrganizationMutation.mutateAsync({
        organizationName: name,
        address,
        isActive: oActive,
        previousSk: oPrevSk || undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const editOrganization = (row: SalesOrganizationAdminRow) => {
    setOName(row.organizationName);
    setOAddress(row.address);
    setOActive(row.isActive);
    setOPrevSk(row.sk);
  };

  const toggleOrganization = async (row: SalesOrganizationAdminRow) => {
    setBusy(true);
    try {
      await toggleOrganizationMutation.mutateAsync(row);
    } finally {
      setBusy(false);
    }
  };

  const resetPartForm = () => {
    setPtNumber('');
    setPtDesc('');
    setPtActive(true);
    setPtEditPartId(null);
  };

  const savePart = async () => {
    if (!selectedOrganizationId) {
      toast.error('Select a customer organization first');
      return;
    }
    const num = ptNumber.trim();
    const desc = ptDesc.trim();
    if (!num || !desc) {
      toast.error('Part number and item description are required');
      return;
    }
    const organization = organizations.find((o) => o.sk === selectedOrganizationId);
    if (!organization) {
      toast.error('Customer organization not found');
      return;
    }
    setBusy(true);
    try {
      await savePartMutation.mutateAsync({
        organizationId: selectedOrganizationId,
        organizationName: organization.organizationName,
        partNumber: num,
        itemDescription: desc,
        isActive: ptActive,
        partId: ptEditPartId || undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const editPart = (row: SalesOrganizationPartRow) => {
    setPtNumber(row.partNumber);
    setPtDesc(row.itemDescription);
    setPtActive(row.isActive);
    setPtEditPartId(row.partId);
  };

  const togglePart = async (row: SalesOrganizationPartRow) => {
    setBusy(true);
    try {
      await togglePartMutation.mutateAsync(row);
    } finally {
      setBusy(false);
    }
  };

  const resetModelForm = () => {
    setMNumber('');
    setMDesc('');
    setMActive(true);
    setMEditModelId(null);
  };

  const saveModel = async () => {
    if (!selectedPrincipalId) {
      toast.error('Select a principal first');
      return;
    }
    const num = mNumber.trim();
    const desc = mDesc.trim();
    if (!num || !desc) {
      toast.error('Model number and product description are required');
      return;
    }
    const principal = principals.find((p) => p.sk === selectedPrincipalId);
    if (!principal) {
      toast.error('Principal not found');
      return;
    }
    setBusy(true);
    try {
      await saveModelMutation.mutateAsync({
        principalId: selectedPrincipalId,
        principalName: principal.principalName,
        modelNumber: num,
        productDescription: desc,
        isActive: mActive,
        modelId: mEditModelId || undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const editModel = (row: SalesPrincipalModelRow) => {
    setMNumber(row.modelNumber);
    setMDesc(row.productDescription);
    setMActive(row.isActive);
    setMEditModelId(row.modelId);
  };

  const toggleModel = async (row: SalesPrincipalModelRow) => {
    setBusy(true);
    try {
      await toggleModelMutation.mutateAsync(row);
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
      await saveRatesMutation.mutateAsync(rates);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 pb-8">
      <Card className="overflow-hidden border-gray-200 shadow-sm">
        <Tabs value={sectionTab} onValueChange={setSectionTab} className="flex w-full flex-col">
          <div className="border-b border-gray-100 bg-white px-4 py-3 sm:px-6">
            <TabsList className="!grid h-auto min-h-9 w-full max-w-4xl grid-cols-3 gap-1 sm:grid-cols-6 sm:gap-0">
              <TabsTrigger value="lists">Lists</TabsTrigger>
              <TabsTrigger value="organizations">Organizations</TabsTrigger>
              <TabsTrigger value="parts">Part No.</TabsTrigger>
              <TabsTrigger value="principals">Principals</TabsTrigger>
              <TabsTrigger value="models">Models</TabsTrigger>
              <TabsTrigger value="rates">FX rates</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="lists"
            className="mt-0 space-y-6 p-4 outline-none data-[state=inactive]:hidden sm:p-6"
          >
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <select
                  className="border-input bg-background h-10 w-full min-w-[200px] rounded-md border px-3 text-sm"
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
              <div className="flex min-w-[280px] flex-1 flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1 space-y-2">
                  <Label htmlFor="list-new-value">New value</Label>
                  <Input
                    id="list-new-value"
                    placeholder="Enter new value"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={() => void addItem()} disabled={busy}>
                  Add
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/90 hover:bg-gray-50/90">
                    <TableHead>Value</TableHead>
                    <TableHead className="w-[140px] text-center">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground py-10 text-center">
                        No items in this category.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((row: SalesMasterAdminItem) => (
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

          <TabsContent
            value="organizations"
            className="mt-0 space-y-6 p-4 outline-none data-[state=inactive]:hidden sm:p-6"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Customer Organization</Label>
                <Input
                  value={oName}
                  onChange={(e) => setOName(e.target.value)}
                  placeholder="e.g. Acme Industries"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input
                  value={oAddress}
                  onChange={(e) => setOAddress(e.target.value)}
                  placeholder="e.g. 123 Industrial Area, Pune"
                />
              </div>
              <div className="flex flex-wrap items-end gap-3 lg:col-span-4">
                <div className="flex items-center gap-2 pb-2">
                  <Switch checked={oActive} onCheckedChange={setOActive} id="o-act" />
                  <Label htmlFor="o-act" className="font-normal">
                    Active
                  </Label>
                </div>
                <Button type="button" onClick={() => void saveOrganization()} disabled={busy}>
                  {oPrevSk ? 'Update' : 'Add'}
                </Button>
                {oPrevSk ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => (setOPrevSk(null), setOName(''), setOAddress(''), setOActive(true))}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/90 hover:bg-gray-50/90">
                    <TableHead>Customer Organization</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="w-[120px] text-center">Active</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                        No customer organizations defined yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    organizations.map((row: SalesOrganizationAdminRow) => (
                      <TableRow key={row.sk}>
                        <TableCell>{row.organizationName}</TableCell>
                        <TableCell>{row.address}</TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={row.isActive}
                            disabled={busy}
                            onCheckedChange={() => void toggleOrganization(row)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => editOrganization(row)}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent
            value="parts"
            className="mt-0 space-y-6 p-4 outline-none data-[state=inactive]:hidden sm:p-6"
          >
            <div className="max-w-md space-y-2">
              <Label htmlFor="parts-organization">Customer Organization</Label>
              <select
                id="parts-organization"
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                value={selectedOrganizationId}
                onChange={(e) => {
                  setSelectedOrganizationId(e.target.value);
                  resetPartForm();
                }}
              >
                <option value="">Select Customer Organization…</option>
                {activeOrganizations.map((o) => (
                  <option key={o.sk} value={o.sk}>
                    {o.organizationName}
                  </option>
                ))}
              </select>
            </div>

            {selectedOrganizationId ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="part-number">Part Number</Label>
                    <Input
                      id="part-number"
                      value={ptNumber}
                      onChange={(e) => setPtNumber(e.target.value)}
                      placeholder="e.g. AHI-100"
                      className="font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="part-desc">Item Description</Label>
                    <Input
                      id="part-desc"
                      value={ptDesc}
                      onChange={(e) => setPtDesc(e.target.value)}
                      placeholder="e.g. Precision Measuring Instrument"
                    />
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex items-center gap-2 pb-2">
                      <Switch checked={ptActive} onCheckedChange={setPtActive} id="pt-act" />
                      <Label htmlFor="pt-act" className="font-normal">
                        Active
                      </Label>
                    </div>
                    <Button type="button" onClick={() => void savePart()} disabled={busy}>
                      {ptEditPartId ? 'Update' : 'Add'}
                    </Button>
                    {ptEditPartId ? (
                      <Button type="button" variant="outline" onClick={resetPartForm}>
                        Cancel edit
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/90 hover:bg-gray-50/90">
                        <TableHead>Part Number</TableHead>
                        <TableHead>Item Description</TableHead>
                        <TableHead className="w-[120px] text-center">Active</TableHead>
                        <TableHead className="w-[140px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partsQuery.isPending ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                            Loading part numbers…
                          </TableCell>
                        </TableRow>
                      ) : parts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                            No part numbers for this customer organization yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        parts.map((row: SalesOrganizationPartRow) => (
                          <TableRow key={row.partId}>
                            <TableCell className="font-mono text-sm">{row.partNumber}</TableCell>
                            <TableCell>{row.itemDescription}</TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={row.isActive}
                                disabled={busy}
                                onCheckedChange={() => void togglePart(row)}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button type="button" variant="outline" size="sm" onClick={() => editPart(row)}>
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a customer organization to manage part numbers.
              </p>
            )}
          </TabsContent>

          <TabsContent
            value="principals"
            className="mt-0 space-y-6 p-4 outline-none data-[state=inactive]:hidden sm:p-6"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Principal name</Label>
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

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/90 hover:bg-gray-50/90">
                    <TableHead>Principal</TableHead>
                    <TableHead className="w-[120px]">Code</TableHead>
                    <TableHead className="w-[120px] text-center">Active</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {principals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                        No principals defined yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    principals.map((row: SalesPrincipalAdminRow) => (
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent
            value="models"
            className="mt-0 space-y-6 p-4 outline-none data-[state=inactive]:hidden sm:p-6"
          >
            <div className="max-w-md space-y-2">
              <Label htmlFor="models-principal">Principal</Label>
              <select
                id="models-principal"
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                value={selectedPrincipalId}
                onChange={(e) => {
                  setSelectedPrincipalId(e.target.value);
                  resetModelForm();
                }}
              >
                <option value="">Select principal…</option>
                {activePrincipals.map((p) => (
                  <option key={p.sk} value={p.sk}>
                    {p.principalName}
                  </option>
                ))}
              </select>
            </div>

            {selectedPrincipalId ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="model-number">Model number</Label>
                    <Input
                      id="model-number"
                      value={mNumber}
                      onChange={(e) => setMNumber(e.target.value)}
                      placeholder="e.g. AHI-100"
                      className="font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="model-desc">Product description</Label>
                    <Input
                      id="model-desc"
                      value={mDesc}
                      onChange={(e) => setMDesc(e.target.value)}
                      placeholder="e.g. Precision Measuring Instrument"
                    />
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex items-center gap-2 pb-2">
                      <Switch checked={mActive} onCheckedChange={setMActive} id="m-act" />
                      <Label htmlFor="m-act" className="font-normal">
                        Active
                      </Label>
                    </div>
                    <Button type="button" onClick={() => void saveModel()} disabled={busy}>
                      {mEditModelId ? 'Update' : 'Add'}
                    </Button>
                    {mEditModelId ? (
                      <Button type="button" variant="outline" onClick={resetModelForm}>
                        Cancel edit
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/90 hover:bg-gray-50/90">
                        <TableHead>Model number</TableHead>
                        <TableHead>Product description</TableHead>
                        <TableHead className="w-[120px] text-center">Active</TableHead>
                        <TableHead className="w-[140px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modelsQuery.isPending ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                            Loading models…
                          </TableCell>
                        </TableRow>
                      ) : models.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                            No models for this principal yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        models.map((row: SalesPrincipalModelRow) => (
                          <TableRow key={row.modelId}>
                            <TableCell className="font-mono text-sm">{row.modelNumber}</TableCell>
                            <TableCell>{row.productDescription}</TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={row.isActive}
                                disabled={busy}
                                onCheckedChange={() => void toggleModel(row)}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button type="button" variant="outline" size="sm" onClick={() => editModel(row)}>
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a principal to manage models.</p>
            )}
          </TabsContent>

          <TabsContent
            value="rates"
            className="mt-0 p-4 outline-none data-[state=inactive]:hidden sm:p-6"
          >
            <form
              className="mx-auto max-w-md space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveRates();
              }}
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
                    className={cn(rateErrors[key] ? 'border-red-500' : '')}
                  />
                  {rateErrors[key] ? <p className="text-sm text-red-600">{rateErrors[key]}</p> : null}
                </div>
              ))}
              <Button type="submit" disabled={busy}>
                Save rates
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
