/**
 * Production expenses CRUD — same behavior as ../ExpensesTab.
 * Use this entry point from Expenses module shell so "My Expenses" stays a named concept in the folder layout.
 */
import ExpensesTab from '../ExpensesTab';
import type { UserRole } from '../../App';
import type { UserMaster } from '../UserCreationTab';

export type MyExpensesTabProps = {
  userRole: UserRole;
  scopeSelfOnly?: boolean;
  currentUserName: string;
  currentEmployeeCode: string;
  availableUsers: UserMaster[];
};

export default function MyExpensesTab(props: MyExpensesTabProps) {
  return <ExpensesTab {...props} />;
}
