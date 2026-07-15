import { cn } from '../ui/utils';

const HOLIDAY_DATE_COLOR = '#E93323';
const IN_MONTH_DATE_COLOR = '#212529';

type CalendarHolidayDayHeaderProps = {
  dayNumber: number;
  inMonth: boolean;
  isCompanyHoliday: boolean;
};

/** Shared in-cell header for company holidays across planner calendars. */
export default function CalendarHolidayDayHeader({
  dayNumber,
  inMonth,
  isCompanyHoliday,
}: CalendarHolidayDayHeaderProps) {
  const showHoliday = inMonth && isCompanyHoliday;

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
    </div>
  );
}
