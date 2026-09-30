/**
 * Super Admin — Expenses Admin Dashboard.
 * Phase 1 Company Overview · Phase 2A Month · Phase 2B Expense Head · Phase 2C Subcategory · Phase 2D Employee filter.
 * Approved + non-deleted · server-side analytics API.
 */

import { useMemo, useState, type ComponentType, type MouseEvent } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, CalendarDays, FileText, PieChart as PieChartIcon, RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import {
  useCompanyOverviewQuery,
  useDashboardEmployeesQuery,
  useExpenseHeadAnalysisQuery,
  useExpenseSubcategoryAnalysisQuery,
} from '../../hooks/expenses/useExpensesQueries';
import { isQueryColdLoading } from '../../utils/queryLoading';
import type {
  CompanyOverviewData,
  CompanyOverviewEmployeeExpense,
  CompanyOverviewLocation,
  CompanyOverviewMonthlyPoint,
  CompanyOverviewPurpose,
  CompanyOverviewServiceProvider,
  ExpenseHeadAnalysisData,
  ExpenseSubcategoryTransaction,
  MonthWaterfallData,
} from '../../hooks/expenses/expensesApi';
import { getExpenseTransactionDetailColumns } from '../../utils/expenseEditFields';

const HEAD_COLORS = [
  '#007BFF',
  '#027A48',
  '#B54708',
  '#6941C6',
  '#C11574',
  '#026AA2',
  '#B42318',
  '#3E4784',
  '#087443',
  '#DC6803',
];

/** Select value for company-wide analytics (no employeeCode sent to API). */
const ALL_EMPLOYEES_VALUE = 'all';

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const MONTH_FULL = [
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

/** YYYY-MM → sortable number */
function yyyyMmSortKey(value: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const y = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return y * 100 + m;
}

/** Expenses.monthYear (MM-YYYY) → API YYYY-MM */
function monthYearToYyyyMm(monthYear: string): string | null {
  const match = /^(\d{2})-(\d{4})$/.exec(String(monthYear ?? '').trim());
  if (!match) return null;
  const m = Number.parseInt(match[1], 10);
  const y = Number.parseInt(match[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function formatYyyyMmLabel(value: string): string {
  const key = yyyyMmSortKey(value);
  if (key == null) return value;
  const y = Math.floor(key / 100);
  const m = key % 100;
  return `${MONTH_SHORT[m - 1]} ${y}`;
}

function formatYyyyMmFullLabel(value: string): string {
  const key = yyyyMmSortKey(value);
  if (key == null) return value;
  const y = Math.floor(key / 100);
  const m = key % 100;
  return `${MONTH_FULL[m - 1]} ${y}`;
}

/** Default = latest 12 calendar months (inclusive), matching prior backend behavior. */
function buildDefaultRangeYyyyMm(reference = new Date()): { from: string; to: string } {
  let year = reference.getUTCFullYear();
  let month = reference.getUTCMonth() + 1;
  const to = `${year}-${String(month).padStart(2, '0')}`;
  for (let i = 0; i < 11; i += 1) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  const from = `${year}-${String(month).padStart(2, '0')}`;
  return { from, to };
}

/** Month options for the range selectors (2020-01 → current UTC month + 12). */
function buildMonthOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  let year = 2020;
  let month = 1;
  const now = new Date();
  const endYear = now.getUTCFullYear() + 1;
  const endMonth = now.getUTCMonth() + 1;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const value = `${year}-${String(month).padStart(2, '0')}`;
    options.push({ value, label: formatYyyyMmLabel(value) });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return options;
}

const MONTH_OPTIONS = buildMonthOptions();

/** Company Overview chart only — top N providers by amount (desc). Does not mutate the API array. */
function topServiceProvidersByAmount(
  providers: CompanyOverviewServiceProvider[],
  limit = 5,
): CompanyOverviewServiceProvider[] {
  return [...providers]
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.serviceProvider.localeCompare(b.serviceProvider);
    })
    .slice(0, limit);
}

/** Build inclusive amount-axis ticks at a fixed step (e.g. ₹15,000), covering max safely. */
function buildAmountAxisTicks(maxAmount: number, step = 15000): number[] {
  const safeStep = step > 0 ? step : 15000;
  const max = Math.max(0, Number(maxAmount) || 0);
  const top = Math.max(safeStep, Math.ceil(max / safeStep) * safeStep);
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += safeStep) ticks.push(v);
  return ticks;
}

