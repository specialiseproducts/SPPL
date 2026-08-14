import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  IndianRupee,
  Info,
  Receipt,
  Search,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from './ui/utils';
import {
  useNotificationMutations,
  useNotificationsQuery,
  useNotificationSettingsQuery,
  useUnreadNotificationCountQuery,
  useInvalidateNotifications,
} from '../hooks/notifications/useNotificationsQueries';
import { useInvalidateSalesForecasts } from '../hooks/sales/useSalesQueries';
import { navigateFromNotification } from '../utils/notificationNavigation';
import type { PortalNotification } from '../types/notifications';
import { resolveActionRequired } from '../notifications/actionRequired/registry';
import ActionRequiredCard from './notifications/ActionRequiredCard';
import { useAuth } from '../context/AuthContext';
import { FOCUS_NOTIF_KEY } from '../utils/browserNotifications';

const MODULE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'All', label: 'All Modules' },
  { value: 'Approvals', label: 'Approvals' },
  { value: 'Expenses', label: 'Expenses' },
  { value: 'Sales', label: 'Sales' },
  { value: 'Daily Planner', label: 'Daily Planner' },
  { value: 'System', label: 'System' },
];

type StatusFilter = 'Unread' | 'Read' | 'Archived';
type SortKey = 'newest' | 'oldest' | 'priority' | 'module';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function groupLabel(iso: string): 'Today' | 'Yesterday' | 'Last Week' | 'Older' {
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return 'Older';
  const today = startOfDay(new Date());
  const that = startOfDay(created);
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'Last Week';
  return 'Older';
}

function moduleIcon(module: string) {
  switch (module) {
    case 'expenses':
      return Receipt;
    case 'salesForecasting':
      return IndianRupee;
    case 'dailyPlanner':
      return ClipboardList;
    case 'userManagement':
      return CheckCircle2;
    default:
      return Bell;
  }
}

function moduleBadgeLabel(module: string) {
  switch (module) {
    case 'expenses':
      return 'Expenses';
    case 'salesForecasting':
      return 'Sales';
    case 'dailyPlanner':
      return 'Daily Planner';
    case 'userManagement':
      return 'User Management';
    case 'crm':
      return 'CRM';
    case 'payroll':
      return 'Payroll';
    case 'purchases':
      return 'Purchases';
    case 'orderProcessing':
      return 'Order Processing';
    default:
      return 'System';
  }
}

function priorityBarStyle(priority: string): CSSProperties {
  switch (priority) {
    case 'Critical':
      return { width: 4, backgroundColor: '#d4183d' };
    case 'High':
      return { width: 4, backgroundColor: '#f97316' };
    case 'Low':
      return { width: 4, backgroundColor: '#d1d5db' };
    default:
      return { width: 4, backgroundColor: '#007BFF' };
  }
}

/** Approved / Rejected / Pending / Reminder / Information — portal palette */
function cardToneClass(title: string, priority: string) {
  const t = title.toLowerCase();
  if (t.includes('reject')) return 'border-red-200 bg-red-50';
  if (t.includes('approv') && !t.includes('pending') && !t.includes('waiting')) {
    return 'border-green-200 bg-green-50';
  }
  if (t.includes('pending') || t.includes('waiting') || priority === 'High' || priority === 'Critical') {
    return 'border-gray-200 bg-yellow-50';
  }
  if (t.includes('remind')) return 'border-blue-200 bg-blue-50';
  if (priority === 'Low') return 'border-gray-200 bg-gray-50';
  return 'border-gray-200 bg-white';
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || '—';
  }
}

function selectClassName() {
  return 'h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-xs text-[#212529]';
}

