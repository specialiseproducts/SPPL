import { TrendingUp, DollarSign, Users as UsersIcon, ShoppingCart, UserCog, FileText, ChevronLeft, ChevronRight, LayoutGrid, Activity, CalendarCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';

export type ModuleName =
  | 'Sales Forecasting'
  | 'Expenses'
  | 'Payroll'
  | 'Purchases'
  | 'CRM'
  | 'User Management'
  | 'Daily Planner'
  | 'System Metrics';

interface SidebarProps {
  activeModule: ModuleName;
  onModuleChange: (module: ModuleName) => void;
  moduleAccess: Record<string, boolean>;
  onBackToDashboard?: () => void;
  showSystemMetrics?: boolean;
}

interface Module {
  name: ModuleName;
  icon: React.ReactNode;
  accessKey: string;
}

const modules: Module[] = [
  { name: 'Sales Forecasting', icon: <TrendingUp className="w-5 h-5" />, accessKey: 'salesForecasting' },
  { name: 'Expenses', icon: <DollarSign className="w-5 h-5" />, accessKey: 'expenses' },
  { name: 'Payroll', icon: <FileText className="w-5 h-5" />, accessKey: 'payroll' },
  { name: 'Purchases', icon: <ShoppingCart className="w-5 h-5" />, accessKey: 'purchases' },
  { name: 'CRM', icon: <UsersIcon className="w-5 h-5" />, accessKey: 'crm' },
  { name: 'Daily Planner', icon: <CalendarCheck className="w-5 h-5" />, accessKey: 'dailyPlanner' },
  { name: 'User Management', icon: <UserCog className="w-5 h-5" />, accessKey: 'userManagement' },
];

export default function Sidebar({
  activeModule,
  onModuleChange,
  moduleAccess,
  onBackToDashboard,
  showSystemMetrics,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const accessibleModules = modules.filter((module) => Boolean(moduleAccess[module.accessKey]));
  if (showSystemMetrics) {
    accessibleModules.push({
      name: 'System Metrics',
      icon: <Activity className="w-5 h-5" />,
      accessKey: 'systemMetrics',
    });
  }

  return (
    <aside
      className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col flex-shrink-0 overflow-y-auto ${
        collapsed ? 'w-20' : 'w-64'
      }`}
      style={{ height: 'calc(100vh - 4rem)', paddingLeft: 10 }}
      aria-label="Main navigation"
    >
      <div className="flex-1 py-6">
        <nav className="space-y-1 px-3">
          {accessibleModules.map((module) => (
            <button
              key={module.name}
              onClick={() => onModuleChange(module.name)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                activeModule === module.name
                  ? 'bg-[#007BFF] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {module.icon}
              {!collapsed && <span className="text-sm">{module.name}</span>}
            </button>
          ))}
        </nav>
      </div>
      <div className="p-3 border-t border-gray-200 space-y-2">
        {onBackToDashboard && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToDashboard}
            className="w-full justify-center gap-2 text-[#007BFF] border-[#007BFF] hover:bg-blue-50"
          >
            <LayoutGrid className="w-4 h-4" />
            {!collapsed && <span>Back to Dashboard</span>}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>
      </div>
    </aside>
  );
}