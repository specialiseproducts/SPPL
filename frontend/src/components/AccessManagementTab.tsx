import { useState } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { toast } from 'sonner';
import AccessFormModal from './AccessFormModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import type { UserRole } from '../App';
import type { ModuleName } from './Sidebar';
import type { UserMaster } from './UserCreationTab';

export interface AccessRule {
  id: string;
  name: string;
  employeeCode: string;
  baseRole: UserRole;
  overrides: Array<{ pageName: ModuleName; subRole: UserRole }>;
  lastModified: string;
}

const initialAccessRules: AccessRule[] = [
  {
    id: '1',
    name: 'Admin User',
    employeeCode: 'E001',
    baseRole: 'Admin',
    overrides: [],
    lastModified: '2024-01-15',
  },
  {
    id: '2',
    name: 'John Doe',
    employeeCode: 'E002',
    baseRole: 'User',
    overrides: [
      { pageName: 'Expenses', subRole: 'Admin' }
    ],
    lastModified: '2024-03-20',
  },
];

interface AccessManagementTabProps {
  availableUsers: UserMaster[];
}

export default function AccessManagementTab({ availableUsers }: AccessManagementTabProps) {
  const [accessRules, setAccessRules] = useState<AccessRule[]>(initialAccessRules);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AccessRule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleCreateAccess = (rule: AccessRule) => {
    setAccessRules([...accessRules, rule]);
    setIsModalOpen(false);
  };

  const handleEditAccess = (rule: AccessRule) => {
    setAccessRules(accessRules.map(r => r.id === rule.id ? rule : r));
    setEditingRule(null);
    toast.success('✅ Role Management Updated Successfully');
  };

  const handleDeleteAccess = (ruleId: string) => {
    const rule = accessRules.find(r => r.id === ruleId);
    if (rule && confirm(`Are you sure you want to delete the access settings for ${rule.name} (${rule.employeeCode})? This action cannot be undone.`)) {
      setAccessRules(accessRules.filter(r => r.id !== ruleId));
      toast.success('✅ Role Management Entry Deleted');
    }
  };

  const filteredRules = accessRules.filter(rule =>
    rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.baseRole.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[#212529]">Access Management Setup</h2>
          <p className="text-sm text-gray-600 mt-1">Configure role-based access controls and page-level overrides</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#007BFF] hover:bg-[#0056b3] gap-2"
        >
          <Plus className="w-4 h-4" />
          Create New Role Management
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, employee code, role"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">Employee Code</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Employee Code assigned in User Creation</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">Name</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Name as entered in User Creation</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead>Role(s)</TableHead>
                <TableHead>Module Access</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRules.map((rule, index) => (
                <TableRow key={rule.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <TableCell>{rule.employeeCode}</TableCell>
                  <TableCell>{rule.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                      rule.baseRole === 'Admin' ? 'bg-blue-100 text-blue-800' :
                      rule.baseRole === 'Accountant' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {rule.baseRole}
                    </span>
                  </TableCell>
                  <TableCell>
                    {rule.overrides.length > 0 ? (
                      <div className="space-y-1">
                        {rule.overrides.map((override, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="text-gray-600">{override.pageName}:</span>{' '}
                            <span className="text-[#007BFF]">{override.subRole}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">No overrides</span>
                    )}
                  </TableCell>
                  <TableCell>{rule.lastModified}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setEditingRule(rule)}
                            className="text-[#1D4ED8] hover:text-[#1e40af] transition-colors"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit Role Management</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleDeleteAccess(rule.id)}
                            className="text-[#EF4444] hover:text-[#dc2626] transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete Role Management Entry</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>

      <AccessFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateAccess}
        availableUsers={availableUsers}
      />

      <AccessFormModal
        isOpen={!!editingRule}
        onClose={() => setEditingRule(null)}
        onSubmit={handleEditAccess}
        availableUsers={availableUsers}
        initialData={editingRule || undefined}
        isEdit={true}
      />
    </Card>
  );
}