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
  | 'project-progress'
  | 'team-daily-planner'
  | 'team-performance'
  | 'reports'
  | 'team-management';

/**
 * Role-wise Daily Planner tab visibility based on the module access role.
 * Updates automatically when Access Management changes the Daily Planner role.
 * @param enhancedEligible Factory OR (Office + Super Admin) — adds Project Progress tab.
 */
export function getDailyPlannerVisibleTabs(
  role: string,
  options?: { enhancedEligible?: boolean },
): DailyPlannerTabId[] {
  const r = normalizeRole(role);
  const enhanced = Boolean(options?.enhancedEligible);

  const withProjectProgress = (tabs: DailyPlannerTabId[]): DailyPlannerTabId[] => {
    if (!enhanced) return tabs;
    if (tabs.includes('project-progress')) return tabs;
    const idx = tabs.indexOf('my-daily-planner');
    if (idx >= 0) {
      return [...tabs.slice(0, idx + 1), 'project-progress', ...tabs.slice(idx + 1)];
    }
    return ['project-progress', ...tabs];
  };

  if (isSuperAdmin(r)) {
    return withProjectProgress([
      'my-daily-planner',
      'team-daily-planner',
      'team-performance',
      'team-management',
    ]);
  }

  if (isAdmin(r)) {
    return withProjectProgress([
      'my-daily-planner',
      'team-daily-planner',
      'team-performance',
    ]);
  }

  if (isDeveloper(r)) {
    return withProjectProgress([
      'my-daily-planner',
      'team-daily-planner',
      'team-performance',
      'reports',
      'team-management',
    ]);
  }

  // User (and any other non-elevated role)
  return withProjectProgress(['my-daily-planner', 'reports']);
}

export function getDefaultDailyPlannerTab(role: string): DailyPlannerTabId {
  const visible = getDailyPlannerVisibleTabs(role);
  return visible[0] ?? 'my-daily-planner';
}

