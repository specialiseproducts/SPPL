import PurchasesTab from './PurchasesTab';
import type { User } from '../App';
import type { UserMaster } from './UserCreationTab';

interface PurchasesProps {
  user: User;
  availableUsers: UserMaster[];
}

export default function Purchases({ user, availableUsers }: PurchasesProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">Purchases</h1>
        <p className="text-gray-600">
          Manage costing sheet with 45 columns, duties, margins, and multi-line POs.
        </p>
      </div>

      <PurchasesTab
        userRole={user.role}
        currentUserName={user.name}
        currentEmployeeCode={user.id}
        availableUsers={availableUsers}
      />
    </div>
  );
}