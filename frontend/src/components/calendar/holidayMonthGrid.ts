import {
  parseIsoDateOnly,
  toIsoDateOnly,
  WEEKDAY_LABELS,
} from '../sales/planner/plannerUtils';
import { getCompanyHolidayInfo } from '../../utils/companyWorkingDays';

export { WEEKDAY_LABELS };

export type HolidayCalendarDayCell = {
  date: Date;
  iso: string;
  inMonth: boolean;
  isCompanyHoliday: boolean;
  holidayName: string | null;
};

/**
 * 42-cell month grid with location-aware company holidays.
 * Same holiday source as Daily Planner / Sales calendars (`getCompanyHolidayInfo`).
 */
export function buildHolidayMonthGrid(
  year: number,
  month: number,
  location?: string | null,
): HolidayCalendarDayCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = first.getUTCDay();
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - startOffset);

  const cells: HolidayCalendarDayCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    const iso = toIsoDateOnly(d);
    const holidayInfo = getCompanyHolidayInfo(iso, location);
    cells.push({
      date: d,
      iso,
      inMonth: d.getUTCMonth() === month - 1,
      isCompanyHoliday: holidayInfo.isHoliday,
      holidayName:
        holidayInfo.holidayType === 'declared' ? holidayInfo.holidayName : null,
    });
  }
  return cells;
}

/** Keep parse helpers available to calendar consumers without pulling task utils. */
export { parseIsoDateOnly, toIsoDateOnly };
