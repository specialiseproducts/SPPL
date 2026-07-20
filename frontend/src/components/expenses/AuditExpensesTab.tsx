import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import type { ExpenseRecord } from '../../types/expenses';
import {
  clearAuditExpenseViewState,
  navigateToAuditExpenseDetail,
  peekAuditExpenseViewState,
  saveAuditExpenseViewState,
} from '../../utils/auditExpenseNavigation';
import {
  approveExpenseAudit,
  rejectExpenseAudit,
  type AuditExpenseFilters,
} from '../../hooks/expenses/expensesApi';
import {
  fetchNextAuditFilteredPage,
  useAuditExpenseEmployeesQuery,
  useAuditExpensesFilteredQuery,
  useInvalidateExpensesList,
} from '../../hooks/expenses/useExpensesQueries';
import { expensesQueryKeys } from '../../hooks/expenses/expensesQueryKeys';
import { isQueryColdLoading } from '../../utils/queryLoading';

const MONTH_FILTER_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => (2020 + i).toString());

function displayCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

function formatDateCell(iso: string | undefined): string {
  if (!iso || String(iso).trim() === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return displayCell(iso);
  return d.toLocaleDateString('en-GB');
}

const approvedActionBadgeStyle = {
  background: '#ECFDF3',
  color: '#027A48',
  borderRadius: '9999px',
  padding: '4px 12px',
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
} as const;

const rejectedActionBadgeStyle = {
  background: '#FEF3F2',
  color: '#B42318',
  borderRadius: '9999px',
  padding: '4px 12px',
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
} as const;

export default function AuditExpensesTab() {
  const queryClient = useQueryClient();
  const employeesQuery = useAuditExpenseEmployeesQuery();
  const invalidateExpenses = useInvalidateExpensesList();

  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ExpenseRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const employees = employeesQuery.data ?? [];

  const activeFilters = useMemo<AuditExpenseFilters>(
    () => ({
      employeeId: selectedEmployee,
      month: selectedMonth,
      year: selectedYear,
    }),
    [selectedEmployee, selectedMonth, selectedYear],
  );

  const auditQuery = useAuditExpensesFilteredQuery(activeFilters, filtersApplied);

  const expenses = auditQuery.data?.pages ?? [];
  const nextCursor = auditQuery.data?.nextCursor ?? null;

  const markFiltersApplied = useCallback(() => {
    setFiltersApplied(true);
  }, []);

  const handleEmployeeChange = useCallback(
    (value: string) => {
      setSelectedEmployee(value);
      markFiltersApplied();
    },
    [markFiltersApplied],
  );

  const handleMonthChange = useCallback(
    (value: string) => {
      setSelectedMonth(value);
      markFiltersApplied();
    },
    [markFiltersApplied],
  );

  const handleYearChange = useCallback(
    (value: string) => {
      setSelectedYear(value);
      markFiltersApplied();
    },
    [markFiltersApplied],
  );

  useEffect(() => {
    const saved = peekAuditExpenseViewState();
    if (!saved) return;

    setSelectedEmployee(saved.employee);
    setSelectedMonth(saved.month);
    setSelectedYear(saved.year);
    if (saved.filtersApplied) {
      setFiltersApplied(true);
    }

    clearAuditExpenseViewState();

    if (typeof saved.scrollY === 'number' && saved.scrollY > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, saved.scrollY ?? 0);
      });
    }
  }, []);

  useEffect(() => {
    if (auditQuery.isError) {
      toast.error('Failed to load audit expenses');
    }
  }, [auditQuery.isError]);

  const approveMutation = useMutation({
    mutationFn: (expenseId: string) => approveExpenseAudit(expenseId),
    onSuccess: () => {
      invalidateExpenses();
      toast.success('Expense approved');
    },
    onError: (error) => {
      console.error('Approve Expense Error:', error);
      toast.error('Could not approve this expense');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ expenseId, reason }: { expenseId: string; reason: string }) =>
      rejectExpenseAudit(expenseId, reason),
    onSuccess: () => {
      invalidateExpenses();
      setRejectTarget(null);
      setRejectReason('');
      toast.success('Expense rejected');
    },
    onError: (error) => {
      console.error('Reject Expense Error:', error);
      toast.error('Could not reject this expense');
    },
  });

  const isLoading = filtersApplied && isQueryColdLoading(auditQuery);
  const showPromptState = !filtersApplied;
  const showEmptyState =
    filtersApplied && !isLoading && !auditQuery.isError && expenses.length === 0;

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const updated = await fetchNextAuditFilteredPage(activeFilters, nextCursor);
      queryClient.setQueryData(expensesQueryKeys.auditFiltered(activeFilters), updated);
    } catch {
      toast.error('Failed to load more records');
    } finally {
      setLoadingMore(false);
    }
  }, [activeFilters, loadingMore, nextCursor, queryClient]);

  const openRejectDialog = (expense: ExpenseRecord) => {
    setRejectReason('');
    setRejectTarget(expense);
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    rejectMutation.mutate({
      expenseId: rejectTarget.expenseId,
      reason: rejectReason,
    });
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-[#212529] text-lg font-semibold">Audit Expenses</h2>
        <p className="text-sm text-gray-600 mt-1">
          Review and approve employee expense submissions organization-wide.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Employee Name</label>
          <Select value={selectedEmployee} onValueChange={handleEmployeeChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((user) => {
                const code = user.employee_code || user.employeeCode || user.name;
                return (
                  <SelectItem key={code} value={code}>
                    {user.name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Month</label>
          <Select value={selectedMonth} onValueChange={handleMonthChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {MONTH_FILTER_OPTIONS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Year</label>
          <Select value={selectedYear} onValueChange={handleYearChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {YEAR_OPTIONS.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap">Employee Name</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">Bill Number</TableHead>
                <TableHead className="whitespace-nowrap">Amount</TableHead>
                <TableHead className="whitespace-nowrap">Supporting Doc.</TableHead>
                <TableHead className="whitespace-nowrap">Month-Year</TableHead>
                <TableHead className="whitespace-nowrap min-w-[220px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showPromptState ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-10">
                    No records selected.
                    <br />
                    Please choose filters to view expenses.
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-10">
                    Loading expense records…
                  </TableCell>
                </TableRow>
              ) : showEmptyState ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-10">
                    No expense records found
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense, index) => {
                  const status = expense.auditStatus ?? 'Pending';
                  const isPending = status === 'Pending';
                  const openExpenseDetail = () => {
                    saveAuditExpenseViewState({
                      activeTab: 'audit',
                      employee: selectedEmployee,
                      month: selectedMonth,
                      year: selectedYear,
                      filtersApplied,
                      scrollY: window.scrollY,
                    });
                    navigateToAuditExpenseDetail(expense.expenseId);
                  };
                  const eyeButton = (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={openExpenseDetail}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Eye
                    </Button>
                  );
                  return (
                    <TableRow
                      key={expense.expenseId}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'}
                    >
                      <TableCell className="font-medium">{displayCell(expense.employeeName)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateCell(expense.date)}</TableCell>
                      <TableCell>{displayCell(expense.billNumber)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        ₹{expense.amount.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>{displayCell(expense.supportingDocument)}</TableCell>
                      <TableCell className="whitespace-nowrap">{displayCell(expense.monthYear)}</TableCell>
                      <TableCell>
                        {isPending ? (
                          <div className="flex flex-wrap gap-1.5">
                            {eyeButton}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(expense.expenseId)}
                            >
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={rejectMutation.isPending}
                              onClick={() => openRejectDialog(expense)}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : status === 'Approved' ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {eyeButton}
                            <span style={approvedActionBadgeStyle}>Approved</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {eyeButton}
                            <span style={rejectedActionBadgeStyle}>Rejected</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {filtersApplied && nextCursor && !isLoading && (
          <div className="flex justify-end border-t px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={() => void handleLoadMore()}
            >
              {loadingMore ? 'Loading…' : 'Load more expenses'}
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={rejectTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Reason (Optional)</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Optional rejection reason"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={confirmReject}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
