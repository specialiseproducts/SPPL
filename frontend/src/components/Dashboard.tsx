import { useEffect, useState, type ReactNode } from 'react';
import Navbar from './Navbar';
import Sidebar, { type ModuleName } from './Sidebar';
import UserManagement from './UserManagement';
import Expenses from './Expenses';
import SalesForecasting from './SalesForecasting';
import Purchases from './Purchases';
import ModuleDashboard from './ModuleDashboard';
import type { User, UserRole } from '../App';
import { Card } from './ui/card';
import type { UserMaster } from './UserCreationTab';
import { cn } from './ui/utils';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  /** When set, open this module; when null, show module picker grid. */
  activeModuleId: string | null;
  onModuleSelect: (moduleId: string) => void;
  onBackToDashboard?: () => void;
  moduleAccess: Record<string, boolean>;
  moduleRoles: Record<string, string>;
  onProfile?: () => void;
  onEmployeeCodeClick?: (employee: UserMaster) => void;
}

const MODULE_ID_TO_NAME: Record<string, ModuleName> = {
  'sales-forecasting': 'Sales Forecasting',
  expenses: 'Expenses',
  payroll: 'Payroll',
  purchases: 'Purchases',
  crm: 'CRM',
  'user-management': 'User Management',
};

function moduleIdToName(moduleId?: string | null): ModuleName {
  return MODULE_ID_TO_NAME[moduleId || ''] || 'Sales Forecasting';
}

function isImplementedModule(name: ModuleName, moduleAccess: Record<string, boolean>): boolean {
  switch (name) {
    case 'User Management':
      return !!moduleAccess.userManagement;
    case 'Expenses':
      return !!moduleAccess.expenses;
    case 'Sales Forecasting':
      return !!moduleAccess.salesForecasting;
    case 'Purchases':
      return !!moduleAccess.purchases;
    default:
      return false;
  }
}

export default function Dashboard({
  user,
  onLogout,
  activeModuleId,
  onModuleSelect,
  onBackToDashboard,
  moduleAccess,
  moduleRoles,
  onProfile,
  onEmployeeCodeClick,
}: DashboardProps) {
  const showModuleGrid = !activeModuleId;
  const [activeModule, setActiveModule] = useState<ModuleName>(moduleIdToName(activeModuleId));
  const [availableUsers, setAvailableUsers] = useState<UserMaster[]>([]);
  const [visitedModules, setVisitedModules] = useState<Set<ModuleName>>(() => {
    const initial = moduleIdToName(activeModuleId);
    return initial ? new Set<ModuleName>([initial]) : new Set();
  });

  useEffect(() => {
    if (activeModuleId) {
      const name = moduleIdToName(activeModuleId);
      setActiveModule(name);
      setVisitedModules((prev) => {
        if (prev.has(name)) return prev;
        const next = new Set(prev);
        next.add(name);
        return next;
      });
    }
  }, [activeModuleId]);

  const handleSidebarModuleChange = (module: ModuleName) => {
    setActiveModule(module);
    setVisitedModules((prev) => {
      if (prev.has(module)) return prev;
      const next = new Set(prev);
      next.add(module);
      return next;
    });
    const id =
      Object.entries(MODULE_ID_TO_NAME).find(([, name]) => name === module)?.[0] || 'sales-forecasting';
    onModuleSelect(id);
  };

  const moduleShell = (name: ModuleName, content: ReactNode) => {
    if (!visitedModules.has(name)) return null;
    return (
      <div className={cn('space-y-6', activeModule !== name || showModuleGrid ? 'hidden' : undefined)}>
        {content}
      </div>
    );
  };

  const showPlaceholder =
    !showModuleGrid && !isImplementedModule(activeModule, moduleAccess);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar user={user} onLogout={onLogout} onProfile={onProfile} />
      <div className="flex flex-1 overflow-hidden">
        {!showModuleGrid && (
          <Sidebar
            activeModule={activeModule}
            onModuleChange={handleSidebarModuleChange}
            moduleAccess={moduleAccess}
            onBackToDashboard={onBackToDashboard}
          />
        )}
        <main className="flex-1 overflow-y-auto p-6 bg-[#F8F9FA]">
          <div className="max-w-7xl mx-auto">
            {showModuleGrid ? (
              <ModuleDashboard
                userRole={user.role}
                currentUser={user.name}
                onModuleSelect={onModuleSelect}
                moduleAccess={moduleAccess}
                onLogout={onLogout}
                onProfile={onProfile}
              />
            ) : (
              <>
                {moduleAccess.userManagement &&
                  moduleShell(
                    'User Management',
                    <UserManagement onUsersChange={setAvailableUsers} onEmployeeCodeClick={onEmployeeCodeClick} />,
                  )}
                {moduleAccess.expenses &&
                  moduleShell(
                    'Expenses',
                    <Expenses
                      user={user}
                      availableUsers={availableUsers}
                      moduleRole={(moduleRoles.expenses || user.role) as UserRole}
                    />,
                  )}
                {moduleAccess.salesForecasting &&
                  moduleShell(
                    'Sales Forecasting',
                    <SalesForecasting
                      user={user}
                      availableUsers={availableUsers}
                      moduleRole={(moduleRoles.salesForecasting || user.role) as UserRole}
                    />,
                  )}
                {moduleAccess.purchases &&
                  moduleShell(
                    'Purchases',
                    <Purchases
                      user={user}
                      availableUsers={availableUsers}
                      moduleRole={(moduleRoles.purchases || user.role) as UserRole}
                    />,
                  )}
                {showPlaceholder && (
                  <Card className="p-8">
                    <div className="text-center py-12">
                      <h2 className="text-[#212529] mb-2">{activeModule}</h2>
                      <p className="text-gray-500">This module is under development.</p>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
