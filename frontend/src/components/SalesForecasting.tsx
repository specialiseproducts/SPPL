import { useCallback, useState } from 'react';
import SalesForecastingTab from './SalesForecastingTab';
import SalesMasterDataPage from './sales/SalesMasterDataPage';
import SalesPlannerTab from './sales/planner/SalesPlannerTab';
import type { User } from '../App';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { cn } from './ui/utils';
import { isAdmin, isDeveloper, isSuperAdmin } from '../utils/accessControl';
import { useInvalidateSalesMasters } from '../hooks/sales/useSalesQueries';
import { SalesDataProvider } from '../hooks/sales/SalesDataContext';

interface SalesForecastingProps {
  user: User;
  moduleRole: User['role'];
}

const sharedTabProps = (user: User, moduleRole: User['role']) =>
  ({
    userRole: moduleRole,
    currentUserName: user.name,
    currentEmployeeCode: user.employeeCode || user.id,
  }) as const;

export default function SalesForecasting({ user, moduleRole }: SalesForecastingProps) {
  const showAdminTabs = isSuperAdmin(moduleRole) || isAdmin(moduleRole) || isDeveloper(moduleRole);
  const [salesTab, setSalesTab] = useState('my-quotations');
  const invalidateMasters = useInvalidateSalesMasters();

  const handleMastersChanged = useCallback(() => {
    invalidateMasters();
  }, [invalidateMasters]);

  const quotationViewScope = salesTab === 'team-quotations' ? 'team' : 'self';

  return (
    <SalesDataProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-[#212529] mb-2">Sales Forecasting</h1>
        </div>

        {showAdminTabs ? (
          <Tabs value={salesTab} onValueChange={setSalesTab} className="w-full">
            <TabsList
              className="grid w-full max-w-4xl"
              style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
            >
              <TabsTrigger value="planner">Team Planner</TabsTrigger>
              <TabsTrigger value="my-quotations">My Quotations</TabsTrigger>
              <TabsTrigger value="team-quotations">Team Quotations</TabsTrigger>
              <TabsTrigger value="master-data">Sales Master Data</TabsTrigger>
            </TabsList>

            <TabsContent value="planner" className="mt-6 outline-none">
              <SalesPlannerTab
                isTeamPlanner
                currentEmployeeCode={user.employeeCode || user.id}
                onQuotationCreated={() => setSalesTab('my-quotations')}
              />
            </TabsContent>

            {/* Keep quotations mounted — tab switch is client-side filter only */}
            <div
              className={cn(
                'mt-6',
                (salesTab === 'master-data' || salesTab === 'planner') && 'hidden',
              )}
              aria-hidden={salesTab === 'master-data' || salesTab === 'planner'}
            >
              <SalesForecastingTab {...sharedTabProps(user, moduleRole)} viewScope={quotationViewScope} />
            </div>

            <TabsContent value="master-data" className="mt-6 outline-none">
              <SalesMasterDataPage onMastersChanged={handleMastersChanged} />
            </TabsContent>
          </Tabs>
        ) : (
          <Tabs value={salesTab} onValueChange={setSalesTab} className="w-full">
            <TabsList
              className="grid w-full max-w-md"
              style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
            >
              <TabsTrigger value="planner">Planner</TabsTrigger>
              <TabsTrigger value="my-quotations">My Quotations</TabsTrigger>
            </TabsList>

            <TabsContent value="planner" className="mt-6 outline-none">
              <SalesPlannerTab onQuotationCreated={() => setSalesTab('my-quotations')} />
            </TabsContent>

            <div
              className={cn('mt-6', salesTab === 'planner' && 'hidden')}
              aria-hidden={salesTab === 'planner'}
            >
              <SalesForecastingTab {...sharedTabProps(user, moduleRole)} viewScope="self" />
            </div>
          </Tabs>
        )}
      </div>
    </SalesDataProvider>
  );
}
