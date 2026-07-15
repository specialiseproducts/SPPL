import { Card } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { usePlanningHistoryQuery } from '../../hooks/dailyPlanner/useDailyPlannerQueries';
import { formatPlannerRating } from '../../utils/planningRecognition';
import { isQueryColdLoading } from '../../utils/queryLoading';

interface PlanningHistorySectionProps {
  employeeCode: string;
  enabled?: boolean;
}

function formatMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  if (!year || !month) return yearMonth;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    timeZone: 'UTC',
  });
}

export default function PlanningHistorySection({
  employeeCode,
  enabled = true,
}: PlanningHistorySectionProps) {
  const historyQuery = usePlanningHistoryQuery(employeeCode, enabled && !!employeeCode);
  const isLoading = isQueryColdLoading(historyQuery);
  const rows = historyQuery.data?.history ?? [];

  return (
    <Card className="p-6">
      <h3 className="text-[#212529] mb-4">Planning History</h3>
      <p className="mb-4 text-sm text-gray-600">Previous 12 Months</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading planning history…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No historical planning data yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Badge</TableHead>
                <TableHead>Planning %</TableHead>
                <TableHead>Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.yearMonth}>
                  <TableCell>{formatMonthLabel(row.yearMonth)}</TableCell>
                  <TableCell>{row.planningScore}</TableCell>
                  <TableCell>
                    {row.badgeEmoji ? `${row.badgeEmoji} ` : ''}
                    {row.badge}
                  </TableCell>
                  <TableCell>{row.planningAheadPercent}%</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatPlannerRating({
                      employeeCode: row.employeeCode || employeeCode,
                      year: row.year,
                      month: row.month,
                      yearMonth: row.yearMonth,
                      rawScore: 0,
                      maxScore: 0,
                      normalizedScore: row.planningScore,
                      planningScore: row.planningScore,
                      planningAheadPercent: row.planningAheadPercent,
                      daysPlannedAhead: row.daysPlannedAhead || 0,
                      regularTaskCount: row.regularTaskCount,
                      urgentTaskCount: row.urgentTaskCount,
                      badge: row.badge,
                      badgeEmoji: row.badgeEmoji,
                      rating: row.rating,
                      ratingLabel: row.ratingLabel || row.rating,
                      ratingStars: row.ratingStars,
                      workingDays: row.workingDays || 0,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
