import { useEffect, useMemo, useState } from 'react';
import MyDailyPlannerTab from './dailyPlanner/MyDailyPlannerTab';
import TeamDailyPlannerTab from './dailyPlanner/TeamDailyPlannerTab';
import TeamPerformanceTab from './dailyPlanner/TeamPerformanceTab';
import TeamManagementTab from './dailyPlanner/TeamManagementTab';
import MonthlyPlanningReportTab from './dailyPlanner/MonthlyPlanningReportTab';
import type { User } from '../App';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  getDailyPlannerVisibleTabs,
  getDefaultDailyPlannerTab,
  type DailyPlannerTabId,
} from '../utils/accessControl';

interface DailyPlannerProps {
  user: User;
  moduleRole: User['role'];
}

const INITIAL_TAB_KEY = 'dailyPlanner_initial_tab';

const TAB_LABELS: Record<DailyPlannerTabId, string> = {
  'my-daily-planner': 'My Daily Planner',
  'team-daily-planner': 'Team Daily Planner',
  'team-performance': 'Team Performance',
  reports: 'Reports',
  'team-management': 'Team Management',
};

export default function DailyPlanner({ user, moduleRole }: DailyPlannerProps) {
  const visibleTabs = useMemo(
    () => getDailyPlannerVisibleTabs(moduleRole),
    [moduleRole],
  );
  const defaultTab = useMemo(
    () => getDefaultDailyPlannerTab(moduleRole),
    [moduleRole],
  );
  const [tab, setTab] = useState<DailyPlannerTabId>(defaultTab);

  useEffect(() => {
    const initial = localStorage.getItem(INITIAL_TAB_KEY);
    if (!initial) return;
    localStorage.removeItem(INITIAL_TAB_KEY);
    if (visibleTabs.includes(initial as DailyPlannerTabId)) {
      setTab(initial as DailyPlannerTabId);
    }
  }, [visibleTabs]);

  useEffect(() => {
    if (!visibleTabs.includes(tab)) {
      setTab(defaultTab);
    }
  }, [visibleTabs, tab, defaultTab]);

  const columns = Math.max(visibleTabs.length, 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">Daily Planner</h1>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as DailyPlannerTabId)}
        className="w-full"
      >
        <TabsList
          className="grid w-full max-w-4xl"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {visibleTabs.map((id) => (
            <TabsTrigger key={id} value={id}>
              {TAB_LABELS[id]}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleTabs.includes('my-daily-planner') ? (
          <TabsContent value="my-daily-planner" className="mt-6 outline-none">
            <MyDailyPlannerTab />
          </TabsContent>
        ) : null}

        {visibleTabs.includes('team-daily-planner') ? (
          <TabsContent value="team-daily-planner" className="mt-6 outline-none">
            <TeamDailyPlannerTab />
          </TabsContent>
        ) : null}

        {visibleTabs.includes('team-performance') ? (
          <TabsContent value="team-performance" className="mt-6 outline-none">
            <TeamPerformanceTab />
          </TabsContent>
        ) : null}

        {visibleTabs.includes('reports') ? (
          <TabsContent value="reports" className="mt-6 outline-none">
            <MonthlyPlanningReportTab moduleRole={moduleRole} />
          </TabsContent>
        ) : null}

        {visibleTabs.includes('team-management') ? (
          <TabsContent value="team-management" className="mt-6 outline-none">
            <TeamManagementTab user={user} moduleRole={moduleRole} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
