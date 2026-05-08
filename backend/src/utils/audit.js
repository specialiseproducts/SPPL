/**
 * Audit field helper
 *
 * Standardized creator metadata for new records.
 */

function toText(v) {
  return String(v || '').trim();
}

export function buildAuditFields(user = {}) {
  const firstName = toText(user.firstName);
  const lastName = toText(user.lastName);
  const fullName =
    toText(user.fullName) ||
    `${firstName} ${lastName}`.trim() ||
    toText(user.employeeCode);

  const role =
    toText(user.role) ||
    toText(user.accessControl?.globalRole) ||
    'User';

  const now = new Date().toISOString();

  return {
    created_by_employee_code: toText(user.employeeCode),
    created_by_name: fullName,
    created_by_role: role,
    created_by_user_id: toText(user.userId || user.employeeCode),
    created_by_first_name: firstName,
    created_by_last_name: lastName,
    created_by: toText(user.employeeCode), // compatibility for legacy consumers
    created_at: now,
    updated_at: now,
  };
}

