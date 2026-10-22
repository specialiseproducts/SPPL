import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import CalendarHolidayDayHeader from './CalendarHolidayDayHeader';
import {
  buildHolidayMonthGrid,
  WEEKDAY_LABELS,
  type HolidayCalendarDayCell,
} from './holidayMonthGrid';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SEVEN_COL_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  width: '100%',
};

const CALENDAR_BODY_GRID: CSSProperties = {
  ...SEVEN_COL_GRID,
  gridTemplateRows: 'repeat(6, minmax(7.5rem, 1fr))',
  minHeight: '36rem',
};

function HolidayDayCell({
  cell,
  cellIndex,
  onDayDoubleClick,
  renderDayContent,
}: {
  cell: HolidayCalendarDayCell;
  cellIndex: number;
  onDayDoubleClick?: (iso: string, cell: HolidayCalendarDayCell) => void;
  renderDayContent?: (cell: HolidayCalendarDayCell) => ReactNode;
}) {
  const weekRow = Math.floor(cellIndex / 7);
  const interactive = Boolean(onDayDoubleClick) && cell.inMonth;

  return (
    <div
      role="gridcell"
      className={cn(
        'flex min-h-0 flex-col border-r border-gray-200 p-2 transition-colors',
        weekRow > 0 && 'border-t border-gray-200',
        weekRow > 0 && weekRow % 2 === 0 && 'border-t-gray-300',
        !cell.inMonth ? 'bg-gray-50/70' : 'bg-white',
        interactive && 'cursor-pointer hover:bg-gray-50/80',
      )}
      style={{ minHeight: '7.5rem' }}
      onDoubleClick={() => {
        if (!interactive || !onDayDoubleClick) return;
        onDayDoubleClick(cell.iso, cell);
      }}
    >
      <CalendarHolidayDayHeader
        dayNumber={cell.date.getUTCDate()}
        inMonth={cell.inMonth}
        isCompanyHoliday={cell.isCompanyHoliday}
        holidayName={cell.holidayName}
      />
      {/* flex-1 fills remaining cell height below the date/holiday header */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderDayContent ? renderDayContent(cell) : null}
      </div>
    </div>
  );
}

export type HolidayMonthCalendarProps = {
  year: number;
  month: number;
  /** Employee location for Office vs Factory holiday rules. */
  location?: string | null;
  onViewChange: (next: { year: number; month: number }) => void;
  /**
   * Extra controls rendered before month/year (e.g. Team employee selector).
   * Matches Team Daily Planner toolbar composition.
   */
  trailingControls?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  className?: string;
  /** Optional double-click handler for in-month cells (e.g. leave request). */
  onDayDoubleClick?: (iso: string, cell: HolidayCalendarDayCell) => void;
  /** Optional in-cell content (leave chips, etc.). */
  renderDayContent?: (cell: HolidayCalendarDayCell) => ReactNode;
};

/**
 * Holiday-aware month calendar chrome matching Daily Planner layout
 * (nav, month/year selects, weekday row, 7×6 cells, holiday headers).
 */
export default function HolidayMonthCalendar({
  year,
  month,
  location,
  onViewChange,
  trailingControls,
  loading = false,
  loadingLabel = 'Loading…',
  className,
  onDayDoubleClick,
  renderDayContent,
}: HolidayMonthCalendarProps) {
  const grid = useMemo(
    () => buildHolidayMonthGrid(year, month, location),
    [year, month, location],
  );

  const yearOptions = useMemo(() => {
    const base = new Date().getUTCFullYear();
    const min = Math.min(base - 5, year);
    const max = Math.max(base + 5, year);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [year]);

  const shiftMonth = (delta: -1 | 1) => {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    onViewChange({ year: nextYear, month: nextMonth });
  };

  return (
    <Card className={cn('w-full border-gray-200 shadow-sm', className)}>
      <div
        className="border-b border-gray-200 bg-white"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
        >
          {trailingControls}
          <select
            className="border-input bg-background h-9 min-w-[8.5rem] rounded-md border px-2 text-sm"
            value={month}
            onChange={(e) => onViewChange({ year, month: Number(e.target.value) })}
            aria-label="Month"
          >
            {MONTHS.map((label, idx) => (
              <option key={label} value={idx + 1}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="border-input bg-background h-9 min-w-[5.5rem] rounded-md border px-2 text-sm"
            value={year}
            onChange={(e) => onViewChange({ year: Number(e.target.value), month })}
            aria-label="Year"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        role="row"
        className="border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        style={SEVEN_COL_GRID}
      >
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} role="columnheader" className="border-r border-gray-200 py-2.5 last:border-r-0">
            {d}
          </div>
        ))}
      </div>

      <div className="relative w-full overflow-x-auto overflow-y-hidden rounded-b-xl">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-gray-500">
            {loadingLabel}
          </div>
        ) : null}
        <div role="grid" className="min-w-[640px] bg-white" style={CALENDAR_BODY_GRID}>
          {grid.map((cell, index) => (
            <HolidayDayCell
              key={cell.iso}
              cell={cell}
              cellIndex={index}
              onDayDoubleClick={onDayDoubleClick}
              renderDayContent={renderDayContent}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
