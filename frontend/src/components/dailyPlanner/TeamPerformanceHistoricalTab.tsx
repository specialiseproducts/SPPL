import { Card } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useTeamPlanningHistoryQuery } from '../../hooks/dailyPlanner/useDailyPlannerQueries';
import { isQueryColdLoading } from '../../utils/queryLoading';

const chartConfig = {
  score: { label: 'Average Team Score', color: '#007BFF' },
  percent: { label: 'Planning Ahead %', color: '#027A48' },
};

function formatMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  if (!year || !month) return yearMonth;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    timeZone: 'UTC',
  });
}

export default function TeamPerformanceHistoricalTab() {
  const historyQuery = useTeamPlanningHistoryQuery();
  const isLoading = isQueryColdLoading(historyQuery);
  const data = historyQuery.data;

  const scoreSeries = (data?.chartSeries.averageTeamScoreByMonth ?? []).map((row) => ({
    label: formatMonthLabel(row.yearMonth),
    value: row.value,
  }));
  const percentSeries = (data?.chartSeries.planningAheadPercentByMonth ?? []).map((row) => ({
    label: formatMonthLabel(row.yearMonth),
    value: row.value,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-[#212529]">Average Team Score</h3>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <LineChart data={scoreSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="value" stroke="#007BFF" strokeWidth={2} dot />
              </LineChart>
            </ChartContainer>
          )}
        </Card>

        <Card className="border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-[#212529]">Planning Ahead %</h3>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <LineChart data={percentSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="value" stroke="#027A48" strokeWidth={2} dot />
              </LineChart>
            </ChartContainer>
          )}
        </Card>
      </div>

      <Card className="border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-[#212529]">Top Planner Each Month</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Top Planner</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.chartSeries.topPlannerByMonth ?? []).map((row) => (
                  <TableRow key={row.yearMonth}>
                    <TableCell>{formatMonthLabel(row.yearMonth)}</TableCell>
                    <TableCell>{row.employeeName}</TableCell>
                    <TableCell>{row.planningScore}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-[#212529]">Badge Distribution by Month</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            {(data?.chartSeries.badgeDistributionByMonth ?? []).map((monthRow) => (
              <div key={monthRow.yearMonth} className="border-b border-gray-100 pb-3 last:border-0">
                <p className="mb-2 text-sm font-medium text-[#212529]">
                  {formatMonthLabel(monthRow.yearMonth)}
                </p>
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  {(monthRow.distribution ?? []).map((item) => (
                    <span key={`${monthRow.yearMonth}-${item.badge}`}>
                      {item.badge}: {item.count}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
