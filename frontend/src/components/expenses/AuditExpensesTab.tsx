/**
 * Audit-oriented expenses view (Admin tab 2).
 * UI-only: replace MOCK_AUDIT_ROWS and wire to GET /api/expenses/audit (or similar) when backend exists.
 * Future: OCR pipeline — hook "Check" action to POST /api/expenses/:id/ocr or queue job.
 * Future: document preview — open signed URL in Sheet/Dialog from row.documentUrl.
 * Future: audit history — timeline drawer fed by GET /api/expenses/:id/audit-log.
 */

import { useMemo, useState } from 'react';
import { Search, FileText, History } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ExpenseAuditStatusBadge, type ExpenseAuditStatusKind } from './expenseAuditStatusBadge';

export interface AuditExpenseRow {
  id: string;
  employeeName: string;
  expenseHead: string;
  subCategory: string;
  amount: number;
  date: string;
  documentLabel: string;
  auditStatus: ExpenseAuditStatusKind;
  ocrStatus: ExpenseAuditStatusKind;
  verificationStatus: ExpenseAuditStatusKind;
  finalApprovalStatus: ExpenseAuditStatusKind;
}

const MOCK_AUDIT_ROWS: AuditExpenseRow[] = [
  {
    id: 'mock-1',
    employeeName: 'Asha Menon',
    expenseHead: 'Travel',
    subCategory: 'Car',
    amount: 4200,
    date: '2026-04-12',
    documentLabel: 'receipt-001.pdf',
    auditStatus: 'Pending',
    ocrStatus: 'Pending',
    verificationStatus: 'Pending',
    finalApprovalStatus: 'Pending',
  },
  {
    id: 'mock-2',
    employeeName: 'Rahul Verma',
    expenseHead: 'Hotel_Booking',
    subCategory: 'Self',
    amount: 11800,
    date: '2026-04-10',
    documentLabel: 'hotel-invoice.png',
    auditStatus: 'Checked',
    ocrStatus: 'Checked',
    verificationStatus: 'Verified',
    finalApprovalStatus: 'Pending',
  },
  {
    id: 'mock-3',
    employeeName: 'Neha Kapoor',
    expenseHead: 'Meals',
    subCategory: '—',
    amount: 890,
    date: '2026-04-08',
    documentLabel: 'meal.jpg',
    auditStatus: 'Checked',
    ocrStatus: 'Pending',
    verificationStatus: 'Pending',
    finalApprovalStatus: 'Rejected',
  },
];

function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}

export default function AuditExpensesTab() {
  const [search, setSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return MOCK_AUDIT_ROWS.filter((row) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const hay = [
          row.employeeName,
          row.expenseHead,
          row.subCategory,
          row.documentLabel,
          row.date,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (auditFilter !== 'all' && row.auditStatus !== auditFilter) return false;
      if (approvalFilter !== 'all' && row.finalApprovalStatus !== approvalFilter) return false;
      return true;
    });
  }, [search, auditFilter, approvalFilter]);

  const onCheck = (row: AuditExpenseRow) => {
    // Future OCR: trigger scan / AI audit job for row.id
    toast.info(`OCR / AI audit (placeholder) for ${row.employeeName} — expense ${row.id}`);
  };

  const onVerify = (row: AuditExpenseRow) => {
    toast.message(`Manual verification (placeholder) — ${row.employeeName}`, {
      description: 'Backend verification workflow not wired yet.',
    });
  };

  const onApprove = (row: AuditExpenseRow) => {
    toast.success(`Approve (placeholder) — ${row.employeeName}`);
  };

  const onReject = (row: AuditExpenseRow) => {
    toast.error(`Reject (placeholder) — ${row.employeeName}`);
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h2 className="text-[#212529] text-lg font-semibold">Audit Expenses</h2>
          <p className="text-sm text-gray-600 mt-1">
            Cross-employee audit queue — UI preview. Connect APIs when audit/OCR services are ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1 text-gray-600" disabled>
            <History className="w-4 h-4" />
            Audit history
            <span className="text-xs text-gray-400">(soon)</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm text-gray-700">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Employee, head, document, date…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Audit status</label>
          <Select value={auditFilter} onValueChange={setAuditFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Checked">Checked</SelectItem>
              <SelectItem value="Verified">Verified</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Final approval</label>
          <Select value={approvalFilter} onValueChange={setApprovalFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap w-12">Sr. #</TableHead>
                <TableHead className="whitespace-nowrap">Employee Name</TableHead>
                <TableHead className="whitespace-nowrap">Expense Head</TableHead>
                <TableHead className="whitespace-nowrap">Sub Category</TableHead>
                <TableHead className="whitespace-nowrap text-right">Amount</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">Document</TableHead>
                <TableHead className="whitespace-nowrap">Audit Status</TableHead>
                <TableHead className="whitespace-nowrap">OCR Status</TableHead>
                <TableHead className="whitespace-nowrap">Verification Status</TableHead>
                <TableHead className="whitespace-nowrap">Final Approval</TableHead>
                <TableHead className="whitespace-nowrap min-w-[280px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-gray-500 py-10">
                    No rows match filters (mock data).
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row, i) => (
                  <TableRow key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{row.employeeName}</TableCell>
                    <TableCell>{row.expenseHead}</TableCell>
                    <TableCell>{row.subCategory}</TableCell>
                    <TableCell className="text-right tabular-nums">₹ {formatAmount(row.amount)}</TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[#007BFF] hover:underline text-sm"
                        onClick={() =>
                          toast.message('Document preview', {
                            description: `Placeholder open for ${row.documentLabel} — wire signed URL + viewer.`,
                          })
                        }
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        {row.documentLabel}
                      </button>
                    </TableCell>
                    <TableCell>
                      <ExpenseAuditStatusBadge label={row.auditStatus} />
                    </TableCell>
                    <TableCell>
                      <ExpenseAuditStatusBadge label={row.ocrStatus} />
                    </TableCell>
                    <TableCell>
                      <ExpenseAuditStatusBadge label={row.verificationStatus} />
                    </TableCell>
                    <TableCell>
                      <ExpenseAuditStatusBadge label={row.finalApprovalStatus} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="bg-sky-100 text-sky-900 hover:bg-sky-200 border border-sky-200"
                          onClick={() => onCheck(row)}
                        >
                          Check
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => onVerify(row)}>
                          Verify
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                          onClick={() => onApprove(row)}
                        >
                          Approve
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => onReject(row)}>
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}
