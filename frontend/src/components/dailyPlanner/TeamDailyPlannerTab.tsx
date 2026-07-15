import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import type { DailyPlannerTask } from '../../types/dailyPlanner';
import {
  useTeamDailyPlannerMonthQuery,
  useTeamMappingsQuery,
} from '../../hooks/dailyPlanner/useDailyPlannerQueries';
import { useAuth } from '../../context/AuthContext';
import { isQueryColdLoading } from '../../utils/queryLoading';
import TeamDailyPlannerTaskChip from './TeamDailyPlannerTaskChip';
import CalendarHolidayDayHeader from '../calendar/CalendarHolidayDayHeader';
import BulletPointList from './BulletPointList';
import {
  buildDailyMonthGrid,
  DAILY_STATUS_LEGEND,
  WEEKDAY_LABELS,
  type DailyCalendarDayCell,
} from './dailyPlannerUtils';

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

const CALENDAR_BODY_GRID: CSSProperties = {
  ...SEVEN_COL_GRID,
  gridTemplateRows: 'repeat(6, minmax(7.5rem, 1fr))',
  minHeight: '36rem',
};

function displayCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

function formatDateCell(iso: string | undefined | null): string {
  if (!iso || String(iso).trim() === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return displayCell(iso);
  return d.toLocaleDateString('en-GB');
}

const STATUS_BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Pending: { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
  Approved: { bg: '#ECFDF3', text: '#027A48', border: '#A6F4C5' },
  Rejected: { bg: '#FEF3F2', text: '#B42318', border: '#FECDCA' },
  Completed: { bg: '#ECFDF3', text: '#027A48', border: '#A6F4C5' },
  'Not Completed': { bg: '#FEF3F2', text: '#B42318', border: '#FECDCA' },
  Rescheduled: { bg: '#FFFAEB', text: '#B54708', border: '#FEDF89' },
  Terminated: { bg: '#FEF3F2', text: '#B42318', border: '#FECDCA' },
};

function statusBadge(status: string) {
  const label = status === 'Terminated' ? 'Closed' : status;
  const colors = STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.Pending;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      {label}
    </span>
  );
}

function ViewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="text-sm text-[#212529] break-words">{value}</div>
    </div>
  );
}

function ViewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-[#212529]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ViewBulletField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="min-h-[2.5rem] rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
        <BulletPointList text={value} />
      </div>
    </div>
  );
}

