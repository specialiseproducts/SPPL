import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Plus, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { AccessRule } from './AccessManagementTab';
import type { UserRole } from '../App';
import type { ModuleName } from './Sidebar';
import type { UserMaster } from './UserCreationTab';

interface AccessFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rule: AccessRule) => void;
  availableUsers: UserMaster[];
  initialData?: AccessRule;
  isEdit?: boolean;
}

interface Override {
  pageName: ModuleName;
  subRole: UserRole;
}

const allPages: ModuleName[] = [
  'Sales Forecasting',
  'Expenses',
  'Payroll',
  'Purchases',
  'CRM',
  'User Management',
];

export default function AccessFormModal({ isOpen, onClose, onSubmit, availableUsers, initialData, isEdit }: AccessFormModalProps) {
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState(initialData?.employeeCode || '');
  const [baseRole, setBaseRole] = useState<UserRole>(initialData?.baseRole || 'User');
  const [overrides, setOverrides] = useState<Override[]>(initialData?.overrides || []);

  const selectedUser = availableUsers.find(u => u.employee_code === selectedEmployeeCode);

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      setSelectedEmployeeCode(initialData.employeeCode);
      setBaseRole(initialData.baseRole);
      setOverrides(initialData.overrides);
    } else {
      setSelectedEmployeeCode('');
      setBaseRole('User');
      setOverrides([]);
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeCode) {
      toast.error('Please select a name');
      return;
    }

    if (!selectedUser) {
      toast.error('Selected user no longer exists. Please choose another user.');
      return;
    }

    const rule: AccessRule = {
      id: isEdit && initialData ? initialData.id : Date.now().toString(),
      name: selectedUser.name,
      employeeCode: selectedEmployeeCode,
      baseRole,
      overrides,
      lastModified: new Date().toISOString().split('T')[0],
    };

    onSubmit(rule);
    
    // Reset form only if not editing
    if (!isEdit) {
      setSelectedEmployeeCode('');
      setBaseRole('User');
      setOverrides([]);
    }
  };

  const addOverride = () => {
    setOverrides([...overrides, { pageName: 'Sales Forecasting', subRole: 'User' }]);
  };

  const removeOverride = (index: number) => {
    setOverrides(overrides.filter((_, i) => i !== index));
  };

  const updateOverride = (index: number, field: keyof Override, value: string) => {
    setOverrides(overrides.map((override, i) => 
      i === index ? { ...override, [field]: value } : override
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Role Management' : 'Create New Role Management'}</DialogTitle>
          <DialogDescription>
            Configure user roles and page-level access permissions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Selection */}
          <div className="space-y-2">
            <Label htmlFor="access-name">Name *</Label>
            {availableUsers.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No users available. Add users in User Creation first.
                </AlertDescription>
              </Alert>
            ) : (
              <Select 
                value={selectedEmployeeCode} 
                onValueChange={(value) => {
                  setSelectedEmployeeCode(value);
                  const user = availableUsers.find(u => u.employee_code === value);
                  if (user && user.role) setBaseRole(user.role);
                }}
              >
                <SelectTrigger id="access-name">
                  <SelectValue placeholder="Select Name" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(user => (
                    <SelectItem key={user.employee_code} value={user.employee_code}>
                      {user.name} — {user.employee_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-gray-500">Select Name</p>
          </div>

          {/* Employee Code (Read-only display) */}
          {selectedUser && (
            <div className="space-y-2">
              <Label htmlFor="employee-code-display">Employee Code</Label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
                {selectedUser.employee_code}
              </div>
            </div>
          )}

          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="role">Select Role *</Label>
            <Select value={baseRole} onValueChange={(value) => setBaseRole(value as UserRole)}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Accountant">Accountant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Module Access Overrides */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Page Level Role Overrides</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOverride}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Override Access
              </Button>
            </div>

            {overrides.length > 0 && (
              <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
                {overrides.map((override, index) => (
                  <div key={index} className="flex items-end gap-3">
                    <div className="flex-1 space-y-2">
                      <Label className="text-xs">Page Name</Label>
                      <Select
                        value={override.pageName}
                        onValueChange={(value) => updateOverride(index, 'pageName', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allPages.map(page => (
                            <SelectItem key={page} value={page}>{page}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label className="text-xs">Sub Role</Label>
                      <Select
                        value={override.subRole}
                        onValueChange={(value) => updateOverride(index, 'subRole', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="User">User</SelectItem>
                          <SelectItem value="Accountant">Accountant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOverride(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-[#007BFF] hover:bg-[#0056b3]"
              disabled={availableUsers.length === 0}
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}