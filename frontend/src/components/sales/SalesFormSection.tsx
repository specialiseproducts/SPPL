import type { ReactNode } from 'react';
import { cn } from '../ui/utils';

interface SalesFormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Shared section chrome for Sales Forecasting modals (grouped fields, ERP-style).
 */
export function SalesFormSection({ title, description, children, className }: SalesFormSectionProps) {
  return (
    <section className={cn('scroll-mt-2', className)}>
      <div className="mb-3 sm:mb-4">
        <h3 className="text-sm font-semibold text-[#212529] tracking-tight">{title}</h3>
        {description ? <p className="text-xs text-gray-500 mt-1 max-w-3xl leading-relaxed">{description}</p> : null}
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
        {children}
      </div>
    </section>
  );
}

interface SalesDetailSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function SalesDetailSection({ title, children, className }: SalesDetailSectionProps) {
  return (
    <section className={cn('scroll-mt-2', className)}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">{title}</h3>
      <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 sm:p-5 space-y-0">{children}</div>
    </section>
  );
}

interface SalesDetailFieldProps {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}

function isEmptyDisplayValue(value: ReactNode): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

export function SalesDetailField({ label, value, fullWidth }: SalesDetailFieldProps) {
  const display = isEmptyDisplayValue(value) ? '—' : value;
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-1 py-3 sm:grid-cols-12 sm:gap-4 sm:items-start border-b border-gray-100 last:border-b-0',
        fullWidth && 'sm:grid-cols-1'
      )}
    >
      <div className="text-xs font-medium text-gray-500 sm:col-span-4 lg:col-span-3">{label}</div>
      <div
        className={cn(
          'text-sm text-[#212529] whitespace-pre-wrap break-words leading-relaxed sm:col-span-8 lg:col-span-9',
          fullWidth && 'sm:col-span-1'
        )}
      >
        {display}
      </div>
    </div>
  );
}
