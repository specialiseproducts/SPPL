import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import type { ExpenseDocument, ExpenseRecord } from '../../types/expenses';
import { useExpenseFullDetails } from '../../hooks/expenses/useExpenseFullDetails';
import ExpenseDocumentPreviewPanel from './ExpenseDocumentPreviewPanel';
import ExpenseEditFormPanel from './ExpenseEditFormPanel';
import {
  EXPENSE_DETAILS_DIALOG_CLASS,
  EXPENSE_DETAILS_DIALOG_STYLE,
  ExpenseDetailsViewFields,
} from './expenseDetailsUi';

export type ExpenseDetailsMode = 'view' | 'edit';

interface ExpenseDetailsDialogProps {
  expense: ExpenseRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ExpenseDetailsMode;
  currentUserName?: string;
  onSave?: (expense: ExpenseRecord) => void | Promise<void>;
}

export function ExpenseDetailsBody({
  mode,
  expense,
  documents,
  loading,
  previewEnabled,
  currentUserName = '',
  onSave,
}: {
  mode: ExpenseDetailsMode;
  expense: ExpenseRecord;
  documents: ExpenseDocument[];
  loading: boolean;
  previewEnabled: boolean;
  currentUserName?: string;
  onSave?: (expense: ExpenseRecord) => void | Promise<void>;
}) {
  const resolvedDocuments = documents.length > 0 ? documents : expense.documents ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-row">
      <div className="flex w-[35%] shrink-0 flex-col overflow-y-auto border-r px-6 py-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading expense details…</p>
        ) : mode === 'view' ? (
          <div className="space-y-4">
            <ExpenseDetailsViewFields expense={expense} />
          </div>
        ) : onSave ? (
          <ExpenseEditFormPanel
            expense={expense}
            documents={resolvedDocuments}
            enabled={previewEnabled}
            currentUserName={currentUserName}
            onSubmit={onSave}
          />
        ) : null}
      </div>
      <div className="flex min-h-0 w-[65%] flex-1 flex-col overflow-y-auto px-6 py-5">
        <ExpenseDocumentPreviewPanel
          expenseId={expense.expenseId}
          documents={resolvedDocuments}
          enabled={previewEnabled && !loading}
        />
      </div>
    </div>
  );
}

export default function ExpenseDetailsDialog({
  expense,
  open,
  onOpenChange,
  mode,
  currentUserName = '',
  onSave,
}: ExpenseDetailsDialogProps) {
  const { detailExpense, documents, loading } = useExpenseFullDetails(expense, open && !!expense);

  if (!expense) return null;

  const display = detailExpense ?? expense;
  const title = mode === 'edit' ? 'Edit Expense Record' : 'Expense Details';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={EXPENSE_DETAILS_DIALOG_CLASS} style={EXPENSE_DETAILS_DIALOG_STYLE}>
        <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ExpenseDetailsBody
            mode={mode}
            expense={display}
            documents={documents}
            loading={loading}
            previewEnabled={open}
            currentUserName={currentUserName}
            onSave={onSave}
          />
        </div>

        {mode === 'edit' ? (
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="expense-edit-form"
              className="bg-[#007BFF] hover:bg-[#0056b3]"
            >
              Save Record
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
