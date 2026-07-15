import type { ExpenseRecord } from '../types/expenses';

const MY_EXPENSE_EDIT_PATH_PREFIX = '/my-expenses/edit/';
const MY_EXPENSE_CREATE_REVIEW_PATH = '/my-expenses/review';
const MY_EXPENSE_VIEW_STATE_KEY = 'myExpenseViewState';

let pendingCreateDraft: ExpenseRecord | null = null;

export type MyExpenseViewState = {
  searchTerm: string;
  selectedEmployee: string;
  selectedMonth: string;
  selectedYear: string;
  scopeSelfOnly: boolean;
  scrollY?: number;
};

export function saveMyExpenseViewState(state: MyExpenseViewState): void {
  try {
    sessionStorage.setItem(MY_EXPENSE_VIEW_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function peekMyExpenseViewState(): MyExpenseViewState | null {
  try {
    const raw = sessionStorage.getItem(MY_EXPENSE_VIEW_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MyExpenseViewState;
    if (
      parsed &&
      typeof parsed.searchTerm === 'string' &&
      typeof parsed.selectedEmployee === 'string' &&
      typeof parsed.selectedMonth === 'string' &&
      typeof parsed.selectedYear === 'string' &&
      typeof parsed.scopeSelfOnly === 'boolean'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearMyExpenseViewState(): void {
  try {
    sessionStorage.removeItem(MY_EXPENSE_VIEW_STATE_KEY);
  } catch {
    // ignore
  }
}

export function setMyExpenseCreateDraft(expense: ExpenseRecord): void {
  pendingCreateDraft = expense;
}

export function peekMyExpenseCreateDraft(): ExpenseRecord | null {
  return pendingCreateDraft;
}

export function clearMyExpenseCreateDraft(): void {
  pendingCreateDraft = null;
}

export function isMyExpenseCreateReviewPath(pathname = window.location.pathname): boolean {
  return pathname === MY_EXPENSE_CREATE_REVIEW_PATH;
}

export function getMyExpenseEditIdFromPath(pathname = window.location.pathname): string | null {
  if (!pathname.startsWith(MY_EXPENSE_EDIT_PATH_PREFIX)) {
    return null;
  }
  const raw = pathname.slice(MY_EXPENSE_EDIT_PATH_PREFIX.length);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function navigateToMyExpenseCreateReview(): void {
  try {
    localStorage.setItem('sppl_selected_module', 'expenses');
  } catch {
    // ignore
  }
  window.history.pushState({ myExpenseCreateReview: true }, '', MY_EXPENSE_CREATE_REVIEW_PATH);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateToMyExpenseEdit(expenseId: string): void {
  try {
    localStorage.setItem('sppl_selected_module', 'expenses');
  } catch {
    // ignore
  }
  const path = `${MY_EXPENSE_EDIT_PATH_PREFIX}${encodeURIComponent(expenseId)}`;
  window.history.pushState({ myExpenseEdit: expenseId }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateBackToMyExpenses(): void {
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
