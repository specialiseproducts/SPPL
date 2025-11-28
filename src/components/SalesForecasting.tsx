import SalesForecastingTab from './SalesForecastingTab';
import type { User } from '../App';
import type { UserMaster } from './UserCreationTab';

interface SalesForecastingProps {
  user: User;
  availableUsers: UserMaster[];
}

export default function SalesForecasting({ user, availableUsers }: SalesForecastingProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">Sales Forecasting</h1>
        <p className="text-gray-600">
          Manage and track all quotation details, pricing, probability, and sales projections.
        </p>
      </div>

      <SalesForecastingTab
        userRole={user.role}
        currentUserName={user.name}
        currentEmployeeCode={user.username}
        availableUsers={availableUsers}
      />
    </div>
  );
}
