import { apiFetch } from '../../services/api';
import type { PortalNotification } from '../../types/notifications';

export async function fetchNotifications(params: {
  status?: string;
  module?: string;
  q?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ data: PortalNotification[]; nextCursor?: string }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.module) qs.set('module', params.module);
  if (params.q) qs.set('q', params.q);
  if (params.sort) qs.set('sort', params.sort);
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = (await apiFetch(`/api/notifications${suffix}`)) as {
    success?: boolean;
    data?: PortalNotification[];
    nextCursor?: string;
  };
  return {
    data: Array.isArray(res?.data) ? res.data : [],
    nextCursor: res?.nextCursor,
  };
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const res = (await apiFetch('/api/notifications/unread-count')) as {
    data?: { count?: number };
  };
  return Number(res?.data?.count || 0);
}

export async function markNotificationRead(id: string): Promise<PortalNotification> {
  const res = (await apiFetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
  })) as { success?: boolean; data?: PortalNotification; message?: string };
  if (!res?.success || !res.data) throw new Error(res?.message || 'Failed to mark read');
  return res.data;
}

export async function archiveNotification(id: string): Promise<PortalNotification> {
  const res = (await apiFetch(`/api/notifications/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
  })) as { success?: boolean; data?: PortalNotification; message?: string };
  if (!res?.success || !res.data) throw new Error(res?.message || 'Failed to archive');
  return res.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch('/api/notifications/mark-all-read', { method: 'POST' });
}

export async function fetchNotificationSettings(): Promise<
  import('../../types/notificationPreferences').NotificationPreferences
> {
  const res = (await apiFetch('/api/notifications/settings')) as {
    success?: boolean;
    data?: import('../../types/notificationPreferences').NotificationPreferences;
  };
  return (
    res?.data || {
      version: 2,
      soundEnabled: true,
      browserEnabled: true,
      modules: {},
    }
  );
}

export async function updateNotificationSettings(
  patch: Partial<import('../../types/notificationPreferences').NotificationPreferences>,
): Promise<import('../../types/notificationPreferences').NotificationPreferences> {
  const res = (await apiFetch('/api/notifications/settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  })) as {
    success?: boolean;
    data?: import('../../types/notificationPreferences').NotificationPreferences;
    message?: string;
  };
  if (!res?.success || !res.data) throw new Error(res?.message || 'Failed to save preferences');
  return res.data;
}

export async function fetchNotificationAnalytics(): Promise<
  import('../../types/notificationPreferences').NotificationAnalytics
> {
  const res = (await apiFetch('/api/notifications/analytics')) as {
    success?: boolean;
    data?: import('../../types/notificationPreferences').NotificationAnalytics;
    message?: string;
  };
  if (!res?.success || !res.data) throw new Error(res?.message || 'Failed to load analytics');
  return res.data;
}
