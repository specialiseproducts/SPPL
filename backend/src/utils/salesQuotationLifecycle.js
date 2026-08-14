/**
 * Sales quotation lifecycle helpers — workflow vs business status.
 */

/** Terminal business statuses that close the quotation lifecycle. */
export const TERMINAL_OPPORTUNITY_STATUSES = new Set([
  'Lost - Competition',
  'Lost - Other',
  'Lost - Price',
  'Lost - Technical',
  'PO Received',
]);

export function isTerminalOpportunityStatus(status) {
  return TERMINAL_OPPORTUNITY_STATUSES.has(String(status || '').trim());
}

/** Workflows that show an issued quotation reference. */
export function workflowShowsQuotationRef(ws) {
  return ws === 'approved' || ws === 'in_progress' || ws === 'closed';
}

/** Field edits locked once a ref is issued (except dedicated status-update API). */
export function isIssuedQuotationLocked(ws, quotationRef) {
  const ref = String(quotationRef || '').trim();
  if (!ref) return false;
  return ws === 'approved' || ws === 'in_progress' || ws === 'closed';
}

/** Effective lifecycle workflow for post-approval behaviour. Legacy `approved` → `in_progress`. */
export function effectiveLifecycleWorkflow(ws) {
  if (ws === 'approved') return 'in_progress';
  return ws || 'draft';
}

export function buildStatusHistoryEntry({
  previousStatus,
  newStatus,
  updatedByEmployeeCode,
  updatedByName,
  remarks = '',
  updatedAt,
}) {
  const ts = updatedAt || new Date().toISOString();
  return {
    previousStatus: String(previousStatus ?? '').trim(),
    newStatus: String(newStatus ?? '').trim(),
    updatedByEmployeeCode: String(updatedByEmployeeCode || '').trim(),
    updatedByName: String(updatedByName || '').trim(),
    updatedOn: ts,
    timestamp: ts,
    remarks: String(remarks || '').trim(),
  };
}
