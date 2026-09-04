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
  EMPLOYEE_EXACT_SEVEN_HOURS_MESSAGE,
  getPlanningWindowUiState,
  isUrgentTask,
  MIN_PLANNED_HOURS_PER_WORKING_DAY,
  PLANNING_CATEGORY_REGULAR,
  PLANNING_CATEGORY_URGENT,
  PLANNING_WINDOW_CLOSED_MESSAGE,
} from '../../utils/planningRecognition';
import { hasBulletContent, parseBulletPoints } from './bulletPointUtils';
import { cn } from '../ui/utils';
import { fetchDailyPlannerProjects } from '../../hooks/dailyPlanner/dailyPlannerApi';
import DailyPlannerPlanSummaryDialog from './DailyPlannerPlanSummaryDialog';

type TaskSectionState = {
  id: string;
  taskName: string;
  priority: DailyPlannerPriority;
  hoursRequired: string;
  isProjectBased: 'Yes' | 'No';
  projectName: string;
  managerInstructions: string;
  planningCategory: 'Regular' | 'Urgent';
};

type SectionErrors = Record<
  string,
  {
    taskName?: boolean;
    urgentReason?: boolean;
    hoursRequired?: boolean;
    projectName?: boolean;
  }
>;

function createEmptySection(): TaskSectionState {
  return {
    id: crypto.randomUUID(),
    taskName: '',
    priority: 'Medium',
    hoursRequired: '',
    isProjectBased: 'No',
    projectName: '',
    managerInstructions: '',
    planningCategory: 'Regular',
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
  elevated: boolean;
  projectOptions: string[];
  showTaskNameError: boolean;
  showUrgentReasonError: boolean;
  showHoursRequiredError: boolean;
  showProjectNameError: boolean;
  onChange: (patch: Partial<TaskSectionState>) => void;
  onRemove: () => void;
  onDescriptionRef: (handle: BulletPointEditorHandle | null) => void;
  onUrgentReasonRef: (handle: BulletPointEditorHandle | null) => void;
}

function TaskSectionRow({
  index,
  section,
  canRemove,
  elevated,
  projectOptions,
  showTaskNameError,
  showUrgentReasonError,
  showHoursRequiredError,
  showProjectNameError,
  onChange,
  onRemove,
  onDescriptionRef,
  onUrgentReasonRef,
}: TaskSectionRowProps) {
  const urgentMode = elevated && section.planningCategory === PLANNING_CATEGORY_URGENT;

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

      {elevated ? (
        <div className="space-y-2">
          <Label>Task Type</Label>
          <Select
            value={section.planningCategory}
            onValueChange={(v) =>
              onChange({ planningCategory: v as 'Regular' | 'Urgent' })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Regular">Regular Task</SelectItem>
              <SelectItem value="Urgent">Urgent Task</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

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

      {elevated ? (
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
      ) : null}

      <div className="space-y-2">
        <Label>Is this task based on the project?</Label>
        <Select
          value={section.isProjectBased}
          onValueChange={(v) =>
            onChange({
              isProjectBased: v as 'Yes' | 'No',
              projectName: v === 'No' ? '' : section.projectName,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="No">No</SelectItem>
            <SelectItem value="Yes">Yes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {section.isProjectBased === 'Yes' ? (
        <div className="space-y-2">
          <Label htmlFor={`project-name-${section.id}`}>Project Name *</Label>
          <Input
            id={`project-name-${section.id}`}
            list={`project-options-${section.id}`}
            value={section.projectName}
            onChange={(e) => onChange({ projectName: e.target.value })}
            placeholder="Select or type a project name"
            className={cn(showProjectNameError && 'border-red-500 focus-visible:ring-red-500/30')}
            aria-invalid={showProjectNameError}
          />
          <datalist id={`project-options-${section.id}`}>
            {projectOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {showProjectNameError ? (
            <p className="text-xs text-red-600">Project Name is required.</p>
          ) : null}
        </div>
      ) : null}

      {elevated ? (
        <div className="space-y-2">
          <Label htmlFor={`instructions-${section.id}`}>Instructions (optional)</Label>
          <Input
            id={`instructions-${section.id}`}
            value={section.managerInstructions}
            onChange={(e) => onChange({ managerInstructions: e.target.value })}
            placeholder="Special remarks / instructions"
          />
        </div>
      ) : null}
    </div>
  );
}

interface DailyPlannerCreateTaskModalProps {
  open: boolean;
  date: string;
  planningConfig?: PlanningConfig | null;
  /** When set, normal task fields stay hidden until Create Urgent Task (managers only). */
  regularCreationBlockedMessage?: string | null;
  /** Admin / Manager / Developer — Priority, Urgent, Instructions, flexible hours. */
  elevated?: boolean;
  /** When creating for a team employee from review. */
  forEmployeeCode?: string;
  /** Skip employee evening-window assert (manager creating for employee). */
  skipPlanningWindowAssert?: boolean;
  onClose: () => void;
  onSave: (drafts: DailyPlannerTaskDraft[]) => Promise<void>;
}

export default function DailyPlannerCreateTaskModal({
  open,
  date,
  planningConfig,
  regularCreationBlockedMessage = null,
  elevated = false,
  forEmployeeCode,
  skipPlanningWindowAssert = false,
  onClose,
  onSave,
}: DailyPlannerCreateTaskModalProps) {
  const [sections, setSections] = useState<TaskSectionState[]>([createEmptySection()]);
  const [errors, setErrors] = useState<SectionErrors>({});
  const [saving, setSaving] = useState(false);
  const [manualUrgentMode, setManualUrgentMode] = useState(false);
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [hoursAlert, setHoursAlert] = useState<string | null>(null);
  const [summaryDrafts, setSummaryDrafts] = useState<DailyPlannerTaskDraft[] | null>(null);
  const descriptionRefs = useRef<Record<string, BulletPointEditorHandle | null>>({});
  const urgentReasonRefs = useRef<Record<string, BulletPointEditorHandle | null>>({});

  const requireExactSeven = !elevated && !forEmployeeCode;

  const windowState = useMemo(
    () => getPlanningWindowUiState(planningConfig),
    [planningConfig],
  );
  const windowClosedUi = elevated && windowState === 'closed' && !manualUrgentMode;
  const dateBlockedUi =
    elevated && Boolean(regularCreationBlockedMessage) && !manualUrgentMode;
  const planningClosed = !elevated
    ? false
    : windowClosedUi || dateBlockedUi;
  const closedMessage = windowClosedUi
    ? PLANNING_WINDOW_CLOSED_MESSAGE
    : regularCreationBlockedMessage || PLANNING_WINDOW_CLOSED_MESSAGE;

  useEffect(() => {
    if (open) {
      setSections([createEmptySection()]);
      setErrors({});
      setManualUrgentMode(false);
      setHoursAlert(null);
      setSummaryDrafts(null);
      descriptionRefs.current = {};
      urgentReasonRefs.current = {};
      void fetchDailyPlannerProjects()
        .then((projects) => setProjectOptions(projects.map((p) => p.projectName).filter(Boolean)))
        .catch(() => setProjectOptions([]));
    }
  }, [open, date, elevated]);

  const liveTotalHours = useMemo(() => {
    return sections.reduce((sum, section) => {
      const h = Number(section.hoursRequired);
      return sum + (Number.isFinite(h) && h > 0 ? h : 0);
    }, 0);
  }, [sections]);

  const totalHoursDisplay = Math.round(liveTotalHours * 100) / 100;

  const handleClose = () => {
    onClose();
  };

  const addSection = () => {
    setSections((prev) => [...prev, createEmptySection()]);
    setHoursAlert(null);
  };

  const updateSection = (id: string, patch: Partial<TaskSectionState>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setHoursAlert(null);
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
    setHoursAlert(null);
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
      const urgentMode =
        elevated &&
        (section.planningCategory === PLANNING_CATEGORY_URGENT ||
          (manualUrgentMode && section.planningCategory !== PLANNING_CATEGORY_REGULAR));

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

      if (section.isProjectBased === 'Yes' && !section.projectName.trim()) {
        validationErrors[section.id] = {
          ...(validationErrors[section.id] || {}),
          projectName: true,
        };
        continue;
      }

      const category = !elevated
        ? PLANNING_CATEGORY_REGULAR
        : urgentMode || section.planningCategory === PLANNING_CATEGORY_URGENT
          ? PLANNING_CATEGORY_URGENT
          : PLANNING_CATEGORY_REGULAR;

      drafts.push({
        date,
        taskName: section.taskName.trim(),
        description,
        priority: elevated ? section.priority : 'Medium',
        hoursRequired: Math.round(hoursValue * 100) / 100,
        planningCategory: category,
        urgentReason: category === PLANNING_CATEGORY_URGENT ? urgentReason : '',
        isProjectBased: section.isProjectBased === 'Yes',
        projectName: section.isProjectBased === 'Yes' ? section.projectName.trim() : '',
        managerInstructions: elevated ? section.managerInstructions.trim() : '',
        employeeCode: forEmployeeCode || undefined,
      });
    }

    return { drafts, validationErrors };
  };

  const persistDrafts = async (drafts: DailyPlannerTaskDraft[]) => {
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

  const saveTasks = async () => {
    if (!skipPlanningWindowAssert && !planningConfig) {
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

    const total = Math.round(
      drafts.reduce((sum, d) => sum + (Number(d.hoursRequired) || 0), 0) * 100,
    ) / 100;

    if (requireExactSeven && total !== MIN_PLANNED_HOURS_PER_WORKING_DAY) {
      setHoursAlert(EMPLOYEE_EXACT_SEVEN_HOURS_MESSAGE);
      toast.error(EMPLOYEE_EXACT_SEVEN_HOURS_MESSAGE);
      return;
    }

    if (!skipPlanningWindowAssert && planningConfig) {
      try {
        for (const draft of drafts) {
          if (isUrgentTask(draft.planningCategory)) {
            assertCanCreateUrgentTask(draft.date, planningConfig, { elevated });
          } else {
            assertCanCreateRegularTask(draft.date, planningConfig, { elevated });
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Cannot create task for this date');
        return;
      }
    }

    setErrors({});
    setHoursAlert(null);

    if (requireExactSeven) {
      setSummaryDrafts(drafts);
      return;
    }

    await persistDrafts(drafts);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await saveTasks();
  };

  const multipleSections = sections.length > 1;

  const totalHoursIndicator = (
    <div
      className={cn(
        'rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-[#212529] shrink-0 text-right',
      )}
    >
      Total Planned Hours: {totalHoursDisplay} Hours
    </div>
  );

  return (
    <>
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
                    {elevated ? (
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
                    ) : null}
                  </div>
                ) : null}

                {!planningClosed
                  ? sections.map((section, index) => (
                      <TaskSectionRow
                        key={section.id}
                        index={index}
                        section={section}
                        canRemove={sections.length > 1}
                        elevated={elevated}
                        projectOptions={projectOptions}
                        showTaskNameError={Boolean(errors[section.id]?.taskName)}
                        showUrgentReasonError={Boolean(errors[section.id]?.urgentReason)}
                        showHoursRequiredError={Boolean(errors[section.id]?.hoursRequired)}
                        showProjectNameError={Boolean(errors[section.id]?.projectName)}
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
              {hoursAlert ? (
                <p className="text-sm text-red-600 whitespace-pre-wrap">{hoursAlert}</p>
              ) : null}
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                {!planningClosed ? totalHoursIndicator : null}
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

      <DailyPlannerPlanSummaryDialog
        open={Boolean(summaryDrafts)}
        date={date}
        drafts={summaryDrafts || []}
        title="Review Your Plan Before Submission"
        confirmLabel="Submit Plan"
        busy={saving}
        onClose={() => setSummaryDrafts(null)}
        onConfirm={() => {
          if (!summaryDrafts) return;
          void persistDrafts(summaryDrafts);
        }}
      />
    </>
  );
}
