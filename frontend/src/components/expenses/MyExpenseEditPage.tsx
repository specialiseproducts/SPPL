import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { apiFetch } from '../../services/api';
import {
  createExpenseRecord,
  fetchExpenseFullDetails,
  updateExpenseRecord,
} from '../../hooks/expenses/expensesApi';
import { useInvalidateExpensesList } from '../../hooks/expenses/useExpensesQueries';
import {
  clearMyExpenseCreateDraft,
  navigateBackToMyExpenses,
  peekMyExpenseCreateDraft,
} from '../../utils/myExpenseNavigation';
import type { ExpenseDocument, ExpenseRecord } from '../../types/expenses';
import ExpenseEditFormPanel from './ExpenseEditFormPanel';
import { computeOutstationDuration } from '../../utils/expenseOutstation';

type PreviewPhase = 'idle' | 'loading' | 'ready' | 'no_attachment' | 'preview_failed';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? 'Request failed');
}

function isPdfFile(fileName?: string, fileUrl?: string): boolean {
  const hay = `${fileName ?? ''} ${fileUrl ?? ''}`.toLowerCase();
  return hay.includes('.pdf');
}

function isImageFile(fileName?: string, fileUrl?: string): boolean {
  const hay = `${fileName ?? ''} ${fileUrl ?? ''}`.toLowerCase();
  return /\.(jpe?g|png|webp|gif|bmp)(\?|$|#)/i.test(hay);
}

/** Match Audit Expenses detail page: use stored URL directly when it is already http(s). */
async function resolveDocumentPreviewUrl(
  fileUrl: string,
  expenseId: string,
): Promise<string> {
  const trimmed = String(fileUrl).trim();
  if (!trimmed) {
    throw new Error('Missing document URL');
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const key = trimmed.split('?')[0].split('#')[0].replace(/^\/+/, '');
  const params = new URLSearchParams({ key, expenseId });
  const data = await apiFetch(`/api/users/file-url?${params.toString()}`);
  if (!data?.success || !data?.url) {
    throw new Error(
      typeof data?.message === 'string' && data.message.trim()
        ? data.message
        : 'Failed to load document',
    );
  }
  return String(data.url);
}

type MyExpenseEditPageProps =
  | {
      mode: 'edit';
      expenseId: string;
      currentUserName: string;
    }
  | {
      mode: 'create';
      currentUserName: string;
    };

export default function MyExpenseEditPage(props: MyExpenseEditPageProps) {
  const { mode, currentUserName } = props;
  const expenseId = mode === 'edit' ? props.expenseId : '';
  const invalidateExpensesList = useInvalidateExpensesList();
  const [detailExpense, setDetailExpense] = useState<ExpenseRecord | null>(null);
  const [documents, setDocuments] = useState<ExpenseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>('idle');
  const [objectPreviewUrl, setObjectPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setDetailExpense(null);
      setDocuments([]);
      setPreviewUrl(null);
      setPreviewFileName('');
      setPreviewPhase('loading');

      if (mode === 'create') {
        const draft = peekMyExpenseCreateDraft();
        if (!draft) {
          if (!cancelled) {
            toast.error('No expense draft found. Please create a record again.');
            setLoading(false);
            navigateBackToMyExpenses();
          }
          return;
        }

        if (!cancelled) {
          setDetailExpense(draft);
          setDocuments(draft.documents ?? []);
        }

        if (draft.selectedFile) {
          const localUrl = URL.createObjectURL(draft.selectedFile);
          if (!cancelled) {
            setObjectPreviewUrl(localUrl);
            setPreviewUrl(localUrl);
            setPreviewFileName(draft.selectedFile.name);
            setPreviewPhase('ready');
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setPreviewPhase('no_attachment');
          setLoading(false);
        }
        return;
      }

      try {
        const { expense, documents: docs } = await fetchExpenseFullDetails(expenseId);
        if (cancelled) return;

        setDetailExpense(expense);
        setDocuments(docs);

        const selectedDocument = docs.length > 0 ? docs[0] : null;
        if (!selectedDocument?.fileUrl) {
          setPreviewPhase('no_attachment');
          return;
        }

        setPreviewFileName(selectedDocument.fileName || 'document');
        try {
          const preview = await resolveDocumentPreviewUrl(selectedDocument.fileUrl, expenseId);
          if (!cancelled) {
            setPreviewUrl(preview);
            setPreviewPhase('ready');
          }
        } catch (previewErr) {
          console.error('My expense document preview failed:', previewErr);
          if (!cancelled) {
            setPreviewPhase('preview_failed');
          }
        }
      } catch (loadErr) {
        console.error('My expense edit load failed:', loadErr);
        if (!cancelled) {
          toast.error(getErrorMessage(loadErr));
          setPreviewPhase('no_attachment');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [expenseId, mode]);

  useEffect(() => {
    return () => {
      if (objectPreviewUrl) {
        URL.revokeObjectURL(objectPreviewUrl);
      }
    };
  }, [objectPreviewUrl]);

  const handleCancel = () => {
    if (mode === 'create') {
      clearMyExpenseCreateDraft();
    }
    navigateBackToMyExpenses();
  };

  const handleSave = async (expense: ExpenseRecord) => {
    setSaving(true);
    try {
      if (mode === 'create') {
        await createExpenseRecord(expense);
        clearMyExpenseCreateDraft();
        void invalidateExpensesList();
        toast.success('Expense Record Created Successfully');
        navigateBackToMyExpenses();
        return;
      }

      await updateExpenseRecord(expense);
      void invalidateExpensesList();
      toast.success('Expense Record Updated Successfully');
      navigateBackToMyExpenses();
    } catch (error) {
      console.error(mode === 'create' ? 'Create expense error:' : 'Update expense error:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
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
    if (loading || previewPhase === 'loading' || previewPhase === 'idle') {
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
                console.error('My expense image preview failed to render');
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

  const pageTitle = mode === 'create' ? 'Review Expense Record' : 'Edit Expense Record';
  const outstationDuration =
    detailExpense?.outStation === 'Yes'
      ? computeOutstationDuration(
          detailExpense.arrivalDate || '',
          detailExpense.arrivalTime || '',
          detailExpense.departureDate || '',
          detailExpense.departureTime || '',
        )
      : null;

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
          onClick={handleCancel}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Expenses
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="expense-edit-form"
            className="bg-[#007BFF] hover:bg-[#0056b3]"
            disabled={loading || saving || !detailExpense}
          >
            {saving ? 'Saving…' : 'Save Record'}
          </Button>
        </div>
      </div>

      <h1 className="text-lg font-semibold text-[#212529]" style={{ flexShrink: 0 }}>
        {pageTitle}
      </h1>
      {detailExpense?.outStation === 'Yes' ? (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-[#212529]">
          <div className="font-medium">OutStation Travel Duration (Auto-calculated)</div>
          <div className="mt-1">
            Total Hours: {outstationDuration?.durationHours ?? detailExpense.durationHours ?? 0}
          </div>
          <div>
            Total Days: {outstationDuration?.durationDays ?? detailExpense.durationDays ?? 0}
          </div>
        </div>
      ) : null}

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
          style={{
            overflow: 'auto',
            height: '100%',
            minHeight: 0,
            paddingRight: '4px',
          }}
        >
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading expense details…</p>
          ) : detailExpense ? (
            <ExpenseEditFormPanel
              expense={detailExpense}
              documents={documents}
              enabled={!saving}
              currentUserName={currentUserName}
              onSubmit={(updated) => void handleSave(updated)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Expense could not be loaded.</p>
          )}
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
            <div className="border-b border-gray-200 px-6 py-4" style={{ flexShrink: 0 }}>
              <h2 className="text-base font-semibold text-[#212529]">Document Preview</h2>
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {renderPreviewPanel()}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
