import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getApiBaseUrl } from '../../config/apiBase';
import { getToken } from '../../services/authService';
import { notificationsQueryKeys } from './notificationsQueryKeys';
import type { PortalNotification } from '../../types/notifications';

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

export type NotificationRealtimeHandlers = {
  onCreated?: (notification: PortalNotification) => void;
};

function applyCreatedToCache(queryClient: QueryClient, notification: PortalNotification) {
  const id = String(notification.notificationId || '');
  if (!id) return;

  queryClient.setQueryData<number>(notificationsQueryKeys.unreadCount(), (prev) => {
    const current = typeof prev === 'number' ? prev : Number(prev || 0);
    return current + 1;
  });

  const queries = queryClient.getQueriesData<{ data?: PortalNotification[]; nextCursor?: string }>({
    queryKey: [...notificationsQueryKeys.all, 'list'],
  });

  for (const [key, value] of queries) {
    if (!value || !Array.isArray(value.data)) continue;
    if (value.data.some((n) => n.notificationId === id)) continue;

    const params = (Array.isArray(key) ? key[2] : {}) as Record<string, string | undefined>;
    const statusFilter = String(params?.status || '').trim();
    if (statusFilter && statusFilter !== String(notification.status || 'Unread')) {
      continue;
    }

    const moduleFilter = String(params?.module || '').trim();
    if (moduleFilter && moduleFilter !== String(notification.module || '')) {
      continue;
    }

    queryClient.setQueryData(key, {
      ...value,
      data: [notification, ...value.data],
    });
  }
}

/**
 * One authenticated SSE connection for the logged-in user.
 * Updates React Query caches; optional handler for UX (sound / browser).
 */
export function useNotificationRealtime(
  enabled: boolean,
  handlers: NotificationRealtimeHandlers = {},
) {
  const queryClient = useQueryClient();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    let closed = false;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (closed) return;
      const token = getToken();
      if (!token) {
        retryTimer = setTimeout(connect, BASE_BACKOFF_MS);
        return;
      }

      const url = `${getApiBaseUrl()}/notifications/stream?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);

      es.addEventListener('connected', () => {
        const wasReconnect = attempt > 0;
        attempt = 0;
        // First connect: cache warm via prefetch/SSE push — avoid full invalidation storm.
        // After reconnect only: soft-refresh active unread + lists for anything missed offline.
        if (wasReconnect) {
          void queryClient.invalidateQueries({
            queryKey: notificationsQueryKeys.unreadCount(),
            refetchType: 'active',
          });
          void queryClient.invalidateQueries({
            queryKey: [...notificationsQueryKeys.all, 'list'],
            refetchType: 'active',
          });
        }
      });

      es.addEventListener('heartbeat', () => {
        attempt = 0;
      });

      es.addEventListener('notification.created', (evt) => {
        try {
          const parsed = JSON.parse((evt as MessageEvent).data || '{}') as {
            notification?: PortalNotification;
          };
          const notification = parsed.notification;
          if (!notification?.notificationId) return;
          const id = notification.notificationId;
          if (seenRef.current.has(id)) return;
          seenRef.current.add(id);
          if (seenRef.current.size > 500) {
            const keep = [...seenRef.current].slice(-250);
            seenRef.current = new Set(keep);
          }
          applyCreatedToCache(queryClient, notification);
          handlersRef.current.onCreated?.(notification);
        } catch {
          /* ignore malformed events */
        }
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (closed) return;
        attempt += 1;
        const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.min(attempt, 5));
        const jitter = Math.floor(Math.random() * 400);
        retryTimer = setTimeout(connect, delay + jitter);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [enabled, queryClient]);
}
