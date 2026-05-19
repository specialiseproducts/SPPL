import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Download, Search, Edit, Trash2, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';
import { toast } from 'sonner';
import type { UserRole } from '../App';
import type { UserMaster } from './UserCreationTab';
import { apiFetch } from '../services/api';
import { DEFAULT_EXCHANGE_RATES, emptyMastersState } from '../hooks/sales/salesApi';
import {
  useInvalidateSalesForecasts,
  useInvalidateSalesMasters,
  useSalesForecastsQuery,
  useSalesMastersQuery,
  useSalesRatesQuery,
} from '../hooks/sales/useSalesQueries';
import { canCreate, canDelete, canEdit, canExport, isAdmin, isDeveloper, isSuperAdmin } from '../utils/accessControl';
import type { SalesOpportunity, SalesWorkflowStatus } from '../types/salesForecast';
import { isQuotationLocked } from '../utils/salesForecastCalculations';
import { getDeadlineStatus } from '../utils/salesDeadlineStatus';
import QuotationDeadlineBadge from './sales/QuotationDeadlineBadge';
import SalesForecastingOpportunityFormModal from './sales/SalesForecastingOpportunityFormModal';
import SalesForecastingDetailModal from './sales/SalesForecastingDetailModal';

export type SalesForecastingViewScope = 'self' | 'team';

interface SalesForecastingTabProps {
  userRole: UserRole;
  currentUserName: string;
  currentEmployeeCode: string;
  availableUsers: UserMaster[];
  /** `self`: own quotations (enforced client-side for admins). `team`: all quotations — admin/developer only. */
  viewScope?: SalesForecastingViewScope;
}

function workflowBadge(ws: SalesWorkflowStatus) {
  switch (ws) {
    case 'approved':
      return (
        <Badge className="border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">Approved</Badge>
      );
    case 'rejected':
      return <Badge className="border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">Rejected</Badge>;
    case 'pending_approval':
      return (
        <Badge className="border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
          Pending approval
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700">
          Draft
        </Badge>
      );
  }
}

function canModerateSales(role: UserRole) {
  return isAdmin(role) || isSuperAdmin(role) || isDeveloper(role);
}

function canEditRow(row: SalesOpportunity, role: UserRole, employeeCode: string) {
  if (isQuotationLocked(row)) return false;
  if (canModerateSales(role)) return true;
  const own =
    String(row.ownerEmployeeCode || '').trim() === String(employeeCode || '').trim() ||
    String(row.createdByEmployeeCode || '').trim() === String(employeeCode || '').trim();
  if (!own) return false;
  if (row.workflowStatus === 'draft' || row.workflowStatus === 'rejected') return true;
  return false;
}

function canViewDetail() {
  return true;
}

function isOwnQuotation(row: SalesOpportunity, employeeCode: string) {
  const c = String(employeeCode || '').trim();
  return (
    String(row.ownerEmployeeCode || '').trim() === c || String(row.createdByEmployeeCode || '').trim() === c
  );
}

