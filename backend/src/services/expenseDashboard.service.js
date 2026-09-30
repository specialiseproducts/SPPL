/**
 * Expenses Admin Dashboard — Company Overview analytics (Super Admin).
 * Isolated from CRUD / audit / export flows.
 */

import * as ExpenseModel from '../models/Expenses.js';
import {
  isApprovedExpense,
  monthYearSortKey,
} from '../constants/expenseExportStatus.js';
import log from '../utils/logger.js';

const MONTH_LABELS = [
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

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Latest 12 calendar months including the current UTC month, oldest → newest.
 * Format matches Expenses.monthYear: MM-YYYY
 */
export function buildLatestTwelveMonthYears(reference = new Date()) {
  let year = reference.getUTCFullYear();
  let month = reference.getUTCMonth() + 1;
  const newestFirst = [];
  for (let i = 0; i < 12; i += 1) {
    newestFirst.push(`${String(month).padStart(2, '0')}-${year}`);
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return newestFirst.reverse();
}

/**
 * Parse API period param as YYYY-MM → internal MM-YYYY + sort key.
 * @returns {{ yyyyMm: string, monthYear: string, sortKey: number } | null}
 */
export function parseYearMonthParam(value) {
  const raw = String(value ?? '').trim();
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  const monthYear = `${String(month).padStart(2, '0')}-${year}`;
  const sortKey = monthYearSortKey(monthYear);
  if (sortKey == null) return null;
  return {
    yyyyMm: `${year}-${String(month).padStart(2, '0')}`,
    monthYear,
    sortKey,
  };
}

/**
 * Inclusive calendar-month range as MM-YYYY, oldest → newest.
 */
export function buildMonthRangeInclusive(fromMonthYear, toMonthYear) {
  const startKey = monthYearSortKey(fromMonthYear);
  const endKey = monthYearSortKey(toMonthYear);
  if (startKey == null || endKey == null || startKey > endKey) {
    return null;
  }

  let year = Math.floor(startKey / 100);
  let month = startKey % 100;
  const months = [];
  while (year * 100 + month <= endKey) {
    months.push(`${String(month).padStart(2, '0')}-${year}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function monthYearLabel(monthYear, short = false) {
  const key = monthYearSortKey(monthYear);
  if (key == null) return String(monthYear || '').trim() || 'Unknown';
  const y = Math.floor(key / 100);
  const m = key % 100;
  const names = short ? MONTH_SHORT : MONTH_LABELS;
  return `${names[m - 1]} ${y}`;
}

function resolveExpenseMonthYear(row) {
  const existing = String(row?.monthYear ?? '').trim();
  if (existing && monthYearSortKey(existing) != null) {
    return existing;
  }
  const rawDate = String(row?.date ?? '').trim();
  if (!rawDate) return '';
  const dateObj = new Date(rawDate);
  if (Number.isNaN(dateObj.getTime())) return '';
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const year = String(dateObj.getUTCFullYear());
  return `${month}-${year}`;
}

/** Stable employee identifier used across Expenses (matches audit filter convention). */
function resolveExpenseEmployeeCode(row) {
  return String(row?.created_by_employee_code || row?.employeeId || '').trim();
}

function resolveExpenseEmployeeName(row) {
  const fromName = String(row?.employeeName ?? '').trim();
  if (fromName) return fromName;
  const fromCreated = String(row?.created_by_name ?? '').trim();
  if (fromCreated) return fromCreated;
  return resolveExpenseEmployeeCode(row) || 'Unknown';
}

/**
 * Parse optional employeeCode query param. Empty = all employees.
 * @returns {{ ok: true, employeeCode: string } | { ok: false, statusCode: number, message: string }}
 */
export function parseEmployeeCodeParam(value) {
  if (value == null || String(value).trim() === '') {
    return { ok: true, employeeCode: '' };
  }
  const employeeCode = String(value).trim();
  if (employeeCode.length > 64) {
    return {
      ok: false,
      statusCode: 400,
      message: 'employeeCode is too long.',
    };
  }
  return { ok: true, employeeCode };
}

function matchesEmployeeFilter(row, employeeCode) {
  if (!employeeCode) return true;
  return resolveExpenseEmployeeCode(row) === employeeCode;
}

function resolveExpenseLocationLabel(row) {
  return String(row?.location ?? '').trim() || 'Not Specified';
}

function resolveExpensePurposeLabel(row) {
  return String(row?.purpose ?? '').trim() || 'Not Specified';
}

/**
 * Parse optional location query param. Empty = all locations.
 * @returns {{ ok: true, location: string } | { ok: false, statusCode: number, message: string }}
 */
export function parseLocationParam(value) {
  if (value == null || String(value).trim() === '') {
    return { ok: true, location: '' };
  }
  const location = String(value).trim();
  if (location.length > 120) {
    return {
      ok: false,
      statusCode: 400,
      message: 'location is too long.',
    };
  }
  return { ok: true, location };
}

/** Previous calendar month as MM-YYYY. */
export function previousCalendarMonthYear(monthYear) {
  const key = monthYearSortKey(monthYear);
  if (key == null) return null;
  let year = Math.floor(key / 100);
  let month = key % 100;
  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${String(month).padStart(2, '0')}-${year}`;
}

function matchesLocationFilter(row, location) {
  if (!location) return true;
  return resolveExpenseLocationLabel(row) === location;
}

function safeAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function roundPercent(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Resolve analysis months from optional from/to (YYYY-MM).
 * Defaults to latest 12 calendar months when both omitted.
 */
export function resolveCompanyOverviewMonths({ from, to } = {}) {
  const hasFrom = from != null && String(from).trim() !== '';
  const hasTo = to != null && String(to).trim() !== '';

  if (!hasFrom && !hasTo) {
    const months = buildLatestTwelveMonthYears(new Date());
    return { ok: true, months };
  }

  if (!hasFrom || !hasTo) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Both from and to query parameters are required (YYYY-MM).',
    };
  }

  const fromParsed = parseYearMonthParam(from);
  const toParsed = parseYearMonthParam(to);
  if (!fromParsed || !toParsed) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Invalid from/to. Use YYYY-MM (e.g. 2026-01).',
    };
  }

  if (fromParsed.sortKey > toParsed.sortKey) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Invalid range: from must be less than or equal to to.',
    };
  }

  const months = buildMonthRangeInclusive(fromParsed.monthYear, toParsed.monthYear);
  if (!months || months.length === 0) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Invalid analysis period.',
    };
  }

  // Guard against unbounded scans in aggregation loops
  if (months.length > 120) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Analysis period cannot exceed 120 months.',
    };
  }

  return { ok: true, months };
}

