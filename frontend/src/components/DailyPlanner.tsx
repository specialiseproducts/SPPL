import { useEffect, useState } from 'react';
import MyDailyPlannerTab from './dailyPlanner/MyDailyPlannerTab';
import TeamDailyPlannerTab from './dailyPlanner/TeamDailyPlannerTab';
import TeamPerformanceTab from './dailyPlanner/TeamPerformanceTab';
import TeamManagementTab from './dailyPlanner/TeamManagementTab';
import MonthlyPlanningReportTab from './dailyPlanner/MonthlyPlanningReportTab';
import type { User } from '../App';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { canManageDailyPlannerTeam } from '../utils/accessControl';

interface DailyPlannerProps {
  user: User;
  moduleRole: User['role'];
}

const INITIAL_TAB_KEY = 'dailyPlanner_initial_tab';

export default function DailyPlanner({ user, moduleRole }: DailyPlannerProps) {
  const showTeamTabs = canManageDailyPlannerTeam(moduleRole);
  const [tab, setTab] = useState('my-daily-planner');

  useEffect(() => {
    const initial = localStorage.getItem(INITIAL_TAB_KEY);
    if (!initial) return;
    setTab(initial);
    localStorage.removeItem(INITIAL_TAB_KEY);
  }, []);

  if (showTeamTabs) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[#212529] mb-2">Daily Planner</h1>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList
            className="grid w-full max-w-4xl"
            style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
          >
            <TabsTrigger value="my-daily-planner">My Daily Planner</TabsTrigger>
            <TabsTrigger value="team-daily-planner">Team Daily Planner</TabsTrigger>
            <TabsTrigger value="team-performance">Team Performance</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="team-management">Team Management</TabsTrigger>
          </TabsList>

          <TabsContent value="my-daily-planner" className="mt-6 outline-none">
            <MyDailyPlannerTab />
          </TabsContent>
          <TabsContent value="team-daily-planner" className="mt-6 outline-none">
            <TeamDailyPlannerTab />
          </TabsContent>
          <TabsContent value="team-performance" className="mt-6 outline-none">
            <TeamPerformanceTab />
          </TabsContent>
          <TabsContent value="reports" className="mt-6 outline-none">
            <MonthlyPlanningReportTab moduleRole={moduleRole} />
          </TabsContent>
          <TabsContent value="team-management" className="mt-6 outline-none">
            <TeamManagementTab user={user} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">Daily Planner</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList
          className="grid w-full max-w-md"
          style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
        >
          <TabsTrigger value="my-daily-planner">My Daily Planner</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="my-daily-planner" className="mt-6 outline-none">
          <MyDailyPlannerTab />
        </TabsContent>
        <TabsContent value="reports" className="mt-6 outline-none">
          <MonthlyPlanningReportTab moduleRole={moduleRole} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
