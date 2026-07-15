import type { PlanningMonthlyRecord } from '../../utils/planningRecognition';
import {
  formatDaysPlannedAhead,
  formatPlanningAheadPercent,
  formatPlanningBadge,
  formatPlannerRating,
  formatPlanningMonthLabel,
  formatPlanningScoreLabel,
  getPlanningBadgeStyle,
} from '../../utils/planningRecognition';
import { Card } from '../ui/card';
import { cn } from '../ui/utils';

function BadgePill({ record }: { record: PlanningMonthlyRecord | null | undefined }) {
  if (!record) return <span className="text-sm text-muted-foreground">—</span>;
  const style = getPlanningBadgeStyle(record.badge || 'No Badge');
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      {formatPlanningBadge(record)}
    </span>
  );
}

function StatBlock({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 space-y-0.5', className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-medium text-[#212529]">{value}</p>
    </div>
  );
}

type PlanningPerformanceCardProps = {
  record: PlanningMonthlyRecord | null | undefined;
  loading?: boolean;
  variant?: 'compact' | 'profile';
};

export default function PlanningPerformanceCard({
  record,
  loading = false,
  variant = 'compact',
}: PlanningPerformanceCardProps) {
  if (loading) {
    return (
      <Card className="border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Loading planning performance…</p>
      </Card>
    );
  }

  if (variant === 'profile') {
    return (
      <Card className="p-6">
        <h3 className="text-[#212529] mb-4">Planning Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Current Planning Score</p>
            <p className="text-sm text-[#212529] mt-1">{formatPlanningScoreLabel(record)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Current Badge</p>
            <div className="mt-1">
              <BadgePill record={record} />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500">Current Rating</p>
            <p className="text-sm text-[#212529] mt-1">{formatPlannerRating(record)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Planning Ahead %</p>
            <p className="text-sm text-[#212529] mt-1">{formatPlanningAheadPercent(record)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Current Month</p>
            <p className="text-sm text-[#212529] mt-1">{formatPlanningMonthLabel(record)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Working Days</p>
            <p className="text-sm text-[#212529] mt-1">{record?.workingDays ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Days Planned Ahead</p>
            <p className="text-sm text-[#212529] mt-1">{record?.daysPlannedAhead ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Regular Tasks</p>
            <p className="text-sm text-[#212529] mt-1">{record?.regularTaskCount ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Urgent Tasks</p>
            <p className="text-sm text-[#212529] mt-1">{record?.urgentTaskCount ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Monthly Rank</p>
            <p className="text-sm text-[#212529] mt-1">Coming Soon</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-gray-200 bg-white p-4 shadow-sm sm:w-auto">
      <h3 className="mb-3 text-sm font-semibold text-[#212529]">Planning Performance</h3>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <StatBlock label="Planning Score" value={formatPlanningScoreLabel(record)} />
          <StatBlock
            label="Planning Ahead %"
            value={formatPlanningAheadPercent(record)}
            className="text-right"
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Planner Rating
          </p>
          <p className="text-sm text-[#212529]">{formatPlannerRating(record)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Current Badge
            </p>
            <BadgePill record={record} />
          </div>
          <StatBlock
            label="Working Days Planned Ahead"
            value={formatDaysPlannedAhead(record)}
            className="text-right"
          />
        </div>
      </div>
    </Card>
  );
}
