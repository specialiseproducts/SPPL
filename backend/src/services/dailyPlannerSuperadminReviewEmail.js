/**
 * Superadmin (MD) Daily Planner review-comment email — employee + reporting person.
 */

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPlannerDateLabel(dateKey) {
  const key = String(dateKey || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key || 'today';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Email content for Superadmin out-of-team review comments only.
 * Reviewer name must come from the authenticated Superadmin who submitted the comment.
 */
export function buildSuperadminReviewEmail({
  recipientName,
  employeeName,
  reviewerName,
  taskName,
  projectName,
  taskDate,
  commentText,
}) {
  const dateLabel = formatPlannerDateLabel(taskDate);
  const subject = `MD's Comment on Your Daily Planner — Action Required`;
  const text = [
    `Hello ${recipientName || 'there'},`,
    '',
    "MD's Comment on Daily Planner Planning",
    '',
    `${reviewerName} left an MD's comment on Daily Planner planning that needs attention.`,
    '',
    `Employee: ${employeeName}`,
    `Task: ${taskName || '—'}`,
    `Project: ${projectName || '—'}`,
    `Task date: ${dateLabel}`,
    `Reviewer: ${reviewerName}`,
    '',
    "MD's comment:",
    commentText,
    '',
    'This message is feedback about planning or task progress. It does not change task ownership or approval workflow.',
  ].join('\n');
  const html = `<p>Hello ${escapeHtml(recipientName || 'there')},</p>
<h2 style="margin:16px 0 12px;font-size:18px;">MD's Comment on Daily Planner Planning</h2>
<p><strong>${escapeHtml(reviewerName)}</strong> left an MD's comment on Daily Planner planning that needs attention.</p>
<ul>
<li><strong>Employee:</strong> ${escapeHtml(employeeName)}</li>
<li><strong>Task:</strong> ${escapeHtml(taskName || '—')}</li>
<li><strong>Project:</strong> ${escapeHtml(projectName || '—')}</li>
<li><strong>Task date:</strong> ${escapeHtml(dateLabel)}</li>
<li><strong>Reviewer:</strong> ${escapeHtml(reviewerName)}</li>
</ul>
<p><strong>MD's comment:</strong></p>
<p>${escapeHtml(commentText).replace(/\n/g, '<br>')}</p>
<p>This message is feedback about planning or task progress. It does not change task ownership or approval workflow.</p>`;
  return { subject, text, html };
}
