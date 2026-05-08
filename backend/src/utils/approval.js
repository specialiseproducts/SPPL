export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected', 'Under Review'];

export function withApprovalDefaults(payload = {}) {
  return {
    ...payload,
    approval_status: payload.approval_status || 'Pending',
    approved_by: payload.approved_by || '',
    approved_at: payload.approved_at || '',
    rejected_by: payload.rejected_by || '',
    rejected_at: payload.rejected_at || '',
    approval_comments: payload.approval_comments || '',
  };
}

