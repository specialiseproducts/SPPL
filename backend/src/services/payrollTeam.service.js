/**
 * Payroll team-mapping service.
 * Writes only to PayrollTeamMappings — never DailyPlannerTeamMappings.
 */

import * as PayrollTeamMappingsModel from '../models/PayrollTeamMappings.js';
import * as EmployeeMasterModel from '../models/EmployeeMaster.js';
import {
  canAccessAllRecords,
  canManagePayrollTeamMappings,
} from '../utils/accessControl.js';
import { getEmployeeLocation } from '../utils/employeeLocation.js';
import {
  assertEmployeeActiveOnDate,
  EMPLOYEE_EXITED_OPERATION_MESSAGE,
} from '../utils/employeeActiveStatus.js';
import { todayIstDateKey } from '../utils/salesQuotationDates.js';

function forbidden(message = 'Forbidden') {
  const err = new Error(message);
  err.statusCode = 403;
  return err;
}

function assertCanManagePayrollTeamMappings(effectiveRole) {
  if (!canManagePayrollTeamMappings(effectiveRole)) {
    throw forbidden();
  }
}

/**
 * Employee directory for Payroll Team assign/transfer dropdowns.
 * Super Admin / Developer only (Payroll Team tab). Not User Management access.
 */
export const listPayrollEmployeeDirectory = async (options = {}, effectiveRole = 'User') => {
  assertCanManagePayrollTeamMappings(effectiveRole);
  const result = await EmployeeMasterModel.getAllEmployees(options);
  return { data: result.data || [], nextCursor: result.nextCursor ?? null };
};

function employeeCodeOf(authUser) {
  return String(authUser?.employeeCode || authUser?.id || '').trim();
}

function employeeNameOf(authUser) {
  return String(
    authUser?.fullName || `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim(),
  ).trim();
}

async function assertEmployeeCodeActiveOnDate(employeeCode, operationDate) {
  const code = String(employeeCode || '').trim();
  if (!code) return;
  const employee = await EmployeeMasterModel.getEmployeeByCode(code);
  assertEmployeeActiveOnDate(
    employee?.dateOfExit || employee?.date_of_exit,
    operationDate,
    EMPLOYEE_EXITED_OPERATION_MESSAGE,
  );
}

/**
 * Team mappings for Team Calendar (Admin+) and Payroll Team (Super Admin / Developer).
 * Admin / elevated non-managers of the Payroll Team tab only receive their own mappings.
 */
export const listTeamMappings = async (authUser, effectiveRole) => {
  if (!canAccessAllRecords(effectiveRole)) {
    throw forbidden();
  }
  const mappings = await PayrollTeamMappingsModel.listAllMappings();
  const enriched = await Promise.all(
    (mappings || []).map(async (mapping) => {
      const location = await getEmployeeLocation(mapping?.employeeCode);
      return { ...mapping, location };
    }),
  );
  if (canManagePayrollTeamMappings(effectiveRole)) {
    return { mappings: enriched };
  }
  const managerCode = employeeCodeOf(authUser);
  return {
    mappings: (enriched || []).filter(
      (m) => String(m.managerCode || '').trim() === managerCode,
    ),
  };
};

export const assignTeamMapping = async (body, authUser, effectiveRole) => {
  assertCanManagePayrollTeamMappings(effectiveRole);
  const actorCode = employeeCodeOf(authUser);
  const managerCode = String(body.managerCode || '').trim() || actorCode;
  if (!managerCode) {
    const err = new Error('Reporting manager is required');
    err.statusCode = 400;
    throw err;
  }
  const managerName =
    String(body.managerName || '').trim() ||
    (managerCode === actorCode ? employeeNameOf(authUser) : '') ||
    managerCode;
  const employeeCode = String(body.employeeCode || '').trim();
  const today = todayIstDateKey();
  await assertEmployeeCodeActiveOnDate(employeeCode, today);
  await assertEmployeeCodeActiveOnDate(managerCode, today);
  const mapping = await PayrollTeamMappingsModel.createMapping({
    managerCode,
    managerName,
    employeeCode,
    employeeName: String(body.employeeName || '').trim(),
    createdBy: actorCode,
  });
  return { mapping };
};

export const removeTeamMapping = async (mappingId, effectiveRole) => {
  assertCanManagePayrollTeamMappings(effectiveRole);
  await PayrollTeamMappingsModel.softDeleteMapping(mappingId);
  return { success: true };
};

export const transferTeamMapping = async (mappingId, body, effectiveRole) => {
  assertCanManagePayrollTeamMappings(effectiveRole);
  const newManagerCode = String(body.managerCode || '').trim();
  const newManagerName = String(body.managerName || '').trim();
  if (!newManagerCode) {
    const err = new Error('managerCode is required');
    err.statusCode = 400;
    throw err;
  }
  await assertEmployeeCodeActiveOnDate(newManagerCode, todayIstDateKey());
  const mapping = await PayrollTeamMappingsModel.updateMapping(mappingId, {
    managerCode: newManagerCode,
    managerName: newManagerName,
  });
  return { mapping };
};
