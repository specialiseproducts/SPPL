import { useCallback, useEffect } from 'react';
import {
  useNotificationSettingsQuery,
  usePrefetchNotificationsInbox,
} from '../../hooks/notifications/useNotificationsQueries';
import { useNotificationRealtime } from '../../hooks/notifications/useNotificationRealtime';
import {
  ensureBrowserNotificationPermission,
  showBrowserNotification,
} from '../../utils/browserNotifications';
import { playNotificationSound } from '../../utils/notificationSound';
import type { NotificationPreferences } from '../../types/notificationPreferences';
import type { PortalNotification } from '../../types/notifications';

function channelAllowed(
  settings: NotificationPreferences | undefined,
  notification: PortalNotification,
  channel: 'browser' | 'sound',
): boolean {
  if (!settings) return true;
  if (channel === 'sound' && settings.soundEnabled === false) return false;
  if (channel === 'browser' && settings.browserEnabled === false) return false;

  const category = String(notification.category || '');
  if (category === 'Approvals') {
    const approvals = settings.modules?.approvals;
    if (approvals && approvals[channel] === false) return false;
  }

  const mod = String(notification.module || 'system');
  const row = settings.modules?.[mod];
  if (row && row[channel] === false) return false;
  return true;
}

/**
 * Maintains one SSE connection and applies browser/sound UX when events arrive.
 * Badge / list updates happen via React Query cache in the realtime hook.
 * Prefetches the default Unread inbox so opening the panel is cache-hit fast.
 */
export default function NotificationExperienceHost({ enabled = true }: { enabled?: boolean }) {
  const settingsQuery = useNotificationSettingsQuery(enabled);
  usePrefetchNotificationsInbox(enabled);

  useEffect(() => {
    if (!enabled) return;
    void ensureBrowserNotificationPermission();
  }, [enabled]);

  const onCreated = useCallback(
    (n: PortalNotification) => {
      const settings = settingsQuery.data;
      if (channelAllowed(settings, n, 'browser')) {
        void showBrowserNotification({
          title: n.title || 'Notification',
          body: `${n.message || ''}\nSpécialisé Products Private Limited`.trim(),
          notificationId: n.notificationId,
          module: n.module,
          tag: n.notificationId,
        });
      }
      if (channelAllowed(settings, n, 'sound')) {
        playNotificationSound();
      }
    },
    [settingsQuery.data],
  );

  useNotificationRealtime(enabled, { onCreated });

  return null;
}
