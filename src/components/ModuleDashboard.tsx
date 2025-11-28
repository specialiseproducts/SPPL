import { BarChart3, DollarSign, Users, ShoppingCart, Building2, UserCog, ArrowRight, LogOut } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { UserRole } from '../App';

interface ModuleDashboardProps {
  userRole: UserRole;
  currentUser: string;
  onModuleSelect: (module: string) => void;
  moduleAccess: Record<string, boolean>;
  onLogout: () => void;
}

interface ModuleCard {
  id: string;
  name: string;
  icon: any;
  description: string;
  color: string;
  accessKey: string;
}

const ALL_MODULES: ModuleCard[] = [
  {
    id: 'sales-forecasting',
    name: 'Sales Forecasting',
    icon: BarChart3,
    description: 'Manage quotations and sales forecasts',
    color: 'bg-blue-500',
    accessKey: 'salesForecasting',
  },
  {
    id: 'expenses',
    name: 'Expenses',
    icon: DollarSign,
    description: 'Track and manage company expenses',
    color: 'bg-green-500',
    accessKey: 'expenses',
  },
  {
    id: 'payroll',
    name: 'Payroll',
    icon: Users,
    description: 'Employee payroll management',
    color: 'bg-purple-500',
    accessKey: 'payroll',
  },
  {
    id: 'purchases',
    name: 'Purchases',
    icon: ShoppingCart,
    description: 'Manage costing, duties, and margins',
    color: 'bg-orange-500',
    accessKey: 'purchases',
  },
  {
    id: 'crm',
    name: 'CRM',
    icon: Building2,
    description: 'Customer relationship management',
    color: 'bg-pink-500',
    accessKey: 'crm',
  },
  {
    id: 'user-management',
    name: 'User Management',
    icon: UserCog,
    description: 'Manage users and access control',
    color: 'bg-indigo-500',
    accessKey: 'userManagement',
  },
];

export default function ModuleDashboard({ userRole, currentUser, onModuleSelect, moduleAccess, onLogout }: ModuleDashboardProps) {
  // Filter modules based on user access
  const availableModules = ALL_MODULES.filter(module => moduleAccess[module.accessKey]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getRoleBadgeColor = () => {
    switch (userRole) {
      case 'Admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Accountant':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'User':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                <ImageWithFallback 
                  src="/logo.png" 
                  alt="Spécialisé Products Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="text-[#212529] block">Spécialisé Products Private Limited</span>
                <p className="text-sm text-gray-600">
                  {getGreeting()}, <span className="text-[#007BFF]">{currentUser}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`px-4 py-2 rounded-lg border ${getRoleBadgeColor()}`}>
                <span className="text-sm font-medium">{userRole}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
                className="text-gray-600 hover:text-[#007BFF]"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Module Cards Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableModules.map((module) => {
            const Icon = module.icon;
            return (
              <Card
                key={module.id}
                onClick={() => onModuleSelect(module.id)}
                className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-100 border-2 hover:border-[#007BFF]"
              >
                <div className="p-8">
                  {/* Icon Circle */}
                  <div className={`w-16 h-16 ${module.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  {/* Module Name */}
                  <h3 className="text-[#212529] mb-2 group-hover:text-[#007BFF] transition-colors">
                    {module.name}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-6">
                    {module.description}
                  </p>

                  {/* Arrow Icon */}
                  <div className="flex items-center text-[#007BFF] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-sm font-medium mr-2">Open Module</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>

                {/* Decorative gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </Card>
            );
          })}
        </div>

        {/* No modules message */}
        {availableModules.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCog className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-[#212529] mb-2">No Modules Available</h2>
            <p className="text-gray-600">
              You don't have access to any modules yet. Please contact your administrator.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t py-4">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-sm text-gray-500 text-center">
            Spécialisé Products Private Limited © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}