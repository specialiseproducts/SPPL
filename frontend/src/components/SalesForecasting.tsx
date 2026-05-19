import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import SalesForecastingTab from './SalesForecastingTab';
import SalesMasterDataPage from './sales/SalesMasterDataPage';
import type { User } from '../App';
import type { UserMaster } from './UserCreationTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { isAdmin, isDeveloper, isSuperAdmin } from '../utils/accessControl';
import { salesQueryKeys } from '../hooks/sales/salesQueryKeys';

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
    void queryClient.invalidateQueries({ queryKey: salesQueryKeys.all });
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">Sales Forecasting</h1>
      </div>

      {showAdminTabs ? (
        <Tabs value={salesTab} onValueChange={setSalesTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="my-quotations">My Quotations</TabsTrigger>
            <TabsTrigger value="team-quotations">Team Quotations</TabsTrigger>
            <TabsTrigger value="master-data">Sales Master Data</TabsTrigger>
          </TabsList>
          <TabsContent value="my-quotations" className="mt-6">
            {salesTab === 'my-quotations' ? (
              <SalesForecastingTab
                {...sharedTabProps(user, availableUsers, moduleRole)}
                viewScope="self"
              />
            ) : null}
          </TabsContent>
          <TabsContent value="team-quotations" className="mt-6">
            {salesTab === 'team-quotations' ? (
              <SalesForecastingTab
                {...sharedTabProps(user, availableUsers, moduleRole)}
                viewScope="team"
              />
            ) : null}
          </TabsContent>
          <TabsContent value="master-data" className="mt-6">
            {salesTab === 'master-data' ? (
              <SalesMasterDataPage onMastersChanged={handleMastersChanged} />
            ) : null}
          </TabsContent>
        </Tabs>
      ) : (
        <SalesForecastingTab {...sharedTabProps(user, availableUsers, moduleRole)} viewScope="self" />
      )}
    </div>
  );
}
