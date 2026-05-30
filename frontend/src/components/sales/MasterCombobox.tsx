import { useCallback, useId, useMemo, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import { sanitizeSelectOptionsUnique } from '../../utils/sanitizeSelectOptions';

const triggerClass = cn(
  'border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*="text-"])]:text-muted-foreground',
  'flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-input-background px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
  'dark:bg-input/30 dark:hover:bg-input/50',
  'hover:bg-accent/50'
);

const panelClass = cn(
  'bg-popover text-popover-foreground overflow-hidden rounded-md border p-0 shadow-md',
  'w-[var(--radix-popover-trigger-width)] min-w-[8rem] max-w-[calc(100vw-2rem)]',
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
);

const itemClass = cn(
  'relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none transition-colors',
  'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
);

interface MasterComboboxProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  /** @deprecated Masters are admin-managed; kept for API compatibility. */
  category?: string;
  placeholder?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export function MasterCombobox({
  label,
  value,
  onChange,
  options,
  category: _category,
  placeholder,
  inputClassName: _inputClassName,
  disabled = false,
}: MasterComboboxProps) {
  const reactId = useId();
  const triggerId = `mcb-tr-${reactId.replace(/:/g, '')}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const deduped = useMemo(
    () => sanitizeSelectOptionsUnique(options).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [options]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deduped;
    return deduped.filter((o) => o.toLowerCase().includes(q));
  }, [deduped, query]);

  const commit = useCallback(
    (next: string) => {
      const t = next.trim();
      onChange(t);
      setQuery('');
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={triggerId}>{label}</Label>
      <Popover
        open={disabled ? false : open}
        onOpenChange={(next) => {
          if (disabled) return;
          if (next) {
            setQuery('');
            setOpen(true);
            return;
          }
          setQuery('');
          setOpen(false);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            id={triggerId}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${triggerId}-list`}
            disabled={disabled}
            className={cn(triggerClass, disabled && 'cursor-not-allowed opacity-60')}
          >
            <span className={cn('min-w-0 flex-1 truncate text-left', !value && 'text-muted-foreground')}>
              {value || placeholder || 'Select…'}
            </span>
            <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          collisionPadding={12}
          className={panelClass}
        >
          <Command shouldFilter={false} className="rounded-md border-0 shadow-none">
            <CommandInput
              autoFocus
              placeholder={placeholder || 'Search options…'}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList id={`${triggerId}-list`} className="max-h-[min(240px,var(--radix-popover-content-available-height))]">
              {filtered.length === 0 ? (
                <div className="text-muted-foreground px-3 py-6 text-center text-sm">No matching options.</div>
              ) : null}
              {filtered.map((opt) => {
                const selected = value.trim() === opt.trim();
                return (
                  <CommandItem
                    key={opt}
                    value={opt}
                    className={itemClass}
                    onSelect={() => {
                      commit(opt);
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate">{opt}</span>
                    <span className="absolute right-2 flex size-3.5 items-center justify-center">
                      {selected ? <CheckIcon className="size-4" /> : null}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