/**
 * Aggregate Approved + non-deleted expenses for the selected month range.
 * Single scan + single in-memory pass.
 * Optional location scopes Location Analysis; MoM + waterfall use previous calendar month.
 *
 * @param {{ from?: string, to?: string, employeeCode?: string, location?: string }} [params]
 */
export async function getCompanyOverview(params = {}) {
  const resolved = resolveCompanyOverviewMonths(params);
  if (!resolved.ok) {
    const err = new Error(resolved.message);
    err.statusCode = resolved.statusCode;
    throw err;
  }

  const employeeParsed = parseEmployeeCodeParam(params.employeeCode);
  if (!employeeParsed.ok) {
    const err = new Error(employeeParsed.message);
    err.statusCode = employeeParsed.statusCode;
    throw err;
  }
  const employeeCode = employeeParsed.employeeCode;

  const locationParsed = parseLocationParam(params.location);
  if (!locationParsed.ok) {
    const err = new Error(locationParsed.message);
    err.statusCode = locationParsed.statusCode;
    throw err;
  }
  const locationFilter = locationParsed.location;

  const months = resolved.months;
  const monthSet = new Set(months);
  const startMonthYear = months[0];
  const endMonthYear = months[months.length - 1];
  const monthCount = months.length;
  const prevMonthYear = previousCalendarMonthYear(endMonthYear);

  const rows = await ExpenseModel.scanExpensesForCompanyOverview();

  const monthlyTotals = Object.fromEntries(months.map((m) => [m, 0]));
  const headTotals = new Map();
  const providerTotals = new Map();
  const employeeTotals = new Map();
  const locationTotals = new Map();
  const purposeTotals = new Map();
  const prevHeadTotals = new Map();
  let totalExpenses = 0;
  let includedCount = 0;
  let previousMonthTotal = 0;

  for (const row of rows) {
    if (!matchesEmployeeFilter(row, employeeCode)) continue;
    if (!isApprovedExpense(row)) continue;
    if (!matchesLocationFilter(row, locationFilter)) continue;

    const monthYear = resolveExpenseMonthYear(row);
    if (!monthYear) continue;

    const amount = safeAmount(row.amount);
    const head = String(row.expenseHead ?? '').trim() || 'Unknown';

    // Previous calendar month (may be outside From/To) — for MoM / waterfall.
    if (prevMonthYear && monthYear === prevMonthYear) {
      previousMonthTotal = roundMoney(previousMonthTotal + amount);
      if (monthCount === 1) {
        prevHeadTotals.set(head, roundMoney((prevHeadTotals.get(head) || 0) + amount));
      }
    }

    if (!monthSet.has(monthYear)) continue;

    totalExpenses = roundMoney(totalExpenses + amount);
    monthlyTotals[monthYear] = roundMoney(monthlyTotals[monthYear] + amount);
    includedCount += 1;

    headTotals.set(head, roundMoney((headTotals.get(head) || 0) + amount));

    const provider = String(row.serviceProvider ?? '').trim() || 'Not Specified';
    providerTotals.set(provider, roundMoney((providerTotals.get(provider) || 0) + amount));

    const empCode = resolveExpenseEmployeeCode(row);
    if (empCode) {
      const empName = resolveExpenseEmployeeName(row);
      const existing = employeeTotals.get(empCode);
      if (!existing) {
        employeeTotals.set(empCode, {
          employeeCode: empCode,
          employeeName: empName,
          amount,
        });
      } else {
        existing.amount = roundMoney(existing.amount + amount);
        if (
          existing.employeeName === empCode &&
          empName &&
          empName !== empCode
        ) {
          existing.employeeName = empName;
        }
      }
    }

    if (!locationFilter) {
      const location = resolveExpenseLocationLabel(row);
      locationTotals.set(location, roundMoney((locationTotals.get(location) || 0) + amount));
    }

    if (locationFilter) {
      const purpose = resolveExpensePurposeLabel(row);
      purposeTotals.set(purpose, roundMoney((purposeTotals.get(purpose) || 0) + amount));
    }
  }

  const monthlyTrend = months.map((monthYear) => ({
    monthYear,
    label: monthYearLabel(monthYear, true),
    amount: monthlyTotals[monthYear] || 0,
  }));

  let highestExpenseMonth = null;
  for (const point of monthlyTrend) {
    if (
      !highestExpenseMonth ||
      point.amount > highestExpenseMonth.amount ||
      (point.amount === highestExpenseMonth.amount &&
        monthYearSortKey(point.monthYear) > monthYearSortKey(highestExpenseMonth.monthYear))
    ) {
      highestExpenseMonth = {
        monthYear: point.monthYear,
        label: monthYearLabel(point.monthYear, false),
        amount: point.amount,
      };
    }
  }
  if (!highestExpenseMonth || highestExpenseMonth.amount <= 0) {
    highestExpenseMonth = null;
  }

  const expenseHeads = [...headTotals.entries()]
    .map(([expenseHead, amount]) => ({
      expenseHead,
      amount,
      percentage:
        totalExpenses > 0 ? roundPercent((amount / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.expenseHead.localeCompare(b.expenseHead);
    });

  const serviceProviders = [...providerTotals.entries()]
    .map(([serviceProvider, amount]) => ({
      serviceProvider,
      amount,
      percentage:
        totalExpenses > 0 ? roundPercent((amount / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.serviceProvider.localeCompare(b.serviceProvider);
    });

  const employeesByExpense = [...employeeTotals.values()]
    .map((row) => ({
      employeeCode: row.employeeCode,
      employeeName: row.employeeName,
      amount: row.amount,
      percentage:
        totalExpenses > 0 ? roundPercent((row.amount / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.employeeName.localeCompare(b.employeeName);
    });

  const locations = [...locationTotals.entries()]
    .map(([location, amount]) => ({
      location,
      amount,
      percentage:
        totalExpenses > 0 ? roundPercent((amount / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.location.localeCompare(b.location);
    });

  let purposes = [];
  if (locationFilter) {
    const purposeRows = [...purposeTotals.entries()]
      .map(([purpose, amount]) => ({ purpose, amount }))
      .sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return a.purpose.localeCompare(b.purpose);
      });
    let running = 0;
    purposes = purposeRows.map((row) => {
      running = roundMoney(running + row.amount);
      return {
        purpose: row.purpose,
        amount: row.amount,
        percentage:
          totalExpenses > 0 ? roundPercent((row.amount / totalExpenses) * 100) : 0,
        cumulativeAmount: running,
        cumulativePercent:
          totalExpenses > 0 ? roundPercent((running / totalExpenses) * 100) : 0,
      };
    });
  }

  const highestExpenseHead =
    expenseHeads.length > 0 && expenseHeads[0].amount > 0
      ? {
          expenseHead: expenseHeads[0].expenseHead,
          amount: expenseHeads[0].amount,
        }
      : null;

  const averageMonthlyExpense =
    monthCount > 0 ? roundMoney(totalExpenses / monthCount) : 0;

  const latestMonthAmount = monthlyTotals[endMonthYear] || 0;
  let momChange = null;
  if (prevMonthYear) {
    const percent =
      previousMonthTotal > 0
        ? roundPercent(((latestMonthAmount - previousMonthTotal) / previousMonthTotal) * 100)
        : null;
    momChange = {
      percent,
      latestMonthYear: endMonthYear,
      latestMonthLabel: monthYearLabel(endMonthYear, true),
      previousMonthYear: prevMonthYear,
      previousMonthLabel: monthYearLabel(prevMonthYear, true),
      latestAmount: latestMonthAmount,
      previousAmount: previousMonthTotal,
    };
  }

  let waterfall = null;
  if (monthCount === 1 && prevMonthYear) {
    const headKeys = new Set([...headTotals.keys(), ...prevHeadTotals.keys()]);
    const contributions = [...headKeys]
      .map((expenseHead) => {
        const currentAmount = headTotals.get(expenseHead) || 0;
        const previousAmount = prevHeadTotals.get(expenseHead) || 0;
        return {
          expenseHead,
          change: roundMoney(currentAmount - previousAmount),
          currentAmount,
          previousAmount,
        };
      })
      .filter((row) => row.change !== 0 || row.currentAmount > 0 || row.previousAmount > 0)
      .sort((a, b) => {
        const absDiff = Math.abs(b.change) - Math.abs(a.change);
        if (absDiff !== 0) return absDiff;
        return a.expenseHead.localeCompare(b.expenseHead);
      });

    waterfall = {
      previousMonthYear: prevMonthYear,
      previousMonthLabel: monthYearLabel(prevMonthYear, false),
      currentMonthYear: endMonthYear,
      currentMonthLabel: monthYearLabel(endMonthYear, false),
      previousMonthTotal,
      currentMonthTotal: totalExpenses,
      contributions,
    };
  }

  const periodLabel = locationFilter
    ? `${monthYearLabel(startMonthYear, true)} – ${monthYearLabel(endMonthYear, true)}`
    : `${monthYearLabel(startMonthYear, true)} – ${monthYearLabel(endMonthYear, true)}`;

  const toYyyyMm = (monthYear) => {
    const key = monthYearSortKey(monthYear);
    if (key == null) return '';
    const y = Math.floor(key / 100);
    const m = key % 100;
    return `${y}-${String(m).padStart(2, '0')}`;
  };

  log.info('Company overview analytics aggregated', {
    months: monthCount,
    includedCount,
    totalExpenses,
    headCount: expenseHeads.length,
    providerCount: serviceProviders.length,
    employeeCount: employeesByExpense.length,
    locationCount: locations.length,
    purposeCount: purposes.length,
    from: startMonthYear,
    to: endMonthYear,
    employeeCode: employeeCode || null,
    location: locationFilter || null,
  });

  return {
    period: {
      start: startMonthYear,
      end: endMonthYear,
      label: periodLabel,
      months,
      monthCount,
      from: toYyyyMm(startMonthYear),
      to: toYyyyMm(endMonthYear),
    },
    employeeCode: employeeCode || null,
    location: locationFilter || null,
    kpis: {
      totalExpenses,
      highestExpenseMonth,
      highestExpenseHead,
      averageMonthlyExpense,
      momChange,
    },
    monthlyTrend,
    expenseHeads,
    serviceProviders,
    employeesByExpense,
    locations,
    purposes,
    waterfall,
  };
}

/**
 * Phase 2B — Month + Expense Head analysis.
 * Approved + non-deleted only; single scan + single in-memory pass.
 * Aggregates subcategory totals for the selected head within the period.
 *
 * @param {{ from?: string, to?: string, expenseHead?: string, employeeCode?: string, location?: string }} params
 */
export async function getExpenseHeadAnalysis(params = {}) {
  const resolved = resolveCompanyOverviewMonths({
    from: params.from,
    to: params.to,
  });
  if (!resolved.ok) {
    const err = new Error(resolved.message);
    err.statusCode = resolved.statusCode;
    throw err;
  }

  const employeeParsed = parseEmployeeCodeParam(params.employeeCode);
  if (!employeeParsed.ok) {
    const err = new Error(employeeParsed.message);
    err.statusCode = employeeParsed.statusCode;
    throw err;
  }
  const employeeCode = employeeParsed.employeeCode;

  const locationParsed = parseLocationParam(params.location);
  if (!locationParsed.ok) {
    const err = new Error(locationParsed.message);
    err.statusCode = locationParsed.statusCode;
    throw err;
  }
  const locationFilter = locationParsed.location;

  const expenseHead = String(params.expenseHead ?? '').trim();
  if (!expenseHead) {
    const err = new Error('expenseHead query parameter is required.');
    err.statusCode = 400;
    throw err;
  }
  if (expenseHead.length > 120) {
    const err = new Error('expenseHead is too long.');
    err.statusCode = 400;
    throw err;
  }

  const months = resolved.months;
  const monthSet = new Set(months);
  const startMonthYear = months[0];
  const endMonthYear = months[months.length - 1];

  const rows = await ExpenseModel.scanExpensesForCompanyOverview();

  const subTotals = new Map();
  const subCounts = new Map();
  let totalExpenses = 0;
  let recordCount = 0;

  for (const row of rows) {
    if (!matchesEmployeeFilter(row, employeeCode)) continue;
    if (!matchesLocationFilter(row, locationFilter)) continue;
    if (!isApprovedExpense(row)) continue;
    const monthYear = resolveExpenseMonthYear(row);
    if (!monthYear || !monthSet.has(monthYear)) continue;

    const head = String(row.expenseHead ?? '').trim() || 'Unknown';
    if (head !== expenseHead) continue;

    const amount = safeAmount(row.amount);
    totalExpenses = roundMoney(totalExpenses + amount);
    recordCount += 1;

    const sub = String(row.subCategory ?? '').trim() || 'Unspecified';
    subTotals.set(sub, roundMoney((subTotals.get(sub) || 0) + amount));
    subCounts.set(sub, (subCounts.get(sub) || 0) + 1);
  }

  const subcategories = [...subTotals.entries()]
    .map(([subCategory, amount]) => ({
      subCategory,
      amount,
      count: subCounts.get(subCategory) || 0,
      percentage:
        totalExpenses > 0 ? roundPercent((amount / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.subCategory.localeCompare(b.subCategory);
    });

  const toYyyyMm = (monthYear) => {
    const key = monthYearSortKey(monthYear);
    if (key == null) return '';
    const y = Math.floor(key / 100);
    const m = key % 100;
    return `${y}-${String(m).padStart(2, '0')}`;
  };

  const periodLabel =
    months.length === 1
      ? monthYearLabel(startMonthYear, false)
      : `${monthYearLabel(startMonthYear, true)} – ${monthYearLabel(endMonthYear, true)}`;

  log.info('Expense head analytics aggregated', {
    expenseHead,
    months: months.length,
    recordCount,
    totalExpenses,
    subcategoryCount: subcategories.length,
    from: startMonthYear,
    to: endMonthYear,
    employeeCode: employeeCode || null,
    location: locationFilter || null,
  });

  return {
    period: {
      start: startMonthYear,
      end: endMonthYear,
      label: periodLabel,
      months,
      monthCount: months.length,
      from: toYyyyMm(startMonthYear),
      to: toYyyyMm(endMonthYear),
    },
    expenseHead,
    employeeCode: employeeCode || null,
    location: locationFilter || null,
    kpis: {
      totalExpenses,
      recordCount,
    },
    subcategories,
  };
}

function resolveSubCategoryLabel(row) {
  return String(row?.subCategory ?? '').trim() || 'Unspecified';
}

function formatTransactionDate(rawDate) {
  const s = String(rawDate ?? '').trim();
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB');
}

/**
 * Phase 2C — Month + Expense Head + Subcategory transaction details.
 * Approved + non-deleted only; single scan + single in-memory pass.
 *
 * @param {{ from?: string, to?: string, expenseHead?: string, subCategory?: string, employeeCode?: string, location?: string }} params
 */
export async function getExpenseSubcategoryAnalysis(params = {}) {
  const resolved = resolveCompanyOverviewMonths({
    from: params.from,
    to: params.to,
  });
  if (!resolved.ok) {
    const err = new Error(resolved.message);
    err.statusCode = resolved.statusCode;
    throw err;
  }

  const employeeParsed = parseEmployeeCodeParam(params.employeeCode);
  if (!employeeParsed.ok) {
    const err = new Error(employeeParsed.message);
    err.statusCode = employeeParsed.statusCode;
    throw err;
  }
  const employeeCode = employeeParsed.employeeCode;

  const locationParsed = parseLocationParam(params.location);
  if (!locationParsed.ok) {
    const err = new Error(locationParsed.message);
    err.statusCode = locationParsed.statusCode;
    throw err;
  }
  const locationFilter = locationParsed.location;

  const expenseHead = String(params.expenseHead ?? '').trim();
  if (!expenseHead) {
    const err = new Error('expenseHead query parameter is required.');
    err.statusCode = 400;
    throw err;
  }
  if (expenseHead.length > 120) {
    const err = new Error('expenseHead is too long.');
    err.statusCode = 400;
    throw err;
  }

  const subCategory = String(params.subCategory ?? '').trim();
  if (!subCategory) {
    const err = new Error('subCategory query parameter is required.');
    err.statusCode = 400;
    throw err;
  }
  if (subCategory.length > 120) {
    const err = new Error('subCategory is too long.');
    err.statusCode = 400;
    throw err;
  }

  const months = resolved.months;
  const monthSet = new Set(months);
  const startMonthYear = months[0];
  const endMonthYear = months[months.length - 1];

  const rows = await ExpenseModel.scanExpensesForCompanyOverview();

  const transactions = [];
  let totalExpenses = 0;

  for (const row of rows) {
    if (!matchesEmployeeFilter(row, employeeCode)) continue;
    if (!matchesLocationFilter(row, locationFilter)) continue;
    if (!isApprovedExpense(row)) continue;
    const monthYear = resolveExpenseMonthYear(row);
    if (!monthYear || !monthSet.has(monthYear)) continue;

    const head = String(row.expenseHead ?? '').trim() || 'Unknown';
    if (head !== expenseHead) continue;

    const sub = resolveSubCategoryLabel(row);
    if (sub !== subCategory) continue;

    const amount = safeAmount(row.amount);
    totalExpenses = roundMoney(totalExpenses + amount);

    const docs = Array.isArray(row.documents) ? row.documents : [];
    const firstDoc = docs.length > 0 ? docs[0] : null;
    const supportingRaw = String(row.supportingDocument ?? '').trim();
    const supportingDocument =
      supportingRaw ||
      (firstDoc?.fileUrl ? 'Yes' : docs.length > 0 ? 'Yes' : 'No');

    const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
    const numOrNull = (v) => {
      if (v === undefined || v === null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    transactions.push({
      expenseId: str(row.expenseId),
      date: str(row.date),
      dateLabel: formatTransactionDate(row.date),
      employeeName: str(row.employeeName || row.created_by_name),
      employeeId: str(row.employeeId || row.created_by_employee_code),
      expenseHead: head,
      subCategory: sub,
      outStation: str(row.outStation) || 'No',
      billNumber: str(row.billNumber),
      amount,
      serviceProvider: str(row.serviceProvider),
      purpose: str(row.purpose),
      location: str(row.location),
      pnrNo: str(row.pnrNo),
      fromLocation: str(row.fromLocation),
      toLocation: str(row.toLocation),
      returnType: str(row.returnType),
      kilometers: numOrNull(row.kilometers),
      stayDateFrom: str(row.stayDateFrom),
      stayDateTo: str(row.stayDateTo),
      fuelType: str(row.fuelType),
      arrivalDate: str(row.arrivalDate),
      arrivalTime: str(row.arrivalTime),
      departureDate: str(row.departureDate),
      departureTime: str(row.departureTime),
      durationHours: numOrNull(row.durationHours),
      durationDays: numOrNull(row.durationDays),
      travelAllowanceAmount: numOrNull(row.travelAllowanceAmount),
      supportingDocument,
      documentUrl: firstDoc?.fileUrl ? str(firstDoc.fileUrl) : '',
      documentFileName: firstDoc?.fileName ? str(firstDoc.fileName) : '',
      auditStatus: str(row.auditStatus || row.approval_status),
      monthYear,
    });
  }

  transactions.sort((a, b) => {
    const ta = Date.parse(a.date) || 0;
    const tb = Date.parse(b.date) || 0;
    if (tb !== ta) return tb - ta;
    return String(a.expenseId).localeCompare(String(b.expenseId));
  });

  const toYyyyMm = (monthYear) => {
    const key = monthYearSortKey(monthYear);
    if (key == null) return '';
    const y = Math.floor(key / 100);
    const m = key % 100;
    return `${y}-${String(m).padStart(2, '0')}`;
  };

  const periodLabel =
    months.length === 1
      ? monthYearLabel(startMonthYear, false)
      : `${monthYearLabel(startMonthYear, true)} – ${monthYearLabel(endMonthYear, true)}`;

  log.info('Expense subcategory analytics aggregated', {
    expenseHead,
    subCategory,
    months: months.length,
    recordCount: transactions.length,
    totalExpenses,
    from: startMonthYear,
    to: endMonthYear,
    employeeCode: employeeCode || null,
    location: locationFilter || null,
  });

  return {
    period: {
      start: startMonthYear,
      end: endMonthYear,
      label: periodLabel,
      months,
      monthCount: months.length,
      from: toYyyyMm(startMonthYear),
      to: toYyyyMm(endMonthYear),
    },
    expenseHead,
    subCategory,
    employeeCode: employeeCode || null,
    location: locationFilter || null,
    kpis: {
      totalExpenses,
      recordCount: transactions.length,
    },
    transactions,
  };
}

/**
 * Phase 2D — Distinct employees with at least one non-deleted expense record.
 * Any approval status qualifies for the dropdown; analytics still use Approved only.
 * Single scan + single in-memory pass.
 */
export async function getDashboardEmployees() {
  const rows = await ExpenseModel.scanExpensesForCompanyOverview();
  const byCode = new Map();

  for (const row of rows) {
    const employeeCode = resolveExpenseEmployeeCode(row);
    if (!employeeCode) continue;

    const employeeName = resolveExpenseEmployeeName(row);
    const existing = byCode.get(employeeCode);
    if (!existing) {
      byCode.set(employeeCode, { employeeCode, employeeName });
      continue;
    }
    // Prefer a real display name over a code fallback if a later row has one.
    if (
      existing.employeeName === employeeCode &&
      employeeName &&
      employeeName !== employeeCode
    ) {
      byCode.set(employeeCode, { employeeCode, employeeName });
    }
  }

  const employees = [...byCode.values()].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }),
  );

  log.info('Dashboard employee directory aggregated', {
    employeeCount: employees.length,
  });

  return { employees };
}
