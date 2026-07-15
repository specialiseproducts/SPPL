import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
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
import type { PlannerEventDraft, PlannerOrganizationOption } from '../../../types/planner';
import { EMPTY_PLANNER_EVENT_DRAFT, PLANNER_MEETING_MODES } from '../../../types/planner';
import { createPlannerEvents } from '../../../hooks/sales/plannerApi';
import ContactPersonFields from './ContactPersonFields';

interface PlannerCreateEventsModalProps {
  open: boolean;
  visitDate: string;
  organizations: PlannerOrganizationOption[];
  contactTitleOptions: string[];
  onClose: () => void;
  onCreated: () => void;
}

function formatDisplayDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function PlannerCreateEventsModal({
  open,
  visitDate,
  organizations,
  contactTitleOptions,
  onClose,
  onCreated,
}: PlannerCreateEventsModalProps) {
  const [blocks, setBlocks] = useState<PlannerEventDraft[]>([EMPTY_PLANNER_EVENT_DRAFT()]);
  const [busy, setBusy] = useState(false);

  const activeOrgs = useMemo(
    () =>
      organizations
        .filter((o) => o.isActive)
        .sort((a, b) =>
          a.organizationName.localeCompare(b.organizationName, undefined, { sensitivity: 'base' }),
        ),
    [organizations],
  );

  useEffect(() => {
    if (open) {
      setBlocks([EMPTY_PLANNER_EVENT_DRAFT()]);
    }
  }, [open, visitDate]);

  const updateBlock = (index: number, patch: Partial<PlannerEventDraft>) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };

  const handleOrgChange = (index: number, orgSk: string) => {
    const org = activeOrgs.find((o) => o.sk === orgSk);
    if (!org) {
      updateBlock(index, {
        organizationId: '',
        organizationName: '',
        organizationAddress: '',
        contactAddress: '',
      });
      return;
    }
    updateBlock(index, {
      organizationId: org.sk,
      organizationName: org.organizationName,
      organizationAddress: org.address,
      contactAddress: org.address,
    });
  };

  const handleSubmit = async () => {
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b.organizationId || !b.modeOfMeeting || !b.contactFullName.trim() || !b.purpose.trim()) {
        toast.error(`Please complete all required fields for event ${i + 1}`);
        return;
      }
    }
    setBusy(true);
    try {
      await createPlannerEvents(visitDate, blocks);
      toast.success(`${blocks.length} planner event(s) saved`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save events');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create planner events</DialogTitle>
          <DialogDescription>
            {visitDate ? `Visit date: ${formatDisplayDate(visitDate)}` : 'Select a date on the calendar'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {blocks.map((block, index) => (
            <div
              key={index}
              className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              {blocks.length > 1 ? (
                <p className="text-sm font-medium text-muted-foreground">Event {index + 1}</p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor={`pl-org-${index}`}>Customer Organization *</Label>
                <select
                  id={`pl-org-${index}`}
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={block.organizationId}
                  onChange={(e) => handleOrgChange(index, e.target.value)}
                >
                  <option value="">Select customer organization…</option>
                  {activeOrgs.map((o) => (
                    <option key={o.sk} value={o.sk}>
                      {o.organizationName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`pl-mode-${index}`}>Mode Of Meeting *</Label>
                <select
                  id={`pl-mode-${index}`}
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={block.modeOfMeeting}
                  onChange={(e) =>
                    updateBlock(index, {
                      modeOfMeeting: e.target.value as PlannerEventDraft['modeOfMeeting'],
                    })
                  }
                >
                  <option value="">Select mode…</option>
                  {PLANNER_MEETING_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <ContactPersonFields
                idPrefix={`pl-${index}`}
                contactTitleOptions={contactTitleOptions}
                values={{
                  contactTitle: block.contactTitle,
                  contactFullName: block.contactFullName,
                  contactAddress: block.contactAddress,
                  contactNumber: block.contactNumber,
                  contactEmail: block.contactEmail,
                }}
                onChange={(patch) => updateBlock(index, patch)}
              />

              <div className="space-y-2">
                <Label htmlFor={`pl-purpose-${index}`}>Purpose *</Label>
                <Textarea
                  id={`pl-purpose-${index}`}
                  rows={3}
                  value={block.purpose}
                  onChange={(e) => updateBlock(index, { purpose: e.target.value })}
                  placeholder="Meeting objective / purpose"
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setBlocks((prev) => [...prev, EMPTY_PLANNER_EVENT_DRAFT()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={busy}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
