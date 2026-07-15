import { useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useTeamPerformanceQuery } from '../../hooks/dailyPlanner/useDailyPlannerQueries';
import type { TeamPerformanceEmployeeRow } from '../../types/teamPerformance';
import {
  formatPlannerRating,
  getPlanningBadgeStyle,
} from '../../utils/planningRecognition';
import { isQueryColdLoading } from '../../utils/queryLoading';
import { cn } from '../ui/utils';
import TeamPerformanceHistoricalTab from './TeamPerformanceHistoricalTab';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const BADGE_FILTERS = [
  'All',
  'Platinum Planner',
  'Gold Planner',
  'Silver Planner',
  'Bronze Planner',
  'No Badge',
] as const;

const SCORE_FILTERS = [
  { value: 'all', label: 'All Scores' },
  { value: 'excellent', label: 'Excellent (90+)' },
  { value: 'good', label: 'Good (75–89)' },
  { value: 'average', label: 'Average (55–74)' },
  { value: 'needs', label: 'Needs Improvement (<55)' },
] as const;

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Excellent: { bg: '#ECFDF3', text: '#027A48', border: '#A6F4C5' },
  Good: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  Average: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  'Needs Improvement': { bg: '#FEF3F2', text: '#B42318', border: '#FECDCA' },
};

function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <Card className="border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#212529]">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </Card>
  );
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

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.Average;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      {status}
    </span>
  );
}

function formatMonthLabel(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function matchesScoreFilter(score: number, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'excellent') return score >= 90;
  if (filter === 'good') return score >= 75 && score < 90;
  if (filter === 'average') return score >= 55 && score < 75;
  if (filter === 'needs') return score < 55;
  return true;
}

function employeeRowToMonthlyRecord(row: TeamPerformanceEmployeeRow) {
  return {
    employeeCode: row.employeeCode,
    year: row.year,
    month: row.month,
    yearMonth: row.yearMonth,
    rawScore: 0,
    maxScore: 0,
    normalizedScore: row.planningScore,
    planningScore: row.planningScore,
    planningAheadPercent: row.planningAheadPercent,
    daysPlannedAhead: row.daysPlannedAhead,
    regularTaskCount: row.regularTaskCount,
    urgentTaskCount: row.urgentTaskCount,
    badge: row.badge,
    badgeEmoji: row.badgeEmoji,
    rating: row.rating,
    ratingLabel: row.ratingLabel || row.rating,
    ratingStars: row.ratingStars,
    workingDays: row.workingDays,
  };
}

