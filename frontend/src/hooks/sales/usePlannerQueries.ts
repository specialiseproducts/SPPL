import { useMemo } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesQueryKeys } from './salesQueryKeys';
import { queryDefaults } from '../queryDefaults';
import {
  fetchPlannerMonthEvents,
  fetchPlannerOrganizations,
} from './plannerApi';
import type { PlannerEvent } from '../../types/planner';

export function usePlannerOrganizationsQuery(enabled = true) {
  return useQuery({
    queryKey: salesQueryKeys.plannerOrganizations(),
    queryFn: fetchPlannerOrganizations,
    enabled,
    ...queryDefaults.reference,
  });
}

export function usePlannerMonthQuery(
  year: number,
  month: number,
  employeeCode?: string,
  enabled = true,
) {
  const code = String(employeeCode || '').trim();
  return useQuery({
    queryKey: salesQueryKeys.plannerMonth(year, month, code || undefined),
    queryFn: () => fetchPlannerMonthEvents(year, month, code || undefined),
    enabled: enabled && year > 0 && month >= 1 && month <= 12,
    ...queryDefaults.reference,
  });
}

export function usePlannerAllTeamMonthQuery(
  year: number,
  month: number,
  employeeCodes: string[],
  enabled = true,
) {
  const codes = useMemo(
    () => [...new Set(employeeCodes.map((code) => String(code || '').trim()).filter(Boolean))].sort(),
    [employeeCodes],
  );

  const results = useQueries({
    queries: codes.map((code) => ({
      queryKey: salesQueryKeys.plannerMonth(year, month, code),
      queryFn: () => fetchPlannerMonthEvents(year, month, code),
      enabled: enabled && year > 0 && month >= 1 && month <= 12 && codes.length > 0,
      ...queryDefaults.reference,
    })),
  });

  const data = useMemo(() => {
    const merged: PlannerEvent[] = [];
    const seen = new Set<string>();
    for (const result of results) {
      for (const event of result.data ?? []) {
        if (!event.eventId || seen.has(event.eventId)) continue;
        seen.add(event.eventId);
        merged.push(event);
      }
    }
    return merged;
  }, [results]);

  return {
    data,
    isLoading: results.some((result) => result.isLoading),
    isFetching: results.some((result) => result.isFetching),
    isError: results.some((result) => result.isError),
  };
}

export function useInvalidatePlannerMonth() {
  const queryClient = useQueryClient();
  return (year: number, month: number) => {
    void queryClient.invalidateQueries({ queryKey: salesQueryKeys.plannerMonth(year, month) });
    void queryClient.refetchQueries({ queryKey: salesQueryKeys.plannerMonth(year, month), type: 'all' });
  };
}

export function useInvalidatePlannerQueries() {
  const queryClient = useQueryClient();
  return () => {
    const plannerKey = [...salesQueryKeys.all, 'planner'] as const;
    void queryClient.invalidateQueries({ queryKey: plannerKey });
    void queryClient.refetchQueries({ queryKey: plannerKey, type: 'all' });
  };
}

export function useInvalidateSalesForecastsFromPlanner() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: salesQueryKeys.forecasts() });
    void queryClient.invalidateQueries({ queryKey: salesQueryKeys.forecastsInfinite() });
    void queryClient.refetchQueries({ queryKey: salesQueryKeys.forecasts(), type: 'all' });
    void queryClient.refetchQueries({ queryKey: salesQueryKeys.forecastsInfinite(), type: 'all' });
  };
}
