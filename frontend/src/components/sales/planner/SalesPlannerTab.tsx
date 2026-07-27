import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';
import { useSalesData } from '../../../hooks/sales/SalesDataContext';
import {
  useInvalidatePlannerQueries,
  useInvalidateSalesForecastsFromPlanner,
  usePlannerAllTeamMonthQuery,
  usePlannerMonthQuery,
  usePlannerOrganizationsQuery,
} from '../../../hooks/sales/usePlannerQueries';
import { useEmployeesListQuery } from '../../../hooks/employees/useEmployeesQuery';
import { useAccessRulesQuery } from '../../../hooks/access/useAccessQueries';
import type { PlannerEvent } from '../../../types/planner';
import PlannerCreateEventsModal from './PlannerCreateEventsModal';
import PlannerUpdateEventModal from './PlannerUpdateEventModal';
import PlannerEventChip from './PlannerEventChip';
import CalendarHolidayDayHeader from '../../calendar/CalendarHolidayDayHeader';
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  PLANNER_STATUS_LEGEND,
  type CalendarDayCell,
} from './plannerUtils';
import {
  ALL_TEAM_VALUE,
  MY_PLANNER_VALUE,
  buildPlannerTeamEmployeeOptions,
  collectPlannerTeamEmployeeCodes,
  isAllTeamPlannerSelection,
  resolvePlannerEmployeeCode,
} from './plannerTeamUtils';
import { COMPANY_HOLIDAY_MESSAGE, isCompanyHoliday } from '../../../utils/companyWorkingDays';
import { toast } from 'sonner';

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

const MAX_VISIBLE_EVENTS = 3;

const SEVEN_COL_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  width: '100%',
};

const CALENDAR_BODY_GRID: React.CSSProperties = {
  ...SEVEN_COL_GRID,
  gridTemplateRows: 'repeat(6, minmax(7.5rem, 1fr))',
  minHeight: '36rem',
};

