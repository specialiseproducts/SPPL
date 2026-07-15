import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import { sanitizeSelectOptionsUnique } from '../../utils/sanitizeSelectOptions';

const inputClass = cn(
  'border-input placeholder:text-muted-foreground flex h-9 w-full min-w-0 rounded-md border bg-input-background py-1 pl-3 text-sm shadow-xs transition-[color,box-shadow] outline-none',
  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
  'dark:bg-input/30',
);

const listClass = cn(
  'bg-popover text-popover-foreground absolute z-50 mt-1 w-full overflow-hidden rounded-md border shadow-md',
);

const itemClass = cn(
  'relative flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors',
  'hover:bg-accent hover:text-accent-foreground',
);

const INPUT_PADDING_RIGHT = 36;
const ARROW_RIGHT_OFFSET = 10;

export interface SearchableComboboxProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

export function SearchableCombobox({
  label,
  value,
  options,
  onChange,
  placeholder = 'Search or select…',
  disabled = false,
  emptyMessage = 'No matching options.',
}: SearchableComboboxProps) {
  const reactId = useId();
  const inputId = `scb-${reactId.replace(/:/g, '')}`;
  const listId = `${inputId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const deduped = useMemo(
    () =>
      sanitizeSelectOptionsUnique(options).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [options],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deduped;
    return deduped.filter((o) => o.toLowerCase().includes(q));
  }, [deduped, query]);

  useEffect(() => {
    if (highlighted >= filtered.length) {
      setHighlighted(filtered.length > 0 ? 0 : -1);
    }
  }, [filtered, highlighted]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setHighlighted(0);
  }, []);

  const selectOption = useCallback(
    (opt: string) => {
      onChange(opt.trim());
      close();
      requestAnimationFrame(() => inputRef.current?.blur());
    },
    [close, onChange],
  );

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setQuery(value);
    setOpen(true);
    setHighlighted(0);
  }, [disabled, value]);

  const toggleDropdown = useCallback(() => {
    if (disabled) return;
    if (open) {
      close();
      inputRef.current?.blur();
    } else {
      openDropdown();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [close, disabled, open, openDropdown]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open, close]);

  const handleFocus = () => {
    openDropdown();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setQuery(e.target.value);
    setOpen(true);
    setHighlighted(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      inputRef.current?.blur();
      return;
    }

    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      openDropdown();
      return;
    }

    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => (filtered.length === 0 ? -1 : (i + 1) % filtered.length));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) =>
        filtered.length === 0 ? -1 : (i - 1 + filtered.length) % filtered.length,
      );
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < filtered.length) {
        selectOption(filtered[highlighted]);
      }
    }
  };

  const displayValue = open ? query : value;

  return (
    <div className="space-y-2" ref={rootRef}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative w-full">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          className={cn(inputClass, disabled && 'cursor-not-allowed opacity-60')}
          style={{ paddingRight: INPUT_PADDING_RIGHT }}
          value={displayValue}
          placeholder={placeholder}
          onFocus={handleFocus}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`${open ? 'Close' : 'Open'} ${label} options`}
          disabled={disabled}
          className={cn(
            'absolute flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground',
            disabled && 'pointer-events-none opacity-50',
          )}
          style={{
            right: ARROW_RIGHT_OFFSET,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 24,
            height: 24,
          }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleDropdown}
        >
          <ChevronDownIcon className="size-4 opacity-60" aria-hidden />
        </button>

        {open && !disabled ? (
          <div id={listId} role="listbox" className={listClass}>
            <ul className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="text-muted-foreground px-3 py-6 text-center text-sm">{emptyMessage}</li>
              ) : (
                filtered.map((opt, index) => {
                  const selected = value.trim() === opt.trim();
                  const active = index === highlighted;
                  return (
                    <li key={opt} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        className={cn(itemClass, active && 'bg-accent text-accent-foreground')}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setHighlighted(index)}
                        onClick={() => selectOption(opt)}
                      >
                        <span className="flex-1 truncate">{opt}</span>
                        {selected ? (
                          <CheckIcon className="size-4 shrink-0 opacity-70" aria-hidden />
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Include saved value in options when editing records with legacy/master values. */
export function comboboxOptionsWithCurrent(options: string[], current: string): string[] {
  const c = current.trim();
  if (!c) return options;
  if (options.some((n) => n.toLowerCase() === c.toLowerCase())) return options;
  return [...options, c];
}
