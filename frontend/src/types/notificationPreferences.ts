export type NotificationChannelPrefs = {
  inApp: boolean;
  browser: boolean;
  sound: boolean;
  email: boolean;
};

export type NotificationPreferences = {
  version: number;
  soundEnabled: boolean;
  browserEnabled: boolean;
  modules: Record<string, NotificationChannelPrefs>;
  labels?: Array<{ key: string; label: string }>;
};

export type NotificationAnalytics = {
  unreadCount: number;
  readCount: number;
  archivedCount: number;
  pendingApprovals: number;
  averageReadTimeMs: number | null;
  averageApprovalTimeMs: number | null;
  notificationsToday: number;
  notificationsThisWeek: number;
  notificationsThisMonth: number;
  topModules: Array<{ module: string; count: number }>;
  sampleSize: number;
  generatedAt: string;
};
