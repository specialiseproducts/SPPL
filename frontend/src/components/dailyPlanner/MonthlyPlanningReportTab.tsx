import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  usePlanningReportQuery,
  useTeamMappingsQuery,
} from '../../hooks/dailyPlanner/useDailyPlannerQueries';
import { fetchPlanningExportPayload } from '../../hooks/dailyPlanner/planningAnalyticsApi';
import { formatPlannerRating, getPlanningBadgeStyle } from '../../utils/planningRecognition';
import { exportPlanningReportExcel, exportPlanningReportPdf } from '../../utils/planningReportExport';
import { isQueryColdLoading } from '../../utils/queryLoading';
import { canManageDailyPlannerTeam } from '../../utils/accessControl';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../App';
import type { PlanningReportData } from '../../types/planningAnalytics';

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

const chartConfig = {
  score: { label: 'Planning Score', color: '#007BFF' },
  percent: { label: 'Planning Ahead %', color: '#027A48' },
  urgent: { label: 'Urgent Tasks', color: '#B42318' },
  regular: { label: 'Regular Tasks', color: '#027A48' },
};

interface MonthlyPlanningReportTabProps {
  moduleRole: UserRole;
}

function BadgePill({ badge, badgeEmoji }: { badge: string; badgeEmoji?: string }) {
  const style = getPlanningBadgeStyle(badge || 'No Badge');
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      {badgeEmoji ? `${badgeEmoji} ${badge}` : badge}
    </span>
  );
}

function formatMonthShort(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  if (!year || !month) return yearMonth;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    timeZone: 'UTC',
  });
}

