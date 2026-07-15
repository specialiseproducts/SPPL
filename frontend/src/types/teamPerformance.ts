export interface TeamPerformanceSummary {
  averageTeamScore: number;
  topPlanner: {
    employeeCode: string;
    employeeName: string;
    planningScore: number;
    badge: string;
    badgeEmoji: string;
  } | null;
  averagePlanningAheadPercent: number;
  teamSize: number;
}

export interface TeamPerformanceEmployeeRow {
  employeeCode: string;
  employeeName: string;
  year: number;
  month: number;
  yearMonth: string;
  planningScore: number;
  planningAheadPercent: number;
  daysPlannedAhead: number;
  workingDays: number;
  regularTaskCount: number;
  urgentTaskCount: number;
  badge: string;
  badgeEmoji: string;
  rating: string;
  ratingLabel?: string;
  ratingStars: number;
  status: string;
  rank?: number;
}

export interface TeamBadgeDistributionRow {
  badge: string;
  emoji: string;
  count: number;
  percent: number;
}

export interface TeamPlanningInsights {
  highestPlanningScore: number;
  lowestPlanningScore: number;
  averagePlanningScore: number;
  averagePlanningPercent: number;
  totalUrgentTasks: number;
  totalRegularTasks: number;
  averageUrgentTasksPerEmployee: number;
  bestPlanner: {
    employeeCode: string;
    employeeName: string;
    planningScore: number;
    badge: string;
    badgeEmoji: string;
  } | null;
  needsMostImprovement: {
    employeeCode: string;
    employeeName: string;
    planningScore: number;
    badge: string;
    badgeEmoji: string;
  } | null;
}

export interface TeamPerformanceData {
  year: number;
  month: number;
  yearMonth: string;
  summary: TeamPerformanceSummary;
  leaderboard: TeamPerformanceEmployeeRow[];
  employees: TeamPerformanceEmployeeRow[];
  badgeDistribution: TeamBadgeDistributionRow[];
  insights: TeamPlanningInsights;
}
