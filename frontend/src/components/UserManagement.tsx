import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import UserCreationTab from './UserCreationTab';
import AccessManagementTab from './AccessManagementTab';
import type { UserMaster } from './UserCreationTab';

interface UserManagementProps {
  onUsersChange: (users: UserMaster[]) => void;
  onEmployeeCodeClick?: (employee: UserMaster) => void;
}

export default function UserManagement({ onUsersChange, onEmployeeCodeClick }: UserManagementProps) {
  const [users, setUsers] = useState<UserMaster[]>([]);

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

      <Tabs defaultValue="creation" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="creation">User Creation</TabsTrigger>
          <TabsTrigger value="access">Access Management</TabsTrigger>
        </TabsList>
        <TabsContent value="creation" className="mt-6">
          <UserCreationTab onUsersChange={handleUsersChange} onEmployeeCodeClick={onEmployeeCodeClick} />
        </TabsContent>
        <TabsContent value="access" className="mt-6">
          <AccessManagementTab availableUsers={users} />
        </TabsContent>
      </Tabs>
    </div>
  );
}