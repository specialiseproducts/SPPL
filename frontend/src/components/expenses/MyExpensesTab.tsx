/**
 * Production expenses CRUD — same behavior as ../ExpensesTab.
 * Use this entry point from Expenses module shell so "My Expenses" stays a named concept in the folder layout.
 */
import ExpensesTab from '../ExpensesTab';
import type { UserRole } from '../../App';
export type MyExpensesTabProps = {
  userRole: UserRole;
  scopeSelfOnly?: boolean;
  currentUserName: string;
  currentEmployeeCode: string;
};

export default function MyExpensesTab(props: MyExpensesTabProps) {
  return <ExpensesTab {...props} />;
}
