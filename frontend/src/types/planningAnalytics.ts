export interface PlanningDashboardData {
  year: number;
  month: number;
  yearMonth: string;
  planningScore: number;
  badge: string;
  badgeEmoji: string;
  planningAheadPercent: number;
  rating: string;
  ratingLabel: string;
  ratingStars: number;
  managerRank: number | null;
  managerTeamSize: number;
  progressPercent: number;
}

export interface ManagerPlanningDashboardData {
  year: number;
  month: number;
  yearMonth: string;
  averageTeamScore: number;
  bestPlanner: {
    employeeCode: string;
    employeeName: string;
    planningScore: number;
    badge?: string;
    badgeEmoji?: string;
  } | null;
  lowestPlanner: {
    employeeCode: string;
    employeeName: string;
    planningScore: number;
  } | null;
  platinumEmployees: number;
  goldEmployees: number;
  employeesNeedingImprovement: number;
  planningAheadPercent: number;
  teamSize: number;
  managerCode: string;
}

export interface PlanningHistoryRow {
  employeeCode?: string;
  employeeName?: string;
  year: number;
  month: number;
  yearMonth: string;
  planningScore: number;
  planningAheadPercent: number;
  daysPlannedAhead?: number;
  workingDays?: number;
  regularTaskCount: number;
  urgentTaskCount: number;
  latePlanningCount?: number;
  badge: string;
  badgeEmoji: string;
  rating: string;
  ratingLabel?: string;
  ratingStars: number;
}

export interface PlanningTrends {
  highestEverScore: number;
  averageScore: number;
  bestMonth: PlanningHistoryRow | null;
  worstMonth: PlanningHistoryRow | null;
  mostImprovedMonth: (PlanningHistoryRow & { improvement?: number }) | null;
  longestPlatinumStreak: number;
  badgeProgression: Array<{ yearMonth: string; badge: string; badgeEmoji: string }>;
  planningGrowthPercent: number;
}

export interface PlanningHistoryData {
  employeeCode: string;
  employeeName: string;
  history: PlanningHistoryRow[];
  trends: PlanningTrends;
}

export interface TrendIndicator {
  direction: 'up' | 'down' | 'stable';
  delta?: number;
  label: string;
}

export interface PlanningReportData {
  year: number;
  month: number;
  yearMonth: string;
  employeeCode: string;
  employeeName: string;
  summary: {
    planningScore: number;
    badge: string;
    badgeEmoji: string;
    planningAheadPercent: number;
    workingDays: number;
    daysPlannedAhead: number;
    regularTaskCount: number;
    urgentTaskCount: number;
    latePlanningDays: number;
    rating: string;
    ratingLabel: string;
    ratingStars: number;
  };
  performanceBreakdown: {
    excellent: boolean;
    good: boolean;
    average: boolean;
    needsImprovement: boolean;
    status: string;
  };
  monthlyComment: string;
  indicators: {
    planningScore: TrendIndicator;
    planningAheadPercent: TrendIndicator;
    badge: TrendIndicator;
  };
  history: PlanningHistoryRow[];
  chartSeries: {
    planningScoreByMonth: Array<{ yearMonth: string; value: number }>;
    planningAheadPercentByMonth: Array<{ yearMonth: string; value: number }>;
    urgentTaskCountByMonth: Array<{ yearMonth: string; value: number }>;
    regularTaskCountByMonth: Array<{ yearMonth: string; value: number }>;
    badgeHistory: Array<{ yearMonth: string; badge: string; badgeEmoji: string }>;
  };
  trends: PlanningTrends;
}

export interface TeamPlanningHistoryData {
  managerCode: string;
  history: Array<{
    year: number;
    month: number;
    yearMonth: string;
    averageTeamScore?: number;
    averagePlanningAheadPercent?: number;
    teamSize?: number;
    topPlanner?: {
      employeeName: string;
      planningScore: number;
    };
    badgeDistribution?: Array<{ badge: string; count: number; percent: number }>;
    summary?: ManagerPlanningDashboardData;
  }>;
  chartSeries: {
    averageTeamScoreByMonth: Array<{ yearMonth: string; value: number }>;
    planningAheadPercentByMonth: Array<{ yearMonth: string; value: number }>;
    topPlannerByMonth: Array<{ yearMonth: string; employeeName: string; planningScore: number }>;
    badgeDistributionByMonth: Array<{
      yearMonth: string;
      distribution: Array<{ badge: string; count: number; percent: number }>;
    }>;
  };
}

export interface PlanningExportPayload {
  scope: 'self' | 'team';
  year: number;
  month: number;
  yearMonth: string;
  employeeCode?: string;
  employeeName?: string;
  summary?: PlanningReportData['summary'] | ManagerPlanningDashboardData;
  rows?: unknown[];
}
