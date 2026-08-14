import {
  approveQuotationEditRequest,
  rejectQuotationEditRequest,
} from '../../hooks/sales/salesApi';
import { ACTION_KINDS, type ActionRequiredDefinition } from '../../types/actionRequired';
import type { PortalNotification } from '../../types/notifications';
import { navigateFromNotification } from '../../utils/notificationNavigation';
import {
  alreadyProcessedErrorMessage,
  formatActionDateTime,
  formatActionValues,
} from './formatters';

function meta(n: PortalNotification) {
  return (n.metadata || {}) as Record<string, unknown>;
}

function requestIdOf(n: PortalNotification): string {
  const m = meta(n);
  return String(m.requestId || n.actionId || '').trim();
}

export const quotationEditRequestAction: ActionRequiredDefinition = {
  kind: ACTION_KINDS.QUOTATION_EDIT_REQUEST,

  matches(notification) {
    const m = meta(notification);
    return (
      String(m.actionKind || '').trim() === ACTION_KINDS.QUOTATION_EDIT_REQUEST ||
      (Boolean(m.requestId) &&
        Boolean(m.requestType) &&
        notification.module === 'salesForecasting' &&
        String(notification.title || '').toLowerCase().includes('edit request'))
    );
  },

  getTitle() {
    return 'Quotation Edit Request';
  },

  isProcessed(notification) {
    const status = String(meta(notification).approvalStatus || 'Pending').trim();
    return status === 'Completed' || status === 'Rejected' || status === 'Approved';
  },

  canAct(notification, actorEmployeeCode) {
    if (this.isProcessed(notification)) return false;
    const requester = String(
      meta(notification).requesterEmployeeCode || meta(notification).employeeCode || '',
    ).trim();
    if (requester && actorEmployeeCode && requester === actorEmployeeCode) return false;
    return Boolean(requestIdOf(notification));
  },

  renderDetails(notification) {
    const m = meta(notification);
    const rows: Array<{ label: string; value: string }> = [
      { label: 'Requested By', value: String(m.employeeName || m.requestedBy || '—') },
      { label: 'Employee ID', value: String(m.employeeCode || m.requesterEmployeeCode || '—') },
      { label: 'Quotation', value: String(m.quotationRef || '—') },
      { label: 'Requested Field', value: String(m.requestType || m.requestedFields || '—') },
      {
        label: 'Current Value',
        value: formatActionValues(m.oldValues as Record<string, unknown> | undefined),
      },
      {
        label: 'Requested Value',
        value: formatActionValues(m.requestedValues as Record<string, unknown> | undefined),
      },
      { label: 'Requested On', value: formatActionDateTime(m.requestedAt || notification.createdAt) },
    ];

    return (
      <dl className="mt-2 space-y-1.5 text-xs text-[#212529]">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[7.5rem_1fr] gap-2">
            <dt className="font-medium text-gray-500">{row.label}</dt>
            <dd className="min-w-0 break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
    );
  },

  async approve(ctx) {
    const id = requestIdOf(ctx.notification);
    if (!id) throw new Error('Missing request id');
    try {
      await approveQuotationEditRequest(id);
    } catch (err) {
      throw new Error(alreadyProcessedErrorMessage(err));
    }
    ctx.invalidate();
  },

  async reject(ctx, remark) {
    const id = requestIdOf(ctx.notification);
    if (!id) throw new Error('Missing request id');
    try {
      await rejectQuotationEditRequest(id, remark);
    } catch (err) {
      throw new Error(alreadyProcessedErrorMessage(err));
    }
    ctx.invalidate();
  },

  view(ctx) {
    const m = meta(ctx.notification);
    const quotationId = String(m.quotationId || '').trim();
    navigateFromNotification(
      {
        ...ctx.notification,
        actionId: quotationId || ctx.notification.actionId,
        actionType: 'View',
        actionUrl: quotationId
          ? `/sales-forecasting/quotations/${encodeURIComponent(quotationId)}`
          : ctx.notification.actionUrl,
        metadata: {
          ...m,
          focus: 'quotation',
          forecastId: quotationId,
        },
      },
      ctx.onModuleSelect,
    );
  },
};
