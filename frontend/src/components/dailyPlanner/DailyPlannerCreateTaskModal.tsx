import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import BulletPointEditor, { type BulletPointEditorHandle } from './BulletPointEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import type { DailyPlannerPriority, DailyPlannerTaskDraft } from '../../types/dailyPlanner';
import type { PlanningConfig } from '../../utils/planningRecognition';
import {
  assertCanCreateRegularTask,
  assertCanCreateUrgentTask,
  getPlanningWindowUiState,
  isUrgentTask,
  PLANNING_WINDOW_CLOSED_MESSAGE,
  resolveAutoPlanningCategory,
} from '../../utils/planningRecognition';
import { hasBulletContent, parseBulletPoints } from './bulletPointUtils';
import { cn } from '../ui/utils';

type TaskSectionState = {
  id: string;
  taskName: string;
  priority: DailyPlannerPriority;
  hoursRequired: string;
};

type SectionErrors = Record<
  string,
  { taskName?: boolean; urgentReason?: boolean; hoursRequired?: boolean }
>;

function createEmptySection(): TaskSectionState {
  return {
    id: crypto.randomUUID(),
    taskName: '',
    priority: 'Medium',
    hoursRequired: '',
  };
}

function isSectionEmpty(
  taskName: string,
  description: string,
  urgentMode: boolean,
  urgentReason: string,
): boolean {
  const hasDescription = hasBulletContent(parseBulletPoints(description));
  const hasUrgentReason = urgentMode
    ? hasBulletContent(parseBulletPoints(urgentReason))
    : false;
  return !taskName.trim() && !hasDescription && !hasUrgentReason;
}

interface TaskSectionRowProps {
  index: number;
  section: TaskSectionState;
  canRemove: boolean;
  urgentMode: boolean;
  showTaskNameError: boolean;
  showUrgentReasonError: boolean;
  showHoursRequiredError: boolean;
  onChange: (patch: Partial<TaskSectionState>) => void;
  onRemove: () => void;
  onDescriptionRef: (handle: BulletPointEditorHandle | null) => void;
  onUrgentReasonRef: (handle: BulletPointEditorHandle | null) => void;
}

