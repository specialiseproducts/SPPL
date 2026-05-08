export function buildSoftDeleteFields(user = {}) {
  return {
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by_employee_code: user?.employeeCode || '',
    deleted_by_name: user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
    deleted_by_role: user?.role || '',
  };
}

export function isNotDeleted(record = {}) {
  return !record?.is_deleted;
}

