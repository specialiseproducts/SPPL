import { useState } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import ModuleDashboard from './components/ModuleDashboard';
import { Toaster } from 'sonner';

export type UserRole = 'Admin' | 'User' | 'Accountant';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setSelectedModule(null); // Reset to dashboard on login
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedModule(null);
  };

  const handleModuleSelect = (moduleId: string) => {
    setSelectedModule(moduleId);
  };

  const handleBackToDashboard = () => {
    setSelectedModule(null);
  };

  // Get module access based on user role
  const getModuleAccess = (role: UserRole) => {
    if (role === 'Admin') {
      return {
        salesForecasting: true,
        expenses: true,
        payroll: true,
        purchases: true,
        crm: true,
        userManagement: true,
      };
    } else if (role === 'Accountant') {
      return {
        salesForecasting: true,
        expenses: true,
        payroll: true,
        purchases: true,
        crm: false,
        userManagement: false,
      };
    } else {
      // User role
      return {
        salesForecasting: true,
        expenses: true,
        payroll: false,
        purchases: false,
        crm: true,
        userManagement: false,
      };
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {!currentUser ? (
        <LoginPage onLogin={handleLogin} />
      ) : selectedModule ? (
        <Dashboard 
          user={currentUser} 
          onLogout={handleLogout} 
          initialModule={selectedModule}
          onBackToDashboard={handleBackToDashboard}
        />
      ) : (
        <ModuleDashboard
          userRole={currentUser.role}
          currentUser={currentUser.name}
          onModuleSelect={handleModuleSelect}
          moduleAccess={getModuleAccess(currentUser.role)}
          onLogout={handleLogout}
        />
      )}
      <Toaster position="top-right" />
    </div>
  );
}