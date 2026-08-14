import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FilePlus2,
  Pencil,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  useAuditTrailQuery,
  useEntityAuditTrailInfinite,
} from '../../hooks/auditTrail/useAuditTrailQueries';
import type { AuditTrailEntry } from '../../types/auditTrail';

function formatWhen(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function actionTone(action: string) {
  const a = String(action || '').toUpperCase();
  if (a === 'CREATE' || a === 'APPROVE' || a === 'VERIFY') {
    return {
      bar: 'bg-emerald-500',
      chip: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      Icon: a === 'CREATE' ? FilePlus2 : CheckCircle2,
    };
  }
  if (a === 'UPDATE' || a === 'STATUS_CHANGE' || a === 'WORKFLOW_CHANGE' || a === 'ROLE_CHANGE' || a === 'PERMISSION_CHANGE') {
    return {
      bar: 'bg-sky-500',
      chip: 'bg-sky-50 text-sky-800 border-sky-200',
      Icon: Pencil,
    };
  }
  if (a === 'REJECT') {
    return {
      bar: 'bg-red-500',
      chip: 'bg-red-50 text-red-800 border-red-200',
      Icon: XCircle,
    };
  }
  if (a === 'DELETE') {
    return {
      bar: 'bg-gray-400',
      chip: 'bg-gray-100 text-gray-700 border-gray-200',
      Icon: Trash2,
    };
  }
  return {
    bar: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-900 border-amber-200',
    Icon: a === 'EXPORT' ? ShieldAlert : CircleDot,
  };
}

function ValuesBlock({
  title,
  values,
}: {
  title: string;
  values: Record<string, unknown> | null | undefined;
}) {
  if (!values || typeof values !== 'object' || !Object.keys(values).length) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-500">{title}</p>
        <p className="text-xs text-gray-400 mt-1">—</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{title}</p>
      <pre className="mt-1 max-h-40 overflow-auto rounded border border-gray-100 bg-white p-2 text-[11px] leading-relaxed text-[#212529] whitespace-pre-wrap break-words">
        {JSON.stringify(values, null, 2)}
      </pre>
    </div>
  );
}

function TimelineItem({ entry }: { entry: AuditTrailEntry }) {
  const [open, setOpen] = useState(false);
  const tone = actionTone(entry.action);
  const Icon = tone.Icon;
  const hasDiff = Boolean(
    (entry.oldValues && Object.keys(entry.oldValues).length) ||
      (entry.newValues && Object.keys(entry.newValues).length),
  );

  return (
    <li className="relative pl-8 pb-5 last:pb-0">
      <span className={`absolute left-0 top-1.5 h-3 w-3 rounded-full ${tone.bar}`} />
      <span className="absolute left-[5px] top-4 bottom-0 w-px bg-gray-200 last:hidden" />
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.chip}`}>
                  {entry.action || 'CUSTOM'}
                </span>
                <p className="text-sm font-medium text-[#212529] truncate">
                  {entry.description || entry.action}
                </p>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                {entry.employeeName || entry.performedBy || '—'}
                {entry.performedByRole ? ` · ${entry.performedByRole}` : ''}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{formatWhen(entry.performedAt)}</p>
            </div>
          </div>
          {hasDiff ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <ChevronDown className="h-3.5 w-3.5 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 mr-1" />}
              Expand
            </Button>
          ) : null}
        </div>
        {open && hasDiff ? (
          <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
            <ValuesBlock title="Old Values" values={entry.oldValues} />
            <div className="hidden sm:flex items-center justify-center text-gray-400 text-xs pt-5">↓</div>
            <ValuesBlock title="New Values" values={entry.newValues} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function AuditHistoryTimeline({
  entries,
  loading,
  emptyLabel = 'No audit history yet.',
  onLoadMore,
  hasMore,
}: {
  entries: AuditTrailEntry[];
  loading?: boolean;
  emptyLabel?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
}) {
  if (loading && !entries.length) {
    return <p className="text-sm text-gray-500 py-6 text-center">Loading audit history…</p>;
  }
  if (!entries.length) {
    return <p className="text-sm text-gray-500 py-6 text-center">{emptyLabel}</p>;
  }
  return (
    <div>
      <ul className="relative space-y-0">
        {entries.map((entry) => (
          <TimelineItem key={entry.auditId} entry={entry} />
        ))}
      </ul>
      {hasMore ? (
        <div className="mt-3 flex justify-center">
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={onLoadMore}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Entity-scoped history (preferred for record detail views). */
  entityType?: string;
  entityId?: string;
  module?: string;
  /** Module feed when entity is not set (e.g. admin dashboard). */
  listParams?: {
    module?: string;
    employeeCode?: string;
    action?: string;
    limit?: number;
  };
};

/**
 * Reusable Audit History modal — timeline, newest first, lazy load.
 * Safe to mount from any View Details / History entry point.
 */
export default function AuditHistoryModal({
  open,
  onOpenChange,
  title = 'Audit History',
  entityType,
  entityId,
  module,
  listParams,
}: ModalProps) {
  const entityMode = Boolean(entityType && entityId);
  const entityQuery = useEntityAuditTrailInfinite(
    entityType || '',
    entityId || '',
    open && entityMode,
    module,
  );
  const listQuery = useAuditTrailQuery(
    {
      module: listParams?.module || module || 'expenses',
      employeeCode: listParams?.employeeCode,
      action: listParams?.action,
      limit: listParams?.limit ?? 40,
      sort: 'newest',
    },
    open && !entityMode,
  );

  const entries = useMemo(() => {
    if (entityMode) {
      return (entityQuery.data?.pages || []).flatMap((p) => p.data || []);
    }
    return listQuery.data?.data || [];
  }, [entityMode, entityQuery.data, listQuery.data]);

  const loading = entityMode ? entityQuery.isFetching : listQuery.isFetching;
  const hasMore = entityMode ? Boolean(entityQuery.hasNextPage) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-gray-200 shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {entityType && entityId ? (
            <p className="text-xs text-gray-500 mt-1">
              {entityType} · {entityId}
            </p>
          ) : null}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50/80">
          <AuditHistoryTimeline
            entries={entries}
            loading={loading}
            onLoadMore={() => void entityQuery.fetchNextPage()}
            hasMore={hasMore}
          />
        </div>
        <DialogFooter className="px-6 py-3 border-t border-gray-200 shrink-0 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
