import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import {
  formatMinutesLabel,
  newProcedureStepDraft,
  sumDraftPlannedMinutes,
  type ProcedureStepDraft,
} from '../../utils/dailyPlannerProcedureSteps';

/** Equal compact size for Hours / Minutes — fixed box so Input's default w-full cannot expand. */
const DURATION_BOX_PX = 52;

interface StepProcedureEditorProps {
  label?: string;
  steps: ProcedureStepDraft[];
  onChange: (steps: ProcedureStepDraft[]) => void;
  required?: boolean;
  id?: string;
  error?: boolean;
  showDurationTotal?: boolean;
  /** Planned (default) vs Actual — Extra Task / reporting-style durations. */
  durationMode?: 'planned' | 'actual';
  /** Extra Task procedure: text steps only (no Hours/Minutes inputs). */
  descriptionOnly?: boolean;
  descriptionPlaceholder?: string;
  /**
   * When true, hide Add Step / Remove — step count is controlled by the parent
   * (e.g. Extra Task Work Done rows locked 1:1 to procedure steps).
   */
  lockStepCount?: boolean;
}

function DurationNumberInput({
  id,
  value,
  onChange,
  placeholder,
  min,
  max,
  'aria-label': ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (raw: string) => void;
  placeholder: string;
  min: number;
  max?: number;
  'aria-label': string;
}) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-md border border-input bg-white"
      style={{ width: DURATION_BOX_PX, height: 36 }}
    >
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          'box-border h-full w-full border-0 bg-transparent px-1 text-center text-sm tabular-nums outline-none',
          '[appearance:textfield]',
          '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      />
    </div>
  );
}

export default function StepProcedureEditor({
  label = 'Step By Step Procedure',
  steps,
  onChange,
  required,
  id,
  error,
  showDurationTotal = true,
  durationMode = 'planned',
  descriptionOnly = false,
  descriptionPlaceholder = 'Enter step…',
  lockStepCount = false,
}: StepProcedureEditorProps) {
  const totalMinutes = sumDraftPlannedMinutes(steps);
  const hoursAria = durationMode === 'actual' ? 'actual hours' : 'hours';
  const minutesAria = durationMode === 'actual' ? 'actual minutes' : 'minutes';
  const totalPrefix = durationMode === 'actual' ? 'Actual total' : 'Steps total';
  const showDurations = !descriptionOnly;

  const updateStep = (index: number, patch: Partial<ProcedureStepDraft>) => {
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    if (lockStepCount) return;
    onChange([...steps, newProcedureStepDraft()]);
  };

  const removeStep = (index: number) => {
    if (lockStepCount) return;
    if (steps.length <= 1) {
      onChange([newProcedureStepDraft()]);
      return;
    }
    onChange(steps.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </Label>
      <div
        className={cn(
          'space-y-2 rounded-lg border bg-gray-50/50 p-3',
          error ? 'border-red-400' : 'border-gray-200',
        )}
      >
        {steps.map((step, index) => (
          <div
            key={step.stepId}
            className="flex w-full min-w-0 flex-nowrap items-center gap-2"
          >
            <span className="w-5 shrink-0 text-sm font-medium text-gray-500">
              {index + 1}.
            </span>
            <Input
              id={index === 0 ? id : undefined}
              value={step.description}
              onChange={(e) => updateStep(index, { description: e.target.value })}
              placeholder={descriptionPlaceholder}
              className="min-w-0 flex-1 bg-white"
              aria-invalid={error}
            />
            {showDurations ? (
              <>
                <DurationNumberInput
                  value={step.hours === 0 && !step.description ? '' : String(step.hours)}
                  placeholder="Hrs"
                  min={0}
                  aria-label={`Step ${index + 1} ${hoursAria}`}
                  onChange={(raw) => {
                    const v = raw.trim() === '' ? 0 : Number(raw);
                    if (!Number.isFinite(v) || v < 0) return;
                    updateStep(index, { hours: Math.floor(v) });
                  }}
                />
                <DurationNumberInput
                  value={step.minutes === 0 && !step.description ? '' : String(step.minutes)}
                  placeholder="Min"
                  min={0}
                  max={59}
                  aria-label={`Step ${index + 1} ${minutesAria}`}
                  onChange={(raw) => {
                    const v = raw.trim() === '' ? 0 : Number(raw);
                    if (!Number.isFinite(v) || v < 0) return;
                    updateStep(index, { minutes: Math.max(0, Math.min(59, Math.round(v))) });
                  }}
                />
              </>
            ) : null}
            {!lockStepCount ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-600"
                onClick={() => removeStep(index)}
                aria-label="Remove step"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {!lockStepCount ? (
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addStep}>
              <Plus className="h-3.5 w-3.5" />
              Add Step
            </Button>
          ) : (
            <span />
          )}
          {showDurations && showDurationTotal ? (
            <p className="text-xs text-gray-600">
              {totalPrefix}: {totalMinutes > 0 ? formatMinutesLabel(totalMinutes) : '—'}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
