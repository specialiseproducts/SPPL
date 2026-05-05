import { useState } from 'react';
import ExpensesTab from './ExpensesTab';
import type { User } from '../App';
import type { UserMaster } from './UserCreationTab';

interface ExpensesProps {
  user: User;
  availableUsers: UserMaster[];
}

export default function Expenses({ user, availableUsers }: ExpensesProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">Expenses</h1>
        <p className="text-gray-600">
          {user.role === 'Admin' 
            ? 'Manage and track all employee expenses' 
            : 'Submit and track your expense records'}
        </p>
      </div>

      <ExpensesTab
        userRole={user.role}
        currentUserName={user.name}
        currentEmployeeCode={user.id}
        availableUsers={availableUsers}
      />
    </div>
  );
}
