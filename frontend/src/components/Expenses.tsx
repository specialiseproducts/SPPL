import { useState } from 'react';
import ExpensesTab from './ExpensesTab';
import type { User } from '../App';
import type { UserMaster } from './UserCreationTab';

interface ExpensesProps {
  user: User;
  availableUsers: UserMaster[];
  moduleRole: User['role'];
}

export default function Expenses({ user, availableUsers, moduleRole }: ExpensesProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">Expenses</h1>
        <p className="text-gray-600">
          {moduleRole === 'Admin' || moduleRole === 'Developer'
            ? 'Manage and track all employee expenses' 
            : 'Submit and track your expense records'}
        </p>
      </div>

      <ExpensesTab
        userRole={moduleRole}
        currentUserName={user.name}
        currentEmployeeCode={user.employeeCode || user.id}
        availableUsers={availableUsers}
      />
    </div>
  );
}
