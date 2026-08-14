import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { SalesOpportunity } from '../../types/salesForecast';

interface SalesQuotationProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: SalesOpportunity | null;
  statusOptions: string[];
  isSubmitting?: boolean;
  onSubmit: (payload: { keepCurrent: boolean; opportunityStatus?: string }) => void | Promise<void>;
  onRequestEditPermission?: () => void;
}

export default function SalesQuotationProgressModal({
  isOpen,
  onClose,
  record,
  statusOptions,
  isSubmitting = false,
  onSubmit,
  onRequestEditPermission,
}: SalesQuotationProgressModalProps) {
  const currentStatus = String(record?.opportunityStatus || '').trim();
  const [mode, setMode] = useState<'keep' | 'change'>('keep');
  const [nextStatus, setNextStatus] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setMode('keep');
    setNextStatus(currentStatus || '');
  }, [isOpen, currentStatus, record?.forecastId]);

  const handleSubmit = async () => {
    if (mode === 'keep') {
      await onSubmit({ keepCurrent: true });
      return;
    }
    if (!String(nextStatus || '').trim()) return;
    await onSubmit({ keepCurrent: false, opportunityStatus: String(nextStatus).trim() });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quotation Progress Update</DialogTitle>
          <DialogDescription>
            Update the business status for this quotation. Workflow remains separate from Status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="rounded-md border px-4 py-3">
            <div className="text-sm text-muted-foreground">Current Status</div>
            <div className="mt-1 text-base font-semibold text-[#212529]">
              {currentStatus || '—'}
            </div>
            {record?.quotationRef ? (
              <div className="mt-2 font-mono text-sm font-semibold text-[#007BFF]">
                {record.quotationRef}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-[#212529]">
              Do you want to change the Status?
            </Label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="status-mode"
                className="h-4 w-4 accent-[#007BFF]"
                checked={mode === 'keep'}
                disabled={isSubmitting}
                onChange={() => setMode('keep')}
              />
              Keep Current Status
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="status-mode"
                className="h-4 w-4 accent-[#007BFF]"
                checked={mode === 'change'}
                disabled={isSubmitting}
                onChange={() => setMode('change')}
              />
              Change Status
            </label>
          </div>

          {mode === 'change' ? (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={nextStatus || undefined} onValueChange={setNextStatus} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-end sm:gap-2">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onRequestEditPermission?.()}
          >
            Request Edit Permission
          </Button>
          <Button
            type="button"
            className="bg-[#007BFF] hover:bg-[#0056b3]"
            disabled={
              isSubmitting || (mode === 'change' && !String(nextStatus || '').trim())
            }
            onClick={() => void handleSubmit()}
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