function NotificationCard({
  n,
  onView,
  onArchive,
  viewBusy,
  dismissBusy,
}: {
  n: PortalNotification;
  onView: () => void;
  onArchive: () => void;
  viewBusy: boolean;
  dismissBusy: boolean;
}) {
  const Icon = moduleIcon(n.module);
  const unread = n.status === 'Unread';

  return (
    <div
      id={`notification-row-${n.notificationId}`}
      className={cn(
        'relative rounded-md border px-3 py-2 shadow-sm',
        cardToneClass(n.title, String(n.priority)),
      )}
      role="listitem"
    >
      <div
        className="absolute left-0 top-0 h-full rounded-md"
        style={priorityBarStyle(String(n.priority))}
        aria-hidden
      />
      <div className="flex gap-2 pl-2">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-[#007BFF]">
          <Icon className="size-3.5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {unread ? (
              <span
                className="mt-1 inline-block shrink-0 rounded-full bg-[#007BFF]"
                style={{ width: 8, height: 8 }}
                aria-label="Unread"
              />
            ) : (
              <span className="mt-1 inline-block shrink-0" style={{ width: 8, height: 8 }} aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[#212529]">{n.title}</div>
              <div className="mt-1 text-xs text-gray-600 line-clamp-2">{n.message}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="truncate text-xs text-muted-foreground">{formatTime(n.createdAt)}</div>
            {(() => {
              const approvalStatus = String(
                (n.metadata as { approvalStatus?: string } | undefined)?.approvalStatus || '',
              ).trim();
              if (approvalStatus === 'Completed' || approvalStatus === 'Rejected') {
                return (
                  <span
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-xs font-medium',
                      approvalStatus === 'Completed'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-red-200 bg-red-50 text-red-600',
                    )}
                  >
                    {approvalStatus}
                  </span>
                );
              }
              return null;
            })()}
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                disabled={dismissBusy}
                onClick={onArchive}
              >
                Dismiss
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-6 bg-[#007BFF] px-2 text-xs hover:bg-[#0056b3]"
                disabled={viewBusy}
                onClick={onView}
              >
                View
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupedList({
  items,
  onView,
  onArchive,
  dismissingIds,
}: {
  items: PortalNotification[];
  onView: (n: PortalNotification) => void;
  onArchive: (n: PortalNotification) => void;
  dismissingIds: ReadonlySet<string>;
}) {
  const groups = useMemo(() => {
    const order: Array<'Today' | 'Yesterday' | 'Last Week' | 'Older'> = [
      'Today',
      'Yesterday',
      'Last Week',
      'Older',
    ];
    const map = new Map<string, PortalNotification[]>();
    for (const label of order) map.set(label, []);
    for (const n of items) {
      const label = groupLabel(n.createdAt);
      map.get(label)?.push(n);
    }
    return order
      .map((label) => ({ label, rows: map.get(label) || [] }))
      .filter((g) => g.rows.length > 0);
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3" role="list">
      {groups.map((g) => (
        <div key={g.label} className="space-y-2">
          <div className="text-xs font-semibold uppercase text-gray-500">{g.label}</div>
          <div className="space-y-2">
            {g.rows.map((n) => (
              <NotificationCard
                key={n.notificationId}
                n={n}
                viewBusy={false}
                dismissBusy={dismissingIds.has(n.notificationId)}
                onView={() => onView(n)}
                onArchive={() => onArchive(n)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ statusFilter }: { statusFilter: StatusFilter }) {
  const subtitle =
    statusFilter === 'Unread'
      ? 'No unread notifications.'
      : statusFilter === 'Read'
        ? 'No read notifications.'
        : 'No archived notifications.';

  return (
    <div
      className="flex flex-col items-center justify-center px-6 text-center"
      style={{ minHeight: 280 }}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#007BFF]">
        <Bell className="h-6 w-6" aria-hidden />
      </div>
      <div className="text-base font-semibold text-[#212529]">You&apos;re all caught up!</div>
      <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
    </div>
  );
}

interface NotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModuleSelect: (moduleId: string) => void;
}

export default function NotificationCenter({
  open,
  onOpenChange,
  onModuleSelect,
}: NotificationCenterProps) {
  const { user } = useAuth();
  const actorEmployeeCode = String(user?.employeeCode || '').trim();
  const invalidateNotifications = useInvalidateNotifications();
  const invalidateSales = useInvalidateSalesForecasts();
  const [moduleFilter, setModuleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Unread');
  const [sort, setSort] = useState<SortKey>('newest');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const invalidateActionQueries = () => {
    invalidateNotifications();
    void invalidateSales();
  };

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const queryParams = {
    status: statusFilter,
    module: moduleFilter,
    q: debouncedSearch || undefined,
    sort,
  };

  const listQuery = useNotificationsQuery(queryParams, open);
  const settingsQuery = useNotificationSettingsQuery(true);
  const unreadQuery = useUnreadNotificationCountQuery(open);
  const { markRead, archive, markAllRead } = useNotificationMutations();
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(() => new Set());
  const dismissingIdsRef = useRef<Set<string>>(new Set());

  const rows = useMemo(() => {
    const all = listQuery.data?.data || [];
    const settings = settingsQuery.data;
    if (!settings?.modules) return all;
    return all.filter((n) => {
      const category = String(n.category || '');
      if (category === 'Approvals' && settings.modules.approvals?.inApp === false) return false;
      const mod = String(n.module || '');
      if (settings.modules[mod]?.inApp === false) return false;
      return true;
    });
  }, [listQuery.data, settingsQuery.data]);

  const actionRequired = rows.filter((n) => n.section === 'action_required');
  const recentActivity = rows.filter((n) => n.section !== 'action_required');
  const unreadCount = Number(unreadQuery.data || 0);

  const moduleOptions = useMemo(() => {
    const knownValues = new Set(MODULE_OPTIONS.map((o) => o.value));
    const extras: Array<{ value: string; label: string }> = [];
    for (const n of rows) {
      const label = moduleBadgeLabel(n.module);
      if (knownValues.has(label) || knownValues.has(n.module)) continue;
      knownValues.add(n.module);
      extras.push({ value: n.module, label });
    }
    return extras.length ? [...MODULE_OPTIONS, ...extras] : MODULE_OPTIONS;
  }, [rows]);

  const handleView = (n: PortalNotification) => {
    // Optimistic mark-read runs in the mutation; do not block navigation on the network.
    if (n.status === 'Unread') {
      markRead.mutate(n.notificationId);
    }
    navigateFromNotification(n, onModuleSelect);
    onOpenChange(false);
  };

  const handleArchive = (n: PortalNotification) => {
    const id = n.notificationId;
    if (dismissingIdsRef.current.has(id)) return;
    dismissingIdsRef.current.add(id);
    setDismissingIds(new Set(dismissingIdsRef.current));
    archive.mutate(id, {
      onSettled: () => {
        dismissingIdsRef.current.delete(id);
        setDismissingIds(new Set(dismissingIdsRef.current));
      },
    });
  };

  useEffect(() => {
    if (!open || rows.length === 0) return;
    try {
      const raw = sessionStorage.getItem(FOCUS_NOTIF_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { notificationId?: string; at?: number };
      sessionStorage.removeItem(FOCUS_NOTIF_KEY);
      if (parsed.at && Date.now() - Number(parsed.at) > 120_000) return;
      const target = rows.find((n) => n.notificationId === parsed.notificationId);
      if (target) {
        window.requestAnimationFrame(() => {
          document
            .getElementById(`notification-row-${target.notificationId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
    } catch {
      /* ignore */
    }
  }, [open, rows]);

  const isEmpty = !listQuery.isLoading && !listQuery.isError && rows.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/*
        Exit sync: static CSS lacks data-[state=closed]:slide-out-to-right.
        Overlay defaults to 150ms while panel uses duration-300 — sync both to 300ms.
        Bare animate-in caused Presence to see no animation-name change on close and unmount the panel immediately while the overlay was still fading.
      */}
      <style>{`
        [data-slot="sheet-overlay"]:has(+ [data-notification-panel]) {
          --tw-duration: 0.3s;
        }
        [data-notification-panel][data-state="open"] {
          --tw-enter-translate-x: 100%;
        }
        [data-notification-panel][data-state="closed"] {
          --tw-exit-translate-x: 100%;
        }
      `}</style>
      <SheetContent
        side="right"
        data-notification-panel=""
        className="top-0 bottom-0 flex w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl duration-300 slide-in-from-right"
        style={{ padding: 0, gap: 0 }}
        aria-label="Notification Center"
      >
        <SheetHeader className="shrink-0 border-b border-gray-200 px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-2 pr-8">
            <div className="flex min-w-0 items-center gap-2">
              <SheetTitle className="text-base text-[#212529]">Notifications</SheetTitle>
              {unreadCount > 0 ? (
                <span className="inline-flex h-5 min-w-0 items-center justify-center rounded-full bg-[#007BFF] px-2 text-xs font-semibold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 shrink-0 px-2 text-xs"
              disabled={markAllRead.isPending || unreadCount === 0}
              onClick={() => markAllRead.mutate()}
            >
              Mark All Read
            </Button>
          </div>
          <SheetDescription className="sr-only">
            Notification center panel. Search, filter, and open notifications.
          </SheetDescription>
        </SheetHeader>

        <div className="shrink-0 border-b border-gray-200 px-4 py-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 size-3.5 -translate-y-1/2 text-gray-400"
              style={{ left: 10 }}
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Notifications"
              className="h-8 text-sm"
              style={{ paddingLeft: 32 }}
              aria-label="Search Notifications"
            />
          </div>

          <div className="mt-2 flex gap-2">
            <select
              className={selectClassName()}
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              aria-label="Filter by module"
            >
              {moduleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className={selectClassName()}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort notifications"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="priority">Priority</option>
              <option value="module">Module</option>
            </select>
          </div>

          <div className="mt-2 flex gap-1">
            {(['Unread', 'Read', 'Archived'] as StatusFilter[]).map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                className={cn(
                  'h-6 px-2 text-xs',
                  statusFilter === s && 'bg-[#007BFF] hover:bg-[#0056b3]',
                )}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ minHeight: 0 }}>
          {listQuery.isLoading && !listQuery.data ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : listQuery.isError && !listQuery.data ? (
            <div className="py-8 text-center text-sm text-red-600">Failed to load notifications</div>
          ) : isEmpty ? (
            <EmptyState statusFilter={statusFilter} />
          ) : (
            <div className="space-y-4">
              {actionRequired.length > 0 ? (
                <section className="rounded-lg border border-gray-200 bg-yellow-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#212529]">
                    <Info className="h-4 w-4 text-yellow-700" />
                    Action Required
                  </div>
                  <div className="space-y-2" role="list">
                    {actionRequired.map((n) => {
                      const actionDef = resolveActionRequired(n);
                      if (actionDef) {
                        return (
                          <ActionRequiredCard
                            key={n.notificationId}
                            notification={n}
                            definition={actionDef}
                            actorEmployeeCode={actorEmployeeCode}
                            onModuleSelect={onModuleSelect}
                            invalidate={invalidateActionQueries}
                            onClosePanel={() => onOpenChange(false)}
                          />
                        );
                      }
                      return (
                        <NotificationCard
                          key={n.notificationId}
                          n={n}
                          viewBusy={false}
                          dismissBusy={dismissingIds.has(n.notificationId)}
                          onView={() => handleView(n)}
                          onArchive={() => handleArchive(n)}
                        />
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {recentActivity.length > 0 ? (
                <section>
                  <div className="mb-2 text-sm font-semibold text-[#212529]">Recent Activity</div>
                  <GroupedList
                    items={recentActivity}
                    dismissingIds={dismissingIds}
                    onView={handleView}
                    onArchive={handleArchive}
                  />
                </section>
              ) : null}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-200 px-4 py-2">
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-full text-xs text-[#007BFF] hover:text-[#0056b3]"
            disabled
            aria-label="View Notification History"
          >
            View Notification History
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
