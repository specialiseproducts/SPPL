/** Stable query keys for Notification Center. */
export const notificationsQueryKeys = {
  all: ['notifications'] as const,
  list: (params?: Record<string, string | undefined>) =>
    [...notificationsQueryKeys.all, 'list', params || {}] as const,
  unreadCount: () => [...notificationsQueryKeys.all, 'unreadCount'] as const,
  settings: () => [...notificationsQueryKeys.all, 'settings'] as const,
};
