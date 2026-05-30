import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import MyExpensesTab from './expenses/MyExpensesTab';
import AuditExpensesTab from './expenses/AuditExpensesTab';
import ExpensesAdminDashboardTab from './expenses/ExpensesAdminDashboardTab';
import type { User, UserRole } from '../App';
import { isDeveloper, isAdmin, isSuperAdmin } from '../utils/accessControl';

interface ExpensesProps {
  user: User;
  /** Effective role for the Expenses module (may differ from global user.role). */
  moduleRole: UserRole;
}

function ExpensesIntro({ moduleRole }: { moduleRole: UserRole }) {
  const auditLayout = isAdmin(moduleRole) && !isSuperAdmin(moduleRole);
  const superLayout = isSuperAdmin(moduleRole);
  const dev = isDeveloper(moduleRole);

  let blurb: string | null = null;
  if (dev) {
    blurb = 'Manage and track employee expenses (full access)';
  } else if (auditLayout) {
    blurb = 'My Expenses: your own records. Audit Expenses: organization-wide review (UI preview).';
  } else if (superLayout) {
    blurb = 'My Expenses: your own records. Admin Dashboard: analytics placeholders (APIs coming).';
  }

  return (
    <div>
      <h1 className="text-[#212529] mb-2">Expenses</h1>
      {blurb ? <p className="text-gray-600">{blurb}</p> : null}
    </div>
  );
}

export default function Expenses({ user, moduleRole }: ExpensesProps) {
  const sharedTabProps = {
    userRole: moduleRole,
    currentUserName: user.name,
    currentEmployeeCode: user.employeeCode || user.id,
  } as const;

  if (isSuperAdmin(moduleRole)) {
    return (
      <div className="space-y-6">
        <ExpensesIntro moduleRole={moduleRole} />
        <Tabs defaultValue="my-expenses" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-2">
            <TabsTrigger value="my-expenses">My Expenses</TabsTrigger>
            <TabsTrigger value="admin-dashboard">Admin Dashboard</TabsTrigger>
          </TabsList>
          <TabsContent value="my-expenses" className="mt-6">
            <MyExpensesTab {...sharedTabProps} scopeSelfOnly />
          </TabsContent>
          <TabsContent value="admin-dashboard" className="mt-6">
            <ExpensesAdminDashboardTab />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (isAdmin(moduleRole)) {
    return (
      <div className="space-y-6">
        <ExpensesIntro moduleRole={moduleRole} />
        <Tabs defaultValue="my-expenses" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-2">
            <TabsTrigger value="my-expenses">My Expenses</TabsTrigger>
            <TabsTrigger value="audit">Audit Expenses</TabsTrigger>
          </TabsList>
          <TabsContent value="my-expenses" className="mt-6">
            <MyExpensesTab {...sharedTabProps} scopeSelfOnly />
          </TabsContent>
          <TabsContent value="audit" className="mt-6">
            <AuditExpensesTab />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ExpensesIntro moduleRole={moduleRole} />
      <MyExpensesTab {...sharedTabProps} />
    </div>
  );
}
