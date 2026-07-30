import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit, Trash2, KeyRound } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { toast } from 'sonner';
import AccessFormModal from './AccessFormModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import type { UserRole } from '../App';
import type { ModuleName } from './Sidebar';
import { apiFetch } from '../services/api';
import { useEmployeesListQuery } from '../hooks/employees/useEmployeesQuery';
import { useAccessRulesQuery, useInvalidateAccessRules } from '../hooks/access/useAccessQueries';
import { accessRuleToApiPayload } from '../hooks/access/accessApi';
import { isQueryColdLoading } from '../utils/queryLoading';

export interface AccessRule {
  id: string;
  name: string;
  employeeCode: string;
  baseRole: UserRole;
  overrides: Array<{ pageName: ModuleName; subRole: UserRole | 'None' }>;
  lastModified: string;
  updatedByName?: string;
}

export default function AccessManagementTab() {
  const employeesQuery = useEmployeesListQuery();
  const rulesQuery = useAccessRulesQuery();
  const invalidateAccessRules = useInvalidateAccessRules();

  const accessRules = rulesQuery.data ?? [];
  const effectiveUsers = employeesQuery.data ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AccessRule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isInitialLoading = isQueryColdLoading(rulesQuery);

  useEffect(() => {
    if (rulesQuery.isError && rulesQuery.data === undefined) {
      console.error('Access rules fetch error:', rulesQuery.error);
      toast.error('Failed to load access rules');
    }
  }, [rulesQuery.isError, rulesQuery.error, rulesQuery.data]);

  useEffect(() => {
    if (employeesQuery.isError && employeesQuery.data === undefined) {
      console.error('Employees fetch error:', employeesQuery.error);
      toast.error('Failed to load employees for access management');
    }
  }, [employeesQuery.isError, employeesQuery.error, employeesQuery.data]);

  const handleCreateAccess = async (rule: AccessRule) => {
    await apiFetch('/api/access-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accessRuleToApiPayload(rule)),
    });
    void invalidateAccessRules();
    setIsModalOpen(false);
    toast.success('Role Management saved');
  };

  const handleEditAccess = async (rule: AccessRule) => {
    await apiFetch(`/api/access-control/${encodeURIComponent(rule.employeeCode)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accessRuleToApiPayload(rule)),
    });
    void invalidateAccessRules();
    setIsModalOpen(false);
    setEditingRule(null);
    toast.success('Role Management updated');
  };

  const handleDeleteAccess = async (employeeCode: string) => {
    const rule = accessRules.find((r) => r.employeeCode === employeeCode);
    if (
      rule &&
      confirm(
        `Are you sure you want to delete the access settings for ${rule.name} (${rule.employeeCode})? This action cannot be undone.`
      )
    ) {
      await apiFetch(`/api/access-control/${encodeURIComponent(employeeCode)}`, { method: 'DELETE' });
      void invalidateAccessRules();
      toast.success('Role Management entry deleted');
    }
  };

  const filteredRules = useMemo(
    () =>
      accessRules.filter((rule) =>
        `${rule.name} ${rule.employeeCode} ${rule.baseRole}`.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [accessRules, searchTerm]
  );

  return (
    <Card className="p-6">
      <div className="flex items-center justify-end mb-6">
        <Button onClick={() => setIsModalOpen(true)} className="bg-[#007BFF] hover:bg-[#0056b3] gap-2">
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
                <TableHead>Employee Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role(s)</TableHead>
                <TableHead>Global Role</TableHead>
                <TableHead>Module Access</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead>Updated By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isInitialLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-6">
                    Loading access rules…
                  </TableCell>
                </TableRow>
              ) : filteredRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-6">
                    No access records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRules.map((rule, index) => (
                  <TableRow key={rule.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <TableCell>{rule.employeeCode}</TableCell>
                    <TableCell>{rule.name || '-'}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                          rule.baseRole === 'Developer'
                            ? 'bg-purple-100 text-purple-800'
                            : rule.baseRole === 'Admin'
                              ? 'bg-blue-100 text-blue-800'
                              : rule.baseRole === 'Super Admin'
                                ? 'bg-indigo-100 text-indigo-900'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {rule.baseRole}
                      </span>
                    </TableCell>
                    <TableCell>{rule.baseRole}</TableCell>
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
                    <TableCell>{rule.lastModified ? new Date(rule.lastModified).toLocaleDateString('en-GB') : '-'}</TableCell>
                    <TableCell>{rule.updatedByName || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingRule(rule);
                                setIsModalOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:bg-red-50"
                              onClick={() => void handleDeleteAccess(rule.employeeCode)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Password reset (coming soon)</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>

      <AccessFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRule(null);
        }}
        onSubmit={editingRule ? handleEditAccess : handleCreateAccess}
        availableUsers={effectiveUsers}
        initialData={editingRule || undefined}
        isEdit={!!editingRule}
      />
    </Card>
  );
}
