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
import type { UserMaster } from './UserCreationTab';
import { apiFetch } from '../services/api';

export interface AccessRule {
  id: string;
  name: string;
  employeeCode: string;
  baseRole: UserRole;
  overrides: Array<{ pageName: ModuleName; subRole: UserRole | 'None' }>;
  lastModified: string;
  updatedByName?: string;
}

interface AccessManagementTabProps {
  availableUsers: UserMaster[];
}

const MODULE_LABEL_TO_KEY: Record<ModuleName, string> = {
  'Sales Forecasting': 'salesForecasting',
  Expenses: 'expenses',
  Payroll: 'payroll',
  Purchases: 'purchases',
  CRM: 'crm',
  'User Management': 'userManagement',
};

const MODULE_KEY_TO_LABEL: Record<string, ModuleName> = {
  salesForecasting: 'Sales Forecasting',
  expenses: 'Expenses',
  payroll: 'Payroll',
  purchases: 'Purchases',
  crm: 'CRM',
  userManagement: 'User Management',
};

export default function AccessManagementTab({ availableUsers }: AccessManagementTabProps) {
  const [accessRules, setAccessRules] = useState<AccessRule[]>([]);
  const [employees, setEmployees] = useState<UserMaster[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AccessRule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const effectiveUsers = useMemo(
    () => (employees.length > 0 ? employees : availableUsers),
    [employees, availableUsers]
  );

  const mapApiRule = (item: any): AccessRule => ({
    id: String(item?.employeeCode || ''),
    name: String(item?.employeeName || ''),
    employeeCode: String(item?.employeeCode || ''),
    baseRole: (item?.globalRole || 'User') as UserRole,
    overrides: Object.entries(item?.moduleOverrides || {}).map(([key, value]) => ({
      pageName: MODULE_KEY_TO_LABEL[key] || 'Sales Forecasting',
      subRole: String(value || 'User') as UserRole | 'None',
    })),
    lastModified: String(item?.updatedAt || item?.createdAt || ''),
    updatedByName: String(item?.updatedByName || item?.updatedBy || ''),
  });

  const toApiPayload = (rule: AccessRule) => ({
    employeeCode: rule.employeeCode,
    employeeName: rule.name,
    globalRole: rule.baseRole,
    moduleOverrides: rule.overrides.reduce<Record<string, string>>((acc, override) => {
      const moduleKey = MODULE_LABEL_TO_KEY[override.pageName];
      if (moduleKey) acc[moduleKey] = String(override.subRole);
      return acc;
    }, {}),
  });

  const loadEmployees = async () => {
    const data = await apiFetch('/api/employees');
    const rows = Array.isArray(data?.data?.items) ? data.data.items : [];
    setEmployees(
      rows.map((row: any) => ({
        employee_code: row.employeeCode || '',
        employeeCode: row.employeeCode || '',
        first_name: row.firstName || '',
        firstName: row.firstName || '',
        last_name: row.lastName || '',
        lastName: row.lastName || '',
        name: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.name || '',
        biometric_code: row.biometricCode || '',
        biometricCode: row.biometricCode || '',
      }))
    );
  };

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/access-control');
      setAccessRules((Array.isArray(data?.data) ? data.data : []).map(mapApiRule));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees().catch(() => {});
    loadRules().catch(() => {});
  }, []);

  const handleCreateAccess = async (rule: AccessRule) => {
    await apiFetch('/api/access-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toApiPayload(rule)),
    });
    await loadRules();
    setIsModalOpen(false);
    toast.success('Role Management saved');
  };

  const handleEditAccess = async (rule: AccessRule) => {
    await apiFetch(`/api/access-control/${encodeURIComponent(rule.employeeCode)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toApiPayload(rule)),
    });
    await loadRules();
    setEditingRule(null);
    toast.success('Role Management updated');
  };

  const handleDeleteAccess = async (employeeCode: string) => {
    const rule = accessRules.find((r) => r.employeeCode === employeeCode);
    if (rule && confirm(`Are you sure you want to delete the access settings for ${rule.name} (${rule.employeeCode})? This action cannot be undone.`)) {
      await apiFetch(`/api/access-control/${encodeURIComponent(employeeCode)}`, { method: 'DELETE' });
      await loadRules();
      toast.success('Role Management entry deleted');
    }
  };

  const filteredRules = accessRules.filter((rule) =>
    `${rule.name} ${rule.employeeCode} ${rule.baseRole}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[#212529]">Access Management Setup</h2>
          <p className="text-sm text-gray-600 mt-1">Configure role-based access controls and page-level overrides</p>
        </div>
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
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-6">Loading access rules...</TableCell></TableRow>
              ) : filteredRules.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-6">No access records found</TableCell></TableRow>
              ) : (
                filteredRules.map((rule, index) => (
                  <TableRow key={rule.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <TableCell>{rule.employeeCode}</TableCell>
                    <TableCell>{rule.name || '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                        rule.baseRole === 'Developer'
                          ? 'bg-purple-100 text-purple-800'
                          : rule.baseRole === 'Admin'
                            ? 'bg-blue-100 text-blue-800'
                            : rule.baseRole === 'Super Admin'
                              ? 'bg-indigo-100 text-indigo-900'
                              : 'bg-gray-100 text-gray-800'
                      }`}>
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
                    <TableCell>{rule.lastModified ? new Date(rule.lastModified).toLocaleString() : '-'}</TableCell>
                    <TableCell>{rule.updatedByName || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => setEditingRule(rule)} className="text-[#1D4ED8] hover:text-[#1e40af] transition-colors">
                              <Edit className="w-5 h-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit Role Management</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleDeleteAccess(rule.employeeCode)} className="text-[#EF4444] hover:text-[#dc2626] transition-colors">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>Delete Role Management Entry</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={async () => {
                                const res = await apiFetch('/api/auth/reset-password', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ employeeCode: rule.employeeCode }),
                                });
                                const pw = res?.data?.password;
                                if (pw) {
                                  navigator.clipboard?.writeText(pw).catch(() => {});
                                  toast.success(`Temporary password: ${pw} (copied)`);
                                } else {
                                  toast.success('Password reset successfully');
                                }
                              }}
                              className="text-[#007BFF] hover:text-[#0056b3] transition-colors"
                            >
                              <KeyRound className="w-5 h-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>Reset Password</p></TooltipContent>
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
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateAccess}
        availableUsers={effectiveUsers}
      />

      <AccessFormModal
        isOpen={!!editingRule}
        onClose={() => setEditingRule(null)}
        onSubmit={handleEditAccess}
        availableUsers={effectiveUsers}
        initialData={editingRule || undefined}
        isEdit={true}
      />
    </Card>
  );
}