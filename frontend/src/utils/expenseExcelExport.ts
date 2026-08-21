import ExcelJS from 'exceljs';
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

function longestSegment(text: string, splitter: RegExp): number {
  return text.split(splitter).reduce((max, part) => Math.max(max, part.trim().length), 0);
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

async function loadLogoBase64(): Promise<{ base64: string; extension: 'png' } | null> {
  try {
    const response = await fetch(LOGO_PATH);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { base64: btoa(binary), extension: 'png' };
  } catch {
    return null;
  }
}

const BORDER_COLOR = { argb: 'FF000000' };

function borderSide(style: 'thin' | 'medium') {
  return { style, color: BORDER_COLOR };
}

function applyThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: borderSide('thin'),
    left: borderSide('thin'),
    bottom: borderSide('thin'),
    right: borderSide('thin'),
  };
}

function setCellBorderSides(
  cell: ExcelJS.Cell,
  sides: Partial<Record<'top' | 'left' | 'bottom' | 'right', 'thin' | 'medium'>>,
) {
  const current = cell.border ?? {};
  cell.border = {
    top: sides.top ? borderSide(sides.top) : current.top,
    left: sides.left ? borderSide(sides.left) : current.left,
    bottom: sides.bottom ? borderSide(sides.bottom) : current.bottom,
    right: sides.right ? borderSide(sides.right) : current.right,
  };
}

/** Upgrade only the outside edges of the report to a thicker border. */
function applyOuterFrameMedium(
  sheet: ExcelJS.Worksheet,
  topRow: number,
  bottomRow: number,
  leftCol: number,
  rightCol: number,
) {
  for (let col = leftCol; col <= rightCol; col += 1) {
    setCellBorderSides(sheet.getCell(topRow, col), { top: 'medium' });
    setCellBorderSides(sheet.getCell(bottomRow, col), { bottom: 'medium' });
  }
  for (let row = topRow; row <= bottomRow; row += 1) {
    setCellBorderSides(sheet.getCell(row, leftCol), { left: 'medium' });
    setCellBorderSides(sheet.getCell(row, rightCol), { right: 'medium' });
  }
}

/** Draw a rectangular section border without internal grid lines. */
function applySectionEnvelope(
  sheet: ExcelJS.Worksheet,
  topRow: number,
  bottomRow: number,
  leftCol: number,
  rightCol: number,
) {
  for (let col = leftCol; col <= rightCol; col += 1) {
    setCellBorderSides(sheet.getCell(topRow, col), { top: 'thin' });
    setCellBorderSides(sheet.getCell(bottomRow, col), { bottom: 'thin' });
  }
  for (let row = topRow; row <= bottomRow; row += 1) {
    setCellBorderSides(sheet.getCell(row, leftCol), { left: 'thin' });
    setCellBorderSides(sheet.getCell(row, rightCol), { right: 'thin' });
  }
}

function applySignatureDivider(
  sheet: ExcelJS.Worksheet,
  topRow: number,
  bottomRow: number,
  dividerAfterCol: number,
) {
  for (let row = topRow; row <= bottomRow; row += 1) {
    setCellBorderSides(sheet.getCell(row, dividerAfterCol), { right: 'thin' });
    setCellBorderSides(sheet.getCell(row, dividerAfterCol + 1), { left: 'thin' });
  }
}

