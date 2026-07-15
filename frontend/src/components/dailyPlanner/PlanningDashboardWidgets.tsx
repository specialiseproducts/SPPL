import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  useManagerPlanningDashboardQuery,
  usePlanningDashboardQuery,
} from '../../hooks/dailyPlanner/useDailyPlannerQueries';
import { formatPlannerRating, getPlanningBadgeStyle } from '../../utils/planningRecognition';
import { isQueryColdLoading } from '../../utils/queryLoading';
import { canManageDailyPlannerTeam } from '../../utils/accessControl';
import type { UserRole } from '../../App';

interface PlanningDashboardWidgetsProps {
  showDailyPlanner: boolean;
  dailyPlannerRole?: UserRole;
  onOpenDailyPlanner: () => void;
  onOpenTeamPerformance?: () => void;
}

function BadgePill({ badge, badgeEmoji }: { badge: string; badgeEmoji?: string }) {
  const style = getPlanningBadgeStyle(badge || 'No Badge');
  const label = badgeEmoji ? `${badgeEmoji} ${badge}` : badge;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      {label}
    </span>
  );
}

export default function PlanningDashboardWidgets({
  showDailyPlanner,
  dailyPlannerRole,
  onOpenDailyPlanner,
  onOpenTeamPerformance,
}: PlanningDashboardWidgetsProps) {
  const employeeQuery = usePlanningDashboardQuery(showDailyPlanner);
  const isManager = canManageDailyPlannerTeam(String(dailyPlannerRole || ''));
  const managerQuery = useManagerPlanningDashboardQuery(showDailyPlanner && isManager);

  if (!showDailyPlanner) return null;

  const employeeLoading = isQueryColdLoading(employeeQuery);
  const employee = employeeQuery.data;
  const managerLoading = isQueryColdLoading(managerQuery);
  const manager = managerQuery.data;

  const ratingRecord = employee
    ? {
        employeeCode: '',
        year: employee.year,
        month: employee.month,
        yearMonth: employee.yearMonth,
        rawScore: 0,
        maxScore: 0,
        normalizedScore: employee.planningScore,
        planningScore: employee.planningScore,
        planningAheadPercent: employee.planningAheadPercent,
        daysPlannedAhead: 0,
        regularTaskCount: 0,
        urgentTaskCount: 0,
        badge: employee.badge,
        badgeEmoji: employee.badgeEmoji,
        rating: employee.rating,
        ratingLabel: employee.ratingLabel,
        ratingStars: employee.ratingStars,
        workingDays: 0,
      }
    : null;

  return (
    <div className="mb-6 space-y-4">
      <Card className="border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-[#212529]">Planning Performance</h3>
        {employeeLoading ? (
          <p className="text-sm text-muted-foreground">Loading planning performance…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Current Planning Score</p>
              <p className="mt-1 text-2xl font-semibold text-[#212529]">
                {employee?.planningScore ?? 0} / 100
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Planner Badge</p>
              <div className="mt-1">
                <BadgePill badge={employee?.badge || 'No Badge'} badgeEmoji={employee?.badgeEmoji} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Planning Ahead %</p>
              <p className="mt-1 text-lg font-medium text-[#212529]">
                {employee?.planningAheadPercent ?? 0}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Current Month Rank</p>
              <p className="mt-1 text-lg font-medium text-[#212529]">
                {employee?.managerRank
                  ? `#${employee.managerRank}`
                  : employee?.managerTeamSize
                    ? '—'
                    : 'N/A'}
              </p>
              {employee?.managerTeamSize ? (
                <p className="text-xs text-muted-foreground">
                  among {employee.managerTeamSize} team members
                </p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-gray-500">Current Rating</p>
              <p className="mt-1 text-sm text-[#212529]">
                {ratingRecord ? formatPlannerRating(ratingRecord) : '—'}
              </p>
            </div>
            <div className="md:col-span-2 xl:col-span-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Planning Score</span>
                <span>{employee?.progressPercent ?? 0}%</span>
              </div>
              <Progress value={employee?.progressPercent ?? 0} className="mt-2 h-2" />
            </div>
          </div>
        )}
        <div className="mt-4">
          <Button type="button" className="bg-[#007BFF] hover:bg-[#0056b3]" onClick={onOpenDailyPlanner}>
            View Daily Planner
          </Button>
        </div>
      </Card>

      {isManager ? (
        <Card className="border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-[#212529]">Team Planning Overview</h3>
          {managerLoading ? (
            <p className="text-sm text-muted-foreground">Loading team overview…</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Average Team Score" value={`${manager?.averageTeamScore ?? 0} / 100`} />
              <Metric
                label="Best Planner"
                value={
                  manager?.bestPlanner
                    ? `${manager.bestPlanner.employeeName} (${manager.bestPlanner.planningScore})`
                    : '—'
                }
              />
              <Metric
                label="Lowest Planner"
                value={
                  manager?.lowestPlanner
                    ? `${manager.lowestPlanner.employeeName} (${manager.lowestPlanner.planningScore})`
                    : '—'
                }
              />
              <Metric label="Platinum Employees" value={String(manager?.platinumEmployees ?? 0)} />
              <Metric label="Gold Employees" value={String(manager?.goldEmployees ?? 0)} />
              <Metric
                label="Employees Needing Improvement"
                value={String(manager?.employeesNeedingImprovement ?? 0)}
              />
              <Metric label="Planning Ahead %" value={`${manager?.planningAheadPercent ?? 0}%`} />
            </div>
          )}
          {onOpenTeamPerformance ? (
            <div className="mt-4">
              <Button type="button" variant="outline" onClick={onOpenTeamPerformance}>
                Open Team Performance
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#212529]">{value}</p>
    </div>
  );
}
