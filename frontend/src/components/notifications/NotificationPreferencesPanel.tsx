import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import {
  useNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
} from '../../hooks/notifications/useNotificationsQueries';
import type {
  NotificationChannelPrefs,
  NotificationPreferences,
} from '../../types/notificationPreferences';
import {
  ensureBrowserNotificationPermission,
  getBrowserNotificationPermission,
} from '../../utils/browserNotifications';
import { isNotificationSoundConfigEnabled } from '../../utils/notificationSound';
import { cn } from '../ui/utils';

const FALLBACK_LABELS = [
  { key: 'salesForecasting', label: 'Sales' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'dailyPlanner', label: 'Daily Planner' },
  { key: 'crm', label: 'CRM' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'orderProcessing', label: 'Order Processing' },
  { key: 'system', label: 'System' },
  { key: 'approvals', label: 'Approvals' },
];

type ChannelKey = keyof NotificationChannelPrefs;

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-[#212529]">
      <input
        type="checkbox"
        className="h-4 w-4 accent-[#007BFF]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span>{label}</span>
    </label>
  );
}

export default function NotificationPreferencesPanel() {
  const settingsQuery = useNotificationSettingsQuery(true);
  const saveMutation = useUpdateNotificationSettingsMutation();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [browserPerm, setBrowserPerm] = useState(getBrowserNotificationPermission());

  useEffect(() => {
    if (settingsQuery.data) setDraft(settingsQuery.data);
  }, [settingsQuery.data]);

  const labels = useMemo(
    () => (draft?.labels?.length ? draft.labels : FALLBACK_LABELS),
    [draft?.labels],
  );

  const soundConfigOn = isNotificationSoundConfigEnabled();

  const updateModule = (key: string, channel: ChannelKey, value: boolean) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const current = prev.modules[key] || {
        inApp: true,
        browser: true,
        sound: true,
        email: false,
      };
      return {
        ...prev,
        modules: {
          ...prev.modules,
          [key]: { ...current, [channel]: value },
        },
      };
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      const saved = await saveMutation.mutateAsync({
        soundEnabled: draft.soundEnabled,
        browserEnabled: draft.browserEnabled,
        modules: draft.modules,
      });
      setDraft(saved);
      toast.success('Notification preferences saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save preferences');
    }
  };

  const handleAskBrowser = async () => {
    const result = await ensureBrowserNotificationPermission();
    setBrowserPerm(result);
    if (result === 'granted') toast.success('Browser notifications enabled');
    else if (result === 'denied') toast.message('Browser notifications are blocked for this site');
  };

  if (settingsQuery.isLoading || !draft) {
    return (
      <Card className="border-gray-200 p-4 shadow-sm">
        <div className="text-sm text-muted-foreground">Loading notification preferences…</div>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#212529]">Notification Preferences</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Control in-app visibility, browser alerts, and sound per module. Email is reserved for a
            future release.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 bg-[#007BFF] hover:bg-[#0056b3]"
          disabled={saveMutation.isPending}
          onClick={() => void handleSave()}
        >
          Save Preferences
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 rounded-md border border-gray-200 bg-gray-50 p-3">
        <Toggle
          checked={draft.browserEnabled}
          onChange={(v) => setDraft((d) => (d ? { ...d, browserEnabled: v } : d))}
          label="Browser notifications (master)"
        />
        <Toggle
          checked={draft.soundEnabled && soundConfigOn}
          disabled={!soundConfigOn}
          onChange={(v) => setDraft((d) => (d ? { ...d, soundEnabled: v } : d))}
          label={soundConfigOn ? 'Sound (master)' : 'Sound (disabled by config)'}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Browser permission: {browserPerm}</span>
          {browserPerm === 'default' || browserPerm === 'denied' ? (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void handleAskBrowser()}>
              {browserPerm === 'denied' ? 'Permission blocked' : 'Allow browser notifications'}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="px-2 py-2 font-medium">Module</th>
              <th className="px-2 py-2 font-medium">In-App</th>
              <th className="px-2 py-2 font-medium">Browser</th>
              <th className="px-2 py-2 font-medium">Sound</th>
              <th className="px-2 py-2 font-medium">Email</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((row) => {
              const prefs = draft.modules[row.key] || {
                inApp: true,
                browser: true,
                sound: true,
                email: false,
              };
              return (
                <tr key={row.key} className="border-b border-gray-100">
                  <td className="px-2 py-2 font-medium text-[#212529]">{row.label}</td>
                  {(['inApp', 'browser', 'sound', 'email'] as ChannelKey[]).map((channel) => {
                    const isEmail = channel === 'email';
                    return (
                      <td key={channel} className="px-2 py-2">
                        <input
                          type="checkbox"
                          className={cn('h-4 w-4 accent-[#007BFF]', isEmail && 'opacity-50')}
                          checked={isEmail ? false : Boolean(prefs[channel])}
                          disabled={isEmail || (channel === 'sound' && !soundConfigOn)}
                          aria-label={`${row.label} ${channel}`}
                          title={isEmail ? 'Email preferences coming soon' : undefined}
                          onChange={(e) => updateModule(row.key, channel, e.target.checked)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
