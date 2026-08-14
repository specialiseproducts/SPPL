/**
 * Notification React Query cache helpers — optimistic UI without full reloads.
 */

import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { notificationsQueryKeys } from './notificationsQueryKeys';
import type { PortalNotification } from '../../types/notifications';

export type NotificationListCache = {
  data: PortalNotification[];
  nextCursor?: string;
};

export type NotificationsMutationSnapshot = {
  lists: Array<[QueryKey, NotificationListCache | undefined]>;
  unread: number | undefined;
};

function listParams(key: QueryKey): Record<string, string | undefined> {
  const params = (Array.isArray(key) ? key[2] : {}) as Record<string, string | undefined>;
  return params && typeof params === 'object' ? params : {};
}

function asListCache(value: unknown): NotificationListCache | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const data = (value as NotificationListCache).data;
  if (!Array.isArray(data)) return undefined;
  return value as NotificationListCache;
}

export function snapshotNotifications(queryClient: QueryClient): NotificationsMutationSnapshot {
  return {
    lists: queryClient.getQueriesData<NotificationListCache>({
      queryKey: [...notificationsQueryKeys.all, 'list'],
    }),
    unread: queryClient.getQueryData<number>(notificationsQueryKeys.unreadCount()),
  };
}

export function restoreNotifications(
  queryClient: QueryClient,
  snapshot: NotificationsMutationSnapshot,
) {
  for (const [key, value] of snapshot.lists) {
    queryClient.setQueryData(key, value);
  }
  queryClient.setQueryData(notificationsQueryKeys.unreadCount(), snapshot.unread);
}

export function adjustUnreadCount(queryClient: QueryClient, delta: number) {
  queryClient.setQueryData<number>(notificationsQueryKeys.unreadCount(), (prev) => {
    const current = typeof prev === 'number' ? prev : Number(prev || 0);
    return Math.max(0, current + delta);
  });
}

export function findNotificationInCache(
  queryClient: QueryClient,
  id: string,
): PortalNotification | undefined {
  const queries = queryClient.getQueriesData<NotificationListCache>({
    queryKey: [...notificationsQueryKeys.all, 'list'],
  });
  for (const [, value] of queries) {
    const hit = value?.data?.find((n) => n.notificationId === id);
    if (hit) return hit;
  }
  return undefined;
}

function upsertInList(
  rows: PortalNotification[],
  notification: PortalNotification,
  statusFilter: string,
): PortalNotification[] {
  const without = rows.filter((n) => n.notificationId !== notification.notificationId);
  const status = String(notification.status || '');
  if (statusFilter === 'Unread' && status !== 'Unread') return without;
  if (statusFilter === 'Read' && status !== 'Read') return without;
  if (statusFilter === 'Archived' && status !== 'Archived') return without;
  if (statusFilter && statusFilter !== 'All' && statusFilter !== 'Unread' && statusFilter !== 'Read' && statusFilter !== 'Archived') {
    // unknown filter — update in place if present
    if (rows.some((n) => n.notificationId === notification.notificationId)) {
      return rows.map((n) => (n.notificationId === notification.notificationId ? notification : n));
    }
    return rows;
  }
  return [notification, ...without];
}

/** Apply a single notification status change across cached list queries. */
export function applyNotificationToLists(
  queryClient: QueryClient,
  notification: PortalNotification,
) {
  const queries = queryClient.getQueriesData<NotificationListCache>({
    queryKey: [...notificationsQueryKeys.all, 'list'],
  });

  for (const [key, value] of queries) {
    const cache = asListCache(value);
    if (!cache) continue;
    const statusFilter = String(listParams(key).status || '').trim();
    queryClient.setQueryData(key, {
      ...cache,
      data: upsertInList(cache.data, notification, statusFilter),
    });
  }
}

/** Remove a notification from all cached lists (e.g. after archive in Unread/Read views). */
export function removeNotificationFromLists(queryClient: QueryClient, id: string) {
  const queries = queryClient.getQueriesData<NotificationListCache>({
    queryKey: [...notificationsQueryKeys.all, 'list'],
  });
  for (const [key, value] of queries) {
    const cache = asListCache(value);
    if (!cache) continue;
    if (!cache.data.some((n) => n.notificationId === id)) continue;
    const statusFilter = String(listParams(key).status || '').trim();
    const next = cache.data.filter((n) => n.notificationId !== id);
    // Keep archived list coherent if we later upsert; for dismiss from Unread/Read just remove.
    if (statusFilter === 'Archived') continue;
    queryClient.setQueryData(key, { ...cache, data: next });
  }
}

/** Mark every Unread row in list caches as Read; clear Unread lists; zero badge. */
export function applyMarkAllReadToCache(queryClient: QueryClient) {
  const queries = queryClient.getQueriesData<NotificationListCache>({
    queryKey: [...notificationsQueryKeys.all, 'list'],
  });
  const now = new Date().toISOString();

  for (const [key, value] of queries) {
    const cache = asListCache(value);
    if (!cache) continue;
    const statusFilter = String(listParams(key).status || '').trim();

    if (statusFilter === 'Unread') {
      queryClient.setQueryData(key, { ...cache, data: [] });
      continue;
    }

    const next = cache.data.map((n) =>
      n.status === 'Unread'
        ? { ...n, status: 'Read', isRead: true, readAt: n.readAt || now }
        : n,
    );
    queryClient.setQueryData(key, { ...cache, data: next });
  }

  queryClient.setQueryData(notificationsQueryKeys.unreadCount(), 0);
}

/** Soft refresh list + unread only (never settings/analytics; never force inactive refetches). */
export function softRefreshNotificationQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    queryKey: [...notificationsQueryKeys.all, 'list'],
    refetchType: 'active',
  });
  void queryClient.invalidateQueries({
    queryKey: notificationsQueryKeys.unreadCount(),
    refetchType: 'active',
  });
}
