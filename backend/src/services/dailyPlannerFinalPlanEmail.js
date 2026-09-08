/**
 * Final / revised daily plan email — HTML + plain text for employee officialEmail.
 */

import { formatDurationLabel, PRIORITY_SORT_ORDER } from '../utils/planningRecognition.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatHours(hours) {
  return formatDurationLabel(hours);
}

function specialRemarkParts(task) {
  const instructions = String(task.managerInstructions || '').trim();
  const comments = String(task.managerComments || '').trim();
  return { instructions, comments };
}

function specialRemarksText(task) {
  const { instructions, comments } = specialRemarkParts(task);
  if (instructions && comments && comments !== instructions) {
    return `Instruction: ${instructions}\nComment: ${comments}`;
  }
  return instructions || comments || '—';
}

function specialRemarksHtml(task) {
  const { instructions, comments } = specialRemarkParts(task);
  if (!instructions && !comments) return '—';
  const block = (label, value) =>
    `<div style="margin:0 0 6px;"><strong>${label}:</strong><br>${escapeHtml(value).replace(/\n/g, '<br>')}</div>`;
  if (instructions && comments && comments !== instructions) {
    return `${block('Instruction', instructions)}${block('Comment', comments)}`;
  }
  return escapeHtml(instructions || comments).replace(/\n/g, '<br>');
}

function descriptionLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[•\-\*]\s*/, '').trim())
    .filter(Boolean);
}

function descriptionHtml(value) {
  const lines = descriptionLines(value);
  if (lines.length === 0) return '—';
  return `<ul style="margin:0;padding-left:18px;list-style-type:disc;">${lines
    .map(
      (line) =>
        `<li style="display:list-item;margin:0 0 4px;line-height:1.4;">${escapeHtml(line)}</li>`,
    )
    .join('')}</ul>`;
}

function descriptionText(value) {
  const lines = descriptionLines(value);
  if (lines.length === 0) return '—';
  return lines.map((line) => `• ${line}`).join('\n');
}

