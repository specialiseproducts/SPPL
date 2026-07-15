import type { ReactNode } from 'react';
import type { PlanningMonthlyRecord } from '../../utils/planningRecognition';
import {
  formatPlanningBadge,
  formatPlanningScoreLabel,
  getPlanningBadgeStyle,
} from '../../utils/planningRecognition';
import { Card } from '../ui/card';
import { cn } from '../ui/utils';

type PlanningPerformanceDashboardProps = {
  record: PlanningMonthlyRecord | null | undefined;
  loading?: boolean;
};

function KpiCard({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        'flex h-full min-h-[5.5rem] flex-col justify-center border-gray-200 bg-white p-4 shadow-sm',
        className,
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 min-w-0">{children}</div>
    </Card>
  );
}

function LoadingKpiCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card
          key={index}
          className="flex h-full min-h-[5.5rem] items-center border-gray-200 bg-white p-4 shadow-sm"
        >
          <p className="text-sm text-muted-foreground">Loading…</p>
        </Card>
      ))}
    </div>
  );
}

export default function PlanningPerformanceDashboard({
  record,
  loading = false,
}: PlanningPerformanceDashboardProps) {
  if (loading) {
    return <LoadingKpiCards />;
  }

  const stars = record
    ? '★'.repeat(Math.max(0, Math.min(5, record.ratingStars || 0))) +
      '☆'.repeat(Math.max(0, 5 - (record.ratingStars || 0)))
    : '—';
  const ratingLabel = record?.ratingLabel || record?.rating || '—';
  const badgeText = formatPlanningBadge(record);
  const badgeStyle = getPlanningBadgeStyle(record?.badge || 'No Badge');
  const plannedAheadPercent = record ? `${record.planningAheadPercent ?? 0}%` : '—';
  const plannedAheadDays = record
    ? `${record.daysPlannedAhead ?? 0} / ${record.workingDays ?? 0} Working Days`
    : '—';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Planning Score">
        <p className="text-xl font-semibold leading-tight text-[#212529] sm:text-2xl">
          {formatPlanningScoreLabel(record)}
        </p>
      </KpiCard>

      <KpiCard label="Current Badge">
        {record ? (
          <p
            className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium"
            style={{
              backgroundColor: badgeStyle.bg,
              color: badgeStyle.text,
              border: `1px solid ${badgeStyle.border}`,
            }}
          >
            {badgeText}
          </p>
        ) : (
          <p className="text-sm font-medium text-[#212529]">—</p>
        )}
      </KpiCard>

      <KpiCard label="Planner Rating">
        <p className="text-lg leading-none tracking-wide text-amber-500">{stars}</p>
        <p className="mt-1.5 text-sm font-medium text-[#212529]">{ratingLabel}</p>
      </KpiCard>

      <KpiCard label="Planned Ahead">
        <p className="text-xl font-semibold leading-tight text-[#212529] sm:text-2xl">
          {plannedAheadPercent}
        </p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{plannedAheadDays}</p>
      </KpiCard>
    </div>
  );
}
