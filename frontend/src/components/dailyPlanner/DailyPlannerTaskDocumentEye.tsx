import { Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  fetchDailyPlannerTaskDocumentUrl,
  type DailyPlannerDocumentType,
} from '../../hooks/dailyPlanner/dailyPlannerApi';

interface DailyPlannerTaskDocumentEyeProps {
  taskId: string;
  hasDocument: boolean;
  documentType?: DailyPlannerDocumentType;
  /** Tooltip / accessible label for the Eye button. */
  title?: string;
  className?: string;
}

/** Opens a task document via authenticated signed URL (Eye icon). */
export default function DailyPlannerTaskDocumentEye({
  taskId,
  hasDocument,
  documentType = 'employee',
  title = 'View document',
  className,
}: DailyPlannerTaskDocumentEyeProps) {
  if (!hasDocument) return null;

  const openDocument = async () => {
    try {
      const { url, fileName } = await fetchDailyPlannerTaskDocumentUrl(taskId, documentType);
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        toast.message(`Document ready: ${fileName}. Allow pop-ups to view.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open document');
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={
        className ||
        'h-8 w-8 border-blue-300 bg-blue-50 text-blue-700 hover:border-blue-400 hover:bg-blue-100 hover:text-blue-800'
      }
      title={title}
      aria-label={title}
      onClick={() => void openDocument()}
    >
      <Eye className="h-4 w-4" />
    </Button>
  );
}