function sortTasksByPriority(tasks) {
  return [...(tasks || [])].sort((a, b) => {
    const pa = PRIORITY_SORT_ORDER[a.currentPriority || a.priority] ?? 2;
    const pb = PRIORITY_SORT_ORDER[b.currentPriority || b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return String(a.taskName || '').localeCompare(String(b.taskName || ''), undefined, {
      sensitivity: 'base',
    });
  });
}

function mapTaskRows(tasks) {
  return sortTasksByPriority(tasks).map((task, index) => ({
    srNo: index + 1,
    taskName: String(task.taskName || '').trim() || '—',
    description: String(task.description || '').trim(),
    priority: String(task.currentPriority || task.priority || 'Medium').trim(),
    hours: formatHours(task.hoursRequired),
    remarksText: specialRemarksText(task),
    remarksHtml: specialRemarksHtml(task),
  }));
}

function buildTasksTable(rows) {
  const tableRows = rows
    .map(
      (r) => `
      <tr>
        <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;text-align:center;">${r.srNo}</td>
        <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">${escapeHtml(r.taskName)}</td>
        <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">${descriptionHtml(r.description)}</td>
        <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;"><strong>${escapeHtml(r.priority)}</strong></td>
        <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">${escapeHtml(r.hours)}</td>
        <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">${r.remarksHtml}</td>
      </tr>`,
    )
    .join('');

  return `
  <div style="overflow-x:auto;">
    <table style="border-collapse:collapse;width:100%;min-width:720px;font-size:14px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Sr. No.</th>
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Task Name</th>
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Task Description</th>
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Priority</th>
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Hours Planned</th>
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Special Remark</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>`;
}

function formatChangeEntry(change) {
  if (change && typeof change === 'object') {
    const label = String(change.label || change.summary || '').trim();
    const details = Array.isArray(change.details)
      ? change.details.map((d) => String(d || '').trim()).filter(Boolean)
      : [];
    return { label, details };
  }
  const text = String(change || '').trim();
  if (!text) return null;
  const [label, ...rest] = text.split('\n');
  return {
    label: label.replace(/^\s*-\s*/, '').trim(),
    details: rest.map((line) => line.replace(/^\s*-\s*/, '').trim()).filter(Boolean),
  };
}

function changeEntries(changes) {
  return (Array.isArray(changes) ? changes : [])
    .map(formatChangeEntry)
    .filter((entry) => entry && entry.label);
}

function changesText(entries) {
  if (entries.length === 0) return ['Plan updated.'];
  return entries.flatMap((entry, index) => {
    const lines = [`${index + 1}. ${entry.label}`];
    for (const detail of entry.details) lines.push(`   - ${detail}`);
    return lines;
  });
}

function changesHtml(entries) {
  if (entries.length === 0) return '<p style="margin:0 0 16px;">Plan updated.</p>';
  return `<ul style="margin:0 0 16px;padding-left:20px;">${entries
    .map((entry) => {
      const details =
        entry.details.length > 0
          ? `<ul style="margin:4px 0 0;padding-left:18px;">${entry.details
              .map((d) => `<li>${escapeHtml(d)}</li>`)
              .join('')}</ul>`
          : '';
      return `<li style="margin:0 0 8px;">${escapeHtml(entry.label)}${details}</li>`;
    })
    .join('')}</ul>`;
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
  const rows = mapTaskRows(tasks);

  const subject = `Final Daily Plan — ${date} — ${name}`;

  const textLines = [
    `Date: ${date}`,
    `Employee: ${name}`,
    `Total Planned Hours: ${hoursLabel}`,
    `Plan Status: Finalized`,
    '',
    'Tasks:',
    ...rows.flatMap((r) => [
      `${r.srNo}. ${r.taskName} | ${r.priority} | ${r.hours}`,
      `   Description: ${descriptionText(r.description).replace(/\n/g, '\n   ')}`,
      `   Special Remark: ${r.remarksText.replace(/\n/g, '\n   ')}`,
    ]),
  ];

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,Helvetica,sans-serif;color:#212529;line-height:1.45;">
  <h2 style="margin:0 0 12px;">Final Daily Plan</h2>
  <p style="margin:0 0 4px;"><strong>Date:</strong> ${escapeHtml(date)}</p>
  <p style="margin:0 0 4px;"><strong>Employee:</strong> ${escapeHtml(name)}</p>
  <p style="margin:0 0 4px;"><strong>Total Planned Hours:</strong> ${escapeHtml(hoursLabel)}</p>
  <p style="margin:0 0 16px;"><strong>Plan Status:</strong> Finalized</p>
  ${buildTasksTable(rows)}
</body>
</html>`.trim();

  return { subject, text: textLines.join('\n'), html };
}

/**
 * Email when a manager revises an already-finalized plan (add/edit tasks).
 * @param {{ employeeName, dateLabel, totalHours, tasks, changes: string[] }} opts
 */
export function buildRevisedPlanEmail({
  employeeName,
  dateLabel,
  totalHours,
  tasks,
  changes,
}) {
  const name = String(employeeName || 'Employee').trim() || 'Employee';
  const date = String(dateLabel || '').trim();
  const hoursLabel = formatHours(totalHours);
  const rows = mapTaskRows(tasks);
  const entries = changeEntries(changes);

  const subject = `Updated Final Daily Plan — ${date} — ${name}`;

  const textLines = [
    `Date: ${date}`,
    `Employee: ${name}`,
    `Total Planned Hours: ${hoursLabel}`,
    `Plan Status: Finalized`,
    '',
    'Changes Made:',
    ...changesText(entries),
    '',
    'Complete Updated Final Plan:',
    ...rows.flatMap((r) => [
      `${r.srNo}. ${r.taskName} | ${r.priority} | ${r.hours}`,
      `   Description: ${descriptionText(r.description).replace(/\n/g, '\n   ')}`,
      `   Special Remark: ${r.remarksText.replace(/\n/g, '\n   ')}`,
    ]),
  ];

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,Helvetica,sans-serif;color:#212529;line-height:1.45;">
  <h2 style="margin:0 0 12px;">Updated Final Daily Plan</h2>
  <p style="margin:0 0 4px;"><strong>Date:</strong> ${escapeHtml(date)}</p>
  <p style="margin:0 0 4px;"><strong>Employee:</strong> ${escapeHtml(name)}</p>
  <p style="margin:0 0 4px;"><strong>Total Planned Hours:</strong> ${escapeHtml(hoursLabel)}</p>
  <p style="margin:0 0 16px;"><strong>Plan Status:</strong> Finalized</p>
  <h3 style="margin:0 0 8px;">Changes Made</h3>
  ${changesHtml(entries)}
  <h3 style="margin:0 0 8px;">Complete Updated Final Plan</h3>
  ${buildTasksTable(rows)}
</body>
</html>`.trim();

  return { subject, text: textLines.join('\n'), html };
}
