/**
 * Super Admin — Expenses "Admin Dashboard" (tab 2).
 * UI-only placeholders. Replace static values with API aggregates, e.g.:
 *   GET /api/expenses/dashboard/summary?month=2026-04
 *   GET /api/expenses/dashboard/trends
 * Charts: swap placeholder blocks for recharts / echarts when requirements are fixed.
 */

import type { ComponentType } from 'react';
import { Card } from '../ui/card';
import { TrendingUp, Users, Wallet, XCircle, Clock, PieChart } from 'lucide-react';

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="p-4 border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-[#212529] mt-1 tabular-nums">{value}</p>
          <p className="text-xs text-gray-500 mt-2">{hint}</p>
        </div>
        <div className="rounded-lg bg-[#007BFF]/10 p-2 text-[#007BFF]">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

export default function ExpensesAdminDashboardTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[#212529] text-lg font-semibold">Expenses admin dashboard</h2>
        <p className="text-sm text-gray-600 mt-1">
          Analytics overview — connect dashboard APIs when available. All figures below are placeholders.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard title="Total expenses" value="—" hint="Sum for selected period (API)" icon={Wallet} />
        <KpiCard title="Pending approvals" value="—" hint="Awaiting final sign-off (API)" icon={Clock} />
        <KpiCard title="Rejected expenses" value="—" hint="Rejected in period (API)" icon={XCircle} />
        <KpiCard title="Monthly expenses" value="—" hint="Current month vs prior (API)" icon={TrendingUp} />
        <KpiCard title="Top expense category" value="—" hint="By amount (API)" icon={PieChart} />
        <KpiCard title="Highest spend employees" value="—" hint="Ranked list (API)" icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 border border-gray-200 min-h-[280px] flex flex-col">
          <h3 className="text-sm font-medium text-[#212529] mb-2">Monthly trend</h3>
          <div className="flex-1 rounded-lg bg-gradient-to-b from-gray-100 to-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-500">
            Chart placeholder — wire time-series from dashboard API
          </div>
        </Card>
        <Card className="p-4 border border-gray-200 min-h-[280px] flex flex-col">
          <h3 className="text-sm font-medium text-[#212529] mb-2">Category split</h3>
          <div className="flex-1 rounded-lg bg-gradient-to-b from-gray-100 to-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-500">
            Graph placeholder — wire breakdown from dashboard API
          </div>
        </Card>
      </div>

      <Card className="p-4 border border-gray-200">
        <h3 className="text-sm font-medium text-[#212529] mb-3">Recent activity</h3>
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-6 text-center text-sm text-gray-500">
          Activity feed placeholder — e.g. recent submissions & approvals from audit API
        </div>
      </Card>
    </div>
  );
}
