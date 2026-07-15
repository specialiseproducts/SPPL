import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import type { PlanningExportPayload, PlanningReportData } from '../types/planningAnalytics';
import type { TeamPerformanceEmployeeRow } from '../types/teamPerformance';

function monthFileLabel(year: number, month: number) {
  const date = new Date(Date.UTC(year, month - 1, 1));
  const monthName = date.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  return `${monthName}_${year}`;
}

export async function exportPlanningReportExcel(payload: PlanningExportPayload) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Planning Report');

  if (payload.scope === 'team') {
    sheet.addRow(['Team Planning Report', payload.yearMonth]);
    sheet.addRow([]);
    sheet.addRow([
      'Employee',
      'Planning Score',
      'Badge',
      'Planning %',
      'Working Days',
      'Planned Ahead',
      'Regular Tasks',
      'Urgent Tasks',
      'Rating',
      'Status',
    ]);
    for (const row of (payload.rows || []) as TeamPerformanceEmployeeRow[]) {
      sheet.addRow([
        row.employeeName,
        row.planningScore,
        row.badge,
        row.planningAheadPercent,
        row.workingDays,
        row.daysPlannedAhead,
        row.regularTaskCount,
        row.urgentTaskCount,
        row.rating,
        row.status,
      ]);
    }
  } else {
    const report = payload as PlanningReportData;
    sheet.addRow(['Planning Report', report.yearMonth, report.employeeName]);
    sheet.addRow([]);
    sheet.addRow(['Planning Score', report.summary.planningScore]);
    sheet.addRow(['Badge', `${report.summary.badgeEmoji || ''} ${report.summary.badge}`.trim()]);
    sheet.addRow(['Planning Ahead %', report.summary.planningAheadPercent]);
    sheet.addRow(['Working Days', report.summary.workingDays]);
    sheet.addRow(['Days Planned Ahead', report.summary.daysPlannedAhead]);
    sheet.addRow(['Regular Tasks', report.summary.regularTaskCount]);
    sheet.addRow(['Urgent Tasks', report.summary.urgentTaskCount]);
    sheet.addRow(['Late Planning Days', report.summary.latePlanningDays]);
    sheet.addRow(['Rating', report.summary.rating]);
    sheet.addRow(['Comment', report.monthlyComment]);
    sheet.addRow([]);
    sheet.addRow(['Month', 'Score', 'Badge', 'Planning %', 'Rating']);
    for (const row of report.history || []) {
      sheet.addRow([
        row.yearMonth,
        row.planningScore,
        row.badge,
        row.planningAheadPercent,
        row.rating,
      ]);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Planning_Report_${monthFileLabel(payload.year, payload.month)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportPlanningReportPdf(payload: PlanningExportPayload) {
  const doc = new jsPDF();
  const title = `Planning Report - ${monthFileLabel(payload.year, payload.month)}`;
  doc.setFontSize(14);
  doc.text(title, 14, 18);

  let y = 30;
  const line = (label: string, value: string | number) => {
    doc.setFontSize(11);
    doc.text(`${label}: ${value}`, 14, y);
    y += 8;
  };

  if (payload.scope === 'team') {
    line('Scope', 'Team Report');
    y += 4;
    for (const row of (payload.rows || []) as TeamPerformanceEmployeeRow[]) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      line('Employee', row.employeeName);
      line('Score', row.planningScore);
      line('Badge', row.badge);
      line('Planning %', `${row.planningAheadPercent}%`);
      y += 4;
    }
  } else {
    const report = payload as PlanningReportData;
    line('Employee', report.employeeName);
    line('Planning Score', `${report.summary.planningScore} / 100`);
    line('Badge', `${report.summary.badgeEmoji || ''} ${report.summary.badge}`.trim());
    line('Planning Ahead %', `${report.summary.planningAheadPercent}%`);
    line('Regular Tasks', report.summary.regularTaskCount);
    line('Urgent Tasks', report.summary.urgentTaskCount);
    line('Late Planning Days', report.summary.latePlanningDays);
    line('Rating', report.summary.rating);
    y += 4;
    doc.text(report.monthlyComment, 14, y, { maxWidth: 180 });
  }

  doc.save(`Planning_Report_${monthFileLabel(payload.year, payload.month)}.pdf`);
}
