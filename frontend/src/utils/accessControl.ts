type AccessControl = {
  globalRole?: string;
  moduleOverrides?: Record<string, string>;
};

function normalizeRole(role?: string) {
  const value = String(role || '').trim();
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

export function isSuperAdmin(role: string) {
  return normalizeRole(role) === 'Super Admin';
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

/** Daily Planner — team tabs (Team Daily Planner, Team Performance, Team Management). */
export function canManageDailyPlannerTeam(role: string) {
  const r = normalizeRole(role);
  return isSuperAdmin(r) || isAdmin(r) || isDeveloper(r);
}

export type DailyPlannerTabId =
  | 'my-daily-planner'
  | 'team-daily-planner'
  | 'team-performance'
  | 'reports'
  | 'team-management';

/**
 * Role-wise Daily Planner tab visibility based on the module access role.
 * Updates automatically when Access Management changes the Daily Planner role.
 */
export function getDailyPlannerVisibleTabs(role: string): DailyPlannerTabId[] {
  const r = normalizeRole(role);

  if (isSuperAdmin(r)) {
    return ['team-daily-planner', 'team-performance', 'team-management'];
  }

  if (isAdmin(r)) {
    return ['my-daily-planner', 'team-daily-planner', 'team-performance'];
  }

  if (isDeveloper(r)) {
    return [
      'my-daily-planner',
      'team-daily-planner',
      'team-performance',
      'reports',
      'team-management',
    ];
  }

  // User (and any other non-elevated role)
  return ['my-daily-planner', 'reports'];
}

export function getDefaultDailyPlannerTab(role: string): DailyPlannerTabId {
  const visible = getDailyPlannerVisibleTabs(role);
  return visible[0] ?? 'my-daily-planner';
}

