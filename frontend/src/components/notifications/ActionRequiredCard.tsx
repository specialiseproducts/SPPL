import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import type { ActionRequiredDefinition } from '../../types/actionRequired';
import type { PortalNotification } from '../../types/notifications';
import { alreadyProcessedErrorMessage } from '../../notifications/actionRequired/formatters';

interface ActionRequiredCardProps {
  notification: PortalNotification;
  definition: ActionRequiredDefinition;
  actorEmployeeCode: string;
  onModuleSelect: (moduleId: string) => void;
  invalidate: () => void;
  onClosePanel?: () => void;
}

export default function ActionRequiredCard({
  notification,
  definition,
  actorEmployeeCode,
  onModuleSelect,
  invalidate,
  onClosePanel,
}: ActionRequiredCardProps) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [processedLocal, setProcessedLocal] = useState(false);

  const processed = processedLocal || definition.isProcessed(notification);
  const canAct = !processed && definition.canAct(notification, actorEmployeeCode);

  const ctx = {
    notification,
    actorEmployeeCode,
    onModuleSelect,
    invalidate,
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      await definition.approve(ctx);
      setProcessedLocal(true);
      setApproveOpen(false);
      toast.success('Request approved');
      invalidate();
    } catch (err) {
      const msg = alreadyProcessedErrorMessage(err);
      toast.error(msg);
      if (/already been processed/i.test(msg)) {
        setProcessedLocal(true);
        invalidate();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    const text = remark.trim();
    if (!text) {
      toast.error('Remark is required');
      return;
    }
    setBusy(true);
    try {
      await definition.reject(ctx, text);
      setProcessedLocal(true);
      setRejectOpen(false);
      setRemark('');
      toast.success('Request rejected');
      invalidate();
    } catch (err) {
      const msg = alreadyProcessedErrorMessage(err);
      toast.error(msg);
      if (/already been processed/i.test(msg)) {
        setProcessedLocal(true);
        invalidate();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      id={`notification-row-${notification.notificationId}`}
      className={cn(
        'relative rounded-md border border-gray-200 bg-white px-3 py-3 shadow-sm',
        processed && 'opacity-80',
      )}
      role="listitem"
    >
      <div className="absolute left-0 top-0 h-full rounded-md bg-orange-500" style={{ width: 4 }} />
      <div className="pl-2">
        <div className="text-sm font-semibold text-[#212529]">{definition.getTitle(notification)}</div>
        {definition.renderDetails(notification)}

        {processed ? (
          <div className="mt-2 text-xs text-muted-foreground">
            This request has already been processed.
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="h-7 bg-[#007BFF] px-2 text-xs hover:bg-[#0056b3]"
            disabled={!canAct || busy}
            onClick={() => setApproveOpen(true)}
          >
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={!canAct || busy}
            onClick={() => {
              setRemark('');
              setRejectOpen(true);
            }}
          >
            Reject
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={busy}
            onClick={() => {
              definition.view(ctx);
              onClosePanel?.();
            }}
          >
            View
          </Button>
        </div>
      </div>

      <Dialog
        open={approveOpen}
        onOpenChange={(open) => {
          if (busy) return;
          setApproveOpen(open);
        }}
      >
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve this edit request?</DialogTitle>
            <DialogDescription>
              Approving will apply the requested changes using the existing approval workflow.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setApproveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#007BFF] hover:bg-[#0056b3]"
              disabled={busy}
              onClick={() => void handleApprove()}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (busy) return;
          setRejectOpen(open);
          if (!open) setRemark('');
        }}
      >
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Edit Request</DialogTitle>
            <DialogDescription>A remark is required when rejecting this request.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor={`action-reject-${notification.notificationId}`}>Remark</Label>
            <Textarea
              id={`action-reject-${notification.notificationId}`}
              rows={3}
              value={remark}
              disabled={busy}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Enter reason for rejection"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !remark.trim()}
              onClick={() => void handleReject()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