export default function SalesForecastingTab({
  userRole,
  currentUserName: _currentUserName,
  currentEmployeeCode,
  availableUsers,
  viewScope = 'self',
}: SalesForecastingTabProps) {
  const invalidateForecasts = useInvalidateSalesForecasts();
  const invalidateMasters = useInvalidateSalesMasters();

  const forecastsQuery = useSalesForecastsQuery();
  const mastersQuery = useSalesMastersQuery();
  const ratesQuery = useSalesRatesQuery();

  const rows = forecastsQuery.data ?? [];
  const masters = mastersQuery.data ?? emptyMastersState();
  const rates = ratesQuery.data ?? DEFAULT_EXCHANGE_RATES;

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<SalesOpportunity | null>(null);
  const [detailRecord, setDetailRecord] = useState<SalesOpportunity | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [wfFilter, setWfFilter] = useState<string>('all');

  const privileged = canModerateSales(userRole);
  const canCreateRecords = canCreate(userRole);
  const canEditRecords = canEdit(userRole);
  const canDeleteRecords = canDelete(userRole);
  const canExportRecords = canExport(userRole);

  useEffect(() => {
    const loadFailed =
      (forecastsQuery.isError || mastersQuery.isError || ratesQuery.isError) &&
      forecastsQuery.data === undefined &&
      mastersQuery.data === undefined;
    if (loadFailed) {
      toast.error('Failed to load sales forecasting data');
    }
  }, [
    forecastsQuery.isError,
    mastersQuery.isError,
    ratesQuery.isError,
    forecastsQuery.data,
    mastersQuery.data,
  ]);

  const scopedRows = useMemo(() => {
    if (privileged && viewScope === 'self') {
      return rows.filter((r) => isOwnQuotation(r, currentEmployeeCode));
    }
    return rows;
  }, [rows, privileged, viewScope, currentEmployeeCode]);

  const filtered = useMemo(() => {
    let list = scopedRows;
    if (wfFilter !== 'all') {
      list = list.filter((r) => r.workflowStatus === wfFilter);
    }
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter((r) => {
      const blob = [
        r.quotationRef,
        r.customerOrganization,
        r.principal,
        r.modelNumber,
        r.opportunityStatus,
        r.ownerEmployeeName,
        r.contactFullName,
        r.contactEmail,
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [scopedRows, searchTerm, wfFilter]);

  const showTeamModerationActions = privileged && viewScope === 'team';
  const showCreateQuotation = canCreateRecords && viewScope !== 'team';
  const showEditAction = viewScope !== 'team';

  const actionsColClass = showTeamModerationActions
    ? 'w-[248px] min-w-[248px] whitespace-nowrap'
    : 'w-[176px] min-w-[176px] whitespace-nowrap';

  const forecastPath = (id: string) => `/api/sales-forecasts/${encodeURIComponent(id)}`;

  const approveMutation = useMutation({
    mutationFn: (forecastId: string) =>
      apiFetch(`/api/sales-forecasts/${encodeURIComponent(forecastId)}/approve`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Approved');
      void invalidateForecasts();
    },
    onError: (e) => {
      console.error(e);
      toast.error('Could not approve this quotation.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ forecastId, remarks }: { forecastId: string; remarks: string }) =>
      apiFetch(`/api/sales-forecasts/${encodeURIComponent(forecastId)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks }),
      }),
    onSuccess: () => {
      toast.success('Rejected');
      void invalidateForecasts();
    },
    onError: (e) => {
      console.error(e);
      toast.error('Could not reject this quotation.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (forecastId: string) => apiFetch(forecastPath(forecastId), { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Deleted');
      void invalidateForecasts();
    },
    onError: (e) => {
      console.error(e);
      toast.error('Could not delete this opportunity.');
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async ({
      payload,
      forecastId,
    }: {
      payload: Record<string, unknown>;
      forecastId?: string;
    }) => {
      if (forecastId) {
        await apiFetch(forecastPath(forecastId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/sales-forecasts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, mode: 'draft' }),
        });
      }
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.forecastId ? 'Draft saved' : 'Draft created');
      void invalidateForecasts();
      void invalidateMasters();
    },
    onError: (e) => {
      console.error(e);
      toast.error('Could not save draft.');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async ({
      payload,
      forecastId,
    }: {
      payload: Record<string, unknown>;
      forecastId?: string;
    }) => {
      if (forecastId) {
        await apiFetch(forecastPath(forecastId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        await apiFetch(`/api/sales-forecasts/${encodeURIComponent(forecastId)}/submit`, {
          method: 'POST',
        });
      } else {
        await apiFetch('/api/sales-forecasts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, mode: 'submit' }),
        });
      }
    },
    onSuccess: () => {
      toast.success('Submitted for approval');
      void invalidateForecasts();
      void invalidateMasters();
    },
    onError: (e) => {
      console.error(e);
      toast.error('Could not submit for approval.');
    },
  });

  const approveFromTable = (r: SalesOpportunity) => {
    approveMutation.mutate(r.forecastId);
  };

  const rejectFromTable = (r: SalesOpportunity) => {
    const remarks = window.prompt('Rejection remarks (optional)', '');
    if (remarks === null) return;
    rejectMutation.mutate({ forecastId: r.forecastId, remarks });
  };

  const handleSaveDraft = async (payload: Record<string, unknown>) => {
    await saveDraftMutation.mutateAsync({
      payload,
      forecastId: editing?.forecastId,
    });
  };

  const handleSubmitForApproval = async (payload: Record<string, unknown>) => {
    await submitMutation.mutateAsync({
      payload,
      forecastId: editing?.forecastId,
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this opportunity?')) return;
    deleteMutation.mutate(id);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (r: SalesOpportunity) => {
    if (isQuotationLocked(r)) {
      toast.error('Approved quotations cannot be edited');
      return;
    }
    setEditing(r);
    setFormOpen(true);
    setDetailOpen(false);
  };

  const openDetail = (r: SalesOpportunity) => {
    setDetailRecord(r);
    setDetailOpen(true);
  };

  const handleExport = () => {
    const headers = [
      'QuotationRef',
      'Workflow',
      'Customer',
      'ContactTitle',
      'ContactName',
      'ContactEmail',
      'Principal',
      'INRValue',
      'Probability',
      'Owner',
      'Updated',
    ];
    const lines = [
      headers.join(','),
      ...filtered.map((r) =>
        [
          r.quotationRef,
          r.workflowStatus,
          r.customerOrganization,
          r.contactTitle,
          r.contactFullName,
          r.contactEmail,
          r.principal,
          r.inrValueExclGst,
          r.probabilityLabel,
          r.ownerEmployeeName,
          r.updatedAt,
        ]
          .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_opportunities_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export started');
  };

  return (
    <TooltipProvider>
      <Card className="border-gray-200 p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3">
                <Select value={wfFilter} onValueChange={setWfFilter}>
                  <SelectTrigger className="h-9 w-full max-w-[240px] shrink-0 border-gray-200 bg-white sm:h-10 sm:w-[240px]">
                    <SelectValue placeholder="Workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All workflow states</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending_approval">Pending approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative min-h-9 min-w-0 flex-1 sm:min-h-10">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="h-9 w-full min-w-0 border-gray-200 bg-white pl-10 sm:h-10 md:max-w-xl md:text-sm"
                    placeholder="Search quotation ref, customer, principal, model, owner…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {canExportRecords && (
                  <Button onClick={handleExport} variant="outline" className="gap-2 border-gray-200">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                )}
                {showCreateQuotation && (
                  <Button onClick={openCreate} className="gap-2 bg-[#007BFF] hover:bg-[#0056b3]">
                    <Plus className="h-4 w-4" />
                    Create New Quotation
                  </Button>
                )}
              </div>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table className="min-w-[1380px]">
              <TableHeader>
                <TableRow className="border-b border-gray-200 bg-gray-50/90 hover:bg-gray-50/90">
                  <TableHead className="w-10 whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">#</TableHead>
                  <TableHead className="w-[108px] whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Workflow</TableHead>
                  <TableHead className="min-w-[132px] whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Quotation ref
                  </TableHead>
                  <TableHead className="min-w-[150px] max-w-[220px] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Customer</TableHead>
                  <TableHead className="min-w-[110px] max-w-[180px] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Principal</TableHead>
                  <TableHead className="w-[120px] whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                    INR (ex GST)
                  </TableHead>
                  <TableHead className="min-w-[128px] max-w-[200px] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Probability</TableHead>
                  <TableHead className="min-w-[172px] whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Deadline Status
                  </TableHead>
                  <TableHead className="min-w-[112px] max-w-[160px] whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Owner</TableHead>
                  <TableHead className="min-w-[148px] whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Updated</TableHead>
                  <TableHead
                    className={cn(
                      actionsColClass,
                      'px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600',
                    )}
                  >
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-14 text-center text-sm text-gray-500">
                      No opportunities match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r, i) => {
                    const deadline = getDeadlineStatus(r);
                    return (
                    <TableRow
                      key={r.forecastId}
                      className={cn(
                        'group border-b border-gray-100',
                        deadline.rowClassName || 'hover:bg-gray-50/90',
                      )}
                    >
                      <TableCell className="px-3 py-3 text-sm text-gray-600">{i + 1}</TableCell>
                      <TableCell className="px-3 py-3">{workflowBadge(r.workflowStatus)}</TableCell>
                      <TableCell className="px-3 py-3 font-mono text-sm font-semibold text-[#007BFF]">
                        {r.quotationRef || <span className="font-sans font-normal text-gray-400">—</span>}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate px-3 py-3 text-sm text-[#212529]" title={r.customerOrganization || undefined}>
                        {r.customerOrganization || '—'}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate px-3 py-3 text-sm text-gray-700" title={r.principal || undefined}>
                        {r.principal || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-[#212529]">
                        {r.inrValueExclGst != null ? `₹ ${Number(r.inrValueExclGst).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate px-3 py-3 text-xs text-gray-700 sm:text-sm" title={String(r.probabilityLabel || r.probabilityPercent || '')}>
                        {r.probabilityLabel || r.probabilityPercent || '—'}
                      </TableCell>
                      <TableCell className="min-w-[172px] whitespace-nowrap px-4 py-3">
                        <QuotationDeadlineBadge deadline={deadline} />
                      </TableCell>
                      <TableCell
                        className="min-w-[112px] max-w-[160px] truncate whitespace-nowrap px-4 py-3 text-sm text-gray-700"
                        title={r.ownerEmployeeName || r.ownerEmployeeCode || undefined}
                      >
                        {r.ownerEmployeeName || r.ownerEmployeeCode || '—'}
                      </TableCell>
                      <TableCell className="min-w-[148px] whitespace-nowrap px-4 py-3 text-xs text-gray-500 sm:text-sm">
                        {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className={cn(actionsColClass, 'px-2 py-2 text-right')}>
                        <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1">
                          {canViewDetail() && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-600 hover:text-[#007BFF]" onClick={() => openDetail(r)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View</TooltipContent>
                            </Tooltip>
                          )}
                          {showTeamModerationActions && r.workflowStatus === 'pending_approval' && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => void approveFromTable(r)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Approve</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0 border-red-200 text-red-700 hover:bg-red-50"
                                    onClick={() => void rejectFromTable(r)}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Reject</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                          {showEditAction && canEditRecords && canEditRow(r, userRole, currentEmployeeCode) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-600 hover:text-[#007BFF]" onClick={() => openEdit(r)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          )}
                          {canDeleteRecords &&
                            (privileged || r.workflowStatus !== 'pending_approval') &&
                            canEditRow(r, userRole, currentEmployeeCode) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:bg-red-50" onClick={() => handleDelete(r.forecastId)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 text-sm text-gray-600">
            Showing <span className="font-medium text-[#212529]">{filtered.length}</span> of{' '}
            <span className="font-medium text-[#212529]">{scopedRows.length}</span> records
          </div>
        </div>
      </Card>

      <SalesForecastingOpportunityFormModal
          isOpen={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          editing={editing}
          masters={masters}
          rates={rates}
          availableUsers={availableUsers}
          onSaveDraft={handleSaveDraft}
          onSubmitForApproval={handleSubmitForApproval}
      />

      <SalesForecastingDetailModal
          isOpen={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailRecord(null);
          }}
          record={detailRecord}
          canModerate={privileged}
          canEdit={
            showEditAction &&
            !!detailRecord &&
            canEditRecords &&
            canEditRow(detailRecord, userRole, currentEmployeeCode)
          }
          onApprove={async () => {
            if (!detailRecord) return;
            await approveMutation.mutateAsync(detailRecord.forecastId);
          }}
          onReject={async (remarks) => {
            if (!detailRecord) return;
            await rejectMutation.mutateAsync({
              forecastId: detailRecord.forecastId,
              remarks,
            });
          }}
          onEdit={() => {
            if (detailRecord) openEdit(detailRecord);
          }}
      />
    </TooltipProvider>
  );
}
