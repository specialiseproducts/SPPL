export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected', 'Under Review'];

export function withApprovalDefaults(payload = {}) {
  const status = payload.auditStatus || payload.approval_status || 'Pending';
  return {
    ...payload,
    approval_status: status,
    auditStatus: status,
    approved_by: payload.approved_by || '',
    approved_at: payload.approved_at || '',
    rejected_by: payload.rejected_by || '',
    rejected_at: payload.rejected_at || '',
    approval_comments: payload.approval_comments || '',
    auditReason: payload.auditReason ?? payload.approval_comments ?? '',
    auditedBy: payload.auditedBy || '',
    auditedAt: payload.auditedAt || '',
  };
}

