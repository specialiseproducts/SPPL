/**
 * Shared helpers for sales quotation email notifications.
 */

/** Resolve quotation owner employee code with production field priority. */
export function resolveOwnerCode(quotation) {
  return String(
    quotation?.created_by || quotation?.ownerEmployeeCode || quotation?.created_by_employee_code || ''
  ).trim();
}

/**
 * Normalize workflow status for email rule comparisons.
 * Handles DB values like "Draft", "Pending approval", "Rejected", "Approved", "In Progress", "Closed".
 */
export function normalizeWorkflowStatus(item) {
  if (!item) return 'draft';

  let raw = item.workflowStatus ?? item.workflow_status ?? '';
  if (!String(raw).trim() && item.approval_status) {
    raw = item.approval_status;
  }

  const normalized = String(raw).trim().toLowerCase().replace(/\s+/g, '_');

  if (normalized === 'pending' || normalized === 'pending_approval') return 'pending_approval';
  if (normalized === 'approved') return 'approved';
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'draft') return 'draft';
  if (normalized === 'in_progress' || normalized === 'inprogress') return 'in_progress';
  if (normalized === 'closed') return 'closed';

  return normalized || 'draft';
}

/** Trailing decorative ellipsis/bullet runs only — preserves in-text punctuation. */
const TRAILING_DECORATIVE_RE = /(?:…|\.{3,}|[•·\u2022\u00B7]{2,})+$/u;

/**
 * Remove trailing Unicode ellipsis, bullet runs, and ASCII dot runs from rejection text.
 * Does not alter legitimate punctuation within the body of the message.
 */
export function sanitizeRejectionReason(value) {
  let text = String(value ?? '').replace(/\s+$/u, '');

  let prev;
  do {
    prev = text;
    text = text.replace(TRAILING_DECORATIVE_RE, '').replace(/\s+$/u, '');
  } while (text !== prev);

  return text.trim();
}
