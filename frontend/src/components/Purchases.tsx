import PurchasesTab from './PurchasesTab';
import type { User } from '../App';

interface PurchasesProps {
  user: User;
  moduleRole: User['role'];
}

export default function Purchases({ user, moduleRole }: PurchasesProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">Purchases</h1>
        <p className="text-gray-600">
          Manage costing sheet with 45 columns, duties, margins, and multi-line POs.
        </p>
      </div>

      <PurchasesTab
        userRole={moduleRole}
        currentUserName={user.name}
        currentEmployeeCode={user.employeeCode || user.id}
      />
    </div>
  );
}
