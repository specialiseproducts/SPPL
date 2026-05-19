import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import UserCreationTab from './UserCreationTab';
import AccessManagementTab from './AccessManagementTab';
import type { UserMaster } from './UserCreationTab';
import { cn } from './ui/utils';

interface UserManagementProps {
  onUsersChange: (users: UserMaster[]) => void;
  onEmployeeCodeClick?: (employee: UserMaster) => void;
}

export default function UserManagement({ onUsersChange, onEmployeeCodeClick }: UserManagementProps) {
  const [users, setUsers] = useState<UserMaster[]>([]);
  const [tab, setTab] = useState('creation');

  const handleUsersChange = (updatedUsers: UserMaster[]) => {
    setUsers(updatedUsers);
    onUsersChange(updatedUsers);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">User Management</h1>
        <p className="text-gray-600">Manage users and access controls for your organization</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="creation">User Creation</TabsTrigger>
          <TabsTrigger value="access">Access Management</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className={cn('mt-6', tab !== 'creation' ? 'hidden' : undefined)}>
        <UserCreationTab onUsersChange={handleUsersChange} onEmployeeCodeClick={onEmployeeCodeClick} />
      </div>
      <div className={cn('mt-6', tab !== 'access' ? 'hidden' : undefined)}>
        <AccessManagementTab availableUsers={users} />
      </div>
    </div>
  );
}
