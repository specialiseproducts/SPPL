import type { PlanningConfig, PlanningProfile } from '../../utils/planningRecognition';
import { apiFetch } from '../../services/api';

export async function fetchPlanningConfig(): Promise<PlanningConfig> {
  const res = (await apiFetch('/api/daily-planner/planning/config')) as {
    data?: { config?: PlanningConfig };
  };
  if (!res?.data?.config) throw new Error('Planning config unavailable');
  return res.data.config;
}

export async function fetchMyPlanningProfile(): Promise<PlanningProfile> {
  const res = (await apiFetch('/api/daily-planner/planning/me')) as {
    data?: PlanningProfile;
  };
  return (
    res?.data ?? {
      currentMonth: null,
      history: [],
      todayIst: '',
    }
  );
}

export async function fetchEmployeePlanningProfile(employeeCode: string): Promise<PlanningProfile> {
  const res = (await apiFetch(
    `/api/daily-planner/planning/employee/${encodeURIComponent(employeeCode)}`,
  )) as { data?: PlanningProfile };
  return (
    res?.data ?? {
      currentMonth: null,
      history: [],
      todayIst: '',
    }
  );
}
