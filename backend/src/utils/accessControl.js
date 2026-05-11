/**
 * Role/access-control helpers.
 * Developer remains a distinct role from Admin.
 */

function normalizeRole(role) {
  const value = String(role || '').trim();
  if (!value) return 'User';
  if (
    value === 'Developer' ||
    value === 'Admin' ||
    value === 'Super Admin' ||
    value === 'User' ||
    value === 'None'
  ) {
    return value;
  }
  const lower = value.toLowerCase();
  if (lower === 'developer') return 'Developer';
  if (lower === 'admin') return 'Admin';
  if (lower === 'super admin') return 'Super Admin';
  if (lower === 'none') return 'None';
  return 'User';
}

export function isDeveloper(role) {
  return normalizeRole(role) === 'Developer';
}

export function isAdmin(role) {
  return normalizeRole(role) === 'Admin';
}

export function isSuperAdmin(role) {
  return normalizeRole(role) === 'Super Admin';
}

export function isUser(role) {
  return normalizeRole(role) === 'User';
}

/** Expenses list/API: only Developer may read or act on all employees' records. */
export function canAccessAllExpenseRecords(role) {
  return isDeveloper(role);
}

export function getEffectiveRole(accessControl, moduleName) {
  const globalRole = normalizeRole(accessControl?.globalRole);
  const override = accessControl?.moduleOverrides?.[moduleName];
  if (override !== undefined && override !== null && String(override).trim() !== '') {
    return normalizeRole(override);
  }
  return globalRole;
}

export function hasModuleAccess(accessControl, moduleName) {
  return getEffectiveRole(accessControl, moduleName) !== 'None';
}

export function canView(role) {
  const r = normalizeRole(role);
  return r !== 'None';
}

export function canCreate(role) {
  const r = normalizeRole(role);
  return r !== 'None';
}

export function canEdit(role) {
  const r = normalizeRole(role);
  return r !== 'None';
}

export function canDelete(role) {
  const r = normalizeRole(role);
  return r !== 'None';
}

export function canExport(role) {
  const r = normalizeRole(role);
  return r !== 'None';
}

export function canAccessAllRecords(role) {
  const r = normalizeRole(role);
  return isDeveloper(r) || isAdmin(r) || isSuperAdmin(r);
}

export function buildOwnershipFilter(user, role) {
  if (canAccessAllRecords(role)) {
    return null;
  }

  return {
    created_by_employee_code: String(user?.employeeCode || '').trim(),
  };
}

export function isOwnedByUser(record, user) {
  const code = String(user?.employeeCode || '').trim();
  if (!code) return false;

  const fullName = String(user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()).trim();

  const recordCode = String(
    record?.created_by_employee_code ||
      record?.createdByEmployeeCode ||
      record?.employeeCode ||
      record?.employee_code ||
      record?.created_by ||
      ''
  ).trim();

  if (recordCode && recordCode === code) return true;

  const recordName = String(record?.created_by_name || record?.employeeName || record?.employee_name || '').trim();
  if (fullName && recordName && recordName === fullName) return true;

  return false;
}