function TeamPlannerDayCell({
  cell,
  cellIndex,
  expanded,
  onToggleExpand,
  onSelectTask,
  showEmployeeName,
}: {
  cell: DailyCalendarDayCell;
  cellIndex: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelectTask: (task: DailyPlannerTask) => void;
  showEmployeeName: boolean;
}) {
  const weekRow = Math.floor(cellIndex / 7);
  const visibleTasks = expanded ? cell.tasks : cell.tasks.slice(0, MAX_VISIBLE_EVENTS);
  const hiddenCount = expanded ? 0 : Math.max(0, cell.tasks.length - MAX_VISIBLE_EVENTS);

  return (
    <div
      role="gridcell"
      className={cn(
        'flex min-h-0 flex-col border-r border-gray-200 p-2 transition-colors',
        weekRow > 0 && 'border-t border-gray-200',
        weekRow > 0 && weekRow % 2 === 0 && 'border-t-gray-300',
        !cell.inMonth ? 'bg-gray-50/70' : 'bg-white',
      )}
      style={{ minHeight: '7.5rem' }}
    >
      <CalendarHolidayDayHeader
        dayNumber={cell.date.getUTCDate()}
        inMonth={cell.inMonth}
        isCompanyHoliday={cell.isCompanyHoliday}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
        {visibleTasks.map((task) => (
          <TeamDailyPlannerTaskChip
            key={task.plannerTaskId}
            task={task}
            onSelect={onSelectTask}
            showEmployeeName={showEmployeeName}
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
        ) : expanded && cell.tasks.length > MAX_VISIBLE_EVENTS ? (
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

export default function TeamDailyPlannerTab() {
  const { user } = useAuth();
  const managerCode = String(user?.employeeCode || user?.id || '').trim();
  const now = new Date();
  const [view, setView] = useState({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });
  const { year, month } = view;
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState('');
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [viewTask, setViewTask] = useState<DailyPlannerTask | null>(null);

  const mappingsQuery = useTeamMappingsQuery();
  const employeeOptions = useMemo(() => {
    const mappings = mappingsQuery.data ?? [];
    return mappings
      .filter((m) => m.status === 'Active' && m.managerCode === managerCode)
      .map((m) => ({
        value: m.employeeCode,
        label: m.employeeName || m.employeeCode,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [mappingsQuery.data, managerCode]);

  useEffect(() => {
    if (employeeOptions.length === 0) return;
    setSelectedEmployeeCode((current) => {
      if (current && employeeOptions.some((option) => option.value === current)) return current;
      return employeeOptions[0].value;
    });
  }, [employeeOptions]);

  const monthQuery = useTeamDailyPlannerMonthQuery(
    year,
    month,
    selectedEmployeeCode,
    !!selectedEmployeeCode,
  );

  const tasks = monthQuery.data ?? [];
  const grid = useMemo(() => buildDailyMonthGrid(year, month, tasks), [year, month, tasks]);
  const isLoading = isQueryColdLoading(monthQuery);

  const latestViewTask = viewTask
    ? tasks.find((t) => t.plannerTaskId === viewTask.plannerTaskId) || viewTask
    : null;

  const yearOptions = useMemo(() => {
    const base = now.getUTCFullYear();
    const min = Math.min(base - 5, year);
    const max = Math.max(base + 5, year);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [now, year]);

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

  const toggleCellExpand = (iso: string) => {
    setExpandedCells((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
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
              <select
                className="border-input bg-background h-9 min-w-[10rem] rounded-md border px-2 text-sm"
                value={selectedEmployeeCode}
                onChange={(e) => {
                  setExpandedCells(new Set());
                  setSelectedEmployeeCode(e.target.value);
                }}
                aria-label="Employee"
                disabled={employeeOptions.length === 0}
              >
                {employeeOptions.map((emp) => (
                  <option key={emp.value} value={emp.value}>
                    {emp.label}
                  </option>
                ))}
              </select>
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

          <div
            className="flex flex-wrap items-center justify-end gap-3 border-b border-gray-100 bg-white px-5 py-2"
            style={{ gap: 12 }}
          >
            {DAILY_STATUS_LEGEND.map((item) => (
              <div
                key={item.status}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: '#6B7280',
                  marginRight: item.status === 'Sales Visit' ? 20 : 0,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: item.color,
                    flexShrink: 0,
                  }}
                />
                <span>{item.status}</span>
              </div>
            ))}
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
            {isLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-gray-500">
                Loading team tasks…
              </div>
            ) : null}
            <div role="grid" className="min-w-[640px] bg-white" style={CALENDAR_BODY_GRID}>
              {grid.map((cell, index) => (
                <TeamPlannerDayCell
                  key={cell.iso}
                  cell={cell}
                  cellIndex={index}
                  expanded={expandedCells.has(cell.iso)}
                  onToggleExpand={() => toggleCellExpand(cell.iso)}
                  onSelectTask={setViewTask}
                  showEmployeeName={false}
                />
              ))}
            </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          Click a task chip to view details.
        </p>
      </div>

      <Dialog open={!!viewTask} onOpenChange={(v) => !v && setViewTask(null)}>
        <DialogContent
          className="!flex !h-[90vh] !max-h-[90vh] !w-[min(92vw,1100px)] !max-w-[1100px] !flex-col gap-0 overflow-hidden !p-0 sm:!max-w-[1100px]"
          style={{
            width: 'min(92vw, 1100px)',
            maxWidth: '1100px',
            height: '90vh',
            maxHeight: '90vh',
          }}
        >
          <DialogHeader className="shrink-0 border-b border-gray-200 px-6 py-4 text-left">
            <DialogTitle className="text-lg font-semibold text-[#212529]">
              Task Details
            </DialogTitle>
            {latestViewTask?.employeeName ? (
              <p className="text-sm text-gray-600">
                {latestViewTask.employeeName}
                {latestViewTask.employeeCode ? ` · ${latestViewTask.employeeCode}` : ''}
              </p>
            ) : null}
          </DialogHeader>

          {latestViewTask ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto scroll-smooth bg-[#F8F9FA] px-6 py-5 overscroll-contain">
              <ViewSection title="Task Information">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ViewField label="Task Name" value={displayCell(latestViewTask.taskName)} />
                  <ViewField label="Date" value={displayCell(latestViewTask.date)} />
                  <ViewField label="Task Type" value={displayCell(latestViewTask.taskType)} />
                  <ViewField label="Source" value={displayCell(latestViewTask.source)} />
                </div>
                <div className="mt-4">
                  <ViewBulletField
                    label="Description"
                    value={displayCell(latestViewTask.description)}
                  />
                </div>
              </ViewSection>

              <ViewSection title="Completion Information">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ViewField
                    label="Employee Status"
                    value={statusBadge(latestViewTask.status)}
                  />
                  <ViewField
                    label="Last Updated"
                    value={formatDateCell(latestViewTask.updatedAt)}
                  />
                </div>
                {latestViewTask.status === 'Completed' ? (
                  <div className="mt-4">
                    <ViewBulletField
                      label="Work Done"
                      value={displayCell(latestViewTask.reason)}
                    />
                  </div>
                ) : null}
                {latestViewTask.status === 'Not Completed' ? (
                  <div className="mt-4">
                    <ViewBulletField
                      label="Not Completed Reason"
                      value={displayCell(latestViewTask.reason)}
                    />
                  </div>
                ) : null}
                {latestViewTask.status === 'Rescheduled' ? (
                  <div className="mt-4 space-y-3">
                    <ViewField
                      label="Rescheduled To"
                      value={displayCell(latestViewTask.rescheduledToDate)}
                    />
                    <ViewBulletField
                      label="Reschedule Reason"
                      value={displayCell(latestViewTask.reason)}
                    />
                  </div>
                ) : null}
                {latestViewTask.status === 'Terminated' ? (
                  <div className="mt-4 space-y-3">
                    <ViewBulletField
                      label="Termination Reason"
                      value={displayCell(latestViewTask.reason)}
                    />
                  </div>
                ) : null}
              </ViewSection>

              <ViewSection title="History">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ViewField
                    label="Created On"
                    value={formatDateCell(latestViewTask.createdAt)}
                  />
                  <ViewField
                    label="Last Updated"
                    value={formatDateCell(latestViewTask.updatedAt)}
                  />
                  <ViewField
                    label="Updated By"
                    value={displayCell(
                      latestViewTask.approvedByName || latestViewTask.employeeName,
                    )}
                  />
                </div>
              </ViewSection>
            </div>
          ) : null}

          <DialogFooter className="shrink-0 border-t border-gray-200 bg-white px-6 py-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setViewTask(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipPrimitive.Provider>
  );
}