function formatInr(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatInrCompact(amount: number): string {
  const n = Number(amount || 0);
  if (Math.abs(n) >= 10000000) {
    return `₹${(n / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}Cr`;
  }
  if (Math.abs(n) >= 100000) {
    return `₹${(n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}L`;
  }
  return formatInr(n);
}

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card className="flex h-full min-h-[112px] flex-col p-4 border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between gap-2 flex-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-600">{title}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className="text-2xl font-semibold text-[#212529] mt-1 tabular-nums break-words">
              {value}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-2">{hint}</p>
        </div>
        <div className="rounded-lg bg-[#007BFF]/10 p-2 text-[#007BFF] shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

function ChartCardSkeleton({ title, heightClass }: { title: string; heightClass: string }) {
  return (
    <Card className="p-4 border border-gray-200 shadow-sm">
      <h3 className="text-sm font-medium text-[#212529] mb-3">{title}</h3>
      <Skeleton className={`w-full rounded-lg ${heightClass}`} />
    </Card>
  );
}

const trendChartConfig = {
  amount: { label: 'Expenses', color: '#007BFF' },
};

const serviceProviderChartConfig = {
  amount: { label: 'Expenses', color: '#007BFF' },
};

const employeeExpenseChartConfig = {
  amount: { label: 'Expenses', color: '#007BFF' },
};

/** Service Provider bar chart. Month Analysis keeps horizontal; Company Overview uses vertical Top N. */
function ServiceProviderBarChart({
  data,
  periodLabel,
  orientation = 'horizontal',
  title = 'Service Provider Analysis',
  subtitle,
  amountTickStep,
  plotHeight,
  hideCategoryTicks = false,
  showBarAmountLabels = false,
  horizontalRowHeight = 36,
  horizontalMinHeight = 260,
}: {
  data: CompanyOverviewServiceProvider[];
  periodLabel: string;
  orientation?: 'horizontal' | 'vertical';
  title?: string;
  subtitle?: string;
  /** When set on vertical charts, force amount-axis ticks at this step (e.g. 10000). */
  amountTickStep?: number;
  /** Optional plot-area height for vertical charts (expands chart without redesigning the card). */
  plotHeight?: number;
  /** Location Analysis: hide service-provider labels on the category axis (tooltip still shows them). */
  hideCategoryTicks?: boolean;
  /** Location Analysis: show expense amount at the end of each horizontal bar. */
  showBarAmountLabels?: boolean;
  /** Horizontal chart: pixels per row (Location Analysis can pass a slightly smaller value). */
  horizontalRowHeight?: number;
  /** Horizontal chart: minimum plot height. */
  horizontalMinHeight?: number;
}) {
  const resolvedSubtitle =
    subtitle ?? `Totals by service provider · ${periodLabel}`;
  const isVertical = orientation === 'vertical';
  const chartHeight = isVertical
    ? plotHeight ?? 260
    : Math.max(horizontalMinHeight, Math.max(data.length, 1) * horizontalRowHeight);
  const maxAmount = data.reduce((m, row) => Math.max(m, Number(row.amount) || 0), 0);
  const amountTicks =
    isVertical && amountTickStep != null
      ? buildAmountAxisTicks(maxAmount, amountTickStep)
      : null;
  const amountDomainTop = amountTicks ? amountTicks[amountTicks.length - 1] : undefined;
  const horizontalRightMargin = showBarAmountLabels ? 96 : 16;
  const horizontalLeftMargin = hideCategoryTicks ? 4 : 8;
  const categoryAxisWidth = hideCategoryTicks ? 8 : 110;

  return (
    <Card className="p-4 border border-gray-200 shadow-sm h-full">
      <h3 className="text-sm font-medium text-[#212529] mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-3">{resolvedSubtitle}</p>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No service provider data available for the selected period.
        </p>
      ) : (
        <div className="w-full" style={{ height: chartHeight, minHeight: chartHeight }}>
          <ChartContainer config={serviceProviderChartConfig} className="h-full w-full aspect-auto">
            {isVertical ? (
              <BarChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="serviceProvider"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-32}
                  textAnchor="end"
                  height={62}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  interval={0}
                  ticks={amountTicks ?? undefined}
                  domain={amountDomainTop != null ? [0, amountDomainTop] : undefined}
                  allowDecimals={false}
                  tickFormatter={(v) => formatInr(Number(v))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatInr(Number(value))}
                      labelKey="serviceProvider"
                    />
                  }
                />
                <Bar dataKey="amount" fill="#007BFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart
                data={data}
                layout="vertical"
                margin={{
                  top: 4,
                  right: horizontalRightMargin,
                  left: horizontalLeftMargin,
                  bottom: 4,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatInrCompact(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="serviceProvider"
                  width={categoryAxisWidth}
                  tick={hideCategoryTicks ? false : undefined}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={hideCategoryTicks ? 0 : 6}
                />
                <ChartTooltip
                  content={
                    hideCategoryTicks ? (
                      <ChartTooltipContent
                        labelFormatter={(_value, items) =>
                          String(items?.[0]?.payload?.serviceProvider ?? '')
                        }
                        formatter={(value) => (
                          <div className="flex w-full flex-1 items-center justify-between gap-4 leading-none">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="text-foreground font-mono font-medium tabular-nums">
                              {formatInr(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    ) : (
                      <ChartTooltipContent
                        formatter={(value) => formatInr(Number(value))}
                        labelKey="serviceProvider"
                      />
                    )
                  }
                />
                <Bar dataKey="amount" fill="#007BFF" radius={[0, 4, 4, 0]}>
                  {showBarAmountLabels ? (
                    <LabelList
                      dataKey="amount"
                      position="right"
                      offset={8}
                      formatter={(value: number | string) => formatInr(Number(value))}
                      style={{ fill: '#374151', fontSize: 11 }}
                    />
                  ) : null}
                </Bar>
              </BarChart>
            )}
          </ChartContainer>
        </div>
      )}
    </Card>
  );
}

/** Company Overview — Employee by Expenses (horizontal by default; vertical for Location Analysis). */
function EmployeeByExpensesBarChart({
  data,
  periodLabel,
  orientation = 'horizontal',
  amountTickStep,
  plotHeight,
}: {
  data: CompanyOverviewEmployeeExpense[];
  periodLabel: string;
  orientation?: 'horizontal' | 'vertical';
  amountTickStep?: number;
  plotHeight?: number;
}) {
  const isVertical = orientation === 'vertical';
  const chartHeight = isVertical
    ? plotHeight ?? 280
    : Math.max(260, Math.max(data.length, 1) * 36);
  const maxAmount = data.reduce((m, row) => Math.max(m, Number(row.amount) || 0), 0);
  const amountTicks =
    isVertical && amountTickStep != null
      ? buildAmountAxisTicks(maxAmount, amountTickStep)
      : null;
  const amountDomainTop = amountTicks ? amountTicks[amountTicks.length - 1] : undefined;

  return (
    <Card className="p-4 border border-gray-200 shadow-sm h-full">
      <h3 className="text-sm font-medium text-[#212529] mb-1">Employee by Expenses</h3>
      <p className="text-xs text-gray-500 mb-3">Totals by employee · {periodLabel}</p>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No employee expense data available for the selected period.
        </p>
      ) : (
        <div className="w-full" style={{ height: chartHeight, minHeight: chartHeight }}>
          <ChartContainer config={employeeExpenseChartConfig} className="h-full w-full aspect-auto">
            {isVertical ? (
              <BarChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="employeeName"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-28}
                  textAnchor="end"
                  height={62}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  interval={0}
                  ticks={amountTicks ?? undefined}
                  domain={amountDomainTop != null ? [0, amountDomainTop] : undefined}
                  allowDecimals={false}
                  tickFormatter={(v) => formatInr(Number(v))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatInr(Number(value))}
                      labelKey="employeeName"
                    />
                  }
                />
                <Bar dataKey="amount" fill="#007BFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatInrCompact(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="employeeName"
                  width={110}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatInr(Number(value))}
                      labelKey="employeeName"
                    />
                  }
                />
                <Bar dataKey="amount" fill="#007BFF" radius={[0, 4, 4, 0]} />
              </BarChart>
            )}
          </ChartContainer>
        </div>
      )}
    </Card>
  );
}

function LocationTreemapCell(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name = '', fill = '#007BFF' } = props;
  if (width <= 0 || height <= 0) return null;
  const showLabel = width > 48 && height > 28;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#fff"
        strokeWidth={2}
      />
      {showLabel ? (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize={11}
          fontWeight={500}
        >
          {name.length > 18 ? `${name.slice(0, 16)}…` : name}
        </text>
      ) : null}
    </g>
  );
}

/** Company Overview — Location by Expenses treemap. */
function LocationByExpensesTreemap({
  data,
  periodLabel,
  onLocationSelect,
}: {
  data: CompanyOverviewLocation[];
  periodLabel: string;
  onLocationSelect?: (location: string) => void;
}) {
  const chartHeight = 260;
  const interactive = typeof onLocationSelect === 'function';
  const treemapData = useMemo(
    () =>
      data.map((row, index) => ({
        name: row.location,
        size: row.amount,
        amount: row.amount,
        fill: HEAD_COLORS[index % HEAD_COLORS.length],
      })),
    [data],
  );

  return (
    <Card className="p-4 border border-gray-200 shadow-sm h-full">
      <h3 className="text-sm font-medium text-[#212529] mb-1">Location by Expenses</h3>
      <p className="text-xs text-gray-500 mb-3">Totals by location · {periodLabel}</p>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No location expense data available for the selected period.
        </p>
      ) : (
        <div className="w-full" style={{ height: chartHeight, minHeight: chartHeight }}>
          <ChartContainer
            config={{ amount: { label: 'Expenses', color: '#007BFF' } }}
            className="h-full w-full aspect-auto"
          >
            <Treemap
              data={treemapData}
              dataKey="size"
              nameKey="name"
              stroke="#fff"
              fill="#007BFF"
              content={<LocationTreemapCell />}
              style={interactive ? { cursor: 'pointer' } : undefined}
              onClick={(node) => {
                if (!interactive) return;
                const n = node as { name?: string; children?: unknown[] };
                if (Array.isArray(n.children) && n.children.length > 0) return;
                const name = String(n?.name ?? '').trim();
                if (name) onLocationSelect?.(name);
              }}
            >
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatInr(Number(value))}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { name?: string } | undefined;
                      return row?.name || '';
                    }}
                  />
                }
              />
            </Treemap>
          </ChartContainer>
        </div>
      )}
    </Card>
  );
}

