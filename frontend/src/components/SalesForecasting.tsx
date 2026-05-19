import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import SalesForecastingTab from './SalesForecastingTab';
import SalesMasterDataPage from './sales/SalesMasterDataPage';
import type { User } from '../App';
import type { UserMaster } from './UserCreationTab';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { isAdmin, isDeveloper, isSuperAdmin } from '../utils/accessControl';
import { salesQueryKeys } from '../hooks/sales/salesQueryKeys';
import { cn } from './ui/utils';

interface SalesForecastingProps {
  user: User;
  availableUsers: UserMaster[];
  moduleRole: User['role'];
}

const sharedTabProps = (user: User, availableUsers: UserMaster[], moduleRole: User['role']) =>
  ({
    userRole: moduleRole,
    currentUserName: user.name,
    currentEmployeeCode: user.employeeCode || user.id,
    availableUsers,
  }) as const;

export default function SalesForecasting({ user, availableUsers, moduleRole }: SalesForecastingProps) {
  const showAdminTabs = isSuperAdmin(moduleRole) || isAdmin(moduleRole) || isDeveloper(moduleRole);
  const [salesTab, setSalesTab] = useState('my-quotations');
  const queryClient = useQueryClient();

  const handleMastersChanged = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: salesQueryKeys.masters() });
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">Sales Forecasting</h1>
      </div>

      {showAdminTabs ? (
        <>
          <Tabs value={salesTab} onValueChange={setSalesTab} className="w-full">
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="my-quotations">My Quotations</TabsTrigger>
              <TabsTrigger value="team-quotations">Team Quotations</TabsTrigger>
              <TabsTrigger value="master-data">Sales Master Data</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className={cn('mt-6', salesTab !== 'my-quotations' ? 'hidden' : undefined)}>
            <SalesForecastingTab
              {...sharedTabProps(user, availableUsers, moduleRole)}
              viewScope="self"
            />
          </div>
          <div className={cn('mt-6', salesTab !== 'team-quotations' ? 'hidden' : undefined)}>
            <SalesForecastingTab
              {...sharedTabProps(user, availableUsers, moduleRole)}
              viewScope="team"
            />
          </div>
          <div className={cn('mt-6', salesTab !== 'master-data' ? 'hidden' : undefined)}>
            <SalesMasterDataPage onMastersChanged={handleMastersChanged} />
          </div>
        </>
      ) : (
        <SalesForecastingTab {...sharedTabProps(user, availableUsers, moduleRole)} viewScope="self" />
      )}
    </div>
  );
}
