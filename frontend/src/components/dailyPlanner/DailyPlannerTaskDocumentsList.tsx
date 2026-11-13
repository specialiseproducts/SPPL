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
      label: 'Uploaded by Employee',
      title: 'View employee document',
      hasDocument: Boolean(String(task.documentFileKey || '').trim()),
    },
    {
      type: 'managerReview',
      label: 'Uploaded by Reporting Person',
      title: 'View reporting person document',
      hasDocument: Boolean(String(task.managerReviewDocumentFileKey || '').trim()),
    },
    {
      type: 'managerApproval',
      label: 'Uploaded by Admin',
      title: 'View admin document',
      hasDocument: Boolean(String(task.managerApprovalDocumentFileKey || '').trim()),
    },
  ];
  return rows.filter((r) => r.hasDocument);
}

interface DailyPlannerTaskDocumentsListProps {
  task: DailyPlannerTask;
  className?: string;
  /** Compact task-level column (Task Review Steps table) — no section heading. */
  compact?: boolean;
}

/** Compact labeled document rows (no filenames) for view / review UIs. */
export default function DailyPlannerTaskDocumentsList({
  task,
  className,
  compact = false,
}: DailyPlannerTaskDocumentsListProps) {
  const rows = buildRows(task);

  if (rows.length === 0) {
    if (!compact) return null;
    return <p className={className || 'text-sm text-gray-500'}>—</p>;
  }

  return (
    <div className={className || 'space-y-2'}>
      {compact ? null : (
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Documents</p>
      )}
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.type}
            className={
              compact
                ? 'flex flex-col gap-1 rounded-md border border-gray-200 bg-white px-2 py-1.5'
                : 'flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2'
            }
          >
            <span className="text-xs text-[#212529] leading-snug">{row.label}</span>
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