/** Location Analysis — Purpose Pareto (bars + cumulative %). */
function PurposeParetoChart({
  data,
  periodLabel,
  orientation = 'vertical',
}: {
  data: CompanyOverviewPurpose[];
  periodLabel: string;
  /** horizontal = horizontal bars + cumulative % on secondary X axis (Location Analysis). */
  orientation?: 'vertical' | 'horizontal';
}) {
  const isHorizontal = orientation === 'horizontal';
  // Horizontal: slightly expanded plot (no category labels) — moderate breathing room only.
  const chartHeight = isHorizontal
    ? Math.min(780, Math.max(360, Math.max(data.length, 1) * 58))
    : 280;
  const chartData = useMemo(
    () =>
      data.map((row) => ({
        purpose: row.purpose,
        amount: row.amount,
        cumulativePercent: row.cumulativePercent,
      })),
    [data],
  );

  return (
    <Card className="p-4 border border-gray-200 shadow-sm h-full">
      <h3 className="text-sm font-medium text-[#212529] mb-1">Purpose</h3>
      <p className="text-xs text-gray-500 mb-3">Pareto by expense amount · {periodLabel}</p>
      {chartData.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No purpose data available for the selected location.
        </p>
      ) : (
        <div className="w-full" style={{ height: chartHeight, minHeight: chartHeight }}>
          <ChartContainer
            config={{
              amount: { label: 'Amount', color: '#007BFF' },
              cumulativePercent: { label: 'Cumulative %', color: '#B54708' },
            }}
            className="h-full w-full aspect-auto"
          >
            {isHorizontal ? (
              <ComposedChart
                layout="vertical"
                data={chartData}
                margin={{ top: 6, right: 16, left: 4, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <YAxis
                  type="category"
                  dataKey="purpose"
                  width={8}
                  tick={false}
                  tickLine={false}
                  axisLine={false}
                />
                <XAxis
                  type="number"
                  xAxisId="amount"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatInrCompact(Number(v))}
                />
                <XAxis
                  type="number"
                  xAxisId="pct"
                  orientation="top"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (name === 'cumulativePercent') {
                          return `${Number(value).toFixed(1)}%`;
                        }
                        return formatInr(Number(value));
                      }}
                    />
                  }
                />
                <Bar
                  xAxisId="amount"
                  dataKey="amount"
                  fill="#007BFF"
                  radius={[0, 4, 4, 0]}
                  name="amount"
                />
                <Line
                  xAxisId="pct"
                  type="monotone"
                  dataKey="cumulativePercent"
                  stroke="#B54708"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#B54708' }}
                  name="cumulativePercent"
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="purpose"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-28}
                  textAnchor="end"
                  height={64}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  yAxisId="amount"
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v) => formatInrCompact(Number(v))}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={(v) => `${v}%`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (name === 'cumulativePercent') {
                          return `${Number(value).toFixed(1)}%`;
                        }
                        return formatInr(Number(value));
                      }}
                    />
                  }
                />
                <Bar
                  yAxisId="amount"
                  dataKey="amount"
                  fill="#007BFF"
                  radius={[4, 4, 0, 0]}
                  name="amount"
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="cumulativePercent"
                  stroke="#B54708"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#B54708' }}
                  name="cumulativePercent"
                />
              </ComposedChart>
            )}
          </ChartContainer>
        </div>
      )}
    </Card>
  );
}

/** Month Analysis — Month-over-Month expense head contribution waterfall. */
function MonthWaterfallChart({ data }: { data: MonthWaterfallData }) {
  const chartHeight = 340;
  const chartData = useMemo(() => {
    const rows: Array<{
      name: string;
      base: number;
      visible: number;
      kind: 'total' | 'up' | 'down';
      change: number;
      cumulative: number;
    }> = [];

    rows.push({
      name: data.previousMonthLabel,
      base: 0,
      visible: data.previousMonthTotal,
      kind: 'total',
      change: data.previousMonthTotal,
      cumulative: data.previousMonthTotal,
    });

    let running = data.previousMonthTotal;
    for (const step of data.contributions) {
      const change = Number(step.change) || 0;
      if (change >= 0) {
        rows.push({
          name: step.expenseHead,
          base: running,
          visible: change,
          kind: 'up',
          change,
          cumulative: running + change,
        });
        running = Math.round((running + change) * 100) / 100;
      } else {
        const next = Math.round((running + change) * 100) / 100;
        rows.push({
          name: step.expenseHead,
          base: next,
          visible: Math.abs(change),
          kind: 'down',
          change,
          cumulative: next,
        });
        running = next;
      }
    }

    rows.push({
      name: data.currentMonthLabel,
      base: 0,
      visible: data.currentMonthTotal,
      kind: 'total',
      change: data.currentMonthTotal,
      cumulative: data.currentMonthTotal,
    });

    return rows;
  }, [data]);

  const maxWaterfallAmount = useMemo(() => {
    let max = Math.max(data.previousMonthTotal, data.currentMonthTotal, 0);
    for (const row of chartData) {
      max = Math.max(max, row.base + row.visible, row.cumulative);
    }
    return max;
  }, [chartData, data.currentMonthTotal, data.previousMonthTotal]);

  const waterfallTicks = buildAmountAxisTicks(maxWaterfallAmount, 45000);
  const waterfallDomainTop = waterfallTicks[waterfallTicks.length - 1];

  return (
    <Card className="p-4 border border-gray-200 shadow-sm">
      <h3 className="text-sm font-medium text-[#212529] mb-1">
        Month-over-Month(MoM) Expense Analysis
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        MoM Expense Analysis · {data.previousMonthLabel} → {data.currentMonthLabel}
      </p>
      {chartData.length <= 2 && data.previousMonthTotal === 0 && data.currentMonthTotal === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No waterfall data available for this month comparison.
        </p>
      ) : (
        <div className="w-full" style={{ height: chartHeight, minHeight: chartHeight }}>
          <ChartContainer
            config={{
              visible: { label: 'Amount', color: '#007BFF' },
            }}
            className="h-full w-full aspect-auto"
          >
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-24}
                textAnchor="end"
                height={56}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={72}
                interval={0}
                ticks={waterfallTicks}
                domain={[0, waterfallDomainTop]}
                allowDecimals={false}
                tickFormatter={(v) => formatInr(Number(v))}
              />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  // Stacked waterfall uses invisible `base` + visible change; only show `visible` once.
                  const item = payload.find((p) => p.dataKey === 'visible');
                  if (!item) return null;
                  const row = item.payload as
                    | { kind?: string; change?: number; cumulative?: number }
                    | undefined;
                  if (!row) return null;
                  const title = String(label ?? '');
                  if (row.kind === 'total') {
                    return (
                      <div className="border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
                        <div className="font-medium">{title}</div>
                        <div>{formatInr(Number(row.change) || 0)}</div>
                      </div>
                    );
                  }
                  const change = Number(row.change) || 0;
                  const sign = change > 0 ? '+' : change < 0 ? '' : '';
                  return (
                    <div className="border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
                      <div className="font-medium">{title}</div>
                      <div>
                        Change: {sign}
                        {formatInr(change)}
                      </div>
                      <div className="text-muted-foreground">
                        Cumulative: {formatInr(Number(row.cumulative) || 0)}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="base" stackId="wf" fill="transparent" legendType="none" />
              <Bar dataKey="visible" stackId="wf" radius={[4, 4, 0, 0]}>
                {chartData.map((row, index) => (
                  <Cell
                    key={`wf-${row.name}-${index}`}
                    fill={
                      row.kind === 'total'
                        ? '#007BFF'
                        : row.kind === 'up'
                          ? '#027A48'
                          : '#B42318'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </Card>
  );
}

function MonthlyTrendChart({
  data,
  periodLabel,
  onMonthSelect,
}: {
  data: CompanyOverviewData['monthlyTrend'];
  periodLabel: string;
  onMonthSelect?: (point: CompanyOverviewMonthlyPoint) => void;
}) {
  // Inline height required: project index.css has no h-56 / h-[224px] utilities.
  // Same pattern as the working Expense Head Analysis bar chart below.
  const chartHeight = 224;

  const handlePointClick = (point: CompanyOverviewMonthlyPoint | undefined, e?: MouseEvent) => {
    e?.stopPropagation();
    if (!point || !onMonthSelect) return;
    if (!point.monthYear) return;
    onMonthSelect(point);
  };

  return (
    <Card className="p-4 border border-gray-200 shadow-sm">
      <h3 className="text-sm font-medium text-[#212529] mb-1">Monthly Expense Trend</h3>
      <p className="text-xs text-gray-500 mb-3">Approved expenses by month ({periodLabel})</p>
      <div className="w-full" style={{ height: chartHeight, minHeight: chartHeight }}>
        <ChartContainer config={trendChartConfig} className="h-full w-full aspect-auto">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v) => formatInrCompact(Number(v))}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatInr(Number(value))}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as
                      | { label?: string; monthYear?: string }
                      | undefined;
                    return row?.label || row?.monthYear || '';
                  }}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#007BFF"
              strokeWidth={2}
              dot={(dotProps) => {
                const { cx, cy, payload, index } = dotProps as {
                  cx?: number;
                  cy?: number;
                  payload?: CompanyOverviewMonthlyPoint;
                  index?: number;
                };
                if (typeof cx !== 'number' || typeof cy !== 'number') return null;
                return (
                  <circle
                    key={`month-dot-${payload?.monthYear ?? index}`}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="#007BFF"
                    className="cursor-pointer"
                    onClick={(e) => handlePointClick(payload, e)}
                  />
                );
              }}
              activeDot={(dotProps) => {
                const { cx, cy, payload } = dotProps as {
                  cx?: number;
                  cy?: number;
                  payload?: CompanyOverviewMonthlyPoint;
                };
                if (typeof cx !== 'number' || typeof cy !== 'number') return null;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill="#007BFF"
                    stroke="#fff"
                    strokeWidth={2}
                    className="cursor-pointer"
                    onClick={(e) => handlePointClick(payload, e)}
                  />
                );
              }}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </Card>
  );
}

