import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { toast } from 'sonner';
import {
  useDailyPlannerMonthQuery,
  useInvalidateDailyPlannerQueries,
  useMyPlanningProfileQuery,
  usePlanningConfigQuery,
} from '../../hooks/dailyPlanner/useDailyPlannerQueries';
import { createDailyPlannerTasks } from '../../hooks/dailyPlanner/dailyPlannerApi';
import {
  markRevisionParentHandledInCache,
  removePlannerTasksFromCache,
  upsertPlannerTasksInCache,
} from '../../hooks/dailyPlanner/dailyPlannerCache';
import { dailyPlannerQueryKeys } from '../../hooks/dailyPlanner/dailyPlannerQueryKeys';
import type { DailyPlannerTask } from '../../types/dailyPlanner';
import DailyPlannerCreateTaskModal from './DailyPlannerCreateTaskModal';
import DailyPlannerDayTasksModal from './DailyPlannerDayTasksModal';
import DailyPlannerTaskChip from './DailyPlannerTaskChip';
import CalendarHolidayDayHeader from '../calendar/CalendarHolidayDayHeader';
import PlanningPerformanceDashboard from './PlanningPerformanceDashboard';
import {
  buildDailyMonthGrid,
  DAILY_STATUS_LEGEND,
  todayIso,
  tomorrowIso,
  visibleEmployeePlannerTasks,
  WEEKDAY_LABELS,
  type DailyCalendarDayCell,
} from './dailyPlannerUtils';
import { useAuth } from '../../context/AuthContext';
import {
  evaluateMyDailyPlannerCreateEligibility,
  REGULAR_TASK_TODAY_BLOCKED_MESSAGE,
} from '../../utils/planningRecognition';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
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

