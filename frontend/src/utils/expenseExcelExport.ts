import { jsPDF } from 'jspdf';
import type { ExpenseRecord } from '../types/expenses';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Exact Excel export column labels / order — source of truth. */
const EXPORT_COLUMNS = [
  'Sr. #',
  'Date',
  'Expense Head',
  'Sub Category',
  'Location',
  'Purpose',
  'From',
  'To',
  'Return',
  'Kilometers (km)',
  'Stay Date (From)',
  'Stay Date (To)',
  'Service Provider',
  'Bill Number',
  'Fuel Type',
  'Supporting Document',
  'Amount (Rs)',
] as const;

const COL_COUNT = EXPORT_COLUMNS.length;
const LOGO_PATH = '/sppl-expense-logo.png';

/**
 * Column proportions matching the existing Excel export (content-based ~5–12 char widths).
 * Purpose / Service Provider / Bill Number get more space; travel fields stay narrow.
 */
const COL_WEIGHTS = [
  0.028, // Sr. #
  0.052, // Date
  0.062, // Expense Head
  0.068, // Sub Category
  0.055, // Location
  0.11, // Purpose
  0.04, // From
  0.04, // To
  0.038, // Return
  0.048, // Kilometers
  0.05, // Stay From
  0.05, // Stay To
  0.075, // Service Provider
  0.08, // Bill Number
  0.042, // Fuel Type
  0.055, // Supporting Document
  0.057, // Amount
];

export type ExpenseExportContext = {
  employeeName: string;
  monthLabel: string;
  yearLabel: string;
};

export type ExpenseTravelAllowanceSummary = {
  recordCount: number;
  totalAmount: number;
};

function displayCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const s = String(value).trim();
  return s === '' ? '' : s;
}

function formatKm(km: number | undefined): string {
  if (km === undefined || km === null || Number.isNaN(Number(km))) return '';
  return String(km);
}