function ExpenseHeadDonutChart({
  data,
  periodLabel,
  onExpenseHeadSelect,
}: {
  data: CompanyOverviewData['expenseHeads'];
  periodLabel: string;
  onExpenseHeadSelect?: (expenseHead: string) => void;
}) {
  const pieData = useMemo(
    () =>
      data.map((row, index) => ({
        ...row,
        fill: HEAD_COLORS[index % HEAD_COLORS.length],
      })),
    [data],
  );

  const donutConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {};
    for (const row of pieData) {
      cfg[row.expenseHead] = { label: row.expenseHead, color: row.fill };
    }
    return cfg;
  }, [pieData]);

  const interactive = typeof onExpenseHeadSelect === 'function';
  const chartHeight = 220;
  return (
    <Card className="p-4 border border-gray-200 shadow-sm h-full">
      <h3 className="text-sm font-medium text-[#212529] mb-1">Expense Head Distribution</h3>
      <p className="text-xs text-gray-500 mb-3">Share of total · {periodLabel}</p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex flex-1 min-w-0 w-full justify-center">
          <div
            className="shrink-0"
            style={{ height: chartHeight, width: chartHeight, minHeight: chartHeight }}
          >
            <ChartContainer config={donutConfig} className="h-full w-full aspect-auto">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => {
                        const pct = Number((item?.payload as { percentage?: number })?.percentage ?? 0);
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{String(name)}</span>
                            <span>{formatInr(Number(value))}</span>
                            <span className="text-muted-foreground">{pct.toFixed(2)}%</span>
                          </div>
                        );
                      }}
                      hideLabel
                    />
                  }
                />
                <Pie
                  data={pieData}
                  dataKey="amount"
                  nameKey="expenseHead"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={1}
                  strokeWidth={2}
                  cursor={interactive ? 'pointer' : undefined}
                  onClick={(_, index) => {
                    if (!interactive) return;
                    const entry = pieData[index];
                    const head = String(entry?.expenseHead ?? '').trim();
                    if (head) onExpenseHeadSelect?.(head);
                  }}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.expenseHead} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>
        </div>
        <ul
          className="flex-1 min-w-0 w-full space-y-2 overflow-y-auto"
          style={{ maxHeight: chartHeight }}
          aria-label="Expense head distribution legend"
        >
          {pieData.map((row) => (
            <li key={row.expenseHead} className="min-w-0">
              {interactive ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-xs text-gray-700 min-w-0 cursor-pointer text-left"
                  onClick={() => onExpenseHeadSelect?.(row.expenseHead)}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: row.fill }}
                    aria-hidden
                  />
                  <span className="truncate" title={row.expenseHead}>
                    {row.expenseHead}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-700 min-w-0">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: row.fill }}
                    aria-hidden
                  />
                  <span className="truncate" title={row.expenseHead}>
                    {row.expenseHead}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

const subcategoryChartConfig = {
  amount: { label: 'Expenses', color: '#007BFF' },
};

function analyticsDisplayCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

/** Phase 2B/2C — subcategory breakdown; bars clickable when onSubCategorySelect is provided. */
function SubcategoryBarChart({
  data,
  expenseHead,
  periodLabel,
  onSubCategorySelect,
}: {
  data: ExpenseHeadAnalysisData['subcategories'];
  expenseHead: string;
  periodLabel: string;
  onSubCategorySelect?: (subCategory: string) => void;
}) {
  const chartHeight = Math.max(260, Math.max(data.length, 1) * 36);
  const clickable = typeof onSubCategorySelect === 'function';

  const handleBarClick = (entry: unknown) => {
    if (!clickable) return;
    const row = entry as {
      subCategory?: string;
      payload?: { subCategory?: string };
    };
    const sub = String(row?.payload?.subCategory ?? row?.subCategory ?? '').trim();
    if (!sub) return;
    onSubCategorySelect(sub);
  };

  return (
    <Card className="p-4 border border-gray-200 shadow-sm">
      <h3 className="text-sm font-medium text-[#212529] mb-1">
        {expenseHead} Subcategory Analysis
      </h3>
      <p className="text-xs text-gray-500 mb-3">Totals by subcategory · {periodLabel}</p>
      <div className="w-full" style={{ height: chartHeight, minHeight: chartHeight }}>
        <ChartContainer config={subcategoryChartConfig} className="h-full w-full aspect-auto">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatInrCompact(Number(v))}
            />
            <YAxis
              type="category"
              dataKey="subCategory"
              width={110}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatInr(Number(value))}
                  labelKey="subCategory"
                />
              }
            />
            <Bar
              dataKey="amount"
              fill="#007BFF"
              radius={[0, 4, 4, 0]}
              cursor={clickable ? 'pointer' : 'default'}
              onClick={clickable ? handleBarClick : undefined}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </Card>
  );
}

