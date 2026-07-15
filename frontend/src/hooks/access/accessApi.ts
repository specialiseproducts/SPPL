import { apiFetch } from '../../services/api';
import type { AccessRule } from '../../components/AccessManagementTab';
import type { UserRole } from '../../App';
import type { ModuleName } from '../../components/Sidebar';

const MODULE_KEY_TO_LABEL: Record<string, ModuleName> = {
  salesForecasting: 'Sales Forecasting',
  expenses: 'Expenses',
  payroll: 'Payroll',
  purchases: 'Purchases',
  crm: 'CRM',
  userManagement: 'User Management',
  dailyPlanner: 'Daily Planner',
};

const MODULE_LABEL_TO_KEY: Record<ModuleName, string> = {
  'Sales Forecasting': 'salesForecasting',
  Expenses: 'expenses',
  Payroll: 'payroll',
  Purchases: 'purchases',
  CRM: 'crm',
  'User Management': 'userManagement',
  'Daily Planner': 'dailyPlanner',
};

export function accessRuleToApiPayload(rule: AccessRule) {
  return {
    employeeCode: rule.employeeCode,
    employeeName: rule.name,
    globalRole: rule.baseRole,
    moduleOverrides: rule.overrides.reduce<Record<string, string>>((acc, override) => {
      const moduleKey = MODULE_LABEL_TO_KEY[override.pageName];
      if (moduleKey) acc[moduleKey] = String(override.subRole);
      return acc;
    }, {}),
  };
}

function mapApiRule(item: Record<string, unknown>): AccessRule {
  return {
    id: String(item?.employeeCode ?? ''),
    name: String(item?.employeeName ?? ''),
    employeeCode: String(item?.employeeCode ?? ''),
    baseRole: (item?.globalRole || 'User') as UserRole,
    overrides: Object.entries((item?.moduleOverrides as Record<string, unknown>) || {}).map(([key, value]) => ({
      pageName: MODULE_KEY_TO_LABEL[key] || 'Sales Forecasting',
      subRole: String(value || 'User') as UserRole | 'None',
    })),
    lastModified: String(item?.updatedAt || item?.createdAt || ''),
    updatedByName: String(item?.updatedByName || item?.updatedBy || ''),
  };
}

export async function fetchAccessRules(): Promise<AccessRule[]> {
  const data = await apiFetch('/api/access-control');
  const rows = Array.isArray(data?.data) ? data.data : [];
  return rows.map((row: Record<string, unknown>) => mapApiRule(row));
}
