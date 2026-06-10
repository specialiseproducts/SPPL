import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Download, Search, Edit, Trash2, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Table, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { VirtualizedTableBody } from './ui/VirtualizedTableBody';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';
import { toast } from 'sonner';
import type { UserRole } from '../App';
import { apiFetch } from '../services/api';
import { fetchSalesOpportunityById } from '../hooks/sales/salesApi';
import { useSalesData } from '../hooks/sales/SalesDataContext';
import {
  useInvalidateSalesForecasts,
  useInvalidateSalesMasters,
} from '../hooks/sales/useSalesQueries';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
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
  viewScope = 'self',
}: SalesForecastingTabProps) {
  const invalidateForecasts = useInvalidateSalesForecasts();
  const invalidateMasters = useInvalidateSalesMasters();

  const privileged = canModerateSales(userRole);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const { bootstrapQuery, forecastsQuery, opportunities: rows, masters, rates, isColdLoading } =
    useSalesData();
  const isInitialLoading = isColdLoading;

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<SalesOpportunity | null>(null);
  const [detailRecord, setDetailRecord] = useState<SalesOpportunity | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [wfFilter, setWfFilter] = useState<string>('all');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const canCreateRecords = canCreate(userRole);
  const canEditRecords = canEdit(userRole);
  const canDeleteRecords = canDelete(userRole);
  const canExportRecords = canExport(userRole);

  useEffect(() => {
    if (bootstrapQuery.isError && bootstrapQuery.data === undefined) {
      console.error('Sales bootstrap error:', bootstrapQuery.error);
      toast.error('Failed to load sales forecasting data');
    }
    if (forecastsQuery.isError && forecastsQuery.data === undefined) {
      console.error('Sales forecasts error:', forecastsQuery.error);
      toast.error('Failed to load opportunities');
    }
  }, [bootstrapQuery.isError, bootstrapQuery.error, bootstrapQuery.data, forecastsQuery.isError, forecastsQuery.error, forecastsQuery.data]);

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
    if (!debouncedSearch.trim()) return list;
    const q = debouncedSearch.toLowerCase();
    return list.filter((r) => {
      const blob = [
        r.quotationRef,
        r.customerOrganization,
        r.principal,
        r.opportunityStatus,
        r.ownerEmployeeName,
        r.ownerEmployeeCode,
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [scopedRows, debouncedSearch, wfFilter]);

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

  const openEdit = async (r: SalesOpportunity) => {
    const teamApprovedEdit = showTeamModerationActions && r.workflowStatus === 'approved';
    if (isQuotationLocked(r) && !teamApprovedEdit) {
      toast.error('Approved quotations cannot be edited');
      return;
    }
    try {
      const full = await fetchSalesOpportunityById(r.forecastId);
      setEditing(full);
      setFormOpen(true);
      setDetailOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Could not load opportunity for editing');
    }
  };

  const openDetail = async (r: SalesOpportunity) => {
    try {
      const full = await fetchSalesOpportunityById(r.forecastId);
      setDetailRecord(full);
      setDetailOpen(true);
    } catch (e) {
      console.error(e);
      toast.error('Could not load opportunity details');
    }
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
          <div ref={tableScrollRef} className="overflow-auto max-h-[calc(100vh-320px)]">
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
              <VirtualizedTableBody
                parentRef={tableScrollRef}
                rows={filtered}
                colSpan={11}
                isLoading={isInitialLoading}
                loadingMessage="Loading opportunities…"
                emptyMessage="No opportunities match your filters."
                getRowKey={(r) => r.forecastId}
                getRowClassName={(r) =>
                  cn('group border-b border-gray-100', getDeadlineStatus(r).rowClassName || 'hover:bg-gray-50/90')
                }
                renderCells={(r, i) => {
                    const deadline = getDeadlineStatus(r);
                    return (
                    <>
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
                          {canEditRecords &&
                            ((showEditAction && canEditRow(r, userRole, currentEmployeeCode)) ||
                              (showTeamModerationActions && r.workflowStatus === 'approved')) && (
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
                    </>
                    );
                }}
              />
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/50 px-4 py-3 text-sm text-gray-600">
            <span>
              Showing <span className="font-medium text-[#212529]">{filtered.length}</span> loaded
              {scopedRows.length > filtered.length ? ` (${scopedRows.length} total loaded)` : ''}
            </span>
            {forecastsQuery.hasNextPage && (
              <Button
                variant="outline"
                size="sm"
                disabled={forecastsQuery.isFetchingNextPage}
                onClick={() => void forecastsQuery.fetchNextPage()}
              >
                {forecastsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
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
          viewScope={viewScope}
          canEdit={
            !!detailRecord &&
            canEditRecords &&
            (viewScope === 'self'
              ? isOwnQuotation(detailRecord, currentEmployeeCode) &&
                (detailRecord.workflowStatus === 'draft' ||
                  detailRecord.workflowStatus === 'pending_approval' ||
                  detailRecord.workflowStatus === 'rejected')
              : false)
          }
          onEdit={() => {
            if (detailRecord) openEdit(detailRecord);
          }}
      />
    </TooltipProvider>
  );
}
