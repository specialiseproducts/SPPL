import type { ReactNode } from 'react';
import type { DailyPlannerTask, DailyPlannerTaskDraft } from '../../types/dailyPlanner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import BulletPointList from './BulletPointList';
import { isUrgentTask, PLANNING_CATEGORY_REGULAR } from '../../utils/planningRecognition';

function displayCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

function ViewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="text-sm text-[#212529] break-words">{value}</div>
    </div>
  );
}

function ViewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-[#212529]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ViewBulletField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="min-h-[2.5rem] rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
        <BulletPointList text={value} />
      </div>
    </div>
  );
}

function formatReviewDate(iso: string): string {
  const [y, m, d] = String(iso || '')
    .slice(0, 10)
    .split('-')
    .map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

type SummaryItem = {
  taskName: string;
  description: string;
  priority: string;
  hoursRequired: number | null;
  planningCategory: string;
  isProjectBased?: boolean;
  projectName?: string;
  managerInstructions?: string;
  managerComments?: string;
  status?: string;
};

function toItemsFromDrafts(drafts: DailyPlannerTaskDraft[]): SummaryItem[] {
  return drafts.map((d) => ({
    taskName: d.taskName,
    description: d.description,
    priority: d.priority,
    hoursRequired: d.hoursRequired,
    planningCategory: d.planningCategory || PLANNING_CATEGORY_REGULAR,
    isProjectBased: d.isProjectBased,
    projectName: d.projectName,
    managerInstructions: d.managerInstructions,
  }));
}

function toItemsFromTasks(tasks: DailyPlannerTask[]): SummaryItem[] {
  return tasks.map((t) => ({
    taskName: t.taskName,
    description: t.description,
    priority: t.currentPriority || t.priority,
    hoursRequired: t.hoursRequired ?? null,
    planningCategory: t.planningCategory || PLANNING_CATEGORY_REGULAR,
    isProjectBased: t.isProjectBased,
    projectName: t.projectName,
    managerInstructions: t.managerInstructions,
    managerComments: t.managerComments,
    status: t.status,
  }));
}

interface DailyPlannerPlanSummaryDialogProps {
  open: boolean;
  date: string;
  drafts?: DailyPlannerTaskDraft[];
  tasks?: DailyPlannerTask[];
  employeeName?: string;
  title?: string;
  confirmLabel?: string;
  readOnly?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}

export default function DailyPlannerPlanSummaryDialog({
  open,
  date,
  drafts,
  tasks,
  employeeName,
  title = 'Plan Summary',
  confirmLabel = 'Confirm',
  readOnly = false,
  busy = false,
  onClose,
  onConfirm,
}: DailyPlannerPlanSummaryDialogProps) {
  const items = drafts?.length
    ? toItemsFromDrafts(drafts)
    : tasks?.length
      ? toItemsFromTasks(tasks)
      : [];

  const totalHours =
    Math.round(
      items.reduce((sum, item) => sum + (Number(item.hoursRequired) || 0), 0) * 100,
    ) / 100;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="!flex !h-[90vh] !max-h-[90vh] !w-[min(96vw,900px)] !max-w-[900px] !flex-col gap-0 overflow-hidden !p-0"
        style={{ height: '90vh', maxHeight: '90vh' }}
      >
        <DialogHeader className="shrink-0 border-b border-gray-200 bg-white px-6 py-4 text-left">
          <DialogTitle className="text-lg font-semibold text-[#212529]">{title}</DialogTitle>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <ViewField label="Date" value={formatReviewDate(date)} />
            {employeeName ? <ViewField label="Employee" value={employeeName} /> : null}
            <ViewField label="Total Planned Hours" value={`${totalHours} Hours`} />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto bg-[#F8F9FA] px-6 py-5">
          {items.map((item, index) => {
            const specialRemarks = [item.managerInstructions, item.managerComments]
              .map((s) => String(s || '').trim())
              .filter(Boolean)
              .join('\n');
            return (
              <ViewSection key={`${item.taskName}-${index}`} title={`Task ${index + 1}`}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ViewField label="Task Name" value={displayCell(item.taskName)} />
                  <ViewField
                    label="Type"
                    value={isUrgentTask(item.planningCategory) ? 'Urgent' : 'Regular'}
                  />
                  <ViewField label="Priority" value={displayCell(item.priority)} />
                  <ViewField
                    label="Hours Required"
                    value={item.hoursRequired != null ? `${item.hoursRequired}` : '—'}
                  />
                  {item.status ? (
                    <ViewField label="Status" value={displayCell(item.status)} />
                  ) : null}
                  {item.isProjectBased ? (
                    <ViewField label="Project Name" value={displayCell(item.projectName)} />
                  ) : null}
                </div>
                <div className="mt-4">
                  <ViewBulletField label="Description" value={displayCell(item.description)} />
                </div>
                {specialRemarks ? (
                  <div className="mt-4">
                    <ViewBulletField label="Special Remarks" value={specialRemarks} />
                  </div>
                ) : null}
              </ViewSection>
            );
          })}
          {items.length === 0 ? (
            <p className="text-sm text-gray-600">No tasks to display.</p>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-gray-200 bg-white px-6 py-4 gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {readOnly ? 'Close' : 'Back'}
          </Button>
          {!readOnly && onConfirm ? (
            <Button
              type="button"
              className="bg-[#007BFF] hover:bg-[#0056b3]"
              disabled={busy || items.length === 0}
              onClick={onConfirm}
            >
              {busy ? 'Submitting…' : confirmLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
