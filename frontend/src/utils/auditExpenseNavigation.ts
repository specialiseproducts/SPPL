const AUDIT_EXPENSE_PATH_PREFIX = '/audit-expenses/';
const AUDIT_EXPENSE_VIEW_STATE_KEY = 'auditExpenseViewState';

export type AuditExpenseViewState = {
  activeTab: 'audit';
  employee: string;
  month: string;
  year: string;
  filtersApplied: boolean;
  scrollY?: number;
};

export function saveAuditExpenseViewState(state: AuditExpenseViewState): void {
  try {
    sessionStorage.setItem(AUDIT_EXPENSE_VIEW_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function peekAuditExpenseViewState(): AuditExpenseViewState | null {
  try {
    const raw = sessionStorage.getItem(AUDIT_EXPENSE_VIEW_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuditExpenseViewState;
    if (
      parsed &&
      parsed.activeTab === 'audit' &&
      typeof parsed.employee === 'string' &&
      typeof parsed.month === 'string' &&
      typeof parsed.year === 'string' &&
      typeof parsed.filtersApplied === 'boolean'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearAuditExpenseViewState(): void {
  try {
    sessionStorage.removeItem(AUDIT_EXPENSE_VIEW_STATE_KEY);
  } catch {
    // ignore
  }
}

export function getAuditExpenseIdFromPath(pathname = window.location.pathname): string | null {
  if (!pathname.startsWith(AUDIT_EXPENSE_PATH_PREFIX)) {
    return null;
  }
  const raw = pathname.slice(AUDIT_EXPENSE_PATH_PREFIX.length);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function isAuditExpenseDetailPath(pathname = window.location.pathname): boolean {
  return getAuditExpenseIdFromPath(pathname) != null;
}

export function navigateToAuditExpenseDetail(expenseId: string): void {
  try {
    localStorage.setItem('sppl_selected_module', 'expenses');
  } catch {
    // ignore
  }
  const path = `${AUDIT_EXPENSE_PATH_PREFIX}${encodeURIComponent(expenseId)}`;
  window.history.pushState({ auditExpenseDetail: expenseId }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateBackToAuditExpenses(): void {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  try {
    localStorage.setItem('sppl_selected_module', 'expenses');
  } catch {
    // ignore
  }
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}
