import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import {
  decimalHoursToParts,
  partsToDecimalHours,
} from '../../utils/planningRecognition';

interface HoursMinutesFieldsProps {
  value: number | null | undefined;
  onChange: (decimalHours: number) => void;
  disabled?: boolean;
  error?: boolean;
  idPrefix?: string;
}

export default function HoursMinutesFields({
  value,
  onChange,
  disabled = false,
  error = false,
  idPrefix = 'hours-minutes',
}: HoursMinutesFieldsProps) {
  const hasValue = value != null && Number.isFinite(Number(value));
  const parts = decimalHoursToParts(hasValue ? Number(value) : 0);
  const hoursDisplay = hasValue ? String(parts.hours) : '';
  const minutesDisplay = hasValue ? String(parts.minutes) : '';

  const emit = (hoursRaw: string, minutesRaw: string) => {
    const h = hoursRaw.trim() === '' ? 0 : Number(hoursRaw);
    const m = minutesRaw.trim() === '' ? 0 : Number(minutesRaw);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
    onChange(partsToDecimalHours(h, m));
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-hours`}>Hours</Label>
        <Input
          id={`${idPrefix}-hours`}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          disabled={disabled}
          value={hoursDisplay}
          onChange={(e) => emit(e.target.value, minutesDisplay || '0')}
          className={cn(error && 'border-red-500 focus-visible:ring-red-500/30')}
          aria-invalid={error}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-minutes`}>Minutes</Label>
        <Input
          id={`${idPrefix}-minutes`}
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          step={1}
          disabled={disabled}
          value={minutesDisplay}
          onChange={(e) => emit(hoursDisplay || '0', e.target.value)}
          className={cn(error && 'border-red-500 focus-visible:ring-red-500/30')}
          aria-invalid={error}
        />
      </div>
    </div>
  );
}