function PlannerDayCell({
  cell,
  cellIndex,
  expanded,
  onToggleExpand,
  onCreate,
  onSelectEvent,
  showOwnerLabel,
  ownerNameByCode,
}: {
  cell: CalendarDayCell;
  cellIndex: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onCreate: (iso: string) => void;
  onSelectEvent: (ev: PlannerEvent) => void;
  showOwnerLabel?: boolean;
  ownerNameByCode?: Record<string, string>;
}) {
  const weekRow = Math.floor(cellIndex / 7);
  const visibleEvents = expanded ? cell.events : cell.events.slice(0, MAX_VISIBLE_EVENTS);
  const hiddenCount = expanded ? 0 : Math.max(0, cell.events.length - MAX_VISIBLE_EVENTS);

  return (
    <div
      role="gridcell"
      className={cn(
        'flex min-h-0 flex-col border-r border-gray-200 p-2 transition-colors',
        weekRow > 0 && 'border-t border-gray-200',
        weekRow > 0 && weekRow % 2 === 0 && 'border-t-gray-300',
        !cell.inMonth ? 'bg-gray-50/70' : 'bg-white',
        cell.inMonth && !cell.isCompanyHoliday && 'cursor-pointer hover:bg-gray-50/80',
      )}
      style={{ minHeight: '7.5rem' }}
      onDoubleClick={() => {
        if (cell.inMonth) onCreate(cell.iso);
      }}
    >
      <CalendarHolidayDayHeader
        dayNumber={cell.date.getUTCDate()}
        inMonth={cell.inMonth}
        isCompanyHoliday={cell.isCompanyHoliday}
        holidayName={cell.holidayName}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
        {visibleEvents.map((ev) => (
          <PlannerEventChip
            key={ev.eventId}
            event={ev}
            onSelect={onSelectEvent}
            showOwnerLabel={showOwnerLabel}
            ownerNameByCode={ownerNameByCode}
          />
        ))}
        {hiddenCount > 0 ? (
          <button
            type="button"
            className="w-full shrink-0 rounded-md px-1 py-0.5 text-left text-[11px] font-medium text-[#007BFF] hover:bg-blue-50 hover:underline"
            style={{ color: '#007BFF', fontSize: 11 }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            +{hiddenCount} more
          </button>
        ) : expanded && cell.events.length > MAX_VISIBLE_EVENTS ? (
          <button
            type="button"
            className="w-full shrink-0 rounded-md px-1 py-0.5 text-left text-[11px] text-muted-foreground hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            Show less
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface SalesPlannerTabProps {
  onQuotationCreated?: () => void;
  isTeamPlanner?: boolean;
  currentEmployeeCode?: string;
}

export default function SalesPlannerTab({
  onQuotationCreated,
  isTeamPlanner = false,
  currentEmployeeCode = '',
}: SalesPlannerTabProps = {}) {
  const now = new Date();
  const [view, setView] = useState({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  });
  const { year, month } = view;
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<PlannerEvent | null>(null);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [selectedEmployee, setSelectedEmployee] = useState(MY_PLANNER_VALUE);

  const { masters } = useSalesData();
  const orgsQuery = usePlannerOrganizationsQuery();
  const employeesQuery = useEmployeesListQuery();
  const accessRulesQuery = useAccessRulesQuery();
  const invalidatePlanner = useInvalidatePlannerQueries();
  const invalidateForecasts = useInvalidateSalesForecastsFromPlanner();

  const teamEmployeeOptions = useMemo(
    () =>
      buildPlannerTeamEmployeeOptions(
        employeesQuery.data ?? [],
        accessRulesQuery.data ?? [],
      ),
    [employeesQuery.data, accessRulesQuery.data],
  );
  const allTeamEmployeeCodes = useMemo(
    () => collectPlannerTeamEmployeeCodes(teamEmployeeOptions),
    [teamEmployeeOptions],
  );
  const ownerNameByCode = useMemo(
    () =>
      Object.fromEntries(
        teamEmployeeOptions.map((option) => [option.employeeCode, option.label]),
      ),
    [teamEmployeeOptions],
  );
  const isAllTeamSelected = isTeamPlanner && isAllTeamPlannerSelection(selectedEmployee);
  const plannerEmployeeCode = useMemo(
    () => (isAllTeamSelected ? undefined : resolvePlannerEmployeeCode(selectedEmployee, currentEmployeeCode)),
    [isAllTeamSelected, selectedEmployee, currentEmployeeCode],
  );
  const monthQuery = usePlannerMonthQuery(year, month, plannerEmployeeCode, !isAllTeamSelected);
  const allTeamMonthQuery = usePlannerAllTeamMonthQuery(
    year,
    month,
    allTeamEmployeeCodes,
    isAllTeamSelected,
  );
  const events = isAllTeamSelected ? (allTeamMonthQuery.data ?? []) : (monthQuery.data ?? []);

  const holidayLocation = useMemo(() => {
    const code = String(plannerEmployeeCode || currentEmployeeCode || '').trim();
    if (!code) return undefined;
    const emp = (employeesQuery.data ?? []).find((e) => {
      const empCode = String(e.employee_code || e.employeeCode || '').trim();
      return empCode === code;
    });
    return emp?.location || undefined;
  }, [plannerEmployeeCode, currentEmployeeCode, employeesQuery.data]);

  const grid = useMemo(
    () => buildMonthGrid(year, month, events, holidayLocation),
    [year, month, events, holidayLocation],
  );

  const shiftMonth = (delta: -1 | 1) => {
    setExpandedCells(new Set());
    setView((current) => {
      let nextMonth = current.month + delta;
      let nextYear = current.year;
      if (nextMonth < 1) {
        nextMonth = 12;
        nextYear -= 1;
      } else if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      return { year: nextYear, month: nextMonth };
    });
  };

  const handleMonthSelect = (m: number) => {
    setExpandedCells(new Set());
    setView((current) => ({ ...current, month: m }));
  };

  const handleYearSelect = (y: number) => {
    setExpandedCells(new Set());
    setView((current) => ({ ...current, year: y }));
  };

  const refresh = () => {
    invalidatePlanner();
  };

  const yearOptions = useMemo(() => {
    const base = now.getUTCFullYear();
    const min = Math.min(base - 5, year);
    const max = Math.max(base + 5, year);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [now, year]);

  const toggleCellExpand = (iso: string) => {
    setExpandedCells((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  const openCreate = (iso: string) => {
    if (isCompanyHoliday(iso, holidayLocation)) {
      toast.error(COMPANY_HOLIDAY_MESSAGE);
      return;
    }
    setCreateDate(iso);
  };

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <div className="w-full space-y-3 pb-6">
        <Card className="w-full border-gray-200 shadow-sm">
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
              {isTeamPlanner ? (
                <select
                  className="border-input bg-background h-9 min-w-[10rem] rounded-md border px-2 text-sm"
                  value={selectedEmployee}
                  onChange={(e) => {
                    setExpandedCells(new Set());
                    setSelectedEmployee(e.target.value);
                  }}
                  aria-label="Employee"
                >
                  <option value={ALL_TEAM_VALUE}>All Team</option>
                  <option value={MY_PLANNER_VALUE}>My Planner</option>
                  {teamEmployeeOptions.map((emp) => (
                    <option key={emp.value} value={emp.value}>
                      {emp.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <select
                className="border-input bg-background h-9 min-w-[8.5rem] rounded-md border px-2 text-sm"
                value={month}
                onChange={(e) => handleMonthSelect(Number(e.target.value))}
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
                onChange={(e) => handleYearSelect(Number(e.target.value))}
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

          <div className="w-full max-w-full border-b border-gray-100 bg-white px-4 py-3">
            <div className="flex w-full flex-col items-end" style={{ rowGap: 14 }}>
              {[PLANNER_STATUS_LEGEND.slice(0, 5), PLANNER_STATUS_LEGEND.slice(5)].map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="flex w-full flex-wrap items-center justify-end"
                  style={{ columnGap: 20, rowGap: 10 }}
                >
                  {row.map((item) => (
                    <div
                      key={item.status}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#6B7280',
                        padding: '2px 4px',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          backgroundColor: item.color,
                          flexShrink: 0,
                        }}
                      />
                      <span>{item.status}</span>
                    </div>
                  ))}
                </div>
              ))}
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

          <div className="w-full overflow-x-auto overflow-y-hidden rounded-b-xl">
            <div role="grid" className="min-w-[640px] bg-white" style={CALENDAR_BODY_GRID}>
              {grid.map((cell, index) => (
                <PlannerDayCell
                  key={cell.iso}
                  cell={cell}
                  cellIndex={index}
                  expanded={expandedCells.has(cell.iso)}
                  onToggleExpand={() => toggleCellExpand(cell.iso)}
                  onCreate={openCreate}
                  onSelectEvent={setSelectedEvent}
                  showOwnerLabel={isAllTeamSelected}
                  ownerNameByCode={ownerNameByCode}
                />
              ))}
            </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          Double-click a date to create events. Click an event chip to update it.
          {isAllTeamSelected ? ' Each chip shows the employee name when viewing All Team.' : ''}
        </p>

        <PlannerCreateEventsModal
          open={!!createDate}
          visitDate={createDate ?? ''}
          organizations={orgsQuery.data ?? []}
          contactTitleOptions={masters.CONTACT_TITLE}
          onClose={() => setCreateDate(null)}
          onCreated={refresh}
        />

        <PlannerUpdateEventModal
          open={!!selectedEvent}
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdated={({ quotationCreated }) => {
            refresh();
            if (quotationCreated) {
              invalidateForecasts();
              onQuotationCreated?.();
            }
          }}
        />
      </div>
    </TooltipPrimitive.Provider>
  );
}
