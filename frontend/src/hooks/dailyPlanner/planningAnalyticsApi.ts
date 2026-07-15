import type {
  PlanningDashboardData,
  ManagerPlanningDashboardData,
  PlanningHistoryData,
  PlanningReportData,
  TeamPlanningHistoryData,
  PlanningExportPayload,
} from '../../types/planningAnalytics';
import { apiFetch } from '../../services/api';

export async function fetchPlanningDashboard(): Promise<PlanningDashboardData> {
  const res = (await apiFetch('/api/daily-planner/planning/dashboard')) as {
    data?: PlanningDashboardData;
  };
  if (!res?.data) throw new Error('Planning dashboard unavailable');
  return res.data;
}

export async function fetchManagerPlanningDashboard(): Promise<ManagerPlanningDashboardData> {
  const res = (await apiFetch('/api/daily-planner/planning/manager-dashboard')) as {
    data?: ManagerPlanningDashboardData;
  };
  if (!res?.data) throw new Error('Manager planning dashboard unavailable');
  return res.data;
}

export async function fetchPlanningHistory(
  employeeCode?: string,
  limit = 12,
): Promise<PlanningHistoryData> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (employeeCode) params.set('employeeCode', employeeCode);
  const res = (await apiFetch(`/api/daily-planner/planning/history?${params}`)) as {
    data?: PlanningHistoryData;
  };
  if (!res?.data) throw new Error('Planning history unavailable');
  return res.data;
}

export async function fetchPlanningReport(
  year: number,
  month: number,
  employeeCode?: string,
): Promise<PlanningReportData> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  if (employeeCode) params.set('employeeCode', employeeCode);
  const res = (await apiFetch(`/api/daily-planner/planning/report?${params}`)) as {
    data?: PlanningReportData;
  };
  if (!res?.data) throw new Error('Planning report unavailable');
  return res.data;
}

export async function fetchTeamPlanningHistory(limit = 12): Promise<TeamPlanningHistoryData> {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = (await apiFetch(`/api/daily-planner/planning/team-history?${params}`)) as {
    data?: TeamPlanningHistoryData;
  };
  if (!res?.data) throw new Error('Team planning history unavailable');
  return res.data;
}

export async function fetchPlanningExportPayload(
  year: number,
  month: number,
  scope: 'self' | 'team',
  employeeCode?: string,
): Promise<PlanningExportPayload> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
    scope,
  });
  if (employeeCode) params.set('employeeCode', employeeCode);
  const res = (await apiFetch(`/api/daily-planner/planning/export?${params}`)) as {
    data?: PlanningExportPayload;
  };
  if (!res?.data) throw new Error('Planning export unavailable');
  return res.data;
}
