import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Input } from '../../ui/input';
import { cn } from '../../ui/utils';
import type { PlannerEvent } from '../../../types/planner';
import { updatePlannerEventVisit } from '../../../hooks/sales/plannerApi';
import { formatPlannerEventLabel } from './plannerUtils';

type VisitOutcome = 'visited' | 'not_visited' | null;
type NextAction = 'quotation' | 'next_visit' | '';

interface PlannerUpdateEventModalProps {
  open: boolean;
  event: PlannerEvent | null;
  onClose: () => void;
  onUpdated: (result: { quotationCreated?: boolean }) => void;
}

export default function PlannerUpdateEventModal({
  open,
  event,
  onClose,
  onUpdated,
}: PlannerUpdateEventModalProps) {
  const [outcome, setOutcome] = useState<VisitOutcome>(null);
  const [notVisitedReason, setNotVisitedReason] = useState('');
  const [visitReport, setVisitReport] = useState('');
  const [nextAction, setNextAction] = useState<NextAction>('');
  const [newVisitDate, setNewVisitDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && event) {
      setOutcome(null);
      setNotVisitedReason('');
      setVisitReport('');
      setNextAction('');
      setNewVisitDate('');
    }
  }, [open, event?.eventId]);

  if (!event) return null;

  const readOnly = event.status !== 'Planned';

  const handleSubmit = async () => {
    if (readOnly) {
      onClose();
      return;
    }
    if (!outcome) {
      toast.error('Select Visited or Not Visited');
      return;
    }
    setBusy(true);
    try {
      if (outcome === 'not_visited') {
        if (!notVisitedReason.trim()) {
          toast.error('Please enter a reason');
          return;
        }
        await updatePlannerEventVisit(event.eventId, {
          outcome: 'not_visited',
          notVisitedReason: notVisitedReason.trim(),
        });
        toast.success('Event updated');
        onUpdated({});
        onClose();
        return;
      }

      if (!visitReport.trim()) {
        toast.error('Please enter the visit report');
        return;
      }
      if (!nextAction) {
        toast.error('Please select a next action');
        return;
      }
      if (nextAction === 'next_visit' && !newVisitDate) {
        toast.error('Please select the new visit date');
        return;
      }

      const result = await updatePlannerEventVisit(event.eventId, {
        outcome: 'visited',
        visitReport: visitReport.trim(),
        nextAction,
        newVisitDate: nextAction === 'next_visit' ? newVisitDate : undefined,
      });

      if (result.quotation) {
        toast.success('Visit saved and draft quotation created');
        onUpdated({ quotationCreated: true });
      } else if (result.rescheduledFrom) {
        toast.success('Follow-up visit scheduled');
        onUpdated({});
      } else {
        toast.success('Event updated');
        onUpdated({});
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const outcomeBtn = (value: VisitOutcome, label: string) => (
    <Button
      type="button"
      variant="outline"
      disabled={readOnly || busy}
      className={cn(
        'flex-1',
        outcome === value && 'border-[#007BFF] bg-[#007BFF]/10 text-[#007BFF]',
      )}
      onClick={() => setOutcome(value)}
    >
      {label}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update planner event</DialogTitle>
          <DialogDescription>
            {formatPlannerEventLabel(event)} · {event.organizationName} · {event.visitDate}
            {readOnly ? ` · ${event.status}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3">
            {outcomeBtn('visited', 'Visited')}
            {outcomeBtn('not_visited', 'Not Visited')}
          </div>

          {outcome === 'not_visited' && (
            <div className="space-y-2">
              <Label htmlFor="pl-reason">Reason *</Label>
              <Textarea
                id="pl-reason"
                rows={4}
                value={notVisitedReason}
                onChange={(e) => setNotVisitedReason(e.target.value)}
                disabled={readOnly}
                placeholder="Why the visit could not happen"
              />
            </div>
          )}

          {outcome === 'visited' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pl-report">Report *</Label>
                <Textarea
                  id="pl-report"
                  rows={6}
                  value={visitReport}
                  onChange={(e) => setVisitReport(e.target.value)}
                  disabled={readOnly}
                  placeholder="Visit report"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pl-next">Next Action *</Label>
                <select
                  id="pl-next"
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={nextAction}
                  disabled={readOnly}
                  onChange={(e) => setNextAction(e.target.value as NextAction)}
                >
                  <option value="">Select next action…</option>
                  <option value="quotation">Start with Quotation</option>
                  <option value="next_visit">Next Visit Date</option>
                </select>
              </div>

              {nextAction === 'next_visit' && (
                <div className="space-y-2">
                  <Label htmlFor="pl-new-date">New Visit Date *</Label>
                  <Input
                    id="pl-new-date"
                    type="date"
                    value={newVisitDate}
                    disabled={readOnly}
                    onChange={(e) => setNewVisitDate(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {readOnly && event.notVisitedReason ? (
            <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Reason</p>
              <p className="text-muted-foreground">{event.notVisitedReason}</p>
            </div>
          ) : null}

          {readOnly && event.visitReport ? (
            <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Report</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{event.visitReport}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly ? (
            <Button type="button" onClick={() => void handleSubmit()} disabled={busy}>
              Submit
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
