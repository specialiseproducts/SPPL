import { useMemo, useState } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import ModuleDashboard from './components/ModuleDashboard';
import { Toaster } from 'sonner';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { getEffectiveRole, hasModuleAccess } from './utils/accessControl';
import ProfilePage from './components/ProfilePage';
import type { UserMaster } from './components/UserCreationTab';
import { isAdmin, isDeveloper } from './utils/accessControl';

export type UserRole = 'Developer' | 'Admin' | 'User' | 'Accountant' | 'None';

export interface User {
  id: string;
  employeeCode?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  role: UserRole;
  profilePhoto?: string;
  officialEmail?: string;
}

export default function App() {
  const { user, accessControl, isAuthenticated, loading, login, logout } = useAuth();
  const [selectedModule, setSelectedModule] = useState<string | null>(() => {
    try {
      return localStorage.getItem('sppl_selected_module') || null;
    } catch {
      return null;
    }
  });
  const [selectedEmployeeProfile, setSelectedEmployeeProfile] = useState<UserMaster | null>(null);

  const handleLogin = async (employeeCode: string, password: string) => {
    await login(employeeCode, password);
    setSelectedModule(null); // Reset to dashboard on login
  };

  const handleLogout = () => {
    logout();
    setSelectedModule(null);
    setSelectedEmployeeProfile(null);
    try { localStorage.removeItem('sppl_selected_module'); } catch {}
  };

  const handleModuleSelect = (moduleId: string) => {
    setSelectedModule(moduleId);
    try { localStorage.setItem('sppl_selected_module', moduleId); } catch {}
  };

  const handleBackToDashboard = () => {
    setSelectedModule(null);
    setSelectedEmployeeProfile(null);
    try { localStorage.removeItem('sppl_selected_module'); } catch {}
  };

  const handleProfileOpen = () => {
    setSelectedEmployeeProfile(null);
    setSelectedModule('profile');
    try { localStorage.setItem('sppl_selected_module', 'profile'); } catch {}
  };

  const handleEmployeeProfileOpen = (employee: UserMaster) => {
    const effectiveUserManagementRole = moduleRoles.userManagement || user?.role || 'User';
    const currentCode = String(user?.employeeCode || '').trim();
    const targetCode = String(employee.employeeCode || employee.employee_code || '').trim();
    const privileged = isAdmin(effectiveUserManagementRole) || isDeveloper(effectiveUserManagementRole);
    if (!privileged && currentCode !== targetCode) {
      return;
    }
    setSelectedEmployeeProfile(employee);
    setSelectedModule('profile');
    try { localStorage.setItem('sppl_selected_module', 'profile'); } catch {}
  };

  const handleBackFromEmployeeProfile = () => {
    setSelectedEmployeeProfile(null);
    setSelectedModule('user-management');
    try { localStorage.setItem('sppl_selected_module', 'user-management'); } catch {}
  };

  // Get module access based on user role
  const moduleAccess = useMemo(() => {
    const ac = accessControl || {};
    return {
      salesForecasting: hasModuleAccess('salesForecasting', ac),
      expenses: hasModuleAccess('expenses', ac),
      payroll: hasModuleAccess('payroll', ac),
      purchases: hasModuleAccess('purchases', ac),
      crm: hasModuleAccess('crm', ac),
      userManagement: hasModuleAccess('userManagement', ac),
    };
  }, [accessControl]);

  const moduleRoles = useMemo(() => {
    const ac = accessControl || {};
    return {
      salesForecasting: getEffectiveRole('salesForecasting', ac),
      expenses: getEffectiveRole('expenses', ac),
      payroll: getEffectiveRole('payroll', ac),
      purchases: getEffectiveRole('purchases', ac),
      crm: getEffectiveRole('crm', ac),
      userManagement: getEffectiveRole('userManagement', ac),
    };
  }, [accessControl]);

  const currentUser: User | null = user
    ? {
        id: user.id,
        employeeCode: user.employeeCode,
        username: user.employeeCode,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        role: user.role,
        profilePhoto: user.profilePhoto,
        officialEmail: user.officialEmail,
      }
    : null;

  const isProfileSelected = selectedModule === 'profile';
  const safeSelectedModule = !isProfileSelected && selectedModule && moduleAccess[
    ({
      'sales-forecasting': 'salesForecasting',
      expenses: 'expenses',
      payroll: 'payroll',
      purchases: 'purchases',
      crm: 'crm',
      'user-management': 'userManagement',
    } as Record<string, keyof typeof moduleAccess>)[selectedModule] || 'salesForecasting'
  ]
    ? selectedModule
    : null;

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {!isAuthenticated ? (
        <LoginPage onLogin={handleLogin} loading={loading} />
      ) : (
        <ProtectedRoute fallback={<LoginPage onLogin={handleLogin} loading={loading} />}>
          {currentUser && isProfileSelected ? (
            <div className="p-6">
              <ProfilePage
                employee={selectedEmployeeProfile}
                isSelfProfile={!selectedEmployeeProfile}
                onBack={selectedEmployeeProfile ? handleBackFromEmployeeProfile : handleBackToDashboard}
              />
            </div>
          ) : currentUser && safeSelectedModule ? (
            <Dashboard
              user={currentUser}
              onLogout={handleLogout}
              initialModule={safeSelectedModule}
              onBackToDashboard={handleBackToDashboard}
              moduleAccess={moduleAccess}
              moduleRoles={moduleRoles}
              onProfile={handleProfileOpen}
              onEmployeeCodeClick={handleEmployeeProfileOpen}
            />
          ) : currentUser ? (
            <ModuleDashboard
              userRole={currentUser.role}
              currentUser={currentUser.name}
              onModuleSelect={handleModuleSelect}
              moduleAccess={moduleAccess}
              onLogout={handleLogout}
              onProfile={handleProfileOpen}
            />
          ) : null}
        </ProtectedRoute>
      )}
      <Toaster position="top-right" />
    </div>
  );
}