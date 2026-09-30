/**
 * Creatable searchable combobox for Expense master fields.
 * Prefix filter + free-text entry; duplicate detection via normalizeDropdownValue.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import {
  normalizeDropdownValue,
  resolveMasterDisplayValue,
} from '../../utils/expenseMasterNormalize';

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

export interface ExpenseSearchableComboboxProps {
  id?: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

export function ExpenseSearchableCombobox({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = 'Search or type…',
  disabled = false,
  emptyMessage = 'No matching options. Press Enter to use new value.',
}: ExpenseSearchableComboboxProps) {
  const reactId = useId();
  const inputId = id || `escb-${reactId.replace(/:/g, '')}`;
  const listId = `${inputId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const deduped = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of options) {
      const display = String(opt ?? '').trim();
      const key = normalizeDropdownValue(display);
      if (!key) continue;
      if (!map.has(key)) map.set(key, display);
    }
    const currentKey = normalizeDropdownValue(value);
    if (currentKey && !map.has(currentKey)) {
      map.set(currentKey, value.trim());
    }
    return Array.from(map.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = normalizeDropdownValue(query);
    if (!q) return deduped;
    return deduped.filter((o) => normalizeDropdownValue(o).startsWith(q));
  }, [deduped, query]);

  useEffect(() => {
    if (highlighted >= filtered.length) {
      setHighlighted(filtered.length > 0 ? 0 : -1);
    }
  }, [filtered, highlighted]);

  const commit = useCallback(
    (raw: string) => {
      const resolved = resolveMasterDisplayValue(raw, deduped);
      onChange(resolved);
      setQuery('');
      setOpen(false);
      setHighlighted(0);
    },
    [deduped, onChange],
  );

  const closeWithoutCommit = useCallback(() => {
    setOpen(false);
    setQuery('');
    setHighlighted(0);
  }, []);

  const closeAndCommitQuery = useCallback(() => {
    if (open) {
      commit(query);
      return;
    }
    closeWithoutCommit();
  }, [closeWithoutCommit, commit, open, query]);

  const selectOption = useCallback(
    (opt: string) => {
      commit(opt);
      requestAnimationFrame(() => inputRef.current?.blur());
    },
    [commit],
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
      closeAndCommitQuery();
      inputRef.current?.blur();
    } else {
      openDropdown();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [closeAndCommitQuery, disabled, open, openDropdown]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        commit(query);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [commit, open, query]);

  const handleFocus = () => {
    openDropdown();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const next = e.target.value;
    setQuery(next);
    onChange(next);
    setOpen(true);
    setHighlighted(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeWithoutCommit();
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
      } else {
        commit(query);
      }
    }

    if (e.key === 'Tab') {
      commit(query);
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
                  const selected = normalizeDropdownValue(value) === normalizeDropdownValue(opt);
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