/** Phase 2C — read-only transaction table; columns follow Expense form field config. */
function SubcategoryTransactionsTable({
  expenseHead,
  subCategory,
  transactions,
}: {
  expenseHead: string;
  subCategory: string;
  transactions: ExpenseSubcategoryTransaction[];
}) {
  const columns = useMemo(
    () => getExpenseTransactionDetailColumns(expenseHead, subCategory, transactions),
    [expenseHead, subCategory, transactions],
  );

  const minTableWidth = Math.max(980, columns.length * 140);

  const renderCell = (row: ExpenseSubcategoryTransaction, key: string) => {
    if (key === 'amount' || key === 'travelAllowanceAmount') {
      const raw = (row as unknown as Record<string, unknown>)[key];
      if (raw === undefined || raw === null || raw === '') return '—';
      const n = Number(raw);
      return Number.isFinite(n) ? formatInr(n) : analyticsDisplayCell(raw as string | number);
    }
    if (key === 'date') {
      return analyticsDisplayCell(row.dateLabel || row.date);
    }
    if (key === 'kilometers' || key === 'durationHours' || key === 'durationDays') {
      const raw = (row as unknown as Record<string, unknown>)[key];
      if (raw === undefined || raw === null || raw === '') return '—';
      return analyticsDisplayCell(raw as string | number);
    }
    const value = (row as unknown as Record<string, unknown>)[key];
    return analyticsDisplayCell(
      value === undefined || value === null ? null : (value as string | number),
    );
  };

  return (
    <Card className="p-4 border border-gray-200 shadow-sm">
      <h3 className="text-sm font-medium text-[#212529] mb-3">Transaction Details</h3>
      <div className="border rounded-lg overflow-hidden">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-0" style={{ minWidth: minTableWidth }}>
            <TableHeader>
              <TableRow className="bg-gray-50">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={
                      col.key === 'purpose'
                        ? 'whitespace-nowrap min-w-[160px]'
                        : 'whitespace-nowrap'
                    }
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((row, index) => (
                <TableRow
                  key={row.expenseId || `txn-${index}`}
                  className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={col.key === 'purpose' ? undefined : 'whitespace-nowrap'}
                    >
                      {renderCell(row, col.key)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

function AnalyticsErrorCard({
  title,
  onRetry,
}: {
  title: string;
  onRetry: () => void;
}) {
  return (
    <Card className="p-6 border border-red-200 bg-red-50/40">
      <p className="text-sm text-[#212529] font-medium">{title}</p>
      <p className="text-sm text-gray-600 mt-1">
        Please try again. Your My Expenses records were not affected.
      </p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </Card>
  );
}

export default function ExpensesAdminDashboardTab() {
  const defaultRange = useMemo(() => buildDefaultRangeYyyyMm(), []);
  const [draftFrom, setDraftFrom] = useState(defaultRange.from);
  const [draftTo, setDraftTo] = useState(defaultRange.to);
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  /** Phase 2D — draft employee selection (applied only on Apply). */
  const [draftEmployeeCode, setDraftEmployeeCode] = useState(ALL_EMPLOYEES_VALUE);
  /** Applied employeeCode; empty string = All Employees. */
  const [appliedEmployeeCode, setAppliedEmployeeCode] = useState('');
  /** Phase 2A — YYYY-MM for Month Analysis; null = Company Overview */
  const [drillMonth, setDrillMonth] = useState<string | null>(null);
  /** Phase 2B — selected expense head within drillMonth */
  const [drillExpenseHead, setDrillExpenseHead] = useState<string | null>(null);
  /** Phase 2C — selected subcategory within drillExpenseHead */
  const [drillSubcategory, setDrillSubcategory] = useState<string | null>(null);
  /** Location Analysis — selected location from Company Overview treemap */
  const [drillLocation, setDrillLocation] = useState<string | null>(null);

  const isSubcategoryView = drillExpenseHead != null && drillSubcategory != null;
  const isHeadView = drillExpenseHead != null && drillSubcategory == null;
  const isMonthView =
    drillMonth != null && drillExpenseHead == null && drillLocation == null;
  const isLocationView =
    drillLocation != null && drillExpenseHead == null && drillMonth == null;
  const isOverview =
    drillMonth == null && drillExpenseHead == null && drillLocation == null;

  const employeesQuery = useDashboardEmployeesQuery(true);
  const dashboardEmployees = employeesQuery.data ?? [];

  const analysisFrom = drillMonth ?? appliedRange.from;
  const analysisTo = drillMonth ?? appliedRange.to;
  const analysisPeriodLabel = drillMonth
    ? formatYyyyMmFullLabel(drillMonth)
    : `${formatYyyyMmLabel(appliedRange.from)} – ${formatYyyyMmLabel(appliedRange.to)}`;

  const overviewQuery = useCompanyOverviewQuery(
    {
      from: appliedRange.from,
      to: appliedRange.to,
      employeeCode: appliedEmployeeCode || undefined,
    },
    isOverview,
  );
  const locationQuery = useCompanyOverviewQuery(
    drillLocation
      ? {
          from: appliedRange.from,
          to: appliedRange.to,
          employeeCode: appliedEmployeeCode || undefined,
          location: drillLocation,
        }
      : null,
    isLocationView,
  );
  const monthQuery = useCompanyOverviewQuery(
    drillMonth
      ? {
          from: drillMonth,
          to: drillMonth,
          employeeCode: appliedEmployeeCode || undefined,
        }
      : null,
    isMonthView,
  );
  const headQuery = useExpenseHeadAnalysisQuery(
    drillExpenseHead
      ? {
          from: analysisFrom,
          to: analysisTo,
          expenseHead: drillExpenseHead,
          employeeCode: appliedEmployeeCode || undefined,
          location: drillLocation || undefined,
        }
      : null,
    isHeadView,
  );
  const subcategoryQuery = useExpenseSubcategoryAnalysisQuery(
    drillExpenseHead && drillSubcategory
      ? {
          from: analysisFrom,
          to: analysisTo,
          expenseHead: drillExpenseHead,
          subCategory: drillSubcategory,
          employeeCode: appliedEmployeeCode || undefined,
          location: drillLocation || undefined,
        }
      : null,
    isSubcategoryView,
  );

  const overviewLoading = isQueryColdLoading(overviewQuery);
  const overviewData = overviewQuery.data;
  const overviewError = overviewQuery.isError;
  const overviewEmpty =
    !!overviewData &&
    overviewData.kpis.totalExpenses <= 0 &&
    overviewData.expenseHeads.length === 0;

  const monthLoading = isQueryColdLoading(monthQuery);
  const monthData = monthQuery.data;
  const monthError = monthQuery.isError;
  const monthEmpty =
    !!monthData &&
    monthData.kpis.totalExpenses <= 0 &&
    monthData.expenseHeads.length === 0;

  const locationLoading = isQueryColdLoading(locationQuery);
  const locationData = locationQuery.data;
  const locationError = locationQuery.isError;
  const locationEmpty =
    !!locationData &&
    locationData.kpis.totalExpenses <= 0 &&
    locationData.expenseHeads.length === 0;

  const headLoading = isQueryColdLoading(headQuery);
  const headData = headQuery.data;
  const headError = headQuery.isError;
  const headEmpty =
    !!headData &&
    headData.kpis.totalExpenses <= 0 &&
    headData.subcategories.length === 0;

  const subcategoryLoading = isQueryColdLoading(subcategoryQuery);
  const subcategoryData = subcategoryQuery.data;
  const subcategoryError = subcategoryQuery.isError;
  const subcategoryEmpty =
    !!subcategoryData && (subcategoryData.transactions?.length ?? 0) === 0;

  const overviewPeriodHint =
    overviewData?.period?.label ||
    `${formatYyyyMmLabel(appliedRange.from)} – ${formatYyyyMmLabel(appliedRange.to)}`;

  const appliedEmployeeLabel = useMemo(() => {
    if (!appliedEmployeeCode) return 'All Employees';
    const match = dashboardEmployees.find((e) => e.employeeCode === appliedEmployeeCode);
    return match?.employeeName?.trim() || appliedEmployeeCode;
  }, [appliedEmployeeCode, dashboardEmployees]);

  const overviewScopeHint = `${overviewPeriodHint} · ${appliedEmployeeLabel}`;

  const monthLabel = drillMonth ? formatYyyyMmFullLabel(drillMonth) : '';
  const headLabel = drillExpenseHead ?? '';
  const subcategoryLabel = drillSubcategory ?? '';
  const locationLabel = drillLocation ?? '';
  const headPeriodHint = analysisPeriodLabel;

  const monthCount =
    overviewData?.period?.monthCount ??
    overviewData?.period?.months?.length ??
    (() => {
      const a = yyyyMmSortKey(appliedRange.from);
      const b = yyyyMmSortKey(appliedRange.to);
      if (a == null || b == null || a > b) return 0;
      const y1 = Math.floor(a / 100);
      const m1 = a % 100;
      const y2 = Math.floor(b / 100);
      const m2 = b % 100;
      return (y2 - y1) * 12 + (m2 - m1) + 1;
    })();

  const goToOverview = () => {
    setDrillSubcategory(null);
    setDrillExpenseHead(null);
    setDrillLocation(null);
    setDrillMonth(null);
  };

  const goToMonth = () => {
    setDrillSubcategory(null);
    setDrillExpenseHead(null);
    setDrillLocation(null);
  };

  const goToLocation = () => {
    setDrillSubcategory(null);
    setDrillExpenseHead(null);
  };

  const goToHead = () => {
    setDrillSubcategory(null);
  };

  const handleApplyRange = () => {
    const fromKey = yyyyMmSortKey(draftFrom);
    const toKey = yyyyMmSortKey(draftTo);
    if (fromKey == null || toKey == null) {
      toast.error('Please select a valid From and To month.');
      return;
    }
    if (fromKey > toKey) {
      toast.error('From month cannot be after To month.');
      return;
    }
    const nextEmployeeCode =
      draftEmployeeCode === ALL_EMPLOYEES_VALUE
        ? ''
        : String(draftEmployeeCode ?? '').trim();
    setAppliedRange({ from: draftFrom, to: draftTo });
    setAppliedEmployeeCode(nextEmployeeCode);
    setDrillSubcategory(null);
    setDrillExpenseHead(null);
    setDrillLocation(null);
    setDrillMonth(null);
  };

  const handleMonthSelect = (point: CompanyOverviewMonthlyPoint) => {
    const yyyyMm = monthYearToYyyyMm(point.monthYear);
    if (!yyyyMm) {
      toast.error('Unable to open that month. Please try again.');
      return;
    }
    setDrillSubcategory(null);
    setDrillExpenseHead(null);
    setDrillLocation(null);
    setDrillMonth(yyyyMm);
  };

  const handleExpenseHeadSelect = (expenseHead: string) => {
    const head = String(expenseHead ?? '').trim();
    if (!head) return;
    setDrillSubcategory(null);
    setDrillExpenseHead(head);
  };

  const handleLocationSelect = (location: string) => {
    const loc = String(location ?? '').trim();
    if (!loc) return;
    setDrillSubcategory(null);
    setDrillExpenseHead(null);
    setDrillMonth(null);
    setDrillLocation(loc);
  };

  const handleSubcategorySelect = (subCategory: string) => {
    const sub = String(subCategory ?? '').trim();
    if (!sub || !drillExpenseHead) return;
    setDrillSubcategory(sub);
  };

  const mom = overviewData?.kpis?.momChange;
  const momValue =
    mom == null
      ? '—'
      : mom.percent == null
        ? '—'
        : `${mom.percent > 0 ? '+' : ''}${mom.percent.toFixed(1)}%`;
  const momHint =
    mom == null
      ? overviewPeriodHint
      : mom.percent == null
        ? `vs ${mom.previousMonthLabel} (no baseline)`
        : `vs ${mom.previousMonthLabel}`;
  const MomIcon =
    mom?.percent == null ? TrendingUp : mom.percent >= 0 ? ArrowUpRight : ArrowDownRight;

  const monthMom = monthData?.kpis?.momChange;
  const monthMomValue =
    monthMom == null
      ? '—'
      : monthMom.percent == null
        ? '—'
        : `${monthMom.percent > 0 ? '+' : ''}${monthMom.percent.toFixed(1)}%`;
  const monthMomHint =
    monthMom == null
      ? monthLabel
      : monthMom.percent == null
        ? `vs ${monthMom.previousMonthLabel} (no baseline)`
        : `vs ${monthMom.previousMonthLabel}`;
  const MonthMomIcon =
    monthMom?.percent == null
      ? TrendingUp
      : monthMom.percent >= 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-[#212529] text-lg font-semibold">Expenses Analytics</h2>
          {isSubcategoryView ? (
            <nav aria-label="Breadcrumb" className="mt-1">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <li>
                  <button
                    type="button"
                    className="cursor-pointer text-blue-600 hover:text-blue-700"
                    onClick={goToOverview}
                  >
                    Company Overview
                  </button>
                </li>
                {drillLocation ? (
                  <>
                    <li aria-hidden className="text-gray-400">
                      ›
                    </li>
                    <li>
                      <button
                        type="button"
                        className="cursor-pointer text-blue-600 hover:text-blue-700"
                        onClick={goToLocation}
                      >
                        {locationLabel}
                      </button>
                    </li>
                  </>
                ) : null}
                {drillMonth ? (
                  <>
                    <li aria-hidden className="text-gray-400">
                      ›
                    </li>
                    <li>
                      <button
                        type="button"
                        className="cursor-pointer text-blue-600 hover:text-blue-700"
                        onClick={goToMonth}
                      >
                        {monthLabel}
                      </button>
                    </li>
                  </>
                ) : null}
                <li aria-hidden className="text-gray-400">
                  ›
                </li>
                <li>
                  <button
                    type="button"
                    className="cursor-pointer text-blue-600 hover:text-blue-700"
                    onClick={goToHead}
                  >
                    {headLabel}
                  </button>
                </li>
                <li aria-hidden className="text-gray-400">
                  ›
                </li>
                <li
                  className="font-medium text-[#212529] truncate"
                  title={subcategoryLabel}
                >
                  {subcategoryLabel}
                </li>
              </ol>
            </nav>
          ) : isHeadView ? (
            <nav aria-label="Breadcrumb" className="mt-1">
              <ol className="flex items-center gap-2 text-sm text-gray-500">
                <li>
                  <button
                    type="button"
                    className="cursor-pointer text-blue-600 hover:text-blue-700"
                    onClick={goToOverview}
                  >
                    Company Overview
                  </button>
                </li>
                {drillLocation ? (
                  <>
                    <li aria-hidden className="text-gray-400">
                      ›
                    </li>
                    <li>
                      <button
                        type="button"
                        className="cursor-pointer text-blue-600 hover:text-blue-700"
                        onClick={goToLocation}
                      >
                        {locationLabel}
                      </button>
                    </li>
                  </>
                ) : null}
                {drillMonth ? (
                  <>
                    <li aria-hidden className="text-gray-400">
                      ›
                    </li>
                    <li>
                      <button
                        type="button"
                        className="cursor-pointer text-blue-600 hover:text-blue-700"
                        onClick={goToMonth}
                      >
                        {monthLabel}
                      </button>
                    </li>
                  </>
                ) : null}
                <li aria-hidden className="text-gray-400">
                  ›
                </li>
                <li className="font-medium text-[#212529] truncate" title={headLabel}>
                  {headLabel}
                </li>
              </ol>
            </nav>
          ) : isLocationView ? (
            <nav aria-label="Breadcrumb" className="mt-1">
              <ol className="flex items-center gap-2 text-sm text-gray-500">
                <li>
                  <button
                    type="button"
                    className="cursor-pointer text-blue-600 hover:text-blue-700"
                    onClick={goToOverview}
                  >
                    Company Overview
                  </button>
                </li>
                <li aria-hidden className="text-gray-400">
                  ›
                </li>
                <li className="font-medium text-[#212529] truncate" title={locationLabel}>
                  {locationLabel}
                </li>
              </ol>
            </nav>
          ) : isMonthView ? (
            <nav aria-label="Breadcrumb" className="mt-1">
              <ol className="flex items-center gap-2 text-sm text-gray-500">
                <li>
                  <button
                    type="button"
                    className="cursor-pointer text-blue-600 hover:text-blue-700"
                    onClick={goToOverview}
                  >
                    Company Overview
                  </button>
                </li>
                <li aria-hidden className="text-gray-400">
                  ›
                </li>
                <li className="font-medium text-[#212529]">{monthLabel}</li>
              </ol>
            </nav>
          ) : (
            <>
              <p className="text-sm text-gray-600 mt-0.5">Company Overview</p>
              <p className="text-xs text-gray-500 mt-1">{overviewScopeHint}</p>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          {isOverview ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">From</label>
                <Select value={draftFrom} onValueChange={setDraftFrom}>
                  <SelectTrigger className="h-9 w-[132px]">
                    <SelectValue placeholder="From" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((opt) => (
                      <SelectItem key={`from-${opt.value}`} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">To</label>
                <Select value={draftTo} onValueChange={setDraftTo}>
                  <SelectTrigger className="h-9 w-[132px]">
                    <SelectValue placeholder="To" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((opt) => (
                      <SelectItem key={`to-${opt.value}`} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Employee Name</label>
                <Select value={draftEmployeeCode} onValueChange={setDraftEmployeeCode}>
                  <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_EMPLOYEES_VALUE}>All Employees</SelectItem>
                    {dashboardEmployees.map((emp) => (
                      <SelectItem key={emp.employeeCode} value={emp.employeeCode}>
                        {emp.employeeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" size="sm" className="h-9" onClick={handleApplyRange}>
                Apply
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── Phase 2C: Subcategory Transaction Details ─── */}
      {isSubcategoryView ? (
        <>
          {subcategoryError ? (
            <AnalyticsErrorCard
              title="Unable to load subcategory transactions"
              onRetry={() => void subcategoryQuery.refetch()}
            />
          ) : null}

          {!subcategoryError ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
                <KpiCard
                  title={`Total ${subcategoryLabel} Expense`}
                  value={formatInr(subcategoryData?.kpis.totalExpenses ?? 0)}
                  hint={`${headLabel} · ${headPeriodHint}`}
                  icon={Wallet}
                  loading={subcategoryLoading}
                />
                <KpiCard
                  title="Expense Record Count"
                  value={String(subcategoryData?.kpis.recordCount ?? 0)}
                  hint={`${subcategoryLabel} · ${headPeriodHint}`}
                  icon={FileText}
                  loading={subcategoryLoading}
                />
              </div>

              {subcategoryLoading ? (
                <ChartCardSkeleton title="Transaction Details" heightClass="h-[260px]" />
              ) : subcategoryEmpty ? (
                <Card className="p-8 border border-gray-200 text-center">
                  <p className="text-sm text-gray-600">
                    No approved expenses available for {subcategoryLabel} under {headLabel}{' '}
                    in {headPeriodHint}.
                  </p>
                </Card>
              ) : subcategoryData ? (
                <SubcategoryTransactionsTable
                  expenseHead={subcategoryData.expenseHead || headLabel}
                  subCategory={subcategoryData.subCategory || subcategoryLabel}
                  transactions={subcategoryData.transactions}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* ─── Phase 2B: Expense Head Analysis ─── */}
      {isHeadView ? (
        <>
          {headError ? (
            <AnalyticsErrorCard
              title="Unable to load expense head analysis"
              onRetry={() => void headQuery.refetch()}
            />
          ) : null}

          {!headError ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
                <KpiCard
                  title={`Total ${headLabel} Expense`}
                  value={formatInr(headData?.kpis.totalExpenses ?? 0)}
                  hint={headPeriodHint}
                  icon={Wallet}
                  loading={headLoading}
                />
                <KpiCard
                  title="Expense Record Count"
                  value={String(headData?.kpis.recordCount ?? 0)}
                  hint={`${headLabel} · ${headPeriodHint}`}
                  icon={FileText}
                  loading={headLoading}
                />
              </div>

              {headLoading ? (
                <ChartCardSkeleton
                  title={`${headLabel} Subcategory Analysis`}
                  heightClass="h-[260px]"
                />
              ) : headEmpty ? (
                <Card className="p-8 border border-gray-200 text-center">
                  <p className="text-sm text-gray-600">
                    No approved expenses available for {headLabel} in {headPeriodHint}.
                  </p>
                </Card>
              ) : headData ? (
                <SubcategoryBarChart
                  data={headData.subcategories}
                  expenseHead={headLabel}
                  periodLabel={headPeriodHint}
                  onSubCategorySelect={handleSubcategorySelect}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* ─── Location Analysis ─── */}
      {isLocationView ? (
        <>
          {locationError ? (
            <AnalyticsErrorCard
              title="Unable to load location analysis"
              onRetry={() => void locationQuery.refetch()}
            />
          ) : null}

          {!locationError ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
                <KpiCard
                  title={`Total ${locationLabel} Expense`}
                  value={formatInr(locationData?.kpis.totalExpenses ?? 0)}
                  hint={analysisPeriodLabel}
                  icon={Wallet}
                  loading={locationLoading}
                />
                <KpiCard
                  title="Highest Expense Head"
                  value={locationData?.kpis.highestExpenseHead?.expenseHead || 'No data'}
                  hint={
                    locationData?.kpis.highestExpenseHead
                      ? formatInr(locationData.kpis.highestExpenseHead.amount)
                      : analysisPeriodLabel
                  }
                  icon={PieChartIcon}
                  loading={locationLoading}
                />
              </div>

              {locationLoading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
                    <ChartCardSkeleton title="Expense Head Distribution" heightClass="h-[260px]" />
                    <ChartCardSkeleton title="Employee by Expenses" heightClass="h-[340px]" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
                    <ChartCardSkeleton title="Service Provider Analysis" heightClass="h-[136px]" />
                    <ChartCardSkeleton title="Purpose" heightClass="h-[360px]" />
                  </div>
                </div>
              ) : locationEmpty ? (
                <Card className="p-8 border border-gray-200 text-center">
                  <p className="text-sm text-gray-600">
                    No approved expenses available for {locationLabel} in {analysisPeriodLabel}.
                  </p>
                </Card>
              ) : locationData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
                    <ExpenseHeadDonutChart
                      data={locationData.expenseHeads}
                      periodLabel={`${locationLabel} · ${analysisPeriodLabel}`}
                      onExpenseHeadSelect={handleExpenseHeadSelect}
                    />
                    <EmployeeByExpensesBarChart
                      data={locationData.employeesByExpense ?? []}
                      periodLabel={`${locationLabel} · ${analysisPeriodLabel}`}
                      orientation="vertical"
                      amountTickStep={10000}
                      plotHeight={340}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
                    <ServiceProviderBarChart
                      data={locationData.serviceProviders ?? []}
                      periodLabel={`${locationLabel} · ${analysisPeriodLabel}`}
                      orientation="horizontal"
                      title="Service Provider Analysis"
                      hideCategoryTicks
                      horizontalRowHeight={18}
                      horizontalMinHeight={136}
                    />
                    <PurposeParetoChart
                      data={locationData.purposes ?? []}
                      periodLabel={`${locationLabel} · ${analysisPeriodLabel}`}
                      orientation="horizontal"
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* ─── Phase 2A: Month Analysis ─── */}
      {isMonthView ? (
        <>
          {monthError ? (
            <AnalyticsErrorCard
              title="Unable to load month analysis"
              onRetry={() => void monthQuery.refetch()}
            />
          ) : null}

          {!monthError ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
                <KpiCard
                  title="Total Company Expenses"
                  value={formatInr(monthData?.kpis.totalExpenses ?? 0)}
                  hint={monthLabel}
                  icon={Wallet}
                  loading={monthLoading}
                />
                <KpiCard
                  title="Highest Expense Head"
                  value={monthData?.kpis.highestExpenseHead?.expenseHead || 'No data'}
                  hint={
                    monthData?.kpis.highestExpenseHead
                      ? formatInr(monthData.kpis.highestExpenseHead.amount)
                      : monthLabel
                  }
                  icon={PieChartIcon}
                  loading={monthLoading}
                />
                <KpiCard
                  title="MoM Change"
                  value={monthMomValue}
                  hint={monthMomHint}
                  icon={MonthMomIcon}
                  loading={monthLoading}
                />
              </div>

              {monthLoading ? (
                <div className="space-y-4">
                  <ChartCardSkeleton
                    title="Month-over-Month(MoM) Expense Analysis"
                    heightClass="h-[340px]"
                  />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
                    <ChartCardSkeleton title="Service Provider Analysis" heightClass="h-[136px]" />
                    <ChartCardSkeleton title="Expense Head Distribution" heightClass="h-[260px]" />
                  </div>
                </div>
              ) : monthEmpty ? (
                <Card className="p-8 border border-gray-200 text-center">
                  <p className="text-sm text-gray-600">
                    No approved expenses available for {monthLabel}.
                  </p>
                </Card>
              ) : monthData ? (
                <div className="space-y-4">
                  {monthData.waterfall ? (
                    <MonthWaterfallChart data={monthData.waterfall} />
                  ) : (
                    <Card className="p-8 border border-gray-200 text-center">
                      <p className="text-sm text-gray-600">
                        Waterfall comparison is unavailable for {monthLabel}.
                      </p>
                    </Card>
                  )}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
                    <ServiceProviderBarChart
                      data={monthData.serviceProviders ?? []}
                      periodLabel={monthLabel}
                      orientation="horizontal"
                      title="Service Provider Analysis"
                      hideCategoryTicks
                      horizontalRowHeight={18}
                      horizontalMinHeight={136}
                    />
                    <ExpenseHeadDonutChart
                      data={monthData.expenseHeads}
                      periodLabel={monthLabel}
                      onExpenseHeadSelect={handleExpenseHeadSelect}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* ─── Phase 1: Company Overview ─── */}
      {isOverview ? (
        <>
          {overviewError ? (
            <AnalyticsErrorCard
              title="Unable to load company overview"
              onRetry={() => void overviewQuery.refetch()}
            />
          ) : null}

          {!overviewError ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 items-stretch">
                <KpiCard
                  title="Total Company Expenses"
                  value={formatInr(overviewData?.kpis.totalExpenses ?? 0)}
                  hint={overviewPeriodHint}
                  icon={Wallet}
                  loading={overviewLoading}
                />
                <KpiCard
                  title="Highest Expense Month"
                  value={
                    overviewData?.kpis.highestExpenseMonth
                      ? overviewData.kpis.highestExpenseMonth.label
                      : 'No data'
                  }
                  hint={
                    overviewData?.kpis.highestExpenseMonth
                      ? formatInr(overviewData.kpis.highestExpenseMonth.amount)
                      : overviewPeriodHint
                  }
                  icon={CalendarDays}
                  loading={overviewLoading}
                />
                <KpiCard
                  title="Highest Expense Head"
                  value={overviewData?.kpis.highestExpenseHead?.expenseHead || 'No data'}
                  hint={
                    overviewData?.kpis.highestExpenseHead
                      ? formatInr(overviewData.kpis.highestExpenseHead.amount)
                      : overviewPeriodHint
                  }
                  icon={PieChartIcon}
                  loading={overviewLoading}
                />
                <KpiCard
                  title="Average Monthly Expense"
                  value={formatInr(overviewData?.kpis.averageMonthlyExpense ?? 0)}
                  hint={
                    monthCount > 0
                      ? `Total ÷ ${monthCount} month${monthCount === 1 ? '' : 's'}`
                      : overviewPeriodHint
                  }
                  icon={TrendingUp}
                  loading={overviewLoading}
                />
                <KpiCard
                  title="MoM Change"
                  value={momValue}
                  hint={momHint}
                  icon={MomIcon}
                  loading={overviewLoading}
                />
              </div>

              {overviewLoading ? (
                <div className="space-y-4">
                  <ChartCardSkeleton title="Monthly Expense Trend" heightClass="h-[224px]" />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
                    <ChartCardSkeleton title="Top 8 Service Providers" heightClass="h-[340px]" />
                    <ChartCardSkeleton title="Employee by Expenses" heightClass="h-[260px]" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
                    <ChartCardSkeleton title="Location by Expenses" heightClass="h-[260px]" />
                    <ChartCardSkeleton title="Expense Head Distribution" heightClass="h-[260px]" />
                  </div>
                </div>
              ) : overviewEmpty ? (
                <Card className="p-8 border border-gray-200 text-center">
                  <p className="text-sm text-gray-600">
                    No approved expenses available for the selected period.
                  </p>
                </Card>
              ) : overviewData ? (
                <div className="space-y-4">
                  <MonthlyTrendChart
                    data={overviewData.monthlyTrend}
                    periodLabel={overviewPeriodHint}
                    onMonthSelect={handleMonthSelect}
                  />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
                    <ServiceProviderBarChart
                      data={topServiceProvidersByAmount(overviewData.serviceProviders ?? [], 8)}
                      periodLabel={overviewPeriodHint}
                      orientation="vertical"
                      title="Top 8 Service Providers"
                      subtitle={`Top 8 Service Providers · ${overviewPeriodHint}`}
                      amountTickStep={10000}
                      plotHeight={340}
                    />
                    <EmployeeByExpensesBarChart
                      data={overviewData.employeesByExpense ?? []}
                      periodLabel={overviewPeriodHint}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
                    <LocationByExpensesTreemap
                      data={overviewData.locations ?? []}
                      periodLabel={overviewPeriodHint}
                      onLocationSelect={handleLocationSelect}
                    />
                    <ExpenseHeadDonutChart
                      data={overviewData.expenseHeads}
                      periodLabel={overviewPeriodHint}
                      onExpenseHeadSelect={handleExpenseHeadSelect}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
