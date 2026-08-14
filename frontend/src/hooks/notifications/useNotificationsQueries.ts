import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryDefaults } from '../queryDefaults';
import { notificationsQueryKeys } from './notificationsQueryKeys';
import {
  archiveNotification,
  fetchNotificationAnalytics,
  fetchNotificationSettings,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationSettings,
} from './notificationsApi';
import type { NotificationPreferences } from '../../types/notificationPreferences';
import type { PortalNotification } from '../../types/notifications';
import {
  adjustUnreadCount,
  applyMarkAllReadToCache,
  applyNotificationToLists,
  findNotificationInCache,
  removeNotificationFromLists,
  restoreNotifications,
  softRefreshNotificationQueries,
  snapshotNotifications,
} from './notificationsCache';

/** Soft-invalidate active notification list + unread (no forced refetch storm). */
export function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => softRefreshNotificationQueries(queryClient);
}

export function useUnreadNotificationCountQuery(enabled = true) {
  return useQuery({
    queryKey: notificationsQueryKeys.unreadCount(),
    queryFn: fetchUnreadNotificationCount,
    enabled,
    ...queryDefaults.list,
    staleTime: 60 * 1000,
    refetchInterval: false,
  });
}

export function useNotificationSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: notificationsQueryKeys.settings(),
    queryFn: fetchNotificationSettings,
    enabled,
    ...queryDefaults.list,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNotificationAnalyticsQuery(enabled = false) {
  return useQuery({
    queryKey: [...notificationsQueryKeys.all, 'analytics'] as const,
    queryFn: fetchNotificationAnalytics,
    enabled,
    ...queryDefaults.list,
    staleTime: 60 * 1000,
  });
}

export function useUpdateNotificationSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) => updateNotificationSettings(patch),
    onSuccess: (data) => {
      queryClient.setQueryData(notificationsQueryKeys.settings(), data);
    },
  });
}

export function useNotificationsQuery(
  params: {
    status?: string;
    module?: string;
    q?: string;
    sort?: string;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: notificationsQueryKeys.list(params),
    queryFn: () => fetchNotifications({ ...params, limit: 100 }),
    enabled,
    ...queryDefaults.list,
    staleTime: 60 * 1000,
  });
}

/**
 * Prefetch the default Unread inbox so opening the panel is cache-hit fast.
 */
export function usePrefetchNotificationsInbox(enabled = true) {
  return useNotificationsQuery({ status: 'Unread', sort: 'newest' }, enabled);
}

export function useNotificationMutations() {
  const queryClient = useQueryClient();

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id: string) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: [...notificationsQueryKeys.all, 'list'] }),
        queryClient.cancelQueries({ queryKey: notificationsQueryKeys.unreadCount() }),
      ]);
      const snapshot = snapshotNotifications(queryClient);
      const existing = findNotificationInCache(queryClient, id);
      if (existing && existing.status === 'Unread') {
        const optimistic: PortalNotification = {
          ...existing,
          status: 'Read',
          isRead: true,
          readAt: existing.readAt || new Date().toISOString(),
        };
        applyNotificationToLists(queryClient, optimistic);
        adjustUnreadCount(queryClient, -1);
      }
      return { snapshot };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.snapshot) restoreNotifications(queryClient, ctx.snapshot);
    },
    onSuccess: (data) => {
      applyNotificationToLists(queryClient, data);
    },
  });

  const archive = useMutation({
    mutationFn: archiveNotification,
    onMutate: async (id: string) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: [...notificationsQueryKeys.all, 'list'] }),
        queryClient.cancelQueries({ queryKey: notificationsQueryKeys.unreadCount() }),
      ]);
      const snapshot = snapshotNotifications(queryClient);
      const existing = findNotificationInCache(queryClient, id);
      if (existing?.status === 'Unread') {
        adjustUnreadCount(queryClient, -1);
      }
      removeNotificationFromLists(queryClient, id);
      if (existing) {
        const archived: PortalNotification = {
          ...existing,
          status: 'Archived',
          isRead: true,
          archivedAt: new Date().toISOString(),
          readAt: existing.readAt || new Date().toISOString(),
        };
        applyNotificationToLists(queryClient, archived);
      }
      return { snapshot };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.snapshot) restoreNotifications(queryClient, ctx.snapshot);
    },
    onSuccess: (data) => {
      removeNotificationFromLists(queryClient, data.notificationId);
      applyNotificationToLists(queryClient, data);
    },
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: [...notificationsQueryKeys.all, 'list'] }),
        queryClient.cancelQueries({ queryKey: notificationsQueryKeys.unreadCount() }),
      ]);
      const snapshot = snapshotNotifications(queryClient);
      applyMarkAllReadToCache(queryClient);
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreNotifications(queryClient, ctx.snapshot);
    },
    onSettled: () => {
      softRefreshNotificationQueries(queryClient);
    },
  });

  return { markRead, archive, markAllRead };
}
