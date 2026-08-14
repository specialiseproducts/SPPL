import { navigateToAuditExpenseDetail } from '../utils/auditExpenseNavigation';
import { navigateToMyExpenseEdit } from '../utils/myExpenseNavigation';
import type { PortalNotification } from '../types/notifications';

const MODULE_TO_ID: Record<string, string> = {
  expenses: 'expenses',
  salesForecasting: 'sales-forecasting',
  dailyPlanner: 'daily-planner',
  userManagement: 'user-management',
  system: '',
  crm: 'crm',
  payroll: 'payroll',
  purchases: 'purchases',
  orderProcessing: 'order-processing',
};

const DAILY_PLANNER_INITIAL_TAB_KEY = 'dailyPlanner_initial_tab';

function storeDailyPlannerFocus(notification: PortalNotification) {
  const meta = (notification.metadata || {}) as {
    focus?: string;
    plannerDate?: string;
  };
  const focus =
    String(meta.focus || '').trim() ||
    (notification.actionId === 'planning-performance'
      ? 'planning-performance'
      : notification.actionId
        ? 'task'
        : 'planner');
  try {
    localStorage.setItem(DAILY_PLANNER_INITIAL_TAB_KEY, 'my-daily-planner');
    sessionStorage.setItem(
      'sppl_notification_focus',
      JSON.stringify({
        module: notification.module,
        actionId: notification.actionId,
        actionType: notification.actionType,
        actionUrl: notification.actionUrl,
        focus,
        plannerDate: meta.plannerDate,
        at: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Navigate from a notification View action without modifying module UIs.
 * Uses existing expense deep-link helpers where available; otherwise switches module.
 */
export function navigateFromNotification(
  notification: PortalNotification,
  onModuleSelect: (moduleId: string) => void,
): void {
  const moduleId = MODULE_TO_ID[notification.module] || '';
  const actionUrl = String(notification.actionUrl || '').trim();
  const actionId = String(notification.actionId || '').trim();

  if (actionUrl.startsWith('/audit-expenses/')) {
    const id = actionUrl.slice('/audit-expenses/'.length);
    if (id) {
      onModuleSelect('expenses');
      navigateToAuditExpenseDetail(decodeURIComponent(id));
      return;
    }
  }

  if (actionUrl.startsWith('/my-expenses/edit/')) {
    const id = actionUrl.slice('/my-expenses/edit/'.length);
    if (id) {
      onModuleSelect('expenses');
      navigateToMyExpenseEdit(decodeURIComponent(id));
      return;
    }
  }

  if (notification.module === 'expenses' && actionId) {
    onModuleSelect('expenses');
    if (notification.section === 'action_required') {
      navigateToAuditExpenseDetail(actionId);
    } else {
      navigateToMyExpenseEdit(actionId);
    }
    return;
  }

  if (notification.module === 'dailyPlanner') {
    try {
      localStorage.setItem('sppl_selected_module', 'daily-planner');
    } catch {
      /* ignore */
    }
    storeDailyPlannerFocus(notification);
    onModuleSelect('daily-planner');
    return;
  }

  if (notification.module === 'salesForecasting') {
    try {
      localStorage.setItem('sppl_selected_module', 'sales-forecasting');
      if (actionId || actionUrl) {
        sessionStorage.setItem(
          'sppl_notification_focus',
          JSON.stringify({
            module: notification.module,
            actionId:
              actionId ||
              String((notification.metadata as { quotationId?: string })?.quotationId || ''),
            actionType: notification.actionType,
            actionUrl,
            forecastId:
              String((notification.metadata as { quotationId?: string; forecastId?: string })?.quotationId || '') ||
              String((notification.metadata as { forecastId?: string })?.forecastId || '') ||
              actionId,
            at: Date.now(),
          }),
        );
      }
    } catch {
      /* ignore */
    }
    onModuleSelect('sales-forecasting');
    return;
  }

  if (moduleId) {
    try {
      localStorage.setItem('sppl_selected_module', moduleId);
      if (actionId) {
        sessionStorage.setItem(
          'sppl_notification_focus',
          JSON.stringify({
            module: notification.module,
            actionId,
            actionType: notification.actionType,
            at: Date.now(),
          }),
        );
      }
    } catch {
      /* ignore */
    }
    onModuleSelect(moduleId);
  }
}
