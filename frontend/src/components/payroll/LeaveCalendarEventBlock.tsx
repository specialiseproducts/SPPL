import type { CSSProperties } from 'react';
import type { PayrollLeaveRequest } from '../../types/payroll';
import {
  isApprovedLeaveStatus,
  leaveCalendarLabel,
} from '../../utils/payrollLeaveDates';

/** Soft leave-indicator palette (inline — precompiled CSS subset). */
export function leaveIndicatorPalette(status?: string | null): {
  backgroundColor: string;
  borderColor: string;
  color: string;
  accentColor: string;
} {
  if (isApprovedLeaveStatus(status)) {
    return {
      backgroundColor: '#FEF2F2',
      borderColor: '#FECACA',
      color: '#991B1B',
      accentColor: '#DC2626',
    };
  }
  if (String(status || '').trim() === 'Rejected') {
    return {
      backgroundColor: '#F3F4F6',
      borderColor: '#D1D5DB',
      color: '#374151',
      accentColor: '#6B7280',
    };
  }
  return {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    color: '#9A3412',
    accentColor: '#EA580C',
  };
}

type LeaveCalendarEventBlockProps = {
  request: PayrollLeaveRequest;
  onOpen?: (request: PayrollLeaveRequest) => void;
  /** When false, renders a non-clickable indicator (Team Calendar read-only). */
  interactive?: boolean;
  /**
   * `fill` — grow to fill remaining cell height (Payroll + Daily Planner leave).
   * `card` — fixed min-height; not used for DP leave (kept for callers that need shrink-to-content).
   */
  layout?: 'fill' | 'card';
};

/**
 * Leave indicator inside a Payroll (or Daily Planner) calendar date cell.
 * Default layout grows vertically (flex: 1) to fill remaining cell height.
 */
export default function LeaveCalendarEventBlock({
  request,
  onOpen,
  interactive = true,
  layout = 'fill',
}: LeaveCalendarEventBlockProps) {
  const label = leaveCalendarLabel({
    leaveType: request.leaveType,
    durationDays: request.durationDays,
    halfDayPeriod: request.halfDayPeriod,
  });
  const palette = leaveIndicatorPalette(request.status);
  const statusLabel = isApprovedLeaveStatus(request.status)
    ? 'Approved'
    : String(request.status || 'Pending').trim() || 'Pending';
  const fill = layout === 'fill';

  const style: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: fill ? '1 1 0' : '0 0 auto',
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    minHeight: fill ? 0 : 40,
    margin: 0,
    padding: '6px 8px',
    borderRadius: 6,
    border: `1px solid ${palette.borderColor}`,
    backgroundColor: palette.backgroundColor,
    color: palette.color,
    boxShadow: `inset 4px 0 0 0 ${palette.accentColor}`,
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '18px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    cursor: interactive && onOpen ? 'pointer' : 'default',
    boxSizing: 'border-box',
    textAlign: 'center',
  };

  const content = (
    <span
      style={{
        display: 'block',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: 'center',
      }}
    >
      {label}
    </span>
  );

  if (!interactive || !onOpen) {
    return (
      <div
        data-payroll-leave-indicator="full-height-centered"
        data-leave-status={statusLabel}
        style={style}
        title={`${label} · ${statusLabel}`}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-payroll-leave-indicator="full-height-centered"
      data-leave-status={statusLabel}
      style={style}
      title={`${label} · ${statusLabel}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(request);
      }}
    >
      {content}
    </button>
  );
}
