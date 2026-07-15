import type { TeamPerformanceData } from '../../types/teamPerformance';
import { apiFetch } from '../../services/api';

export async function fetchTeamPerformance(
  year: number,
  month: number,
): Promise<TeamPerformanceData> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const res = (await apiFetch(`/api/daily-planner/team-performance?${params}`)) as {
    data?: TeamPerformanceData;
  };
  if (!res?.data) throw new Error('Team performance data unavailable');
  return res.data;
}
