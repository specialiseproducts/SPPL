import { useState } from 'react';
import Navbar from './Navbar';
import Sidebar, { type ModuleName } from './Sidebar';
import UserManagement from './UserManagement';
import Expenses from './Expenses';
import SalesForecasting from './SalesForecasting';
import Purchases from './Purchases';
import type { User } from '../App';
import { Card } from './ui/card';
import type { UserMaster } from './UserCreationTab';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  initialModule?: string;
  onBackToDashboard?: () => void;
  moduleAccess: Record<string, boolean>;
  moduleRoles: Record<string, string>;
  onProfile?: () => void;
  onEmployeeCodeClick?: (employee: UserMaster) => void;
}

export default function Dashboard({ user, onLogout, initialModule, onBackToDashboard, moduleAccess, moduleRoles, onProfile, onEmployeeCodeClick }: DashboardProps) {
  // Map module IDs to ModuleName
  const getModuleName = (moduleId?: string): ModuleName => {
    const moduleMap: Record<string, ModuleName> = {
      'sales-forecasting': 'Sales Forecasting',
      'expenses': 'Expenses',
      'payroll': 'Payroll',
      'purchases': 'Purchases',
      'crm': 'CRM',
      'user-management': 'User Management',
    };
    return moduleMap[moduleId || ''] || 'Sales Forecasting';
  };

  const [activeModule, setActiveModule] = useState<ModuleName>(getModuleName(initialModule));
  const [availableUsers, setAvailableUsers] = useState<UserMaster[]>([]);

  const renderModuleContent = () => {
    if (activeModule === 'User Management') {
      return <UserManagement onUsersChange={setAvailableUsers} onEmployeeCodeClick={onEmployeeCodeClick} />;
    }

    if (activeModule === 'Expenses') {
      return (
        <Expenses
          user={user}
          availableUsers={availableUsers}
          moduleRole={moduleRoles.expenses || user.role}
        />
      );
    }

    if (activeModule === 'Sales Forecasting') {
      return (
        <SalesForecasting
          user={user}
          availableUsers={availableUsers}
          moduleRole={moduleRoles.salesForecasting || user.role}
        />
      );
    }

    if (activeModule === 'Purchases') {
      return (
        <Purchases
          user={user}
          availableUsers={availableUsers}
          moduleRole={moduleRoles.purchases || user.role}
        />
      );
    }

    return (
      <Card className="p-8">
        <div className="text-center py-12">
          <h2 className="text-[#212529] mb-2">{activeModule}</h2>
          <p className="text-gray-500">This module is under development.</p>
          <p className="text-sm text-gray-400 mt-4">
            Content for {activeModule} will be displayed here.
          </p>
        </div>
      </Card>
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar user={user} onLogout={onLogout} onProfile={onProfile} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeModule={activeModule}
          onModuleChange={setActiveModule}
          moduleAccess={moduleAccess}
          onBackToDashboard={onBackToDashboard}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-[#F8F9FA]">
          <div className="max-w-7xl mx-auto">
            {renderModuleContent()}
          </div>
        </main>
      </div>
    </div>
  );
}