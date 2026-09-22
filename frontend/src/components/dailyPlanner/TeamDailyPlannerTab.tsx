import type { DailyPlannerTask } from '../../types/dailyPlanner';
import {
  useInvalidateDailyPlannerQueries,
  usePlanningConfigQuery,
  useTeamDailyPlannerMonthQuery,
  useTeamDailyPlannerQuery,
  useTeamMappingsQuery,
} from '../../hooks/dailyPlanner/useDailyPlannerQueries';
import { upsertPlannerTasksInCache, replacePlannerDayTasksInCache, removePlannerTasksFromCache } from '../../hooks/dailyPlanner/dailyPlannerCache';
import { dailyPlannerQueryKeys } from '../../hooks/dailyPlanner/dailyPlannerQueryKeys';
import { useAuth } from '../../context/AuthContext';
import { isQueryColdLoading } from '../../utils/queryLoading';
import { useEmployeesListQuery } from '../../hooks/employees/useEmployeesQuery';
import TeamDailyPlannerTaskChip from './TeamDailyPlannerTaskChip';
import CalendarHolidayDayHeader from '../calendar/CalendarHolidayDayHeader';
import {
  buildDailyMonthGrid,
  DAILY_STATUS_LEGEND,
  sortDailyPlannerTasksByPriority,
  todayIso,
  visibleEmployeePlannerTasks,
  WEEKDAY_LABELS,
  type DailyCalendarDayCell,
} from './dailyPlannerUtils';
import TodayTaskReviewWizard from './TodayTaskReviewWizard';
import DailyPlannerCreateTaskModal from './DailyPlannerCreateTaskModal';
import DailyPlannerCompletionApprovalsPanel from './DailyPlannerCompletionApprovalsPanel';
import { countReviewedTasks, isTaskManagerReviewed } from './todayTaskReviewWizardUtils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { getNextWorkingDayDateKey, isCompanyWorkingDay } from '../../utils/companyWorkingDays';
import { createDailyPlannerTaskForEmployee, finalizeEmployeeDailyPlan } from '../../hooks/dailyPlanner/dailyPlannerApi';
import { isSuperAdmin } from '../../utils/accessControl';
import { toast } from 'sonner';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const EVENING_START_MINUTES = 17 * 60 + 30;

function resolveTeamReviewDate(
  today: string,
  serverTimeIso: string | undefined,
  location: string | undefined,
  tomorrowIst: string | undefined,
): string {
  if (!serverTimeIso) return today;
  const ref = new Date(serverTimeIso);
  if (Number.isNaN(ref.getTime())) return today;
  const ist = new Date(ref.getTime() + IST_OFFSET_MS);
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  // After 5:30 PM IST managers review next-working-day plans submitted in the evening window.
  if (minutes >= EVENING_START_MINUTES) {
    return getNextWorkingDayDateKey(today, location) || tomorrowIst || today;
  }
  return today;
}

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

function TeamPlannerDayCell({
  cell,
  cellIndex,
  expanded,
  onToggleExpand,
  onSelectTask,
  onSelectDate,
  onCreateForDate,
  showEmployeeName,
}: {
  cell: DailyCalendarDayCell;
  cellIndex: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelectTask: (task: DailyPlannerTask) => void;
  onSelectDate?: (iso: string) => void;
  onCreateForDate: (iso: string) => void;
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
        cell.inMonth && 'cursor-pointer hover:bg-gray-50/80',
      )}
      style={{ minHeight: '7.5rem' }}
      onClick={() => {
        if (!cell.inMonth || !onSelectDate) return;
        onSelectDate(cell.iso);
      }}
      onDoubleClick={() => {
        if (!cell.inMonth) return;
        onCreateForDate(cell.iso);
      }}
    >
      <CalendarHolidayDayHeader
        dayNumber={cell.date.getUTCDate()}
        inMonth={cell.inMonth}
        isCompanyHoliday={cell.isCompanyHoliday}
        holidayName={cell.holidayName}
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

