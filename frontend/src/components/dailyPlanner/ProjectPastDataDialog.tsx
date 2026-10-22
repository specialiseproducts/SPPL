import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { DailyPlannerTask } from '../../types/dailyPlanner';
import { fetchProjectCompletedTasks } from '../../hooks/dailyPlanner/dailyPlannerApi';
import { formatMinutesLabel, resolveProcedureSteps } from '../../utils/dailyPlannerProcedureSteps';
import { formatDurationLabel } from '../../utils/planningRecognition';
import { getDailyTaskStatusLabel, todayIso } from './dailyPlannerUtils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

/** Same normalization as the backend (lowercase, collapsed whitespace). */
export function normalizeProjectKey(name: string | undefined | null): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function defaultFromDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return todayIso(d);
}

interface ProjectPastDataDialogProps {
  open: boolean;
  projectName: string;
  /** Narrow results to one employee (optional); default is the manager's whole team. */
  employeeCode?: string;
  onClose: () => void;
}

export default function ProjectPastDataDialog({
  open,
  projectName,
  employeeCode,
  onClose,
}: ProjectPastDataDialogProps) {
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(() => todayIso());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DailyPlannerTask[] | null>(null);
  const projectKey = normalizeProjectKey(projectName);

  useEffect(() => {
    if (!open) return;
    setFromDate(defaultFromDate());
    setToDate(todayIso());
    setRows(null);
  }, [open, projectKey]);

  const handleRetrieve = async () => {
    if (!projectKey) {
      toast.error('Project name is required');
      return;
    }
    if (!fromDate || !toDate) {
      toast.error('From Date and To Date are required');
      return;
    }
    if (fromDate > toDate) {
      toast.error('From Date must not be after To Date');
      return;
    }
    setLoading(true);
    try {
      const tasks = await fetchProjectCompletedTasks(projectKey, {
        from: fromDate,
        to: toDate,
        employeeCode: employeeCode || undefined,
      });
      setRows(tasks);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to retrieve past data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="!flex !h-[min(90dvh,880px)] !max-h-[90dvh] !w-[min(96vw,960px)] !max-w-[960px] !flex-col !gap-0 overflow-hidden !p-0 sm:!max-w-[960px]"
        style={{
          height: 'min(90dvh, 880px)',
          maxHeight: '90dvh',
          width: 'min(96vw, 960px)',
          maxWidth: '960px',
        }}
      >
        <DialogHeader className="shrink-0 border-b border-gray-200 px-6 py-3 pr-12 text-left">
          <DialogTitle>Past Data — {projectName || 'Project'}</DialogTitle>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-gray-100 px-6 py-3">
          <div className="space-y-1.5">
            <Label htmlFor="past-data-from">From Date</Label>
            <Input
              id="past-data-from"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              disabled={loading}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="past-data-to">To Date</Label>
            <Input
              id="past-data-to"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              disabled={loading}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className="bg-[#007BFF] hover:bg-[#0056b3]"
            disabled={loading}
            onClick={() => void handleRetrieve()}
          >
            {loading ? 'Retrieving…' : 'Apply / Retrieve'}
          </Button>
        </div>

        {/*
          Table data is the only vertical scroll region.
          Sticky thead keeps column headers visible (avoids Table wrapper overflow fighting sticky).
        */}
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-6 py-3">
          {rows === null ? (
            <p className="text-sm text-gray-600">
              Select a date range and click Apply / Retrieve to see completed tasks for this
              project.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-600">
              No completed tasks found for this project in the selected range.
            </p>
          ) : (
            <table className="w-full caption-bottom border-separate border-spacing-0 text-sm">
              <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="bg-white">Date</TableHead>
                  <TableHead className="bg-white">Employee</TableHead>
                  <TableHead className="bg-white">Task</TableHead>
                  <TableHead className="bg-white">Steps</TableHead>
                  <TableHead className="bg-white">Planned</TableHead>
                  <TableHead className="bg-white">Status</TableHead>
                  <TableHead className="bg-white">Manager Comments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => {
                  const steps = resolveProcedureSteps(t);
                  return (
                    <TableRow key={t.plannerTaskId} className="align-top">
                      <TableCell className="whitespace-nowrap">{t.date || '—'}</TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="text-sm">{t.employeeName || t.employeeCode}</div>
                        {t.employeeName ? (
                          <div className="text-xs text-gray-500">{t.employeeCode}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="min-w-[140px] whitespace-normal break-words">
                        {t.taskName || '—'}
                      </TableCell>
                      <TableCell className="min-w-[220px] whitespace-normal">
                        {steps.length === 0 ? (
                          '—'
                        ) : (
                          <ul className="space-y-1 text-sm">
                            {steps.map((s) => (
                              <li key={s.stepId} className="flex gap-2">
                                <span className="text-gray-500">•</span>
                                <span className="break-words">
                                  {s.description}{' '}
                                  <span className="text-xs text-gray-500">
                                    ({formatMinutesLabel(s.plannedMinutes)})
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {t.hoursRequired != null && Number.isFinite(Number(t.hoursRequired))
                          ? formatDurationLabel(Number(t.hoursRequired))
                          : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {getDailyTaskStatusLabel(t.status)}
                      </TableCell>
                      <TableCell className="min-w-[140px] whitespace-normal break-words">
                        {t.managerComments?.trim() || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </table>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-gray-200 px-6 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
