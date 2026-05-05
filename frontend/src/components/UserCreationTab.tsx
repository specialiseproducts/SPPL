import { useState, useEffect } from 'react';
import { UserPlus, Edit, Trash2, Eye, Upload, Download, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import UserFormModal from './UserFormModal';
import ImportUsersModal from './ImportUsersModal';
import type { UserRole } from '../App';

export interface UserMaster {
  employee_code: string;
  name: string;
  designation?: string;
  date_of_joining: string;
  date_of_exit?: string;
  phone: string;
  official_email: string;
  personal_email?: string;
  aadhar_no?: string;
  pan_no?: string;
  account_no?: string;
  bank_name?: string;
  ifsc?: string;
  uan_no?: string;
  emergency_contact?: string;
  address?: string;
  password?: string;
  role?: UserRole;
  imported?: boolean;
}

const initialUsers: UserMaster[] = [
  {
    employee_code: 'E001',
    name: 'Admin User',
    designation: 'System Administrator',
    date_of_joining: '2024-01-15',
    phone: '+919876543210',
    official_email: 'admin@company.com',
    personal_email: 'admin.personal@gmail.com',
    pan_no: 'ABCDE1234F',
    role: 'Admin',
  },
  {
    employee_code: 'E002',
    name: 'John Doe',
    designation: 'Software Engineer',
    date_of_joining: '2024-03-20',
    phone: '+919876543211',
    official_email: 'john.doe@company.com',
    account_no: '1234567890123456',
    bank_name: 'State Bank',
    ifsc: 'SBIN0001234',
    role: 'User',
  },
  {
    employee_code: 'E003',
    name: 'Jane Smith',
    designation: 'Senior Accountant',
    date_of_joining: '2024-02-10',
    phone: '+919876543212',
    official_email: 'jane.smith@company.com',
    aadhar_no: '123412341234',
    role: 'Accountant',
  },
];

interface UserCreationTabProps {
  onUsersChange?: (users: UserMaster[]) => void;
}

export default function UserCreationTab({ onUsersChange }: UserCreationTabProps = {}) {
  const [users, setUsers] = useState<UserMaster[]>(initialUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserMaster | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Notify parent of initial users on mount
  useEffect(() => {
    onUsersChange?.(initialUsers);
  }, []);

  // Notify parent when users change
  const updateUsers = (newUsers: UserMaster[]) => {
    setUsers(newUsers);
    onUsersChange?.(newUsers);
  };

  const handleCreateUser = (user: UserMaster) => {
    updateUsers([...users, user]);
    setIsModalOpen(false);
  };

  const handleEditUser = (user: UserMaster) => {
    updateUsers(users.map(u => u.employee_code === user.employee_code ? user : u));
    setEditingUser(null);
  };

  const handleDeleteUser = (employeeCode: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      updateUsers(users.filter(u => u.employee_code !== employeeCode));
    }
  };

  const handleImportUsers = (importedUsers: UserMaster[]) => {
    const newUsers = importedUsers.map(u => ({ ...u, imported: true }));
    updateUsers([...users, ...newUsers]);
    setIsImportModalOpen(false);
  };

  const openEditModal = (user: UserMaster) => {
    setEditingUser(user);
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.official_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // Download Excel template
              const link = document.createElement('a');
              link.href = '/template/users_template.xlsx';
              link.download = 'users_template.xlsx';
              link.click();
            }}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export Data
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Import from Excel
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#007BFF] hover:bg-[#0056b3] gap-2 text-center"
          >
            <UserPlus className="w-4 h-4" />
            Create New User
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, employee code, email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Employee Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Date of Joining</TableHead>
              <TableHead>Date of Exit</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Official Email</TableHead>
              <TableHead>Personal Email</TableHead>
              <TableHead>Aadhar No.</TableHead>
              <TableHead>PAN No.</TableHead>
              <TableHead>Account No.</TableHead>
              <TableHead>Bank Name</TableHead>
              <TableHead>IFSC</TableHead>
              <TableHead>UAN Number</TableHead>
              <TableHead>Emergency Contact</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user, index) => (
              <TableRow key={user.employee_code} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {user.employee_code}
                    {user.imported && (
                      <Badge variant="secondary" className="text-xs">Imported</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.designation || '-'}</TableCell>
                <TableCell>{user.date_of_joining}</TableCell>
                <TableCell>{user.date_of_exit || '-'}</TableCell>
                <TableCell>{user.phone}</TableCell>
                <TableCell>{user.official_email}</TableCell>
                <TableCell>{user.personal_email || '-'}</TableCell>
                <TableCell>{user.aadhar_no || '-'}</TableCell>
                <TableCell>{user.pan_no || '-'}</TableCell>
                <TableCell>{user.account_no || '-'}</TableCell>
                <TableCell>{user.bank_name || '-'}</TableCell>
                <TableCell>{user.ifsc || '-'}</TableCell>
                <TableCell>{user.uan_no || '-'}</TableCell>
                <TableCell>{user.emergency_contact || '-'}</TableCell>
                <TableCell>
                  {user.address ? (
                    <div className="max-w-[200px] truncate" title={user.address}>
                      {user.address}
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(user)}
                      className="text-[#007BFF] hover:text-[#0056b3]"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteUser(user.employee_code)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <UserFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateUser}
      />

      {editingUser && (
        <UserFormModal
          isOpen={true}
          onClose={() => setEditingUser(null)}
          onSubmit={handleEditUser}
          initialData={editingUser}
          isEdit={true}
        />
      )}

      <ImportUsersModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportUsers}
        existingEmployeeCodes={users.map(u => u.employee_code)}
      />
    </Card>
  );
}