export default function TeamDailyPlannerTab({ moduleRole }: { moduleRole?: string } = {}) {
  const { user } = useAuth();
  const invalidate = useInvalidateDailyPlannerQueries();
  const queryClient = useQueryClient();
  const managerCode = String(user?.employeeCode || user?.id || '').trim();
  const canReviewAnyDate = isSuperAdmin(String(moduleRole || ''));
  const now = new Date();
  const [view, setView] = useState({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });
  const { year, month } = view;
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState('');
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTaskIndex, setWizardTaskIndex] = useState(0);
  const [wizardDismissedForEmployee, setWizardDismissedForEmployee] = useState('');
  const [createDate, setCreateDate] = useState<string | null>(null);
  /** Super Admin only: selected calendar date for Team review (past / today / future). */
  const [reviewDateOverride, setReviewDateOverride] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState<{ date: string; taskId: string | null } | null>(
    null,
  );
  const hadPendingReviewsRef = useRef(false);
  const today = todayIso();
  const planningConfigQuery = usePlanningConfigQuery();

  const mappingsQuery = useTeamMappingsQuery();
  const employeesQuery = useEmployeesListQuery();
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

  const selectedEmployeeLocation = useMemo(() => {
    const code = String(selectedEmployeeCode || '').trim();
    if (!code) return undefined;
    const emp = (employeesQuery.data ?? []).find((e) => {
      const empCode = String(e.employee_code || e.employeeCode || '').trim();
      return empCode === code;
    });
    return emp?.location || undefined;
  }, [selectedEmployeeCode, employeesQuery.data]);

  const defaultReviewDate = useMemo(
    () =>
      resolveTeamReviewDate(
        planningConfigQuery.data?.todayIst || today,
        planningConfigQuery.data?.serverTimeIso,
        selectedEmployeeLocation,
        planningConfigQuery.data?.tomorrowIst,
      ),
    [
      planningConfigQuery.data?.todayIst,
      planningConfigQuery.data?.serverTimeIso,
      planningConfigQuery.data?.tomorrowIst,
      selectedEmployeeLocation,
      today,
    ],
  );

  const reviewDate =
    canReviewAnyDate && reviewDateOverride ? reviewDateOverride : defaultReviewDate;

  const todayTasksQuery = useTeamDailyPlannerQuery(
    { employeeCode: selectedEmployeeCode, date: reviewDate },
    !!selectedEmployeeCode,
  );

  const selectedEmployeeProfile = useMemo(() => {
    const code = String(selectedEmployeeCode || '').trim();
    if (!code) return null;
    const emp = (employeesQuery.data ?? []).find((e) => {
      const empCode = String(e.employee_code || e.employeeCode || '').trim();
      return empCode === code;
    });
    const mapping = (mappingsQuery.data ?? []).find(
      (m) => m.employeeCode === code && m.managerCode === managerCode,
    );
    return {
      employeeCode: code,
      employeeName: mapping?.employeeName || emp?.name || emp?.employee_name || code,
      department: emp?.department || '',
      designation: emp?.designation || '',
      location: emp?.location || selectedEmployeeLocation || '',
    };
  }, [
    selectedEmployeeCode,
    employeesQuery.data,
    mappingsQuery.data,
    managerCode,
    selectedEmployeeLocation,
  ]);

  const todayTasks = useMemo(() => {
    const list = todayTasksQuery.data ?? [];
    // Match My Daily Planner / finalize semantics: hide handled revision parents
    // and Rescheduled originals so Team Review matches the authoritative plan.
    const visible = visibleEmployeePlannerTasks(list).filter(
      (task) => String(task.status || '').trim() !== 'Rescheduled',
    );
    return sortDailyPlannerTasksByPriority(visible);
  }, [todayTasksQuery.data]);

  // keepPreviousData can briefly show another date while the selected-day query is in flight.
  const dayTasksMatchReviewDate = useMemo(
    () =>
      todayTasks.every((task) => String(task.date || '').trim().slice(0, 10) === reviewDate),
    [todayTasks, reviewDate],
  );
  const dayTasksAlignedWithReviewDate =
    !todayTasksQuery.isPlaceholderData && dayTasksMatchReviewDate;

  // Plan-review pending only (never reuse completion submission as plan-review state).
  const pendingReviewTasks = useMemo(
    () => todayTasks.filter((task) => !isTaskManagerReviewed(task)),
    [todayTasks],
  );
  const pendingReviewCount = pendingReviewTasks.length;
  const firstPendingTaskId = pendingReviewTasks[0]?.plannerTaskId ?? '';

  const todayTasksLoading = isQueryColdLoading(todayTasksQuery);

  useEffect(() => {
    setWizardDismissedForEmployee('');
    setWizardOpen(false);
    setWizardTaskIndex(0);
    setReviewDateOverride(null);
    setPendingOpen(null);
    hadPendingReviewsRef.current = false;
  }, [selectedEmployeeCode]);

  useEffect(() => {
    if (!pendingOpen || todayTasksLoading) return;
    if (reviewDate !== pendingOpen.date) return;
    // Wait until the selected-date query has settled (avoid opening with keepPreviousData).
    if (!dayTasksAlignedWithReviewDate || todayTasksQuery.isFetching) return;
    if (todayTasks.length === 0) {
      setPendingOpen(null);
      return;
    }
    const index = pendingOpen.taskId
      ? Math.max(
          0,
          todayTasks.findIndex((task) => task.plannerTaskId === pendingOpen.taskId),
        )
      : 0;
    setWizardTaskIndex(index);
    setWizardOpen(true);
    setPendingOpen(null);
  }, [
    pendingOpen,
    todayTasksLoading,
    reviewDate,
    todayTasks,
    dayTasksAlignedWithReviewDate,
    todayTasksQuery.isFetching,
  ]);

  useEffect(() => {
    if (!selectedEmployeeCode || todayTasksLoading) return;
    if (!dayTasksAlignedWithReviewDate) return;

    // Auto-open when the employee has tasks for the review date (even if all already reviewed).
    if (todayTasks.length === 0) {
      hadPendingReviewsRef.current = false;
      return;
    }

    const newlyArrivedTasks = !hadPendingReviewsRef.current;
    hadPendingReviewsRef.current = true;

    if (wizardDismissedForEmployee === selectedEmployeeCode) {
      // Closed by manager — stay closed unless a fresh task set arrived for this employee.
      if (!newlyArrivedTasks) return;
      setWizardDismissedForEmployee('');
    }

    // Don't reset the wizard while the manager is already reviewing.
    if (wizardOpen && !newlyArrivedTasks) return;

    const firstPendingIndex = firstPendingTaskId
      ? Math.max(
          0,
          todayTasks.findIndex((task) => task.plannerTaskId === firstPendingTaskId),
        )
      : 0;

    // Ignore placeholder rows from the previously selected employee.
    const planTasks = todayTasks.filter(
      (task) => String(task.employeeCode || '').trim() === selectedEmployeeCode,
    );
    if (planTasks.length !== todayTasks.length) return;

    // Same progress as the review form: reviewed tasks / plan tasks.
    // Employee selection must not auto-open a plan that is already 100%.
    // Explicit task clicks still open via handleSelectTask.
    const progressPct = Math.round((countReviewedTasks(planTasks) / planTasks.length) * 100);
    if (progressPct === 100) return;

    setWizardOpen(true);
    setWizardTaskIndex(firstPendingIndex);
  }, [
    selectedEmployeeCode,
    todayTasksLoading,
    pendingReviewCount,
    firstPendingTaskId,
    todayTasks,
    wizardDismissedForEmployee,
    wizardOpen,
    dayTasksAlignedWithReviewDate,
  ]);

  const tasks = monthQuery.data ?? [];
  const grid = useMemo(
    () => buildDailyMonthGrid(year, month, tasks, selectedEmployeeLocation),
    [year, month, tasks, selectedEmployeeLocation],
  );
  const isLoading = isQueryColdLoading(monthQuery);

  const openReviewForDate = (dateKey: string, taskId: string | null) => {
    const key = String(dateKey || '').trim().slice(0, 10);
    if (!key) return;
    setReviewDateOverride(key);
    setWizardDismissedForEmployee('');
    if (
      key === reviewDate &&
      dayTasksAlignedWithReviewDate &&
      !todayTasksLoading &&
      !todayTasksQuery.isFetching &&
      todayTasks.length > 0
    ) {
      const index = taskId
        ? Math.max(0, todayTasks.findIndex((task) => task.plannerTaskId === taskId))
        : 0;
      setWizardTaskIndex(index);
      setWizardOpen(true);
      setPendingOpen(null);
      return;
    }
    setPendingOpen({ date: key, taskId });
  };

  const handleSelectTask = (task: DailyPlannerTask) => {
    const taskDate = String(task.date || '').trim().slice(0, 10);
    if (!taskDate) return;

    // Super Admin: open existing Team review flow for any calendar date.
    if (canReviewAnyDate) {
      openReviewForDate(taskDate, task.plannerTaskId || null);
      return;
    }

    if (taskDate !== reviewDate || todayTasks.length === 0 || !dayTasksAlignedWithReviewDate) {
      return;
    }
    const index = todayTasks.findIndex((t) => t.plannerTaskId === task.plannerTaskId);
    setWizardDismissedForEmployee('');
    setWizardTaskIndex(index >= 0 ? index : 0);
    setWizardOpen(true);
  };

  const handleSelectDate = (iso: string) => {
    if (!canReviewAnyDate) return;
    openReviewForDate(iso, null);
  };

  const handleCreateForDate = (iso: string) => {
    const dateKey = String(iso || '').trim().slice(0, 10);
    if (!selectedEmployeeCode) {
      toast.error('Select an employee before creating a task.');
      return;
    }
    if (!dateKey) return;
    if (!isCompanyWorkingDay(dateKey, selectedEmployeeLocation)) {
      toast.error('Tasks can only be created on a working day.');
      return;
    }
    const todayKey = String(planningConfigQuery.data?.todayIst || today).slice(0, 10);
    if (dateKey < todayKey) {
      toast.error('Cannot create tasks for past dates.');
      return;
    }
    setCreateDate(dateKey);
  };

  const refreshTasks = (
    updatedTasks?: DailyPlannerTask[],
    options?: { replaceEmployeeDate?: boolean; removeTaskIds?: string[] },
  ) => {
    if (options?.removeTaskIds?.length) {
      removePlannerTasksFromCache(queryClient, options.removeTaskIds);
      void queryClient.invalidateQueries({
        queryKey: dailyPlannerQueryKeys.completionApprovalsPending(),
      });
      void queryClient.invalidateQueries({
        queryKey: [...dailyPlannerQueryKeys.all, 'team'],
      });
      void queryClient.invalidateQueries({
        queryKey: [...dailyPlannerQueryKeys.all, 'teamMonth'],
      });
      return;
    }
    if (updatedTasks?.length) {
      if (options?.replaceEmployeeDate) {
        const code = String(updatedTasks[0]?.employeeCode || selectedEmployeeCode || '').trim();
        const date = String(updatedTasks[0]?.date || reviewDate || '').trim().slice(0, 10);
        replacePlannerDayTasksInCache(queryClient, code, date, updatedTasks);
      } else {
        upsertPlannerTasksInCache(queryClient, updatedTasks);
      }
      void queryClient.invalidateQueries({
        queryKey: dailyPlannerQueryKeys.planningProfile(),
      });
      void queryClient.invalidateQueries({
        queryKey: dailyPlannerQueryKeys.managerPlanningDashboard(),
      });
      void queryClient.invalidateQueries({
        queryKey: dailyPlannerQueryKeys.completionApprovalsPending(),
      });
      // Ensure team day/month refetch so UI cannot keep stale draft rows after finalize.
      if (options?.replaceEmployeeDate) {
        void queryClient.invalidateQueries({
          queryKey: [...dailyPlannerQueryKeys.all, 'team'],
        });
        void queryClient.invalidateQueries({
          queryKey: [...dailyPlannerQueryKeys.all, 'teamMonth'],
        });
      }
      return;
    }
    invalidate();
  };

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
      <DailyPlannerCompletionApprovalsPanel
        moduleRole={moduleRole}
        onTasksUpdated={refreshTasks}
      />

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
                  setWizardDismissedForEmployee('');
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

          <div className="w-full max-w-full border-b border-gray-100 bg-white px-4 py-3">
            <div className="flex w-full flex-col items-end" style={{ rowGap: 14 }}>
              {[DAILY_STATUS_LEGEND.slice(0, 5), DAILY_STATUS_LEGEND.slice(5)].map((row, rowIndex) => (
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
                  onSelectTask={handleSelectTask}
                  onSelectDate={canReviewAnyDate ? handleSelectDate : undefined}
                  onCreateForDate={handleCreateForDate}
                  showEmployeeName={false}
                />
              ))}
            </div>
          </div>
        </Card>

        {!todayTasksLoading &&
        selectedEmployeeCode &&
        dayTasksAlignedWithReviewDate &&
        !todayTasksQuery.isFetching &&
        todayTasks.length === 0 ? (
          <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            No tasks created for plan review date ({reviewDate}).
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Today&apos;s plan-review tasks open in the review wizard automatically. Click a plan-date
          task chip to reopen the wizard.
        </p>
      </div>

      {selectedEmployeeProfile && todayTasks.length > 0 && dayTasksAlignedWithReviewDate ? (
        <TodayTaskReviewWizard
          open={wizardOpen}
          tasks={todayTasks}
          employee={selectedEmployeeProfile}
          reviewDate={reviewDate}
          initialTaskIndex={wizardTaskIndex}
          completionReviewMode={false}
          moduleRole={moduleRole}
          onClose={() => {
            setWizardOpen(false);
            setWizardDismissedForEmployee(selectedEmployeeCode);
          }}
          onFinish={() => {
            setWizardOpen(false);
            setWizardDismissedForEmployee(selectedEmployeeCode);
          }}
          onTasksUpdated={refreshTasks}
        />
      ) : null}

      {selectedEmployeeCode && createDate ? (
        <DailyPlannerCreateTaskModal
          open={Boolean(createDate)}
          date={createDate}
          planningConfig={planningConfigQuery.data}
          elevated
          forEmployeeCode={selectedEmployeeCode}
          skipPlanningWindowAssert
          existingTasksForDate={tasks.filter(
            (task) => String(task.date || '').trim().slice(0, 10) === createDate,
          )}
          onClose={() => setCreateDate(null)}
          onSave={async (drafts) => {
            const created: DailyPlannerTask[] = [];
            for (const draft of drafts) {
              const createdTask = await createDailyPlannerTaskForEmployee({
                ...draft,
                date: createDate,
                employeeCode: selectedEmployeeCode,
                skipRevisedEmail: true,
              });
              created.push(createdTask);
            }
            const dayWasFinalized = created.some((task) => Boolean(task.planFinalizedAt));
            if (dayWasFinalized) {
              const finalized = await finalizeEmployeeDailyPlan(
                selectedEmployeeCode,
                createDate,
                { refinalize: true },
              );
              if (finalized.tasks.length) {
                await refreshTasks(finalized.tasks, { replaceEmployeeDate: true });
              } else {
                await refreshTasks(created);
              }
            } else {
              await refreshTasks(created);
            }
            toast.success(
              created.length === 1
                ? 'Task added for employee'
                : `${created.length} tasks added for employee`,
            );
            setCreateDate(null);
          }}
        />
      ) : null}
    </TooltipPrimitive.Provider>
  );
}