function TaskSectionRow({
  index,
  section,
  canRemove,
  urgentMode,
  showTaskNameError,
  showUrgentReasonError,
  showHoursRequiredError,
  onChange,
  onRemove,
  onDescriptionRef,
  onUrgentReasonRef,
}: TaskSectionRowProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#212529]">Task {index + 1}</p>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-gray-500 hover:text-red-600"
            onClick={onRemove}
            aria-label={`Remove task ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
            Remove Task
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`task-name-${section.id}`}>Task Name *</Label>
        <Input
          id={`task-name-${section.id}`}
          value={section.taskName}
          onChange={(e) => onChange({ taskName: e.target.value })}
          className={cn(showTaskNameError && 'border-red-500 focus-visible:ring-red-500/30')}
          aria-invalid={showTaskNameError}
        />
        {showTaskNameError ? (
          <p className="text-xs text-red-600">Task name is required.</p>
        ) : null}
      </div>

      <BulletPointEditor
        key={`${section.id}-description`}
        ref={onDescriptionRef}
        id={`task-description-${section.id}`}
        label="Task Description"
      />

      {urgentMode ? (
        <div className="space-y-1">
          <BulletPointEditor
            key={`${section.id}-urgent`}
            ref={onUrgentReasonRef}
            id={`urgent-reason-${section.id}`}
            label="Urgent Task Reason *"
          />
          {showUrgentReasonError ? (
            <p className="text-xs text-red-600">Urgent Task Reason is required.</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`hours-required-${section.id}`}>Hours Required to Complete *</Label>
        <Input
          id={`hours-required-${section.id}`}
          type="number"
          inputMode="decimal"
          min={0.25}
          step={0.25}
          placeholder="e.g. 1.5"
          value={section.hoursRequired}
          onChange={(e) => onChange({ hoursRequired: e.target.value })}
          className={cn(showHoursRequiredError && 'border-red-500 focus-visible:ring-red-500/30')}
          aria-invalid={showHoursRequiredError}
        />
        {showHoursRequiredError ? (
          <p className="text-xs text-red-600">Enter a valid number of hours greater than 0.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Priority</Label>
        <Select
          value={section.priority}
          onValueChange={(v) => onChange({ priority: v as DailyPlannerPriority })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface DailyPlannerCreateTaskModalProps {
  open: boolean;
  date: string;
  planningConfig?: PlanningConfig | null;
  /** When set, normal task fields stay hidden until Create Urgent Task (same UI as closed window). */
  regularCreationBlockedMessage?: string | null;
  onClose: () => void;
  onSave: (drafts: DailyPlannerTaskDraft[]) => Promise<void>;
}

export default function DailyPlannerCreateTaskModal({
  open,
  date,
  planningConfig,
  regularCreationBlockedMessage = null,
  onClose,
  onSave,
}: DailyPlannerCreateTaskModalProps) {
  const [sections, setSections] = useState<TaskSectionState[]>([createEmptySection()]);
  const [errors, setErrors] = useState<SectionErrors>({});
  const [saving, setSaving] = useState(false);
  const [manualUrgentMode, setManualUrgentMode] = useState(false);
  const descriptionRefs = useRef<Record<string, BulletPointEditorHandle | null>>({});
  const urgentReasonRefs = useRef<Record<string, BulletPointEditorHandle | null>>({});

  const windowState = useMemo(
    () => getPlanningWindowUiState(planningConfig),
    [planningConfig],
  );
  const windowClosedUi = windowState === 'closed' && !manualUrgentMode;
  const dateBlockedUi = Boolean(regularCreationBlockedMessage) && !manualUrgentMode;
  const planningClosed = windowClosedUi || dateBlockedUi;
  const closedMessage = windowClosedUi
    ? PLANNING_WINDOW_CLOSED_MESSAGE
    : regularCreationBlockedMessage || PLANNING_WINDOW_CLOSED_MESSAGE;
  const urgentMode = windowState === 'urgent-only' || manualUrgentMode;
  const autoPlanningCategory = useMemo(
    () => resolveAutoPlanningCategory(planningConfig, manualUrgentMode),
    [planningConfig, manualUrgentMode],
  );

  useEffect(() => {
    if (open) {
      setSections([createEmptySection()]);
      setErrors({});
      setManualUrgentMode(false);
      descriptionRefs.current = {};
      urgentReasonRefs.current = {};
    }
  }, [open, date]);

  const handleClose = () => {
    onClose();
  };

  const addSection = () => {
    setSections((prev) => [...prev, createEmptySection()]);
  };

  const updateSection = (id: string, patch: Partial<TaskSectionState>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    if (patch.taskName !== undefined && patch.taskName.trim()) {
      setErrors((prev) => {
        if (!prev[id]?.taskName) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const removeSection = (id: string) => {
    setSections((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.id !== id);
    });
    delete descriptionRefs.current[id];
    delete urgentReasonRefs.current[id];
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const collectDrafts = (): { drafts: DailyPlannerTaskDraft[]; validationErrors: SectionErrors } => {
    const validationErrors: SectionErrors = {};
    const drafts: DailyPlannerTaskDraft[] = [];

    for (const section of sections) {
      const description =
        descriptionRefs.current[section.id]?.getFormattedValue() ?? '';
      const urgentReason =
        urgentReasonRefs.current[section.id]?.getFormattedValue() ?? '';

      if (isSectionEmpty(section.taskName, description, urgentMode, urgentReason)) {
        continue;
      }

      if (!section.taskName.trim()) {
        validationErrors[section.id] = { ...(validationErrors[section.id] || {}), taskName: true };
        continue;
      }

      if (urgentMode && !hasBulletContent(parseBulletPoints(urgentReason))) {
        validationErrors[section.id] = {
          ...(validationErrors[section.id] || {}),
          urgentReason: true,
        };
        continue;
      }

      const hoursValue = Number(section.hoursRequired);
      if (
        !String(section.hoursRequired || '').trim() ||
        !Number.isFinite(hoursValue) ||
        hoursValue <= 0
      ) {
        validationErrors[section.id] = {
          ...(validationErrors[section.id] || {}),
          hoursRequired: true,
        };
        continue;
      }

      drafts.push({
        date,
        taskName: section.taskName.trim(),
        description,
        priority: section.priority,
        hoursRequired: Math.round(hoursValue * 100) / 100,
        planningCategory: autoPlanningCategory,
        urgentReason: urgentMode ? urgentReason : '',
      });
    }

    return { drafts, validationErrors };
  };

  const saveTasks = async () => {
    if (!planningConfig) {
      toast.error('Planning window information is loading. Please try again.');
      return;
    }

    if (planningClosed) {
      return;
    }

    const { drafts, validationErrors } = collectDrafts();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error('Please fix the highlighted tasks before saving');
      return;
    }

    if (drafts.length === 0) {
      toast.error('Add at least one task with a name');
      return;
    }

    try {
      for (const draft of drafts) {
        if (isUrgentTask(draft.planningCategory)) {
          assertCanCreateUrgentTask(draft.date, planningConfig);
        } else {
          assertCanCreateRegularTask(draft.date, planningConfig);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cannot create task for this date');
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await onSave(drafts);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await saveTasks();
  };

  const multipleSections = sections.length > 1;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="!flex !h-[90vh] !max-h-[90vh] !w-[min(92vw,32rem)] !max-w-lg !flex-col gap-0 overflow-hidden !p-0 sm:!max-w-lg"
        style={{ height: '90vh', maxHeight: '90vh' }}
      >
        <DialogHeader className="shrink-0 border-b border-gray-200 px-6 py-4 pr-12 text-left">
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-smooth overscroll-contain px-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input value={date} readOnly disabled className="bg-gray-50" />
              </div>

              {planningClosed ? (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 whitespace-pre-wrap">
                  {closedMessage}
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-amber-300 bg-white hover:bg-amber-100"
                      onClick={() => setManualUrgentMode(true)}
                    >
                      Create Urgent Task
                    </Button>
                  </div>
                </div>
              ) : null}

              {!planningClosed
                ? sections.map((section, index) => (
                <TaskSectionRow
                  key={section.id}
                  index={index}
                  section={section}
                  canRemove={sections.length > 1}
                  urgentMode={urgentMode}
                  showTaskNameError={Boolean(errors[section.id]?.taskName)}
                  showUrgentReasonError={Boolean(errors[section.id]?.urgentReason)}
                  showHoursRequiredError={Boolean(errors[section.id]?.hoursRequired)}
                  onChange={(patch) => updateSection(section.id, patch)}
                  onRemove={() => removeSection(section.id)}
                  onDescriptionRef={(handle) => {
                    descriptionRefs.current[section.id] = handle;
                  }}
                  onUrgentReasonRef={(handle) => {
                    urgentReasonRefs.current[section.id] = handle;
                  }}
                />
              ))
                : null}
            </div>
          </div>

          <div className="shrink-0 space-y-3 border-t border-gray-200 bg-white px-6 py-4">
            {!planningClosed ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={saving}
                onClick={addSection}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || planningClosed}>
                {saving ? 'Saving…' : multipleSections ? 'Save Tasks' : 'Save Task'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
