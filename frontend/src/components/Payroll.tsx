import { useEffect, useMemo, useState } from 'react';
import type { User } from '../App';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  getDefaultPayrollTab,
  getPayrollVisibleTabs,
  isPayrollTabVisible,
  type PayrollTabId,
} from '../utils/accessControl';
import MyCalendarTab from './payroll/MyCalendarTab';
import TeamCalendarTab from './payroll/TeamCalendarTab';
import PayrollTeamTab from './payroll/PayrollTeamTab';

interface PayrollProps {
  user: User;
  /** Effective Payroll module role from Access Management (`moduleRoles.payroll`). */
  moduleRole: User['role'];
}

const TAB_LABELS: Record<PayrollTabId, string> = {
  'my-calendar': 'My Calendar',
  'team-calendar': 'Team Calendar',
  'payroll-team': 'Payroll Team',
};

export default function Payroll({ user, moduleRole }: PayrollProps) {
  const visibleTabs = useMemo(() => getPayrollVisibleTabs(moduleRole), [moduleRole]);
  const defaultTab = useMemo(() => getDefaultPayrollTab(moduleRole), [moduleRole]);
  const [tab, setTab] = useState<PayrollTabId>(defaultTab);

  useEffect(() => {
    // Access demotion / stale client state → always fall back to My Calendar.
    if (!visibleTabs.includes(tab)) {
      setTab(defaultTab);
    }
  }, [visibleTabs, tab, defaultTab]);

  const selectTab = (value: string) => {
    if (!isPayrollTabVisible(value, moduleRole)) {
      setTab(defaultTab);
      return;
    }
    setTab(value);
  };

  const columns = Math.max(visibleTabs.length, 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">Payroll</h1>
      </div>

      <Tabs value={tab} onValueChange={selectTab} className="w-full">
        <TabsList
          className="grid w-full max-w-5xl"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {visibleTabs.map((id) => (
            <TabsTrigger key={id} value={id}>
              {TAB_LABELS[id]}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleTabs.includes('my-calendar') ? (
          <TabsContent value="my-calendar" className="mt-6 outline-none">
            <MyCalendarTab />
          </TabsContent>
        ) : null}

        {visibleTabs.includes('team-calendar') ? (
          <TabsContent value="team-calendar" className="mt-6 outline-none">
            <TeamCalendarTab />
          </TabsContent>
        ) : null}

        {visibleTabs.includes('payroll-team') ? (
          <TabsContent value="payroll-team" className="mt-6 outline-none">
            <PayrollTeamTab user={user} moduleRole={moduleRole} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