export default function MonthlyPlanningReportTab({ moduleRole }: MonthlyPlanningReportTabProps) {
  const { user } = useAuth();
  const now = new Date();
  const [view, setView] = useState({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });
  const [employeeCode, setEmployeeCode] = useState('me');
  const [badgeFilter, setBadgeFilter] = useState<string>('All');
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);

  const isManager = canManageDailyPlannerTeam(moduleRole);
  const mappingsQuery = useTeamMappingsQuery(isManager);
  const managerCode = String(user?.employeeCode || user?.id || '').trim();

  const employeeOptions = useMemo(() => {
    if (!isManager) return [];
    const mappings = mappingsQuery.data ?? [];
    return mappings
      .filter((m) => m.status === 'Active' && m.managerCode === managerCode)
      .map((m) => ({ value: m.employeeCode, label: m.employeeName || m.employeeCode }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [isManager, mappingsQuery.data, managerCode]);

  const reportEmployeeCode = employeeCode === 'team' ? 'me' : employeeCode;
  const reportQuery = usePlanningReportQuery(
    view.year,
    view.month,
    reportEmployeeCode,
    true,
  );
  const isLoading = isQueryColdLoading(reportQuery);
  const report = reportQuery.data;

  const yearOptions = useMemo(() => {
    const base = now.getUTCFullYear();
    return Array.from({ length: 11 }, (_, i) => base - 5 + i);
  }, [now]);

  const showReport =
    report &&
    (badgeFilter === 'All' || report.summary.badge === badgeFilter);

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    try {
      setExporting(format);
      const scope = isManager && employeeCode === 'team' ? 'team' : 'self';
      const payload = await fetchPlanningExportPayload(
        view.year,
        view.month,
        scope,
        employeeCode !== 'me' && employeeCode !== 'team' ? employeeCode : undefined,
      );
      if (format === 'xlsx') {
        await exportPlanningReportExcel(payload as PlanningReportData & { scope: 'self' | 'team' });
      } else {
        exportPlanningReportPdf(payload as PlanningReportData & { scope: 'self' | 'team' });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <Card className="border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-[#212529]">Monthly Planning Report</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Month"
            value={String(view.month)}
            onValueChange={(value) => setView((v) => ({ ...v, month: Number(value) }))}
            options={MONTHS.map((label, index) => ({ value: String(index + 1), label }))}
          />
          <FilterSelect
            label="Year"
            value={String(view.year)}
            onValueChange={(value) => setView((v) => ({ ...v, year: Number(value) }))}
            options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
          />
          {isManager ? (
            <FilterSelect
              label="Employee"
              value={employeeCode}
              onValueChange={setEmployeeCode}
              options={[
                { value: 'me', label: 'My Report' },
                { value: 'team', label: 'Full Team (Export)' },
                ...employeeOptions,
              ]}
            />
          ) : null}
          <FilterSelect
            label="Badge"
            value={badgeFilter}
            onValueChange={setBadgeFilter}
            options={BADGE_FILTERS.map((badge) => ({ value: badge, label: badge }))}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!!exporting}
            onClick={() => void handleExport('xlsx')}
          >
            {exporting === 'xlsx' ? 'Exporting…' : 'Export Excel'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!!exporting}
            onClick={() => void handleExport('pdf')}
          >
            {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Card className="border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Generating report…</p>
        </Card>
      ) : !showReport ? (
        <Card className="border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">No report matches the selected filters.</p>
        </Card>
      ) : (
        <>
          <Card className="border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-[#212529]">Summary</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SummaryItem label="Planning Score" value={`${report.summary.planningScore} / 100`} indicator={report.indicators.planningScore.label} />
              <SummaryItem label="Planner Badge" value={<BadgePill badge={report.summary.badge} badgeEmoji={report.summary.badgeEmoji} />} indicator={report.indicators.badge.label} />
              <SummaryItem label="Planning %" value={`${report.summary.planningAheadPercent}%`} indicator={report.indicators.planningAheadPercent.label} />
              <SummaryItem label="Working Days" value={String(report.summary.workingDays)} />
              <SummaryItem label="Days Planned Ahead" value={String(report.summary.daysPlannedAhead)} />
              <SummaryItem label="Regular Tasks" value={String(report.summary.regularTaskCount)} />
              <SummaryItem label="Urgent Tasks" value={String(report.summary.urgentTaskCount)} />
              <SummaryItem label="Late Planning Days" value={String(report.summary.latePlanningDays)} />
            </div>
            <div className="mt-4">
              <p className="text-xs text-gray-500">Performance Rating</p>
              <p className="mt-1 text-sm text-[#212529]">
                {formatPlannerRating({
                  employeeCode: report.employeeCode,
                  year: report.year,
                  month: report.month,
                  yearMonth: report.yearMonth,
                  rawScore: 0,
                  maxScore: 0,
                  normalizedScore: report.summary.planningScore,
                  planningScore: report.summary.planningScore,
                  planningAheadPercent: report.summary.planningAheadPercent,
                  daysPlannedAhead: report.summary.daysPlannedAhead,
                  regularTaskCount: report.summary.regularTaskCount,
                  urgentTaskCount: report.summary.urgentTaskCount,
                  badge: report.summary.badge,
                  badgeEmoji: report.summary.badgeEmoji,
                  rating: report.summary.rating,
                  ratingLabel: report.summary.ratingLabel,
                  ratingStars: report.summary.ratingStars,
                  workingDays: report.summary.workingDays,
                })}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <BreakdownPill label="Excellent" active={report.performanceBreakdown.excellent} />
              <BreakdownPill label="Good" active={report.performanceBreakdown.good} />
              <BreakdownPill label="Average" active={report.performanceBreakdown.average} />
              <BreakdownPill label="Needs Improvement" active={report.performanceBreakdown.needsImprovement} />
            </div>
            <p className="mt-4 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-[#212529]">
              {report.monthlyComment}
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TrendChart title="Planning Score by Month" data={report.chartSeries.planningScoreByMonth} color="#007BFF" />
            <TrendChart title="Planning Ahead %" data={report.chartSeries.planningAheadPercentByMonth} color="#027A48" />
            <TrendChart title="Urgent Task Count" data={report.chartSeries.urgentTaskCountByMonth} color="#B42318" />
            <TrendChart title="Regular Task Count" data={report.chartSeries.regularTaskCountByMonth} color="#007BFF" />
          </div>

          <Card className="border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-[#212529]">Badge History</h3>
            <div className="space-y-2">
              {report.chartSeries.badgeHistory.map((row) => (
                <div key={row.yearMonth} className="flex items-center justify-between text-sm">
                  <span>{formatMonthShort(row.yearMonth)}</span>
                  <BadgePill badge={row.badge} badgeEmoji={row.badgeEmoji} />
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-[#212529]">Trend Highlights</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryItem label="Highest Ever Score" value={`${report.trends.highestEverScore} / 100`} />
              <SummaryItem label="Average Score" value={`${report.trends.averageScore} / 100`} />
              <SummaryItem label="Longest Platinum Streak" value={`${report.trends.longestPlatinumStreak} months`} />
              <SummaryItem label="Planning Growth %" value={`${report.trends.planningGrowthPercent}%`} />
              <SummaryItem
                label="Best Month"
                value={report.trends.bestMonth ? `${formatMonthShort(report.trends.bestMonth.yearMonth)} (${report.trends.bestMonth.planningScore})` : '—'}
              />
              <SummaryItem
                label="Worst Month"
                value={report.trends.worstMonth ? `${formatMonthShort(report.trends.worstMonth.yearMonth)} (${report.trends.worstMonth.planningScore})` : '—'}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-gray-500">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  indicator,
}: {
  label: string;
  value: ReactNode;
  indicator?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-[#212529]">{value}</div>
      {indicator ? <p className="mt-1 text-xs text-gray-500">{indicator}</p> : null}
    </div>
  );
}

function BreakdownPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`rounded-md border px-3 py-2 text-center text-xs font-medium ${
        active ? 'border-[#007BFF] bg-blue-50 text-[#007BFF]' : 'border-gray-200 bg-white text-gray-500'
      }`}
    >
      {label}
    </div>
  );
}

function TrendChart({
  title,
  data,
  color,
}: {
  title: string;
  data: Array<{ yearMonth: string; value: number }>;
  color: string;
}) {
  const series = data.map((row) => ({ label: formatMonthShort(row.yearMonth), value: row.value }));
  return (
    <Card className="border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-[#212529]">{title}</h3>
      <ChartContainer config={chartConfig} className="h-56 w-full">
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot />
        </LineChart>
      </ChartContainer>
    </Card>
  );
}
