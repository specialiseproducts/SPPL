import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
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
import { apiFetch } from '../../services/api';
import { normalizeExpenseRow } from '../../utils/expenseRowNormalize';
import {
  navigateBackToAuditExpenses,
  navigateToAuditExpenseDetail,
  peekAuditExpenseViewState,
} from '../../utils/auditExpenseNavigation';
import {
  approveExpenseAudit,
  rejectExpenseAudit,
  type AuditExpenseFilters,
} from '../../hooks/expenses/expensesApi';
import { useAuditExpenseDecisionInvalidation } from '../../hooks/expenses/useExpensesQueries';
import { findNextPendingAuditExpenseId } from '../../utils/auditExpensePendingQueue';
import type { ExpenseAuditDecision, ExpenseDocument, ExpenseRecord } from '../../types/expenses';

type PreviewPhase = 'idle' | 'loading' | 'ready' | 'no_attachment' | 'preview_failed';

function disp(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function ReadField({ label, value }: { label: string; value: unknown }) {
  const s = disp(value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input readOnly tabIndex={-1} className="bg-muted text-sm" value={s || '—'} />
    </div>
  );
}

function isPdfFile(fileName?: string, fileUrl?: string): boolean {
  const hay = `${fileName ?? ''} ${fileUrl ?? ''}`.toLowerCase();
  return hay.includes('.pdf');
}

function isImageFile(fileName?: string, fileUrl?: string): boolean {
  const hay = `${fileName ?? ''} ${fileUrl ?? ''}`.toLowerCase();
  return /\.(jpe?g|png|webp|gif|bmp)(\?|$|#)/i.test(hay);
}

async function fetchExpenseFullDetails(expenseId: string): Promise<{
  expense: ExpenseRecord;
  documents: ExpenseDocument[];
}> {
  const res = (await apiFetch(`/api/expenses/${encodeURIComponent(expenseId)}/full`)) as {
    success?: boolean;
    data?: {
      expense?: Record<string, unknown>;
      documents?: ExpenseDocument[];
    };
    message?: string;
  };

  if (!res?.success || !res.data?.expense) {
    throw new Error(
      typeof res?.message === 'string' && res.message.trim()
        ? res.message
        : 'Failed to load expense details',
    );
  }

  return {
    expense: normalizeExpenseRow(res.data.expense),
    documents: Array.isArray(res.data.documents) ? res.data.documents : [],
  };
}

interface AuditExpenseDetailPageProps {
  expenseId: string;
}

const approvedActionBadgeStyle = {
  background: '#ECFDF3',
  color: '#027A48',
  borderRadius: '9999px',
  padding: '4px 12px',
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
} as const;

const rejectedActionBadgeStyle = {
  background: '#FEF3F2',
  color: '#B42318',
  borderRadius: '9999px',
  padding: '4px 12px',
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
} as const;

export default function AuditExpenseDetailPage({ expenseId }: AuditExpenseDetailPageProps) {
  const queryClient = useQueryClient();
  const applyAuditDecision = useAuditExpenseDecisionInvalidation();
  const [detailExpense, setDetailExpense] = useState<ExpenseRecord | null>(null);
  const [auditStatus, setAuditStatus] = useState<ExpenseAuditDecision>('Pending');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>('idle');
  const [decisionCompleted, setDecisionCompleted] = useState(false);
  const [noMorePending, setNoMorePending] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setDetailExpense(null);
      setPreviewUrl(null);
      setPreviewFileName('');
      setPreviewPhase('loading');
      setDecisionCompleted(false);
      setNoMorePending(false);
      setNextLoading(false);

      try {
        const { expense, documents } = await fetchExpenseFullDetails(expenseId);
        if (cancelled) return;

        setDetailExpense(expense);
        setAuditStatus(expense.auditStatus ?? 'Pending');

        const selectedDocument = documents.length > 0 ? documents[0] : null;

        if (!selectedDocument?.fileUrl) {
          setPreviewPhase('no_attachment');
          return;
        }

        setPreviewFileName(selectedDocument.fileName || 'document');
        const preview = String(selectedDocument.fileUrl).trim();
        if (!cancelled) {
          setPreviewUrl(preview);
          setPreviewPhase('ready');
        }
      } catch (loadErr) {
        console.error('Audit expense full details load failed:', loadErr);
        if (!cancelled) {
          setPreviewPhase('no_attachment');
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [expenseId]);

  const resolveAuditFilters = (): AuditExpenseFilters => {
    const saved = peekAuditExpenseViewState();
    return {
      employeeId: saved?.employee ?? 'all',
      month: saved?.month ?? 'all',
      year: saved?.year ?? 'all',
    };
  };

  const approveMutation = useMutation({
    mutationFn: () => approveExpenseAudit(expenseId),
    onSuccess: (updated) => {
      setAuditStatus('Approved');
      setDetailExpense((prev) =>
        prev ? { ...prev, ...updated, auditStatus: 'Approved' } : updated,
      );
      setDecisionCompleted(true);
      setNoMorePending(false);
      applyAuditDecision(expenseId, 'Approved');
      toast.success('Expense approved');
    },
    onError: (error) => {
      console.error('Approve Expense Error:', error);
      toast.error('Could not approve this expense');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectExpenseAudit(expenseId, reason),
    onSuccess: (updated) => {
      setAuditStatus('Rejected');
      setDetailExpense((prev) =>
        prev ? { ...prev, ...updated, auditStatus: 'Rejected' } : updated,
      );
      setRejectDialogOpen(false);
      setRejectReason('');
      setDecisionCompleted(true);
      setNoMorePending(false);
      applyAuditDecision(expenseId, 'Rejected');
      toast.success('Expense rejected');
    },
    onError: (error) => {
      console.error('Reject Expense Error:', error);
      toast.error('Could not reject this expense');
    },
  });

  const handleNextPending = async () => {
    if (nextLoading) return;
    setNextLoading(true);
    try {
      const filters = resolveAuditFilters();
      const { nextId, exhausted } = await findNextPendingAuditExpenseId(
        queryClient,
        filters,
        expenseId,
      );
      if (nextId) {
        navigateToAuditExpenseDetail(nextId);
        return;
      }
      setNoMorePending(true);
      if (exhausted) {
        toast.message('No more pending expenses.');
      }
    } catch (err) {
      console.error('Next pending expense failed:', err);
      toast.error('Could not load the next pending expense');
    } finally {
      setNextLoading(false);
    }
  };

  const isPending = auditStatus === 'Pending';
  const showNextControls = decisionCompleted && !isPending;

  const renderAuditActions = () => {
    if (isPending) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-emerald-800 border-emerald-200 hover:bg-emerald-50"
            disabled={approveMutation.isPending || rejectMutation.isPending}
            onClick={() => approveMutation.mutate()}
          >
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={approveMutation.isPending || rejectMutation.isPending}
            onClick={() => {
              setRejectReason('');
              setRejectDialogOpen(true);
            }}
          >
            Reject
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        {auditStatus === 'Approved' ? (
          <span style={approvedActionBadgeStyle}>Approved</span>
        ) : auditStatus === 'Rejected' ? (
          <span style={rejectedActionBadgeStyle}>Rejected</span>
        ) : null}
        {showNextControls && !noMorePending ? (
          <Button
            type="button"
            size="sm"
            className="bg-[#007BFF] hover:bg-[#0056b3]"
            disabled={nextLoading}
            onClick={() => void handleNextPending()}
          >
            {nextLoading ? 'Loading…' : 'Next'}
          </Button>
        ) : null}
      </div>
    );
  };

  const isPdf = isPdfFile(previewFileName, previewUrl ?? undefined);
  const isImage = isImageFile(previewFileName, previewUrl ?? undefined);

  const previewAreaStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: '100%',
  };
  const previewAreaClass = 'w-full';

  const renderPreviewPanel = () => {
    if (previewPhase === 'loading' || previewPhase === 'idle') {
      return (
        <div className={`${previewAreaClass} text-sm text-gray-500`} style={previewAreaStyle}>
          Loading document…
        </div>
      );
    }

    if (previewPhase === 'ready' && previewUrl) {
      if (isPdf) {
        return (
          <iframe
            title="Supporting Document"
            src={previewUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        );
      }
      if (isImage) {
        return (
          <div className={previewAreaClass} style={previewAreaStyle}>
            <img
              src={previewUrl}
              alt="Supporting Document"
              className="max-h-full max-w-full object-contain"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={() => {
                console.error('Audit expense image preview failed to render');
                setPreviewPhase('preview_failed');
                setPreviewUrl(null);
              }}
            />
          </div>
        );
      }
      return (
        <iframe
          title="Supporting Document"
          src={previewUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      );
    }

    if (previewPhase === 'preview_failed') {
      return (
        <div
          className={`${previewAreaClass} px-6 text-center text-sm text-gray-500`}
          style={previewAreaStyle}
        >
          Document could not be loaded.
        </div>
      );
    }

    return (
      <div className={`${previewAreaClass} text-sm text-gray-500`} style={previewAreaStyle}>
        No document uploaded.
      </div>
    );
  };

  return (
    <div
      className="bg-[#F8F9FA] p-6"
      style={{
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-3"
        style={{ flexShrink: 0 }}
      >
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => navigateBackToAuditExpenses()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Audit Expenses
        </Button>
        {renderAuditActions()}
      </div>

      {showNextControls && noMorePending ? (
        <p className="mb-3 text-sm text-gray-600" style={{ flexShrink: 0 }}>
          No more pending expenses.
        </p>
      ) : null}

      <h1 className="text-[#212529] text-lg font-semibold" style={{ flexShrink: 0 }}>
        Expense Details
      </h1>

      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
          marginTop: '24px',
          display: 'grid',
          gridTemplateColumns: '35% 65%',
          gap: '24px',
          width: '100%',
          alignItems: 'stretch',
        }}
      >
        <div
          className="space-y-4"
          style={{
            overflow: 'hidden',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ReadField label="Employee Name" value={detailExpense?.employeeName} />
          <ReadField label="Date" value={detailExpense?.date} />
          <ReadField label="Bill Number" value={detailExpense?.billNumber} />
          {detailExpense?.companyGstIn === 'Yes' || detailExpense?.companyGstIn === 'No' ? (
            <ReadField
              label="Did you give Company GSTIN?"
              value={detailExpense.companyGstIn}
            />
          ) : null}
          <ReadField
            label={
              detailExpense?.currency === 'USD'
                ? 'Amount (USD $)'
                : detailExpense?.currency === 'GBP'
                  ? 'Amount (GBP £)'
                  : detailExpense?.currency === 'EUR'
                    ? 'Amount (EUR €)'
                    : 'Amount'
            }
            value={
              detailExpense?.amount != null && Number.isFinite(Number(detailExpense.amount))
                ? Number(detailExpense.amount).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : detailExpense?.amount
            }
          />
          <ReadField label="City" value={detailExpense?.location} />
          <ReadField label="Purpose" value={detailExpense?.purpose} />
          <ReadField label="Supporting Document" value={detailExpense?.supportingDocument} />
          <ReadField label="Month-Year" value={detailExpense?.monthYear} />
        </div>

        <div
          style={{
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Card
            className="gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white"
            style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            <div
              className="border-b border-gray-200 px-6 py-4"
              style={{ flexShrink: 0 }}
            >
              <h2 className="text-[#212529] text-base font-semibold">Document Preview</h2>
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {renderPreviewPanel()}
            </div>
          </Card>
        </div>
      </div>

      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          setRejectDialogOpen(open);
          if (!open) setRejectReason('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="audit-detail-reject-reason">Reason (Optional)</Label>
            <Textarea
              id="audit-detail-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Optional rejection reason"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(rejectReason)}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
