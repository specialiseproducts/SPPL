import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { AlertTriangle, Check, Lock } from 'lucide-react';
import type { DailyPlannerTask } from '../../types/dailyPlanner';
import { isUrgentTask } from '../../utils/planningRecognition';
import {
  getDailyTaskChipStyle,
  getDailyTaskDisplayLabel,
  getDailyTaskStatusLabel,
  getDailyTaskVisualKey,
  isPermanentlyClosedTask,
} from './dailyPlannerUtils';

interface DailyPlannerTaskChipProps {
  task: DailyPlannerTask;
  onSelect: (task: DailyPlannerTask) => void;
}

export default function DailyPlannerTaskChip({ task, onSelect }: DailyPlannerTaskChipProps) {
  const displayLabel = getDailyTaskDisplayLabel(task);
  const visualKey = getDailyTaskVisualKey(task);
  const urgent = isUrgentTask(task.planningCategory);
  const chipStyle = {
    ...getDailyTaskChipStyle(visualKey),
    ...(urgent ? { border: '2px solid #DC2626', boxShadow: 'inset 0 0 0 1px #FECACA' } : {}),
  };
  const showCompletedIcon = task.status === 'Completed';
  const showClosedIcon = isPermanentlyClosedTask(task);
  const showWarningIcon =
    !showClosedIcon && (task.status === 'Not Completed' || task.status === 'Rejected');

  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          style={chipStyle}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(task);
          }}
        >
          {showCompletedIcon ? (
            <Check className="h-3 w-3 shrink-0" aria-hidden />
          ) : showClosedIcon ? (
            <Lock className="h-3 w-3 shrink-0" aria-hidden />
          ) : showWarningIcon ? (
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
          ) : null}
          <span className="min-w-0 truncate">
            {showClosedIcon ? (
              <span className="mr-1 inline-flex rounded px-1 py-0 text-[9px] font-bold uppercase tracking-wide text-white bg-[#991B1B]">
                Closed
              </span>
            ) : null}
            {urgent ? (
              <span className="mr-1 inline-flex rounded px-1 py-0 text-[9px] font-bold uppercase tracking-wide text-white bg-[#DC2626]">
                Urgent
              </span>
            ) : null}
            {displayLabel}
          </span>
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-[100] max-w-xs rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#212529] shadow-md"
        >
          <div className="space-y-0.5">
            <p>
              <span className="font-semibold">Task:</span> {displayLabel}
            </p>
            <p>
              <span className="font-semibold">Status:</span> {getDailyTaskStatusLabel(task.status)}
            </p>
            <p>
              <span className="font-semibold">Priority:</span> {task.currentPriority || task.priority}
            </p>
            <p>
              <span className="font-semibold">Type:</span> {task.taskType}
            </p>
            {urgent ? (
              <p>
                <span className="font-semibold">Planning:</span> Urgent
              </p>
            ) : null}
            {task.description ? (
              <p>
                <span className="font-semibold">Description:</span> {task.description}
              </p>
            ) : null}
          </div>
          <TooltipPrimitive.Arrow className="fill-white" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
