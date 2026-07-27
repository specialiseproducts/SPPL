import { cn } from '../ui/utils';

const HOLIDAY_DATE_COLOR = '#E93323';
const IN_MONTH_DATE_COLOR = '#212529';

type CalendarHolidayDayHeaderProps = {
  dayNumber: number;
  inMonth: boolean;
  isCompanyHoliday: boolean;
  /** Declared company holiday name only; omit/null for weekly holidays. */
  holidayName?: string | null;
};

/** Shared in-cell header for company holidays across planner calendars. */
export default function CalendarHolidayDayHeader({
  dayNumber,
  inMonth,
  isCompanyHoliday,
  holidayName = null,
}: CalendarHolidayDayHeaderProps) {
  const showHoliday = inMonth && isCompanyHoliday;
  const showDeclaredName =
    showHoliday && typeof holidayName === 'string' && holidayName.trim() !== '';

  return (
    <div className="mb-1.5 min-w-0">
      <div
        className={cn(
          'text-center text-sm font-semibold leading-none',
          !inMonth && 'text-muted-foreground',
        )}
        style={
          inMonth
            ? { color: showHoliday ? HOLIDAY_DATE_COLOR : IN_MONTH_DATE_COLOR }
            : undefined
        }
      >
        {dayNumber}
      </div>
      {showHoliday ? (
        <p
          className="mt-1 text-center text-[11px] font-normal leading-tight"
          style={{ color: HOLIDAY_DATE_COLOR }}
        >
          Holiday
        </p>
      ) : null}
      {showDeclaredName ? (
        <p
          className="mt-0.5 line-clamp-2 overflow-hidden text-center text-[9px] font-normal leading-tight break-words"
          style={{ color: HOLIDAY_DATE_COLOR }}
        >
          {holidayName}
        </p>
      ) : null}
    </div>
  );
}