function PlannerDayCell({
  cell,
  cellIndex,
  expanded,
  onToggleExpand,
  onCreate,
  onSelectTask,
}: {
  cell: DailyCalendarDayCell;
  cellIndex: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onCreate: (iso: string) => void;
  onSelectTask: (task: DailyPlannerTask) => void;
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
        {visibleTasks.map((task) => (
          <DailyPlannerTaskChip key={task.plannerTaskId} task={task} onSelect={onSelectTask} />
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

export default function MyDailyPlannerTab() {
  const { user } = useAuth();
  const employeeLocation = user?.location || 'Office';
  const now = new Date();
  const [view, setView] = useState({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });
  const { year, month } = view;
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [createBlockedReason, setCreateBlockedReason] = useState<string | null>(null);
  const [reviseTaskId, setReviseTaskId] = useState<string | null>(null);
  const [dayDate, setDayDate] = useState<string | null>(null);

  const monthQuery = useDailyPlannerMonthQuery(year, month);
  const planningConfigQuery = usePlanningConfigQuery();
  const planningProfileQuery = useMyPlanningProfileQuery();
  const invalidate = useInvalidateDailyPlannerQueries();
  const queryClient = useQueryClient();
  const tasks = useMemo(
    () => visibleEmployeePlannerTasks(monthQuery.data ?? []),
    [monthQuery.data],
  );
  const grid = useMemo(
    () => buildDailyMonthGrid(year, month, tasks, employeeLocation),
    [year, month, tasks, employeeLocation],
  );
  const dayTasks = useMemo(
    () => (dayDate ? tasks.filter((t) => t.date === dayDate) : []),
    [tasks, dayDate],
  );

  const yearOptions = useMemo(() => {
    const base = now.getUTCFullYear();
    return Array.from({ length: 11 }, (_, i) => base - 5 + i);
  }, [now]);

  const refresh = (patch?: {
    upsert?: DailyPlannerTask[];
    removeIds?: string[];
    hideRevisionParentId?: string;
  }) => {
    if (patch?.upsert?.length) {
      upsertPlannerTasksInCache(queryClient, patch.upsert);
    }
    if (patch?.removeIds?.length) {
      removePlannerTasksFromCache(queryClient, patch.removeIds);
    }
    if (patch?.hideRevisionParentId) {
      markRevisionParentHandledInCache(
        queryClient,
        patch.hideRevisionParentId,
        'custom_revision',
        patch.upsert?.[0]?.plannerTaskId,
      );
    }
    if (patch?.upsert?.length || patch?.removeIds?.length || patch?.hideRevisionParentId) {
      // Task lists already updated in cache — avoid full Daily Planner refetch lag.
      void queryClient.invalidateQueries({
        queryKey: dailyPlannerQueryKeys.planningProfile(),
      });
      void queryClient.invalidateQueries({
        queryKey: dailyPlannerQueryKeys.planningDashboard(),
      });
      return;
    }
    invalidate();
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('sppl_notification_focus');
      if (!raw) return;
      const focus = JSON.parse(raw) as {
        module?: string;
        focus?: string;
        actionId?: string;
        plannerDate?: string;
        at?: number;
      };
      if (focus.module && focus.module !== 'dailyPlanner') return;
      if (focus.at && Date.now() - Number(focus.at) > 60_000) {
        sessionStorage.removeItem('sppl_notification_focus');
        return;
      }
      sessionStorage.removeItem('sppl_notification_focus');

      if (focus.focus === 'planning-performance') {
        window.requestAnimationFrame(() => {
          document.getElementById('planning-performance')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
        return;
      }

      const date = String(focus.plannerDate || '').trim();
      if (date) {
        const [y, m] = date.split('-').map(Number);
        if (y && m) setView({ year: y, month: m });
        setDayDate(date);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const openCreate = (iso: string, revisesTaskId?: string | null) => {
    const config = planningConfigQuery.data;
    if (!config) {
      toast.error('Planning window information is loading. Please try again.');
      return;
    }

    const eligibility = evaluateMyDailyPlannerCreateEligibility(iso, config);
    if (!eligibility.allowed) {
      toast.error(eligibility.message);
      return;
    }

    setReviseTaskId(revisesTaskId || null);
    if (eligibility.mode === 'urgent') {
      setCreateBlockedReason(REGULAR_TASK_TODAY_BLOCKED_MESSAGE);
      setCreateDate(iso);
      return;
    }

    setCreateBlockedReason(null);
    setCreateDate(iso);
  };
  const openDay = (iso: string) => setDayDate(iso);

  const handlePlanTomorrow = () => {
    const config = planningConfigQuery.data;
    if (!config) {
      toast.error('Planning window information is loading. Please try again.');
      return;
    }
    const tomorrow = config.tomorrowIst || tomorrowIso();
    const eligibility = evaluateMyDailyPlannerCreateEligibility(tomorrow, config);
    if (!eligibility.allowed) {
      toast.error(eligibility.message);
      return;
    }
    setReviseTaskId(null);
    setCreateBlockedReason(null);
    setCreateDate(tomorrow);
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
      <div className="w-full space-y-4 pb-6">
        <div id="planning-performance">
          <PlanningPerformanceDashboard
            record={planningProfileQuery.data?.currentMonth}
            loading={planningProfileQuery.isLoading}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => openDay(todayIso())}>
            Today&apos;s Tasks
          </Button>
          <Button type="button" className="bg-[#007BFF] hover:bg-[#0056b3]" onClick={handlePlanTomorrow}>
            Plan Tomorrow
          </Button>
        </div>

        <Card className="w-full border-gray-200 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  setView((v) => {
                    let m = v.month - 1;
                    let y = v.year;
                    if (m < 1) {
                      m = 12;
                      y -= 1;
                    }
                    return { year: y, month: m };
                  })
                }
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  setView((v) => {
                    let m = v.month + 1;
                    let y = v.year;
                    if (m > 12) {
                      m = 1;
                      y += 1;
                    }
                    return { year: y, month: m };
                  })
                }
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="border-input bg-background h-9 min-w-[8.5rem] rounded-md border px-2 text-sm"
                value={month}
                onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value) }))}
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
                onChange={(e) => setView((v) => ({ ...v, year: Number(e.target.value) }))}
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
                  onSelectTask={() => openDay(cell.iso)}
                />
              ))}
            </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          Double-click a date to create a task. Click a task chip to review and update status.
        </p>

        <DailyPlannerCreateTaskModal
          open={!!createDate}
          date={createDate ?? ''}
          planningConfig={planningConfigQuery.data}
          regularCreationBlockedMessage={createBlockedReason}
          onClose={() => {
            setCreateDate(null);
            setCreateBlockedReason(null);
            setReviseTaskId(null);
          }}
          onSave={async (drafts) => {
            const payload =
              reviseTaskId && drafts.length > 0
                ? drafts.map((draft, index) =>
                    index === 0 ? { ...draft, revisesTaskId: reviseTaskId } : draft,
                  )
                : drafts;
            const created = await createDailyPlannerTasks(payload, planningConfigQuery.data);
            toast.success(
              drafts.length === 1 ? 'Task created' : `${drafts.length} tasks created`,
            );
            const parentId = reviseTaskId;
            setReviseTaskId(null);
            setCreateBlockedReason(null);
            refresh({
              upsert: created,
              hideRevisionParentId: parentId || undefined,
            });
          }}
        />

        <DailyPlannerDayTasksModal
          open={!!dayDate}
          date={dayDate ?? ''}
          tasks={dayTasks}
          planningConfig={planningConfigQuery.data}
          onClose={() => setDayDate(null)}
          onChanged={refresh}
          onAddTask={(revisesTaskId) => {
            if (!dayDate) return;
            openCreate(dayDate, revisesTaskId);
          }}
        />
      </div>
    </TooltipPrimitive.Provider>
  );
}
