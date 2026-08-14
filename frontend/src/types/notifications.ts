export type NotificationModule =
  | 'expenses'
  | 'salesForecasting'
  | 'dailyPlanner'
  | 'userManagement'
  | 'system'
  | 'crm'
  | 'payroll'
  | 'purchases'
  | 'orderProcessing'
  | string;

export type NotificationStatus = 'Unread' | 'Read' | 'Archived';
export type NotificationPriority = 'Critical' | 'High' | 'Normal' | 'Low';
export type NotificationSection = 'action_required' | 'activity';

export interface PortalNotification {
  notificationId: string;
  recipientEmployeeCode: string;
  recipientRole: string;
  recipientEmail: string;
  module: NotificationModule;
  category: string;
  title: string;
  message: string;
  priority: NotificationPriority | string;
  status: NotificationStatus | string;
  isRead: boolean;
  section: NotificationSection | string;
  actionType: string;
  actionId: string;
  actionUrl: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  readAt: string;
  archivedAt: string;
  prioritySort?: number;
}
