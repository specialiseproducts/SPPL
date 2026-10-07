import type { DailyPlannerTask } from '../../types/dailyPlanner';
import type { DailyPlannerDocumentType } from '../../hooks/dailyPlanner/dailyPlannerApi';
import DailyPlannerTaskDocumentEye from './DailyPlannerTaskDocumentEye';

type DocRow = {
  type: DailyPlannerDocumentType;
  label: string;
  title: string;
  hasDocument: boolean;
};

function buildRows(task: DailyPlannerTask): DocRow[] {
  const rows: DocRow[] = [
    {
      type: 'employee',
      label: 'Employee Document',
      title: 'View Employee Document',
      hasDocument: Boolean(String(task.documentFileKey || '').trim()),
    },
    {
      type: 'managerReview',
      label: 'Manager Review Document',
      title: 'View Manager Review Document',
      hasDocument: Boolean(String(task.managerReviewDocumentFileKey || '').trim()),
    },
    {
      type: 'managerApproval',
      label: 'Manager Approval Document',
      title: 'View Manager Approval Document',
      hasDocument: Boolean(String(task.managerApprovalDocumentFileKey || '').trim()),
    },
  ];
  return rows.filter((r) => r.hasDocument);
}

interface DailyPlannerTaskDocumentsListProps {
  task: DailyPlannerTask;
  className?: string;
}

/** Compact labeled document rows (no filenames) for view / review UIs. */
export default function DailyPlannerTaskDocumentsList({
  task,
  className,
}: DailyPlannerTaskDocumentsListProps) {
  const rows = buildRows(task);
  if (rows.length === 0) return null;

  return (
    <div className={className || 'space-y-2'}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Documents</p>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.type}
            className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
          >
            <span className="text-sm text-[#212529]">{row.label}</span>
            <DailyPlannerTaskDocumentEye
              taskId={task.plannerTaskId}
              hasDocument
              documentType={row.type}
              title={row.title}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
