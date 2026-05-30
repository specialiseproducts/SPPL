import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import UserCreationTab from './UserCreationTab';
import AccessManagementTab from './AccessManagementTab';
import type { UserMaster } from './UserCreationTab';

interface UserManagementProps {
  onEmployeeCodeClick?: (employee: UserMaster) => void;
}

export default function UserManagement({ onEmployeeCodeClick }: UserManagementProps) {
  const [tab, setTab] = useState('creation');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">User Management</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="creation">User Creation</TabsTrigger>
          <TabsTrigger value="access">Access Management</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'creation' && (
        <div className="mt-6">
          <UserCreationTab onEmployeeCodeClick={onEmployeeCodeClick} />
        </div>
      )}
      {tab === 'access' && (
        <div className="mt-6">
          <AccessManagementTab />
        </div>
      )}
    </div>
  );
}
