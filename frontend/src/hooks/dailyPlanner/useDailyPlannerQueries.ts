import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dailyPlannerQueryKeys } from './dailyPlannerQueryKeys';
import { queryDefaults } from '../queryDefaults';
import {
  fetchDailyPlannerDay,
  fetchDailyPlannerMonth,
  fetchTeamDailyPlannerMonth,
  fetchTeamDailyPlannerTasks,
  fetchTeamMappings,
} from './dailyPlannerApi';
import {
  fetchEmployeePlanningProfile,
  fetchMyPlanningProfile,
  fetchPlanningConfig,
} from './planningRecognitionApi';
import { fetchTeamPerformance } from './teamPerformanceApi';
import {
  fetchManagerPlanningDashboard,
  fetchPlanningDashboard,
  fetchPlanningHistory,
  fetchPlanningReport,
  fetchTeamPlanningHistory,
} from './planningAnalyticsApi';

export function useDailyPlannerMonthQuery(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.month(year, month),
    queryFn: () => fetchDailyPlannerMonth(year, month),
    enabled: enabled && year > 0 && month >= 1 && month <= 12,
    ...queryDefaults.reference,
  });
}

export function useDailyPlannerDayQuery(date: string, enabled = true) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.day(date),
    queryFn: () => fetchDailyPlannerDay(date),
    enabled: enabled && !!date,
    ...queryDefaults.reference,
  });
}

export function useTeamDailyPlannerQuery(
  filters: Record<string, string>,
  enabled = true,
) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.team(filters),
    queryFn: () => fetchTeamDailyPlannerTasks(filters),
    enabled,
    ...queryDefaults.list,
  });
}

export function useTeamDailyPlannerMonthQuery(
  year: number,
  month: number,
  employeeCode = '',
  enabled = true,
) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.teamMonth(year, month, employeeCode),
    queryFn: () => fetchTeamDailyPlannerMonth(year, month, employeeCode),
    enabled: enabled && year > 0 && month >= 1 && month <= 12,
    ...queryDefaults.list,
  });
}

export function useTeamMappingsQuery(enabled = true) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.mappings(),
    queryFn: fetchTeamMappings,
    enabled,
    ...queryDefaults.reference,
  });
}

export function usePlanningConfigQuery(enabled = true) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.planningConfig(),
    queryFn: fetchPlanningConfig,
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
    ...queryDefaults.reference,
  });
}

export function useMyPlanningProfileQuery(enabled = true) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.planningProfile('me'),
    queryFn: fetchMyPlanningProfile,
    enabled,
    ...queryDefaults.reference,
  });
}

export function useEmployeePlanningProfileQuery(employeeCode: string, enabled = true) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.planningProfile(employeeCode),
    queryFn: () => fetchEmployeePlanningProfile(employeeCode),
    enabled: enabled && !!employeeCode,
    ...queryDefaults.reference,
  });
}

export function useTeamPerformanceQuery(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.teamPerformance(year, month),
    queryFn: () => fetchTeamPerformance(year, month),
    enabled: enabled && year > 0 && month >= 1 && month <= 12,
    ...queryDefaults.list,
  });
}

export function usePlanningDashboardQuery(enabled = true) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.planningDashboard(),
    queryFn: fetchPlanningDashboard,
    enabled,
    ...queryDefaults.reference,
  });
}

export function useManagerPlanningDashboardQuery(enabled = true) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.managerPlanningDashboard(),
    queryFn: fetchManagerPlanningDashboard,
    enabled,
    ...queryDefaults.reference,
  });
}

export function usePlanningHistoryQuery(employeeCode = 'me', enabled = true) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.planningHistory(employeeCode),
    queryFn: () => fetchPlanningHistory(employeeCode === 'me' ? undefined : employeeCode),
    enabled,
    ...queryDefaults.reference,
  });
}

export function usePlanningReportQuery(
  year: number,
  month: number,
  employeeCode = 'me',
  enabled = true,
) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.planningReport(year, month, employeeCode),
    queryFn: () =>
      fetchPlanningReport(year, month, employeeCode === 'me' ? undefined : employeeCode),
    enabled: enabled && year > 0 && month >= 1 && month <= 12,
    ...queryDefaults.list,
  });
}

export function useTeamPlanningHistoryQuery(enabled = true) {
  return useQuery({
    queryKey: dailyPlannerQueryKeys.teamPlanningHistory(),
    queryFn: () => fetchTeamPlanningHistory(),
    enabled,
    ...queryDefaults.list,
  });
}

export function useInvalidateDailyPlannerQueries() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: dailyPlannerQueryKeys.all });
  };
}
