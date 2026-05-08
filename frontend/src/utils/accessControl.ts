type AccessControl = {
  globalRole?: string;
  moduleOverrides?: Record<string, string>;
};

function normalizeRole(role?: string) {
  const value = String(role || '').trim();
  if (value === 'Developer' || value === 'Admin' || value === 'User' || value === 'None') return value;
  const lower = value.toLowerCase();
  if (lower === 'developer') return 'Developer';
  if (lower === 'admin') return 'Admin';
  if (lower === 'none') return 'None';
  return 'User';
}

function roleFromAccess(accessControl?: AccessControl) {
  return normalizeRole(accessControl?.globalRole);
}

export function getEffectiveRole(moduleName: string, accessControl?: AccessControl) {
  const override = accessControl?.moduleOverrides?.[moduleName];
  if (override !== undefined && override !== null && String(override).trim() !== '') {
    return normalizeRole(String(override));
  }
  return roleFromAccess(accessControl);
}

export function hasModuleAccess(moduleName: string, accessControl?: AccessControl) {
  return getEffectiveRole(moduleName, accessControl) !== 'None';
}

export function isDeveloper(role: string) {
  return normalizeRole(role) === 'Developer';
}

export function isAdmin(role: string) {
  return normalizeRole(role) === 'Admin';
}

export function isUser(role: string) {
  return normalizeRole(role) === 'User';
}

export function canView(role: string) {
  return normalizeRole(role) !== 'None';
}

export function canCreate(role: string) {
  return normalizeRole(role) !== 'None';
}

export function canEdit(role: string) {
  return normalizeRole(role) !== 'None';
}

export function canDelete(role: string) {
  return normalizeRole(role) !== 'None';
}

export function canExport(role: string) {
  return normalizeRole(role) !== 'None';
}