export function TeamPerformanceOverviewTab() {
  const now = new Date();
  const [view, setView] = useState({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [badgeFilter, setBadgeFilter] = useState<string>('All');
  const [scoreFilter, setScoreFilter] = useState('all');

  const performanceQuery = useTeamPerformanceQuery(view.year, view.month);
  const data = performanceQuery.data;
  const isLoading = isQueryColdLoading(performanceQuery);

  const employeeOptions = useMemo(
    () =>
      (data?.employees ?? []).map((row) => ({
        value: row.employeeCode,
        label: row.employeeName,
      })),
    [data?.employees],
  );

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.employees ?? []).filter((row) => {
      if (employeeFilter !== 'all' && row.employeeCode !== employeeFilter) return false;
      if (badgeFilter !== 'All' && row.badge !== badgeFilter) return false;
      if (!matchesScoreFilter(row.planningScore, scoreFilter)) return false;
      if (!query) return true;
      return (
        row.employeeName.toLowerCase().includes(query) ||
        row.employeeCode.toLowerCase().includes(query)
      );
    });
  }, [data?.employees, search, employeeFilter, badgeFilter, scoreFilter]);

  const yearOptions = useMemo(() => {
    const base = now.getUTCFullYear();
    return Array.from({ length: 11 }, (_, i) => base - 5 + i);
  }, [now]);

  const topPlanner = data?.summary.topPlanner;

  return (
    <div className="space-y-6 pb-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Average Team Score"
          value={isLoading ? '—' : `${data?.summary.averageTeamScore ?? 0} / 100`}
          subtitle="Average planning score of all team members."
        />
        <SummaryCard
          title="Top Planner"
          value={
            isLoading || !topPlanner
              ? '—'
              : `${topPlanner.badgeEmoji ? `${topPlanner.badgeEmoji} ` : ''}${topPlanner.employeeName}`
          }
          subtitle={
            topPlanner ? `${topPlanner.planningScore} / 100` : 'No team members assigned yet.'
          }
        />
        <SummaryCard
          title="Planning Ahead %"
          value={isLoading ? '—' : `${data?.summary.averagePlanningAheadPercent ?? 0}%`}
          subtitle="Average planning-ahead percentage across the team."
        />
        <SummaryCard
          title="Team Size"
          value={isLoading ? '—' : `${data?.summary.teamSize ?? 0} Employees`}
        />
      </div>

      <Card className="border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-[#212529]">Top Team Performers</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading leaderboard…</p>
        ) : (data?.leaderboard.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No team members to display.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Planning Score</TableHead>
                  <TableHead>Planner Badge</TableHead>
                  <TableHead>Planning %</TableHead>
                  <TableHead>Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.leaderboard.map((row) => (
                  <TableRow key={row.employeeCode}>
                    <TableCell className="font-medium">#{row.rank}</TableCell>
                    <TableCell>{row.employeeName}</TableCell>
                    <TableCell>{row.planningScore}</TableCell>
                    <TableCell>
                      <BadgePill badge={row.badge} badgeEmoji={row.badgeEmoji} />
                    </TableCell>
                    <TableCell>{row.planningAheadPercent}%</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatPlannerRating(employeeRowToMonthlyRecord(row))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h3 className="text-sm font-semibold text-[#212529]">Team Performance</h3>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-4xl lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Search</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Employee name or code"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Employee</Label>
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger><SelectValue placeholder="All employees" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employeeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Badge</Label>
              <Select value={badgeFilter} onValueChange={setBadgeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BADGE_FILTERS.map((badge) => (
                    <SelectItem key={badge} value={badge}>
                      {badge}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Score</Label>
              <Select value={scoreFilter} onValueChange={setScoreFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCORE_FILTERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Month</Label>
              <div className="flex gap-2">
                <Select
                  value={String(view.month)}
                  onValueChange={(value) =>
                    setView((current) => ({ ...current, month: Number(value) }))
                  }
                >
                  <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((label, index) => (
                      <SelectItem key={label} value={String(index + 1)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(view.year)}
                  onValueChange={(value) =>
                    setView((current) => ({ ...current, year: Number(value) }))
                  }
                >
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading team performance…</p>
        ) : filteredEmployees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No employees match the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Planning Score</TableHead>
                  <TableHead>Planner Badge</TableHead>
                  <TableHead>Planning %</TableHead>
                  <TableHead>Working Days</TableHead>
                  <TableHead>Planned Ahead</TableHead>
                  <TableHead>Regular Tasks</TableHead>
                  <TableHead>Urgent Tasks</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Current Month</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((row) => (
                  <TableRow key={row.employeeCode}>
                    <TableCell className="font-medium">{row.employeeName}</TableCell>
                    <TableCell>{row.planningScore}</TableCell>
                    <TableCell>
                      <BadgePill badge={row.badge} badgeEmoji={row.badgeEmoji} />
                    </TableCell>
                    <TableCell>{row.planningAheadPercent}%</TableCell>
                    <TableCell>{row.workingDays}</TableCell>
                    <TableCell>{row.daysPlannedAhead}</TableCell>
                    <TableCell>{row.regularTaskCount}</TableCell>
                    <TableCell>{row.urgentTaskCount}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatPlannerRating(employeeRowToMonthlyRecord(row))}
                    </TableCell>
                    <TableCell>{formatMonthLabel(row.year, row.month)}</TableCell>
                    <TableCell>
                      <StatusPill status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-[#212529]">Planner Badge Distribution</h3>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading distribution…</p>
          ) : (
            <div className="space-y-3">
              {(data?.badgeDistribution ?? []).map((row) => (
                <div
                  key={row.badge}
                  className={cn(
                    'flex items-center justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0',
                    row.count === 0 && 'opacity-60',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <BadgePill
                      badge={row.badge}
                      badgeEmoji={row.emoji || undefined}
                    />
                    <span className="text-sm text-[#212529]">
                      {row.count} Employee{row.count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{row.percent}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-[#212529]">Planning Insights</h3>
          {isLoading || !data ? (
            <p className="text-sm text-muted-foreground">Loading insights…</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InsightItem label="Highest Planning Score" value={`${data.insights.highestPlanningScore} / 100`} />
              <InsightItem label="Lowest Planning Score" value={`${data.insights.lowestPlanningScore} / 100`} />
              <InsightItem label="Average Planning Score" value={`${data.insights.averagePlanningScore} / 100`} />
              <InsightItem label="Average Planning %" value={`${data.insights.averagePlanningPercent}%`} />
              <InsightItem label="Total Urgent Tasks" value={String(data.insights.totalUrgentTasks)} />
              <InsightItem label="Total Regular Tasks" value={String(data.insights.totalRegularTasks)} />
              <InsightItem
                label="Average Urgent Tasks per Employee"
                value={String(data.insights.averageUrgentTasksPerEmployee)}
              />
              <InsightItem
                label="Best Planner"
                value={
                  data.insights.bestPlanner
                    ? `${data.insights.bestPlanner.badgeEmoji ? `${data.insights.bestPlanner.badgeEmoji} ` : ''}${data.insights.bestPlanner.employeeName}`
                    : '—'
                }
              />
              <InsightItem
                label="Needs Most Improvement"
                value={
                  data.insights.needsMostImprovement
                    ? `${data.insights.needsMostImprovement.employeeName} (${data.insights.needsMostImprovement.planningScore} / 100)`
                    : '—'
                }
                className="sm:col-span-2"
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function TeamPerformanceTab() {
  const [tab, setTab] = useState('overview');
  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="mb-4 grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="overview">Team Performance</TabsTrigger>
        <TabsTrigger value="history">Historical Trends</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="outline-none">
        <TeamPerformanceOverviewTab />
      </TabsContent>
      <TabsContent value="history" className="outline-none">
        <TeamPerformanceHistoricalTab />
      </TabsContent>
    </Tabs>
  );
}

function InsightItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-[#212529]">{value}</p>
    </div>
  );
}
