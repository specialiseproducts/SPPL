import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { PlannerEvent } from '../../../types/planner';
import {
  getPlannerDisplayLabel,
  getPlannerOwnerLabel,
  getPlannerReminderState,
  getPlannerVisualStatus,
  getPlannerChipStyle,
} from './plannerUtils';

interface PlannerEventChipProps {
  event: PlannerEvent;
  onSelect: (event: PlannerEvent) => void;
  showOwnerLabel?: boolean;
  ownerNameByCode?: Record<string, string>;
}

export default function PlannerEventChip({
  event,
  onSelect,
  showOwnerLabel = false,
  ownerNameByCode,
}: PlannerEventChipProps) {
  const displayLabel = getPlannerDisplayLabel(event);
  const ownerLabel = getPlannerOwnerLabel(event, ownerNameByCode);
  const reminderState = getPlannerReminderState(event);
  const visualStatus = getPlannerVisualStatus(event);
  const chipStyle = getPlannerChipStyle(visualStatus, reminderState);

  if (import.meta.env.DEV) {
    console.log({
      eventId: event.eventId,
      label: displayLabel,
      contactTitle: event.contactTitle,
      contactFullName: event.contactFullName,
      organizationName: event.organizationName,
      organizationId: event.organizationId,
      visualStatus,
      reminderState,
    });
  }

  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          style={chipStyle}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(event);
          }}
        >
          {showOwnerLabel && ownerLabel ? (
            <span className="flex min-w-0 flex-col items-start gap-0.5 text-left leading-tight">
              <span className="w-full truncate text-[9px] font-semibold opacity-90">{ownerLabel}</span>
              <span className="w-full truncate">{displayLabel}</span>
            </span>
          ) : (
            displayLabel
          )}
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-[100] max-w-xs rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#212529] shadow-md"
        >
          <div className="space-y-0.5">
            {showOwnerLabel && ownerLabel ? (
              <p>
                <span className="font-semibold">Employee:</span> {ownerLabel}
              </p>
            ) : null}
            <p>
              <span className="font-semibold">Status:</span> {visualStatus}
            </p>
            <p>
              <span className="font-semibold">Organization:</span>{' '}
              {event.organizationName || '—'}
            </p>
            <p>
              <span className="font-semibold">Mode:</span> {event.modeOfMeeting || '—'}
            </p>
            <p>
              <span className="font-semibold">Visit Date:</span> {event.visitDate || '—'}
            </p>
          </div>
          <TooltipPrimitive.Arrow className="fill-white" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
