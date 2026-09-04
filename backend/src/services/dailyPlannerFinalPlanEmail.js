/**
 * Final daily plan email — HTML + plain text for employee officialEmail.
 */

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatHours(hours) {
  const n = Math.round((Number(hours) || 0) * 100) / 100;
  return Number.isInteger(n) ? `${n} hrs` : `${n} hrs`;
}

function specialRemarks(task) {
  const parts = [];
  const instructions = String(task.managerInstructions || '').trim();
  const comments = String(task.managerComments || '').trim();
  if (instructions) parts.push(instructions);
  if (comments && comments !== instructions) parts.push(comments);
  return parts.join(' | ') || '—';
}

export function buildFinalPlanEmail({
  employeeName,
  dateLabel,
  totalHours,
  tasks,
}) {
  const name = String(employeeName || 'Employee').trim() || 'Employee';
  const date = String(dateLabel || '').trim();
  const hoursLabel = formatHours(totalHours);
  const rows = (tasks || []).map((task) => ({
    taskName: String(task.taskName || '').trim() || '—',
    description: String(task.description || '').trim() || '—',
    priority: String(task.currentPriority || task.priority || 'Medium').trim(),
    hours: formatHours(task.hoursRequired),
    type: String(task.planningCategory || 'Regular').trim() || 'Regular',
    remarks: specialRemarks(task),
  }));

  const subject = `Final Daily Plan — ${date} — ${name}`;

  const textLines = [
    `Date: ${date}`,
    `Employee: ${name}`,
    `Total Planned Hours: ${hoursLabel}`,
    `Plan Status: Finalized`,
    '',
    'Tasks:',
    ...rows.map(
      (r, i) =>
        `${i + 1}. ${r.taskName} | ${r.description} | ${r.priority} | ${r.hours} | ${r.type} | ${r.remarks}`,
    ),
  ];

  const tableRows = rows
    .map(
      (r) => `
      <tr>
        <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">${escapeHtml(r.taskName)}</td>
        <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">${escapeHtml(r.description)}</td>
        <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">${escapeHtml(r.priority)}</td>
        <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">${escapeHtml(r.hours)}</td>
        <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">${escapeHtml(r.type)}</td>
        <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">${escapeHtml(r.remarks)}</td>
      </tr>`,
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,Helvetica,sans-serif;color:#212529;line-height:1.45;">
  <h2 style="margin:0 0 12px;">Final Daily Plan</h2>
  <p style="margin:0 0 4px;"><strong>Date:</strong> ${escapeHtml(date)}</p>
  <p style="margin:0 0 4px;"><strong>Employee:</strong> ${escapeHtml(name)}</p>
  <p style="margin:0 0 4px;"><strong>Total Planned Hours:</strong> ${escapeHtml(hoursLabel)}</p>
  <p style="margin:0 0 16px;"><strong>Plan Status:</strong> Finalized</p>
  <div style="overflow-x:auto;">
    <table style="border-collapse:collapse;width:100%;min-width:640px;font-size:14px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Task</th>
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Description</th>
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Priority</th>
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Hours</th>
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Type</th>
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Special Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>
</body>
</html>`.trim();

  return { subject, text: textLines.join('\n'), html };
}
