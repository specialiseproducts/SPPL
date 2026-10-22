import { useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';

/**
 * Locale-independent 12-hour time input (hour + minute + AM/PM).
 * Stores/returns HH:mm (24-hour) for backend compatibility.
 *
 * Local draft state lets the user type hour/minute freely; HH:mm is committed
 * only when both parts form a valid time (or cleared when both are empty).
 */

/** Fixed control widths so Start|End fit side-by-side (base Input/Select use w-full). */
const HH_MM_WIDTH_PX = 48;
const PERIOD_WIDTH_PX = 66;

const digitFieldStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: HH_MM_WIDTH_PX,
  minWidth: HH_MM_WIDTH_PX,
  maxWidth: HH_MM_WIDTH_PX,
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: HH_MM_WIDTH_PX,
};

const periodTriggerStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: PERIOD_WIDTH_PX,
  minWidth: PERIOD_WIDTH_PX,
  maxWidth: PERIOD_WIDTH_PX,
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: PERIOD_WIDTH_PX,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function hhMmTo12hParts(hhmm: string): { hour12: string; minute: string; period: 'AM' | 'PM' } {
  const raw = String(hhmm || '').trim();
  const match = /^(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return { hour12: '', minute: '', period: 'AM' };
  let h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { hour12: '', minute: '', period: 'AM' };
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12: String(hour12), minute: pad2(m), period };
}

export function parts12hToHhMm(hour12: string, minute: string, period: 'AM' | 'PM'): string {
  const hRaw = String(hour12 ?? '').trim();
  const mRaw = String(minute ?? '').trim();
  // Require both parts — Number('') === 0 would falsely treat empty minutes as :00.
  if (!hRaw || !mRaw) return '';
  const h12 = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h12) || !Number.isFinite(m)) return '';
  if (h12 < 1 || h12 > 12 || m < 0 || m > 59) return '';
  let h24 = h12 % 12;
  if (period === 'PM') h24 += 12;
  return `${pad2(h24)}:${pad2(m)}`;
}

interface TwelveHourTimeInputProps {
  id: string;
  label?: string;
  value: string; // HH:mm
  onChange: (hhmm: string) => void;
  required?: boolean;
  error?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function TwelveHourTimeInput({
  id,
  label,
  value,
  onChange,
  required = false,
  error = false,
  className,
  disabled = false,
}: TwelveHourTimeInputProps) {
  const parsed = useMemo(() => hhMmTo12hParts(value), [value]);
  const [hour12, setHour12] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period);
  const [editing, setEditing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef(hour12);
  const minuteRef = useRef(minute);
  const periodRef = useRef(period);
  const valueRef = useRef(value);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  hourRef.current = hour12;
  minuteRef.current = minute;
  periodRef.current = period;
  valueRef.current = value;

  useEffect(() => {
    if (editing) return;
    setHour12(parsed.hour12);
    setMinute(parsed.minute);
    setPeriod(parsed.period);
  }, [parsed.hour12, parsed.minute, parsed.period, editing]);

  useEffect(
    () => () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    },
    [],
  );

  const commit = (nextHour: string, nextMinute: string, nextPeriod: 'AM' | 'PM') => {
    const h = String(nextHour || '').trim();
    const m = String(nextMinute || '').trim();
    if (!h && !m) {
      onChange('');
      return;
    }
    const hhmm = parts12hToHhMm(h, m, nextPeriod);
    if (hhmm) onChange(hhmm);
  };

  const syncFromValue = () => {
    const next = hhMmTo12hParts(valueRef.current);
    setHour12(next.hour12);
    setMinute(next.minute);
    setPeriod(next.period);
  };

  /**
   * Finish editing only when focus leaves the whole control (not when moving
   * HH → MM → AM/PM). Without this, blurring HH after typing "10" (minutes still
   * empty) treated the draft as invalid and syncFromValue() wiped HH from the
   * still-empty parent value.
   */
  const finishEditing = () => {
    setEditing(false);
    const h = hourRef.current.trim();
    const m = minuteRef.current.trim();
    const p = periodRef.current;
    if (!h && !m) {
      onChange('');
      return;
    }
    const hhmm = parts12hToHhMm(h, m, p);
    if (hhmm) {
      onChange(hhmm);
      const normalized = hhMmTo12hParts(hhmm);
      setHour12(normalized.hour12);
      setMinute(normalized.minute);
      setPeriod(normalized.period);
      return;
    }
    // Left the control with an incomplete draft — restore last committed value.
    syncFromValue();
  };

  const handleBlur = (e: FocusEvent<HTMLElement>) => {
    const related = e.relatedTarget as Node | null;
    if (related && containerRef.current?.contains(related)) {
      return;
    }
    // Radix Select content is portaled outside this container; defer so we can
    // detect focus still belonging to this control's dropdown.
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => {
      blurTimerRef.current = null;
      const active = document.activeElement;
      if (containerRef.current?.contains(active)) return;
      if (
        active instanceof Element &&
        active.closest('[data-radix-select-content], [role="listbox"]')
      ) {
        return;
      }
      finishEditing();
    }, 0);
  };

  return (
    <div className={cn('min-w-0 space-y-2', className)}>
      {label ? (
        <Label htmlFor={`${id}-hour`}>
          {label}
          {required ? ' *' : ''}
        </Label>
      ) : null}
      {/*
        Inline pixel widths beat base Input/SelectTrigger `w-full` and the
        native <input> ~20ch intrinsic size so Start|End fit in one card row.
        Targets: HH/MM ~50px, AM/PM ~68px.
      */}
      <div
        ref={containerRef}
        className="inline-flex w-fit max-w-full flex-nowrap items-center gap-1"
      >
        <Input
          id={`${id}-hour`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="HH"
          size={2}
          disabled={disabled}
          value={hour12}
          onFocus={() => setEditing(true)}
          onBlur={handleBlur}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
            setHour12(raw);
            setEditing(true);
            commit(raw, minute, period);
          }}
          style={digitFieldStyle}
          className={cn(
            'h-9 shrink-0 grow-0 px-1 text-center',
            error && 'border-red-500 focus-visible:ring-red-500/30',
          )}
          aria-invalid={error}
        />
        <span className="w-2 shrink-0 text-center text-sm text-gray-500" aria-hidden>
          :
        </span>
        <Input
          id={`${id}-minute`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="MM"
          size={2}
          disabled={disabled}
          value={minute}
          onFocus={() => setEditing(true)}
          onBlur={handleBlur}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
            setMinute(raw);
            setEditing(true);
            commit(hour12, raw, period);
          }}
          style={digitFieldStyle}
          className={cn(
            'h-9 shrink-0 grow-0 px-1 text-center',
            error && 'border-red-500 focus-visible:ring-red-500/30',
          )}
          aria-invalid={error}
        />
        <Select
          value={period}
          disabled={disabled}
          onValueChange={(v) => {
            const next = v as 'AM' | 'PM';
            setPeriod(next);
            setEditing(true);
            commit(hour12, minute, next);
          }}
          onOpenChange={(open) => {
            if (open) setEditing(true);
          }}
        >
          <SelectTrigger
            id={`${id}-period`}
            style={periodTriggerStyle}
            className={cn(
              'h-9 shrink-0 grow-0 gap-1 px-2',
              error && 'border-red-500 focus:ring-red-500/30',
            )}
            aria-invalid={error}
            onFocus={() => setEditing(true)}
            onBlur={handleBlur}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