function formatDateCell(iso: string | undefined): string {
  if (!iso || String(iso).trim() === '') return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB');
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function supportingDocumentLabel(expense: ExpenseRecord): string {
  if (expense.supportingDocument === 'Yes' || expense.supportingDocument === 'No') {
    return expense.supportingDocument;
  }
  if (expense.documents && expense.documents.length > 0) return 'Yes';
  return 'No';
}

/** Existing OutStation Travel records are Travel Allowance items, not normal expense rows. */
function isTravelAllowanceRecord(expense: ExpenseRecord): boolean {
  return String(expense.expenseHead || '').trim() === 'Travel' && expense.outStation === 'Yes';
}

export function buildExpenseExportContext(
  rows: ExpenseRecord[],
  options: {
    privileged: boolean;
    selectedEmployee: string;
    selectedMonth: string;
    selectedYear: string;
    currentUserName: string;
  },
): ExpenseExportContext {
  const { privileged, selectedEmployee, selectedMonth, selectedYear, currentUserName } = options;

  let employeeName = currentUserName;
  if (privileged && selectedEmployee !== 'all') {
    employeeName = selectedEmployee;
  } else if (privileged) {
    const unique = [...new Set(rows.map((r) => r.employeeName).filter(Boolean))];
    if (unique.length === 1) employeeName = unique[0];
  }

  let monthLabel = '';
  let yearLabel = '';
  if (selectedMonth !== 'all' && selectedYear !== 'all') {
    const monthIndex = Number.parseInt(selectedMonth, 10) - 1;
    monthLabel = MONTH_NAMES[monthIndex] || selectedMonth;
    yearLabel = selectedYear;
  } else if (rows.length > 0 && rows[0].monthYear) {
    const [mm, yyyy] = String(rows[0].monthYear).split('-');
    const monthIndex = Number.parseInt(mm, 10) - 1;
    monthLabel = MONTH_NAMES[monthIndex] || mm;
    yearLabel = yyyy || String(new Date().getFullYear());
  } else {
    const now = new Date();
    monthLabel = MONTH_NAMES[now.getMonth()];
    yearLabel = String(now.getFullYear());
  }

  return { employeeName, monthLabel, yearLabel };
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch(LOGO_PATH);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function buildRowValues(expense: ExpenseRecord, index: number): string[] {
  const amount = Number.isFinite(Number(expense.amount)) ? Number(expense.amount) : 0;
  return [
    String(index + 1),
    formatDateCell(expense.date),
    displayCell(expense.expenseHead),
    displayCell(expense.subCategory),
    displayCell(expense.location),
    displayCell(expense.purpose),
    displayCell(expense.fromLocation),
    displayCell(expense.toLocation),
    displayCell(expense.returnType),
    formatKm(expense.kilometers),
    formatDateCell(expense.stayDateFrom),
    formatDateCell(expense.stayDateTo),
    displayCell(expense.serviceProvider),
    displayCell(expense.billNumber),
    displayCell(expense.fuelType),
    supportingDocumentLabel(expense),
    formatAmount(amount),
  ];
}

function buildExportFileName(context: ExpenseExportContext): string {
  const employee = String(context.employeeName || 'Employee')
    .trim()
    .replace(/\.xlsx$/i, '')
    .replace(/\s+/g, '-');
  const month = String(context.monthLabel || '').trim().replace(/\.xlsx$/i, '');
  const year = String(context.yearLabel || '').trim().replace(/\.xlsx$/i, '');
  return `SPPL-Expenses-${employee}-${month}-${year}.pdf`;
}

function downloadPdfBlob(doc: jsPDF, fileName: string) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  // Ensure no residual .xlsx.pdf naming
  if (anchor.download.toLowerCase().includes('.xlsx.pdf')) {
    anchor.download = anchor.download.replace(/\.xlsx\.pdf$/i, '.pdf');
  }
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * PDF export that reproduces the existing Excel expense export layout.
 * Dataset / filters / columns unchanged — layout only.
 */
export async function exportExpensesToPdf(
  rows: ExpenseRecord[],
  context: ExpenseExportContext,
  travelAllowanceSummary?: ExpenseTravelAllowanceSummary,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const marginTop = 14;
  const marginBottom = 16;
  const usableWidth = pageWidth - marginX * 2;
  const weightSum = COL_WEIGHTS.reduce((a, b) => a + b, 0);
  const colWidths = COL_WEIGHTS.map((w) => (w / weightSum) * usableWidth);

  const tableRows = rows.filter((expense) => !isTravelAllowanceRecord(expense));
  let totalAmount = 0;
  const bodyRows = tableRows.map((expense, index) => {
    const amount = Number.isFinite(Number(expense.amount)) ? Number(expense.amount) : 0;
    totalAmount += amount;
    return buildRowValues(expense, index);
  });

  const travelAllowanceTotal = Number(travelAllowanceSummary?.totalAmount || 0);
  const finalTotal =
    totalAmount + (Number.isFinite(travelAllowanceTotal) ? travelAllowanceTotal : 0);
  const title = `SPPL : Expenses by ${context.employeeName} in ${context.monthLabel} ${context.yearLabel}`;
  const logoDataUrl = await loadLogoDataUrl();

  const headerFontSize = 7;
  const bodyFontSize = 7;
  const lineHeight = 8;
  const cellPadX = 1.5;
  const cellPadY = 1.5;

  let y = marginTop;

  const measureWrapped = (text: string, width: number, fontSize: number, bold: boolean) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(String(text || ''), Math.max(6, width - cellPadX * 2));
    return Array.isArray(lines) ? lines : [String(text || '')];
  };

  const drawPageChrome = (includeLogoAndTitle: boolean) => {
    y = marginTop;
    if (includeLogoAndTitle) {
      if (logoDataUrl) {
        try {
          const logoW = 150;
          const logoH = 34;
          doc.addImage(logoDataUrl, 'PNG', (pageWidth - logoW) / 2, y, logoW, logoH);
          y += logoH + 4;
        } catch {
          // continue without logo
        }
      }
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(title, pageWidth / 2, y + 10, { align: 'center' });
      y += 16;
    }
  };

  const drawTableHeader = () => {
    const headerLines = EXPORT_COLUMNS.map((label, i) =>
      measureWrapped(label, colWidths[i], headerFontSize, true),
    );
    const headerHeight = Math.max(
      18,
      ...headerLines.map((lines) => lines.length * lineHeight + cellPadY * 2),
    );

    let x = marginX;
    for (let i = 0; i < COL_COUNT; i += 1) {
      // Re-apply yellow fill every cell (avoids jsPDF fill-state corruption → black bar).
      doc.setFillColor(255, 255, 0);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.rect(x, y, colWidths[i], headerHeight, 'F');
      doc.rect(x, y, colWidths[i], headerHeight, 'S');

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(headerFontSize);
      const lines = headerLines[i];
      const textBlockH = lines.length * lineHeight;
      let textY = y + (headerHeight - textBlockH) / 2 + lineHeight - 1.5;
      for (const line of lines) {
        doc.text(String(line), x + colWidths[i] / 2, textY, { align: 'center' });
        textY += lineHeight;
      }
      x += colWidths[i];
    }
    y += headerHeight;
  };

  const startNewPage = () => {
    doc.addPage();
    // Continuation: table header only (compact, like printing Excel pages).
    drawPageChrome(false);
    drawTableHeader();
  };

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - marginBottom) return;
    startNewPage();
  };

  const drawRow = (values: string[], opts?: { bold?: boolean }) => {
    const bold = Boolean(opts?.bold);
    const wrapped = values.map((value, i) =>
      measureWrapped(value, colWidths[i], bodyFontSize, bold),
    );
    const rowHeight = Math.max(
      11,
      ...wrapped.map((lines) => lines.length * lineHeight + cellPadY * 2),
    );
    ensureSpace(rowHeight);

    let x = marginX;
    for (let i = 0; i < COL_COUNT; i += 1) {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.35);
      doc.rect(x, y, colWidths[i], rowHeight, 'S');

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(bodyFontSize);

      const lines = wrapped[i];
      const textBlockH = lines.length * lineHeight;
      let textY = y + (rowHeight - textBlockH) / 2 + lineHeight - 1.5;
      const isAmount = i === COL_COUNT - 1;
      const isSr = i === 0;
      for (const line of lines) {
        if (isAmount) {
          doc.text(String(line), x + colWidths[i] - cellPadX, textY, { align: 'right' });
        } else if (isSr) {
          doc.text(String(line), x + colWidths[i] / 2, textY, { align: 'center' });
        } else {
          doc.text(String(line), x + cellPadX, textY);
        }
        textY += lineHeight;
      }
      x += colWidths[i];
    }
    y += rowHeight;
  };

  // First page: logo + title + header
  drawPageChrome(true);
  drawTableHeader();

  for (const row of bodyRows) {
    drawRow(row);
  }

  if ((travelAllowanceSummary?.recordCount ?? 0) > 0) {
    const allowanceValues = Array.from({ length: COL_COUNT }, () => '');
    allowanceValues[0] = `Travel Allowances for ${context.monthLabel} ${context.yearLabel}`;
    allowanceValues[COL_COUNT - 1] = formatAmount(
      Number.isFinite(travelAllowanceTotal) ? travelAllowanceTotal : 0,
    );
    drawRow(allowanceValues, { bold: true });
  }

  // Total row — Excel style: "Total :" + one unbroken amount (no cell wrapping).
  // Do not use "₹" — Helvetica lacks that glyph and jsPDF spaces digits incorrectly.
  const totalRowHeight = 14;
  ensureSpace(totalRowHeight);
  {
    let x = marginX;
    for (let i = 0; i < COL_COUNT; i += 1) {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.35);
      doc.rect(x, y, colWidths[i], totalRowHeight, 'S');
      x += colWidths[i];
    }
    const amountColWidth = colWidths[COL_COUNT - 1];
    const amountColRight = marginX + usableWidth;
    const amountColLeft = amountColRight - amountColWidth;
    const totalAmountText = formatAmount(finalTotal);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(bodyFontSize);
    doc.text('Total :', amountColLeft - cellPadX, y + 10, { align: 'right' });
    doc.text(totalAmountText, amountColRight - cellPadX, y + 10, { align: 'right' });
    y += totalRowHeight;
  }

  // Signature section — keep with total when possible (Excel layout)
  const signatureHeight = 48;
  ensureSpace(signatureHeight + 6);
  y += 2;
  const half = usableWidth / 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.rect(marginX, y, half, signatureHeight, 'S');
  doc.rect(marginX + half, y, half, signatureHeight, 'S');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Claimed by & Signature', marginX + half / 2, y + 12, { align: 'center' });
  doc.text('Approved by & Signature', marginX + half + half / 2, y + 12, { align: 'center' });

  downloadPdfBlob(doc, buildExportFileName(context));
}

/** @deprecated Use exportExpensesToPdf */
export const exportExpensesToExcel = exportExpensesToPdf;
