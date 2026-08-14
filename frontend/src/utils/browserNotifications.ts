/**
 * Browser Notification API helpers (Phase 4A UX).
 * Permission is requested at most once (tracked in localStorage).
 */

const PERM_ASKED_KEY = 'sppl_notif_browser_permission_asked';
export const OPEN_CENTER_EVENT = 'sppl:open-notification-center';
export const FOCUS_NOTIF_KEY = 'sppl_browser_notification_focus';

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** Ask once when permission is default. Never re-prompt after deny / ask. */
export async function ensureBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    if (localStorage.getItem(PERM_ASKED_KEY) === '1') {
      return Notification.permission;
    }
    localStorage.setItem(PERM_ASKED_KEY, '1');
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export function showBrowserNotification(payload: {
  title: string;
  body: string;
  tag?: string;
  notificationId?: string;
  module?: string;
}): Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const n = new Notification(payload.title || 'Notification', {
      body: payload.body || '',
      tag: payload.tag || payload.notificationId || 'sppl-notification',
      // Prefer site icon; browsers ignore missing icons gracefully.
      icon: '/logo.png',
      badge: '/logo.png',
      data: {
        notificationId: payload.notificationId,
        module: payload.module,
        erp: 'Spécialisé Products Private Limited',
      },
    });

    n.onclick = () => {
      try {
        window.focus();
        if (payload.notificationId) {
          sessionStorage.setItem(
            FOCUS_NOTIF_KEY,
            JSON.stringify({
              notificationId: payload.notificationId,
              module: payload.module,
              at: Date.now(),
            }),
          );
        }
        window.dispatchEvent(
          new CustomEvent(OPEN_CENTER_EVENT, {
            detail: { notificationId: payload.notificationId },
          }),
        );
      } catch {
        /* ignore */
      }
      n.close();
    };

    return n;
  } catch {
    return null;
  }
}
