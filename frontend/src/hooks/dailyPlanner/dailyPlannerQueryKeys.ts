export const dailyPlannerQueryKeys = {
  all: ['dailyPlanner'] as const,
  month: (year: number, month: number) =>
    [...dailyPlannerQueryKeys.all, 'month', year, month] as const,
  day: (date: string) => [...dailyPlannerQueryKeys.all, 'day', date] as const,
  team: (filters: Record<string, string>) =>
    [...dailyPlannerQueryKeys.all, 'team', filters] as const,
  teamMonth: (year: number, month: number, employeeCode: string) =>
    [...dailyPlannerQueryKeys.all, 'teamMonth', year, month, employeeCode] as const,
  mappings: () => [...dailyPlannerQueryKeys.all, 'mappings'] as const,
  planningConfig: () => [...dailyPlannerQueryKeys.all, 'planningConfig'] as const,
  planningProfile: (employeeCode = 'me') =>
    [...dailyPlannerQueryKeys.all, 'planningProfile', employeeCode] as const,
  teamPerformance: (year: number, month: number) =>
    [...dailyPlannerQueryKeys.all, 'teamPerformance', year, month] as const,
  planningDashboard: () => [...dailyPlannerQueryKeys.all, 'planningDashboard'] as const,
  managerPlanningDashboard: () => [...dailyPlannerQueryKeys.all, 'managerPlanningDashboard'] as const,
  planningHistory: (employeeCode = 'me') =>
    [...dailyPlannerQueryKeys.all, 'planningHistory', employeeCode] as const,
  planningReport: (year: number, month: number, employeeCode = 'me') =>
    [...dailyPlannerQueryKeys.all, 'planningReport', year, month, employeeCode] as const,
  teamPlanningHistory: () => [...dailyPlannerQueryKeys.all, 'teamPlanningHistory'] as const,
  completionApprovalsPending: () =>
    [...dailyPlannerQueryKeys.all, 'completion-approvals', 'pending'] as const,
};
