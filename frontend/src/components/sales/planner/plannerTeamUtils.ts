import type { AccessRule } from '../../AccessManagementTab';
import type { ModuleName } from '../../Sidebar';
import type { UserMaster } from '../../../types/userMaster';
import { getEffectiveRole } from '../../../utils/accessControl';

export const MY_PLANNER_VALUE = '__my_planner__';
export const ALL_TEAM_VALUE = '__all_team__';

export type PlannerTeamEmployeeOption = {
  value: string;
  label: string;
  employeeCode: string;
};

const MODULE_LABEL_TO_KEY: Record<ModuleName, string> = {
  'Sales Forecasting': 'salesForecasting',
  Expenses: 'expenses',
  Payroll: 'payroll',
  Purchases: 'purchases',
  CRM: 'crm',
  'User Management': 'userManagement',
};

function employeeDisplayName(emp: UserMaster): string {
  return String(emp.name || emp.employee_name || '').trim() || String(emp.employeeCode || emp.employee_code || '').trim();
}

function employeeCodeOf(emp: UserMaster): string {
  return String(emp.employeeCode || emp.employee_code || '').trim();
}

function isActiveEmployee(emp: UserMaster | undefined): boolean {
  if (!emp) return true;
  const exit = String(emp.dateOfExit || emp.date_of_exit || '').trim();
  if (!exit) return true;
  const exitDate = new Date(exit);
  if (Number.isNaN(exitDate.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exitDate.setHours(0, 0, 0, 0);
  return exitDate.getTime() > today.getTime();
}

function hasSalesForecastingAccess(rule: AccessRule): boolean {
  const moduleOverrides = rule.overrides.reduce<Record<string, string>>((acc, override) => {
    const moduleKey = MODULE_LABEL_TO_KEY[override.pageName];
    if (moduleKey) acc[moduleKey] = String(override.subRole);
    return acc;
  }, {});

  const effectiveRole = getEffectiveRole('salesForecasting', {
    globalRole: rule.baseRole,
    moduleOverrides,
  });

  return effectiveRole !== 'None';
}

/**
 * Build Team Planner employee options from User Management access rules only.
 * Includes employees with effective Sales Forecasting access (not "None").
 */
export function buildPlannerTeamEmployeeOptions(
  employees: UserMaster[],
  accessRules: AccessRule[],
): PlannerTeamEmployeeOption[] {
  const employeesByCode = new Map(
    employees
      .map((emp) => {
        const code = employeeCodeOf(emp);
        return code ? [code, emp] as const : null;
      })
      .filter((entry): entry is readonly [string, UserMaster] => !!entry),
  );

  const eligible = accessRules
    .map((rule) => {
      const code = String(rule.employeeCode || '').trim();
      if (!code || !hasSalesForecastingAccess(rule)) return null;

      const emp = employeesByCode.get(code);
      if (!isActiveEmployee(emp)) return null;

      const label = emp ? employeeDisplayName(emp) : String(rule.name || '').trim();
      if (!label) return null;

      return {
        value: code,
        label,
        employeeCode: code,
      };
    })
    .filter((row): row is PlannerTeamEmployeeOption => !!row)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  return eligible;
}

export function isAllTeamPlannerSelection(selectedValue: string): boolean {
  return String(selectedValue || '').trim() === ALL_TEAM_VALUE;
}

export function resolvePlannerEmployeeCode(
  selectedValue: string,
  currentEmployeeCode: string,
): string | undefined {
  const selfCode = String(currentEmployeeCode || '').trim();
  const selected = String(selectedValue || '').trim();
  if (!selected || selected === MY_PLANNER_VALUE || selected === ALL_TEAM_VALUE) return undefined;
  if (selected === selfCode) return undefined;
  return selected;
}

export function collectPlannerTeamEmployeeCodes(options: PlannerTeamEmployeeOption[]): string[] {
  return [...new Set(options.map((option) => option.employeeCode).filter(Boolean))].sort();
}
