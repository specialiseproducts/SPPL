import { BarChart3, DollarSign, Users, ShoppingCart, Building2, UserCog, ArrowRight, Activity, CalendarCheck2, ClipboardList } from 'lucide-react';
import { Card } from './ui/card';

interface ModuleDashboardProps {
  onModuleSelect: (module: string) => void;
  moduleAccess: Record<string, boolean>;
  showSystemMetrics?: boolean;
}

interface ModuleCard {
  id: string;
  name: string;
  icon: typeof BarChart3;
  description: string;
  color: string;
  iconBackground?: string;
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
    id: 'daily-planner',
    name: 'Daily Planner',
    icon: CalendarCheck2,
    description: 'Plan daily tasks and track team progress',
    color: '',
    iconBackground: '#14B8A6',
    accessKey: 'dailyPlanner',
  },
  {
    id: 'order-processing',
    name: 'Order Processing',
    icon: ClipboardList,
    description: 'Manage customer order processing forms',
    color: '',
    iconBackground: '#0891B2',
    accessKey: 'orderProcessing',
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

const SYSTEM_METRICS_CARD: ModuleCard = {
  id: 'system-metrics',
  name: 'System Metrics',
  icon: Activity,
  description: 'API latency, DynamoDB usage, and frontend performance',
  color: 'bg-slate-600',
  accessKey: 'systemMetrics',
};

export default function ModuleDashboard({
  onModuleSelect,
  moduleAccess,
  showSystemMetrics,
}: ModuleDashboardProps) {
  const availableModules = ALL_MODULES.filter((module) => moduleAccess[module.accessKey]);
  if (showSystemMetrics) availableModules.push(SYSTEM_METRICS_CARD);

  return (
    <div className="w-full" style={{ paddingBottom: '7rem' }}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {availableModules.map((module) => {
          const Icon = module.icon;
          return (
            <Card
              key={module.id}
              onClick={() => onModuleSelect(module.id)}
              className="group relative cursor-pointer overflow-hidden border-2 transition-all duration-300 hover:scale-105 hover:border-[#007BFF] hover:shadow-xl active:scale-100"
            >
              <div className="p-8">
                <div
                  className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${module.color} transition-transform duration-300 group-hover:scale-110`}
                  style={module.iconBackground ? { backgroundColor: module.iconBackground } : undefined}
                >
                  <Icon className="h-8 w-8 text-white" />
                </div>

                <h3 className="mb-2 text-[#212529] transition-colors group-hover:text-[#007BFF]">{module.name}</h3>

                <p className="mb-6 text-sm text-gray-600">{module.description}</p>

                <div className="flex items-center text-[#007BFF] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="mr-2 text-sm font-medium">Open Module</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-blue-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </Card>
          );
        })}
      </div>

      {availableModules.length === 0 && (
        <div className="py-16 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
            <UserCog className="h-12 w-12 text-gray-400" />
          </div>
          <h2 className="mb-2 text-[#212529]">No Modules Available</h2>
          <p className="text-gray-600">
            You don&apos;t have access to any modules yet. Please contact your administrator.
          </p>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white py-4">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-center text-sm text-gray-500">
            Spécialisé Products Private Limited © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
