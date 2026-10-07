import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import { fetchProjectProgress } from '../../hooks/dailyPlanner/dailyPlannerApi';
import { dailyPlannerQueryKeys } from '../../hooks/dailyPlanner/dailyPlannerQueryKeys';
import { isQueryColdLoading } from '../../utils/queryLoading';

export default function ProjectProgressTab() {
  const query = useQuery({
    queryKey: [...dailyPlannerQueryKeys.all, 'projectProgress'] as const,
    queryFn: fetchProjectProgress,
  });
  const isLoading = isQueryColdLoading(query);
  const projects = query.data ?? [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading project progress…</p>;
  }

  if (projects.length === 0) {
    return (
      <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        No project-based tasks with Progress Done (%) yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Project progress is the average of each contributing employee&apos;s average task progress.
      </p>
      {projects.map((project) => (
        <Card key={project.projectKey} className="border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-[#212529]">{project.projectName}</h3>
            <span className="text-sm font-medium text-[#212529]">
              {project.progressPercent}% · {project.employeeCount} employee
              {project.employeeCount === 1 ? '' : 's'}
            </span>
          </div>
          <Progress value={Math.max(0, Math.min(100, project.progressPercent))} className="h-2.5" />
          <ul className="mt-3 space-y-1.5">
            {project.employees.map((emp) => (
              <li
                key={emp.employeeCode}
                className="flex items-center justify-between text-sm text-gray-700"
              >
                <span>{emp.employeeName}</span>
                <span className="font-medium text-[#212529]">{emp.progressPercent}%</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
