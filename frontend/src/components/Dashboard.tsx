import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import Navbar from './Navbar';
import Sidebar, { type ModuleName } from './Sidebar';
import ModuleDashboard from './ModuleDashboard';
import type { User, UserRole } from '../App';
import { Card } from './ui/card';
import type { UserMaster } from './UserCreationTab';
import { ModuleErrorBoundary } from './errors/ModuleErrorBoundary';
import { ModuleLoadingFallback } from './ui/ModuleLoadingFallback';
import { useEmployeesListQuery } from '../hooks/employees/useEmployeesQuery';
import { recordPerformance } from '../lib/observability/performance';
import { isDeveloper } from '../utils/accessControl';
import { cn } from './ui/utils';

const UserManagement = lazy(() => import('./UserManagement'));
const Expenses = lazy(() => import('./Expenses'));
const SalesForecasting = lazy(() => import('./SalesForecasting'));
const Purchases = lazy(() => import('./Purchases'));
const PerformanceDashboard = lazy(() => import('./admin/PerformanceDashboard'));

interface DashboardProps {
  user: User;
  onLogout: () => void;
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
  'system-metrics': 'System Metrics',
};

function moduleIdToName(moduleId?: string | null): ModuleName {
  return MODULE_ID_TO_NAME[moduleId || ''] || 'Sales Forecasting';
}

function isImplementedModule(name: ModuleName, moduleAccess: Record<string, boolean>, user: User): boolean {
  switch (name) {
    case 'User Management':
      return !!moduleAccess.userManagement;
    case 'Expenses':
      return !!moduleAccess.expenses;
    case 'Sales Forecasting':
      return !!moduleAccess.salesForecasting;
    case 'Purchases':
      return !!moduleAccess.purchases;
    case 'System Metrics':
      return isDeveloper(user.role);
    default:
      return false;
  }
}

function moduleHasAccess(moduleId: string, moduleAccess: Record<string, boolean>, user: User): boolean {
  const name = moduleIdToName(moduleId);
  return isImplementedModule(name, moduleAccess, user);
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
  const activeModule = moduleIdToName(activeModuleId);
  const [visitedModuleIds, setVisitedModuleIds] = useState<Set<string>>(() => new Set());

  useEmployeesListQuery();

  useEffect(() => {
    if (!activeModuleId || !moduleHasAccess(activeModuleId, moduleAccess, user)) return;
    setVisitedModuleIds((prev) => {
      if (prev.has(activeModuleId)) return prev;
      const next = new Set(prev);
      next.add(activeModuleId);
      return next;
    });
  }, [activeModuleId, moduleAccess, user]);

  const mountedModuleIds = useMemo(() => {
    const ids = new Set(visitedModuleIds);
    if (activeModuleId && moduleHasAccess(activeModuleId, moduleAccess, user)) {
      ids.add(activeModuleId);
    }
    return ids;
  }, [visitedModuleIds, activeModuleId, moduleAccess, user]);

  useEffect(() => {
    if (!activeModuleId) return;
    const start = performance.now();
    return () => {
      recordPerformance({
        type: 'module_render',
        name: activeModuleId,
        durationMs: Math.round(performance.now() - start),
      });
    };
  }, [activeModuleId]);

  const handleSidebarModuleChange = (module: ModuleName) => {
    const id =
      Object.entries(MODULE_ID_TO_NAME).find(([, name]) => name === module)?.[0] || 'sales-forecasting';
    onModuleSelect(id);
  };

  const showPlaceholder =
    !showModuleGrid && !isImplementedModule(activeModule, moduleAccess, user);

  const wrapModule = (name: string, node: ReactNode) => (
    <ModuleErrorBoundary moduleName={name}>
      <Suspense fallback={<ModuleLoadingFallback label={`Loading ${name}…`} />}>{node}</Suspense>
    </ModuleErrorBoundary>
  );

  const renderModuleContent = (moduleId: string): ReactNode => {
    switch (moduleId) {
      case 'user-management':
        if (!moduleAccess.userManagement) return null;
        return wrapModule('User Management', <UserManagement onEmployeeCodeClick={onEmployeeCodeClick} />);
      case 'expenses':
        if (!moduleAccess.expenses) return null;
        return wrapModule(
          'Expenses',
          <Expenses user={user} moduleRole={(moduleRoles.expenses || user.role) as UserRole} />,
        );
      case 'sales-forecasting':
        if (!moduleAccess.salesForecasting) return null;
        return wrapModule(
          'Sales Forecasting',
          <SalesForecasting user={user} moduleRole={(moduleRoles.salesForecasting || user.role) as UserRole} />,
        );
      case 'purchases':
        if (!moduleAccess.purchases) return null;
        return wrapModule(
          'Purchases',
          <Purchases user={user} moduleRole={(moduleRoles.purchases || user.role) as UserRole} />,
        );
      case 'system-metrics':
        if (!isDeveloper(user.role)) return null;
        return wrapModule('System Metrics', <PerformanceDashboard />);
      default:
        return null;
    }
  };

  const renderMountedModules = () =>
    Array.from(mountedModuleIds).map((moduleId) => {
      const content = renderModuleContent(moduleId);
      if (!content) return null;
      const visible = !showModuleGrid && activeModuleId === moduleId;
      return (
        <div
          key={moduleId}
          className={cn(!visible && 'hidden')}
          aria-hidden={!visible}
          data-mounted-module={moduleId}
        >
          {content}
        </div>
      );
    });

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar user={user} onLogout={onLogout} onProfile={onProfile} />
      <div className="flex flex-1 overflow-hidden">
        {!showModuleGrid && (
          <Sidebar
            activeModule={activeModule}
            onModuleChange={handleSidebarModuleChange}
            moduleAccess={moduleAccess}
            onBackToDashboard={onBackToDashboard}
            showSystemMetrics={isDeveloper(user.role)}
          />
        )}
        <main className="flex-1 overflow-y-auto p-6 bg-[#F8F9FA]">
          <div className="max-w-7xl mx-auto">
            {showModuleGrid ? (
              <ModuleDashboard
                onModuleSelect={onModuleSelect}
                moduleAccess={moduleAccess}
                showSystemMetrics={isDeveloper(user.role)}
              />
            ) : showPlaceholder ? (
              <Card className="p-8">
                <div className="text-center py-12">
                  <h2 className="text-[#212529] mb-2">{activeModule}</h2>
                  <p className="text-gray-500">This module is under development.</p>
                </div>
              </Card>
            ) : null}
            {/* One instance per visited module — hidden when inactive or on module grid */}
            {renderMountedModules()}
          </div>
        </main>
      </div>
    </div>
  );
}