export async function exportExpensesToExcel(
  rows: ExpenseRecord[],
  context: ExpenseExportContext,
  travelAllowanceSummary?: ExpenseTravelAllowanceSummary,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SPPL Expenses';
  const sheet = workbook.addWorksheet('Expenses', {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  sheet.columns = EXPORT_COLUMNS.map(() => ({ width: 10 }));

  const lastColLetter = String.fromCharCode(64 + COL_COUNT);
  const reportLeftCol = 1;
  const reportRightCol = COL_COUNT;
  const logoStartRow = 1;
  const logoEndRow = 3;
  const titleRow = 4;

  sheet.mergeCells(`A${logoStartRow}:${lastColLetter}${logoEndRow}`);
  sheet.getRow(logoStartRow).height = 28;
  sheet.getRow(logoStartRow + 1).height = 28;
  sheet.getRow(logoEndRow).height = 28;

  const logo = await loadLogoBase64();
  if (logo) {
    const imageId = workbook.addImage({
      base64: logo.base64,
      extension: logo.extension,
    });
    sheet.addImage(imageId, {
      tl: { col: 6.5, row: logoStartRow - 1 + 0.15 },
      ext: { width: 320, height: 72 },
    });
  }

  const title = `SPPL : Expenses by ${context.employeeName} in ${context.monthLabel} ${context.yearLabel}`;
  sheet.mergeCells(`A${titleRow}:${lastColLetter}${titleRow}`);
  const titleCell = sheet.getCell(`A${titleRow}`);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(titleRow).height = 24;

  const headerRowIndex = titleRow + 1;
  const headerRow = sheet.getRow(headerRowIndex);
  EXPORT_COLUMNS.forEach((label, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyThinBorder(cell);
  });
  headerRow.height = 32;

  const tableRows = rows.filter((expense) => !isTravelAllowanceRecord(expense));

  let dataRowIndex = headerRowIndex + 1;
  let totalAmount = 0;

  tableRows.forEach((expense, index) => {
    const amount = Number.isFinite(Number(expense.amount)) ? Number(expense.amount) : 0;
    totalAmount += amount;

    const values = [
      index + 1,
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
      amount,
    ];

    const row = sheet.getRow(dataRowIndex);
    values.forEach((value, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      cell.value = value;
      cell.font = { size: 10 };
      cell.alignment = {
        horizontal: colIndex === 0 || colIndex === values.length - 1 ? 'center' : 'left',
        vertical: 'middle',
        wrapText: true,
      };
      if (colIndex === values.length - 1) {
        cell.numFmt = '#,##0.00';
      }
      applyThinBorder(cell);
    });
    row.height = undefined;
    dataRowIndex += 1;
  });

  const dataEndRowIndex = dataRowIndex;
  let nextRowIndex = dataRowIndex;

  if ((travelAllowanceSummary?.recordCount ?? 0) > 0) {
    const summaryRow = nextRowIndex;
    sheet.mergeCells(`A${summaryRow}:P${summaryRow}`);
    const allowanceTitleCell = sheet.getCell(`A${summaryRow}`);
    allowanceTitleCell.value = `Travel Allowances for ${context.monthLabel} ${context.yearLabel}`;
    allowanceTitleCell.font = { bold: true, size: 11 };
    allowanceTitleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    const allowanceAmountCell = sheet.getCell(`Q${summaryRow}`);
    allowanceAmountCell.value = Number(travelAllowanceSummary?.totalAmount || 0);
    allowanceAmountCell.numFmt = '₹ #,##0.00';
    allowanceAmountCell.font = { bold: true, size: 11 };
    allowanceAmountCell.alignment = { horizontal: 'right', vertical: 'middle' };
    for (let col = reportLeftCol; col <= reportRightCol; col += 1) {
      applyThinBorder(sheet.getCell(summaryRow, col));
    }
    sheet.getRow(summaryRow).height = 22;
    nextRowIndex = summaryRow + 1;
  }

  const totalRowIndex = nextRowIndex;
  sheet.mergeCells(`A${totalRowIndex}:P${totalRowIndex}`);
  const totalLabelCell = sheet.getCell(`A${totalRowIndex}`);
  totalLabelCell.value = 'Total :';
  totalLabelCell.font = { bold: true, size: 11 };
  totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const travelAllowanceTotal = Number(travelAllowanceSummary?.totalAmount || 0);
  const finalTotal =
    totalAmount + (Number.isFinite(travelAllowanceTotal) ? travelAllowanceTotal : 0);

  const totalValueCell = sheet.getCell(`Q${totalRowIndex}`);
  totalValueCell.value = finalTotal;
  totalValueCell.numFmt = '₹ #,##0.00';
  totalValueCell.font = { bold: true, size: 11 };
  totalValueCell.alignment = { horizontal: 'right', vertical: 'middle' };
  for (let col = reportLeftCol; col <= reportRightCol; col += 1) {
    applyThinBorder(sheet.getCell(totalRowIndex, col));
  }
  sheet.getRow(totalRowIndex).height = 22;

  const signatureRowIndex = totalRowIndex + 1;

  const signatureEndRow = signatureRowIndex + 2;
  const signatureDividerCol = 8;

  sheet.mergeCells(`A${signatureRowIndex}:H${signatureEndRow}`);
  sheet.mergeCells(`I${signatureRowIndex}:Q${signatureEndRow}`);

  const claimedCell = sheet.getCell(`A${signatureRowIndex}`);
  claimedCell.value = 'Claimed by & Signature';
  claimedCell.font = { bold: true, size: 11 };
  claimedCell.alignment = { horizontal: 'center', vertical: 'top' };

  const approvedCell = sheet.getCell(`I${signatureRowIndex}`);
  approvedCell.value = 'Approved by & Signature';
  approvedCell.font = { bold: true, size: 11 };
  approvedCell.alignment = { horizontal: 'center', vertical: 'top' };

  for (let row = signatureRowIndex; row <= signatureEndRow; row += 1) {
    sheet.getRow(row).height = 24;
  }

  applySectionEnvelope(
    sheet,
    logoStartRow,
    logoEndRow,
    reportLeftCol,
    reportRightCol,
  );
  applySectionEnvelope(sheet, titleRow, titleRow, reportLeftCol, reportRightCol);
  applySectionEnvelope(
    sheet,
    signatureRowIndex,
    signatureEndRow,
    reportLeftCol,
    signatureDividerCol,
  );
  applySectionEnvelope(
    sheet,
    signatureRowIndex,
    signatureEndRow,
    signatureDividerCol + 1,
    reportRightCol,
  );
  applySignatureDivider(sheet, signatureRowIndex, signatureEndRow, signatureDividerCol);

  applyOuterFrameMedium(
    sheet,
    logoStartRow,
    signatureEndRow,
    reportLeftCol,
    reportRightCol,
  );

  const MIN_COL_WIDTH = 5;
  const MAX_COL_WIDTH = 12;
  for (let colIndex = 1; colIndex <= COL_COUNT; colIndex += 1) {
    const headerText = String(EXPORT_COLUMNS[colIndex - 1] || '');
    let contentWidth = longestSegment(headerText, /\s+/);
    for (let rowIndex = headerRowIndex + 1; rowIndex < dataEndRowIndex; rowIndex += 1) {
      const cell = sheet.getCell(rowIndex, colIndex);
      const value = cell.value == null ? '' : String(cell.value);
      const wordWidth = longestSegment(value, /\s+/);
      if (wordWidth > contentWidth) contentWidth = wordWidth;
    }
    const minWidth = colIndex === COL_COUNT ? 11 : MIN_COL_WIDTH;
    const width = Math.max(minWidth, Math.min(MAX_COL_WIDTH, contentWidth + 1));
    sheet.getColumn(colIndex).width = width;
  }

  for (let rowIndex = headerRowIndex; rowIndex < signatureRowIndex; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    if (rowIndex >= dataEndRowIndex) {
      row.height = 22;
      continue;
    }
    let maxLines = rowIndex === headerRowIndex ? 2 : 1;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.alignment = {
        ...(cell.alignment || {}),
        wrapText: true,
        vertical: 'middle',
      };
      const text = cell.value == null ? '' : String(cell.value);
      if (!text) return;
      const colWidth = Math.max(4, Number(sheet.getColumn(colNumber).width ?? 10) - 1);
      const wrappedLines = text
        .split('\n')
        .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / colWidth)), 0);
      if (wrappedLines > maxLines) maxLines = wrappedLines;
    });
    row.height = Math.max(18, Math.min(72, maxLines * 15));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `SPPL-Expenses-${context.employeeName.replace(/\s+/g, '-')}-${context.monthLabel}-${context.yearLabel}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
