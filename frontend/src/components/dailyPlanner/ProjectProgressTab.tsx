import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  addProjectObservation,
  fetchProjectDetails,
  fetchProjectProgress,
  type ProjectProgressRow,
} from '../../hooks/dailyPlanner/dailyPlannerApi';
import { dailyPlannerQueryKeys } from '../../hooks/dailyPlanner/dailyPlannerQueryKeys';
import { isQueryColdLoading } from '../../utils/queryLoading';
import BulletPointList from './BulletPointList';

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProjectProgressTab() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [...dailyPlannerQueryKeys.all, 'projectProgress'] as const,
    queryFn: fetchProjectProgress,
  });
  const isLoading = isQueryColdLoading(query);
  const projects = query.data ?? [];

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const detailsQuery = useQuery({
    queryKey: [...dailyPlannerQueryKeys.all, 'projectDetails', selectedKey] as const,
    queryFn: () => fetchProjectDetails(selectedKey!),
    enabled: Boolean(selectedKey),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [obsText, setObsText] = useState('');
  const [obsTaskId, setObsTaskId] = useState('');
  const [savingObs, setSavingObs] = useState(false);

  const openDetails = (project: ProjectProgressRow) => {
    setSelectedKey(project.projectKey);
    setAddOpen(false);
    setObsText('');
    setObsTaskId('');
  };

  const handleAddObservation = async () => {
    if (!selectedKey) return;
    if (!obsText.trim()) {
      toast.error('Observation text is required');
      return;
    }
    setSavingObs(true);
    try {
      await addProjectObservation(selectedKey, {
        observationText: obsText.trim(),
        projectTaskId: obsTaskId || undefined,
      });
      toast.success('Observation added');
      setAddOpen(false);
      setObsText('');
      await detailsQuery.refetch();
      await queryClient.invalidateQueries({
        queryKey: [...dailyPlannerQueryKeys.all, 'projectProgress'],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add observation');
    } finally {
      setSavingObs(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading project progress…</p>;
  }

  if (projects.length === 0) {
    return (
      <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        No connected projects with progress data yet.
      </p>
    );
  }

  const details = detailsQuery.data;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Overall progress uses task contribution × task progress (managed projects). Click a card
        for details and observations.
      </p>
      {projects.map((project) => {
        const pct =
          project.progressPercent == null || !Number.isFinite(Number(project.progressPercent))
            ? null
            : Number(project.progressPercent);
        return (
          <Card
            key={project.projectKey}
            className="cursor-pointer border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300"
            onClick={() => openDetails(project)}
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-[#212529]">{project.projectName}</h3>
              <span className="text-sm font-medium text-[#212529]">
                {pct == null
                  ? project.managed && project.allocationValid === false
                    ? 'Allocation incomplete'
                    : '—'
                  : `${pct}%`}
                {' · '}
                {project.employeeCount} employee
                {project.employeeCount === 1 ? '' : 's'}
              </span>
            </div>
            <Progress
              value={pct == null ? 0 : Math.max(0, Math.min(100, pct))}
              className="h-2.5"
            />
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
        );
      })}

      <Dialog
        open={Boolean(selectedKey)}
        onOpenChange={(v) => {
          if (!v) setSelectedKey(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{details?.project.projectName || 'Project details'}</DialogTitle>
          </DialogHeader>
          {detailsQuery.isLoading || !details ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Overall project progress</p>
                <p className="text-lg font-semibold text-[#212529]">
                  {details.project.progressPercent == null
                    ? details.project.allocationValid === false
                      ? 'Allocation incomplete'
                      : '—'
                    : `${details.project.progressPercent}%`}
                </p>
                {details.project.progressPercent != null ? (
                  <Progress
                    value={Math.max(0, Math.min(100, Number(details.project.progressPercent)))}
                    className="mt-2 h-2.5"
                  />
                ) : null}
              </div>

              {(details.project.tasks || []).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#212529]">Project tasks</p>
                  <ul className="space-y-2">
                    {(details.project.tasks || []).map((t) => (
                      <li
                        key={t.projectTaskId}
                        className="rounded-md border border-gray-100 px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium">{t.taskName}</span>
                          <span className="text-gray-600">
                            Contribution {t.contributionPercent}% · Progress{' '}
                            {t.taskProgressPercent}%
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-sm font-medium text-[#212529]">Participants</p>
                <ul className="space-y-1">
                  {details.project.employees.map((emp) => (
                    <li
                      key={emp.employeeCode}
                      className="flex justify-between text-sm text-gray-700"
                    >
                      <span>{emp.employeeName}</span>
                      <span>{emp.progressPercent}%</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#212529]">Observations</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                    Add Observation
                  </Button>
                </div>
                {details.observations.length === 0 ? (
                  <p className="text-sm text-gray-500">No observations yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {details.observations.map((obs) => (
                      <li
                        key={obs.observationId}
                        className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                      >
                        <p className="text-xs text-gray-500">
                          {obs.taskName || '—'} · {obs.employeeName} ·{' '}
                          {formatWhen(obs.submittedAt)}
                        </p>
                        <div className="mt-1 text-gray-800">
                          <BulletPointList text={obs.observationText} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Observation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(details?.project.tasks || []).length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="obs-task">Project task</Label>
                <select
                  id="obs-task"
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  value={obsTaskId}
                  onChange={(e) => setObsTaskId(e.target.value)}
                >
                  <option value="">Select task (optional)</option>
                  {(details?.project.tasks || []).map((t) => (
                    <option key={t.projectTaskId} value={t.projectTaskId}>
                      {t.taskName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="obs-text">Observation *</Label>
              <Textarea
                id="obs-text"
                rows={4}
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
                disabled={savingObs}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingObs}
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={savingObs} onClick={() => void handleAddObservation()}>
              {savingObs ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
