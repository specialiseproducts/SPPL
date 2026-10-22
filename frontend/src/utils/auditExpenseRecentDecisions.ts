import type { ExpenseAuditDecision, ExpenseRecord } from '../types/expenses';

/**
 * In-memory overlay for recently approved/rejected expenses.
 * Prevents Audit Expenses from briefly (or stuck) showing Pending when:
 * - React Query / Map cache is stale, or
 * - DynamoDB GSI reads are eventually consistent right after write.
 */
const recentDecisions = new Map<string, Exclude<ExpenseAuditDecision, 'Pending'>>();

export function rememberAuditExpenseDecision(
  expenseId: string,
  decision: Exclude<ExpenseAuditDecision, 'Pending'>,
): void {
  const id = String(expenseId || '').trim();
  if (!id) return;
  recentDecisions.set(id, decision);
}

export function applyRecentAuditDecisions(rows: ExpenseRecord[]): ExpenseRecord[] {
  if (recentDecisions.size === 0) return rows;
  return rows.map((row) => {
    const id = String(row?.expenseId || '').trim();
    const decision = id ? recentDecisions.get(id) : undefined;
    if (!decision) return row;
    if (row.auditStatus === decision) return row;
    return { ...row, auditStatus: decision };
  });
}

/** Drop overlay entries once the server-normalized rows confirm the decision. */
export function reconcileRecentAuditDecisions(rows: ExpenseRecord[]): void {
  if (recentDecisions.size === 0) return;
  for (const row of rows) {
    const id = String(row?.expenseId || '').trim();
    if (!id) continue;
    const decision = recentDecisions.get(id);
    if (decision && row.auditStatus === decision) {
      recentDecisions.delete(id);
    }
  }
}
