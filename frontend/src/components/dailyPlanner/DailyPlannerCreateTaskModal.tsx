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
import type { DailyPlannerPriority, DailyPlannerTask, DailyPlannerTaskDraft } from '../../types/dailyPlanner';
import type { PlanningConfig } from '../../utils/planningRecognition';
import {
  assertCanCreateRegularTask,
  buildMinimumHoursRequirementMessage,
  formatDurationLabel,
  getMinPlannedHours,
  getPlanningTargetDateMode,
  getPlanningWindowUiState,
  partsToDecimalHours,
  PLANNING_CATEGORY_REGULAR,
  PLANNING_CATEGORY_URGENT,
  PLANNING_WINDOW_CLOSED_MESSAGE,
} from '../../utils/planningRecognition';
import { hasBulletContent, parseBulletPoints } from './bulletPointUtils';
import { sumPlannedHoursForDate } from './dailyPlannerUtils';
import { cn } from '../ui/utils';
import { fetchDailyPlannerProjects, uploadDailyPlannerTaskDocument } from '../../hooks/dailyPlanner/dailyPlannerApi';
import DailyPlannerPlanSummaryDialog from './DailyPlannerPlanSummaryDialog';
import HoursMinutesFields from './HoursMinutesFields';
import DailyPlannerEnhancedTaskFields from './DailyPlannerEnhancedTaskFields';

/** Same duration helper as Mark Completed (Start/End → decimal hours). */
function calcDurationFromTimes(startTime: string, endTime: string): number | null {
  const start = String(startTime || '').trim();
  const end = String(endTime || '').trim();
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return null;
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (endMins < startMins) return null;
  const diff = endMins - startMins;
  return partsToDecimalHours(Math.floor(diff / 60), diff % 60);
}

type TaskSectionState = {
  id: string;
  taskName: string;
  description: string;
  priority: DailyPlannerPriority;
  hoursRequired: number | null;
  isProjectBased: 'Yes' | 'No';
  projectName: string;
  managerInstructions: string;
  startTime: string;
  endTime: string;
  needsDocument: 'Yes' | 'No';
  progressDone: number | null;
  documentFile: File | null;
};

type SectionErrors = Record<
  string,
  {
    taskName?: boolean;
    hoursRequired?: boolean;
    projectName?: boolean;
    startEnd?: boolean;
    workDone?: boolean;
  }
>;

function createEmptySection(): TaskSectionState {
  return {
    id: crypto.randomUUID(),
    taskName: '',
    description: '',
    priority: 'Medium',
    hoursRequired: null,
    isProjectBased: 'No',
    projectName: '',
    managerInstructions: '',
    startTime: '',
    endTime: '',
    needsDocument: 'No',
    progressDone: null,
    documentFile: null,
  };
}

function isSectionEmpty(taskName: string, description: string): boolean {
  const hasDescription = hasBulletContent(parseBulletPoints(description));
  return !taskName.trim() && !hasDescription;
}

interface TaskSectionRowProps {
  index: number;
  section: TaskSectionState;
  canRemove: boolean;
  elevated: boolean;
  enhancedEligible?: boolean;
  projectOptions: string[];
  showTaskNameError: boolean;
  showHoursRequiredError: boolean;
  showProjectNameError: boolean;
  onChange: (patch: Partial<TaskSectionState>) => void;
  onRemove: () => void;
  onDescriptionRef: (handle: BulletPointEditorHandle | null) => void;
}

function TaskSectionRow({
  index,
  section,
  canRemove,
  elevated,
  enhancedEligible = false,
  projectOptions,
  showTaskNameError,
  showHoursRequiredError,
  showProjectNameError,
  onChange,
  onRemove,
  onDescriptionRef,
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
        defaultValue={section.description}
      />

      <div className="space-y-2">
        <Label>Hours Required to Complete *</Label>
        <HoursMinutesFields
          idPrefix={`hours-required-${section.id}`}
          value={section.hoursRequired}
          onChange={(decimal) => onChange({ hoursRequired: decimal })}
          error={showHoursRequiredError}
        />
        {showHoursRequiredError ? (
          <p className="text-xs text-red-600">Enter hours and minutes greater than 0.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Priority *</Label>
        <Select
          value={section.priority}
          onValueChange={(v) => onChange({ priority: v as DailyPlannerPriority })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Urgent">Urgent</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Is this task based on the project?</Label>
        <Select
          value={section.isProjectBased}
          onValueChange={(v) =>
            onChange({
              isProjectBased: v as 'Yes' | 'No',
              projectName: v === 'No' ? '' : section.projectName,
              progressDone: v === 'No' ? null : section.progressDone,
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

      {enhancedEligible ? (
        <DailyPlannerEnhancedTaskFields
          idPrefix={`create-${section.id}`}
          isProjectBased={section.isProjectBased === 'Yes'}
          values={{
            needsDocument: section.needsDocument,
            progressDone: section.progressDone,
            documentFile: section.documentFile,
          }}
          onChange={(patch) => onChange(patch)}
        />
      ) : null}
    </div>
  );
}

interface ExtraTaskSectionFieldsProps {
  section: TaskSectionState;
  projectOptions: string[];
  showTaskNameError: boolean;
  showProjectNameError: boolean;
  showStartEndError: boolean;
  showWorkDoneError: boolean;
  onChange: (patch: Partial<TaskSectionState>) => void;
  onDescriptionRef: (handle: BulletPointEditorHandle | null) => void;
  onWorkDoneRef: (handle: BulletPointEditorHandle | null) => void;
}

/** Extra Task field set — reuses existing Daily Planner field components / Mark Completed time + Work Done. */
function ExtraTaskSectionFields({
  section,
  projectOptions,
  showTaskNameError,
  showProjectNameError,
  showStartEndError,
  showWorkDoneError,
  onChange,
  onDescriptionRef,
  onWorkDoneRef,
}: ExtraTaskSectionFieldsProps) {
  const durationPreview = calcDurationFromTimes(section.startTime, section.endTime);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4 space-y-4">
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
        defaultValue={section.description}
      />

      <div className="space-y-2">
        <Label>Priority *</Label>
        <Select
          value={section.priority}
          onValueChange={(v) => onChange({ priority: v as DailyPlannerPriority })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Urgent">Urgent</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Is this task based on the project?</Label>
        <Select
          value={section.isProjectBased}
          onValueChange={(v) =>
            onChange({
              isProjectBased: v as 'Yes' | 'No',
              projectName: v === 'No' ? '' : section.projectName,
              progressDone: v === 'No' ? null : section.progressDone,
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`extra-start-time-${section.id}`}>Start Time *</Label>
          <Input
            id={`extra-start-time-${section.id}`}
            type="time"
            value={section.startTime}
            onChange={(e) => onChange({ startTime: e.target.value })}
            className={cn(showStartEndError && 'border-red-500 focus-visible:ring-red-500/30')}
            aria-invalid={showStartEndError}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`extra-end-time-${section.id}`}>End Time *</Label>
          <Input
            id={`extra-end-time-${section.id}`}
            type="time"
            value={section.endTime}
            onChange={(e) => onChange({ endTime: e.target.value })}
            className={cn(showStartEndError && 'border-red-500 focus-visible:ring-red-500/30')}
            aria-invalid={showStartEndError}
          />
        </div>
      </div>
      {durationPreview != null && durationPreview > 0 ? (
        <p className="text-sm text-gray-600">Duration: {formatDurationLabel(durationPreview)}</p>
      ) : section.startTime && section.endTime ? (
        <p className="text-sm text-red-600">
          {durationPreview === 0
            ? 'Duration must be greater than 0.'
            : 'End Time must be on or after Start Time.'}
        </p>
      ) : showStartEndError ? (
        <p className="text-xs text-red-600">Start Time and End Time are required.</p>
      ) : null}

      <div className={cn(showWorkDoneError && 'rounded-md ring-1 ring-red-500/40')}>
        <BulletPointEditor
          key={`${section.id}-work-done`}
          ref={onWorkDoneRef}
          id={`work-done-${section.id}`}
          label="Work Done"
          required
        />
      </div>
      {showWorkDoneError ? (
        <p className="text-xs text-red-600">Work done is required.</p>
      ) : null}
    </div>
  );
}

interface DailyPlannerCreateTaskModalProps {
  open: boolean;
  date: string;
  planningConfig?: PlanningConfig | null;
  /** When set, normal task fields stay hidden until Create Task (managers only). */
  regularCreationBlockedMessage?: string | null;
  /** Admin / Manager / Developer — Instructions, flexible hours. */
  elevated?: boolean;
  /** When creating for a team employee from review. */
  forEmployeeCode?: string;
  /** Skip employee evening-window assert (manager creating for employee). */
  skipPlanningWindowAssert?: boolean;
  /** Factory / Office SuperAdmin — document + progress fields. */
  enhancedEligible?: boolean;
  /**
   * Extra Task from Mark Completed / Not Completed — same fields as Add Task,
   * saved as Completed + self-approved (no min-hours / plan-summary).
   */
  isExtraTask?: boolean;
  /** Existing tasks already planned for `date` (same set the calendar uses for that day). */
  existingTasksForDate?: DailyPlannerTask[];
  onClose: () => void;
  onSave: (drafts: DailyPlannerTaskDraft[]) => Promise<DailyPlannerTask[] | void>;
}

export default function DailyPlannerCreateTaskModal({
  open,
  date,
  planningConfig,
  regularCreationBlockedMessage = null,
  elevated = false,
  forEmployeeCode,
  skipPlanningWindowAssert = false,
  enhancedEligible = false,
  isExtraTask = false,
  existingTasksForDate = [],
  onClose,
  onSave,
}: DailyPlannerCreateTaskModalProps) {
  const [sections, setSections] = useState<TaskSectionState[]>([createEmptySection()]);
  const [errors, setErrors] = useState<SectionErrors>({});
  const [saving, setSaving] = useState(false);
  const [manualOutsideWindowMode, setManualOutsideWindowMode] = useState(false);
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [hoursAlert, setHoursAlert] = useState<string | null>(null);
  const [summaryDrafts, setSummaryDrafts] = useState<DailyPlannerTaskDraft[] | null>(null);
  const descriptionRefs = useRef<Record<string, BulletPointEditorHandle | null>>({});
  const workDoneRefs = useRef<Record<string, BulletPointEditorHandle | null>>({});
  const submitLockRef = useRef(false);
  const clientBatchIdRef = useRef('');

  const advancePartialPlanning =
    Boolean(planningConfig) && getPlanningTargetDateMode(date, planningConfig!) === 'other';
  const requireMinHours =
    !elevated && !forEmployeeCode && !isExtraTask && !advancePartialPlanning;
  const minPlannedHours = getMinPlannedHours(planningConfig);

  const windowState = useMemo(
    () => getPlanningWindowUiState(planningConfig),
    [planningConfig],
  );
  const windowClosedUi = elevated && windowState === 'closed' && !manualOutsideWindowMode;
  const dateBlockedUi =
    elevated && Boolean(regularCreationBlockedMessage) && !manualOutsideWindowMode;
  const planningClosed = !elevated
    ? false
    : windowClosedUi || dateBlockedUi;
  const closedMessage = windowClosedUi
    ? PLANNING_WINDOW_CLOSED_MESSAGE
    : regularCreationBlockedMessage || PLANNING_WINDOW_CLOSED_MESSAGE;

  useEffect(() => {
    if (open) {
      submitLockRef.current = false;
      clientBatchIdRef.current = '';
      setSections([createEmptySection()]);
      setErrors({});
      setManualOutsideWindowMode(false);
      setHoursAlert(null);
      setSummaryDrafts(null);
      descriptionRefs.current = {};
      workDoneRefs.current = {};
      void fetchDailyPlannerProjects()
        .then((projects) => setProjectOptions(projects.map((p) => p.projectName).filter(Boolean)))
        .catch(() => setProjectOptions([]));
    }
  }, [open, date, elevated, isExtraTask]);

  const existingPlannedHours = useMemo(
    () => sumPlannedHoursForDate(existingTasksForDate, date),
    [existingTasksForDate, date],
  );

  const liveFormHours = useMemo(() => {
    return sections.reduce((sum, section) => {
      const h = Number(section.hoursRequired);
      return sum + (Number.isFinite(h) && h > 0 ? h : 0);
    }, 0);
  }, [sections]);

  const liveTotalHours = Math.round((existingPlannedHours + liveFormHours) * 100) / 100;

  /** Extra Task: Planned Hours from Start → End (same duration helper as Mark Completed). */
  const extraPlannedHours = useMemo(() => {
    if (!isExtraTask) return null;
    const section = sections[0];
    if (!section) return null;
    const duration = calcDurationFromTimes(section.startTime, section.endTime);
    if (duration == null || duration <= 0) return null;
    return Math.round(duration * 100) / 100;
  }, [isExtraTask, sections]);

  const handleClose = () => {
    onClose();
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

  const addSection = () => {
    setSections((prev) => [...prev, createEmptySection()]);
    setHoursAlert(null);
  };

  const removeSection = (id: string) => {
    setSections((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.id !== id);
    });
    delete descriptionRefs.current[id];
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

      if (isExtraTask) {
        if (!section.taskName.trim()) {
          validationErrors[section.id] = {
            ...(validationErrors[section.id] || {}),
            taskName: true,
          };
        }
        if (section.isProjectBased === 'Yes' && !section.projectName.trim()) {
          validationErrors[section.id] = {
            ...(validationErrors[section.id] || {}),
            projectName: true,
          };
        }
        const duration = calcDurationFromTimes(section.startTime, section.endTime);
        if (
          !section.startTime.trim() ||
          !section.endTime.trim() ||
          duration == null ||
          duration <= 0
        ) {
          validationErrors[section.id] = {
            ...(validationErrors[section.id] || {}),
            startEnd: true,
          };
        }
        const workDoneEditor = workDoneRefs.current[section.id];
        const workDone = workDoneEditor?.getFormattedValue() ?? '';
        if (!workDoneEditor?.hasContent()) {
          validationErrors[section.id] = {
            ...(validationErrors[section.id] || {}),
            workDone: true,
          };
        }
        if (validationErrors[section.id]) {
          continue;
        }

        const category =
          section.priority === 'Urgent' ? PLANNING_CATEGORY_URGENT : PLANNING_CATEGORY_REGULAR;
        drafts.push({
          date,
          taskName: section.taskName.trim(),
          description,
          priority: section.priority,
          hoursRequired: Math.round((duration as number) * 100) / 100,
          planningCategory: category,
          urgentReason: '',
          isProjectBased: section.isProjectBased === 'Yes',
          projectName: section.isProjectBased === 'Yes' ? section.projectName.trim() : '',
          needsDocument: enhancedEligible ? section.needsDocument === 'Yes' : undefined,
          progressDone:
            enhancedEligible && section.isProjectBased === 'Yes' ? section.progressDone : undefined,
          managerInstructions: '',
          employeeCode: forEmployeeCode || undefined,
          isExtraTask: true,
          startTime: section.startTime.trim(),
          endTime: section.endTime.trim(),
          workDone,
        });
        continue;
      }

      if (isSectionEmpty(section.taskName, description)) {
        continue;
      }

      if (!section.taskName.trim()) {
        validationErrors[section.id] = { ...(validationErrors[section.id] || {}), taskName: true };
        continue;
      }

      const hoursValue = Number(section.hoursRequired);
      if (
        section.hoursRequired == null ||
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

      const category =
        section.priority === 'Urgent' ? PLANNING_CATEGORY_URGENT : PLANNING_CATEGORY_REGULAR;

      drafts.push({
        date,
        taskName: section.taskName.trim(),
        description,
        priority: section.priority,
        hoursRequired: Math.round(hoursValue * 100) / 100,
        planningCategory: category,
        urgentReason: '',
        isProjectBased: section.isProjectBased === 'Yes',
        projectName: section.isProjectBased === 'Yes' ? section.projectName.trim() : '',
        needsDocument: enhancedEligible ? section.needsDocument === 'Yes' : undefined,
        progressDone:
          enhancedEligible && section.isProjectBased === 'Yes' ? section.progressDone : undefined,
        managerInstructions: elevated ? section.managerInstructions.trim() : '',
        employeeCode: forEmployeeCode || undefined,
      });
    }

    return { drafts, validationErrors };
  };

  const persistDrafts = async (drafts: DailyPlannerTaskDraft[]) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSaving(true);
    try {
      const created = await onSave(drafts);
      const createdList = Array.isArray(created) ? created : [];
      if (enhancedEligible && createdList.length > 0) {
        const filledSections = sections.filter((section) => {
          const desc =
            descriptionRefs.current[section.id]?.getFormattedValue() ?? section.description;
          return !isSectionEmpty(section.taskName, desc);
        });
        for (let i = 0; i < Math.min(filledSections.length, createdList.length); i += 1) {
          const file = filledSections[i]?.documentFile;
          const taskId = createdList[i]?.plannerTaskId;
          if (file && taskId && filledSections[i]?.needsDocument === 'Yes') {
            try {
              await uploadDailyPlannerTaskDocument(taskId, file);
            } catch (uploadErr) {
              toast.error(
                uploadErr instanceof Error
                  ? uploadErr.message
                  : `Document upload failed for task ${i + 1}`,
              );
            }
          }
        }
      }
      setSummaryDrafts(null);
      handleClose();
    } catch (err) {
      submitLockRef.current = false;
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const snapshotSectionDescriptions = (drafts: DailyPlannerTaskDraft[]) => {
    setSections((prev) =>
      prev.map((section, index) => ({
        ...section,
        description: drafts[index]?.description ?? section.description,
        taskName: drafts[index]?.taskName ?? section.taskName,
        priority: (drafts[index]?.priority as DailyPlannerPriority) || section.priority,
        hoursRequired: drafts[index]?.hoursRequired ?? section.hoursRequired,
        managerInstructions: drafts[index]?.managerInstructions ?? section.managerInstructions,
      })),
    );
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

    const draftHours = Math.round(
      drafts.reduce((sum, d) => sum + (Number(d.hoursRequired) || 0), 0) * 100,
    ) / 100;
    const total = Math.round((existingPlannedHours + draftHours) * 100) / 100;

    if (requireMinHours && total < minPlannedHours) {
      const message = buildMinimumHoursRequirementMessage(planningConfig);
      setHoursAlert(message);
      toast.error(message);
      return;
    }

    if (!skipPlanningWindowAssert && !isExtraTask && planningConfig) {
      try {
        for (const draft of drafts) {
          assertCanCreateRegularTask(draft.date, planningConfig, { elevated });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Cannot create task for this date');
        return;
      }
    }

    setErrors({});
    setHoursAlert(null);
    snapshotSectionDescriptions(drafts);

    if (!clientBatchIdRef.current) {
      clientBatchIdRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    const draftsWithFlags = drafts.map((draft) => ({
      ...draft,
      clientBatchId: clientBatchIdRef.current,
      ...(isExtraTask ? { isExtraTask: true } : {}),
    }));

    // Extra Task and Team for-employee create save immediately (no plan-summary step).
    // My Daily Planner plan create still shows the review summary first.
    if (!forEmployeeCode && !isExtraTask) {
      setSummaryDrafts(draftsWithFlags);
      return;
    }

    await persistDrafts(draftsWithFlags);
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
      Total Planned Hours: {formatDurationLabel(liveTotalHours)}
      {existingPlannedHours > 0 ? (
        <span className="mt-0.5 block text-xs font-normal text-gray-500">
          Existing: {formatDurationLabel(existingPlannedHours)}
        </span>
      ) : null}
    </div>
  );

  const extraHoursIndicator = (
    <div
      className={cn(
        'rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-[#212529] shrink-0 text-right',
      )}
    >
      Planned Hours:{' '}
      {extraPlannedHours != null ? formatDurationLabel(extraPlannedHours) : '—'}
      {existingPlannedHours > 0 ? (
        <span className="mt-0.5 block text-xs font-normal text-gray-500">
          Existing: {formatDurationLabel(existingPlannedHours)}
        </span>
      ) : null}
    </div>
  );

  return (
    <>
      <Dialog open={open && !summaryDrafts} onOpenChange={(v) => !v && !summaryDrafts && handleClose()}>
        <DialogContent
          className="!flex !h-[90vh] !max-h-[90vh] !w-[min(92vw,32rem)] !max-w-lg !flex-col gap-0 overflow-hidden !p-0 sm:!max-w-lg"
          style={{ height: '90vh', maxHeight: '90vh' }}
        >
          <DialogHeader className="shrink-0 border-b border-gray-200 px-6 py-4 pr-12 text-left">
            <DialogTitle>{isExtraTask ? 'Extra Task' : 'Create Task'}</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-smooth overscroll-contain px-6 py-4">
              <div className="space-y-4">
                {!isExtraTask ? (
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input value={date} readOnly disabled className="bg-gray-50" />
                  </div>
                ) : null}

                {planningClosed ? (
                  <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 whitespace-pre-wrap">
                    {closedMessage}
                    {elevated ? (
                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-amber-300 bg-white hover:bg-amber-100"
                          onClick={() => setManualOutsideWindowMode(true)}
                        >
                          Create Task Anyway
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {!planningClosed && isExtraTask
                  ? sections.slice(0, 1).map((section) => (
                      <ExtraTaskSectionFields
                        key={section.id}
                        section={section}
                        projectOptions={projectOptions}
                        showTaskNameError={Boolean(errors[section.id]?.taskName)}
                        showProjectNameError={Boolean(errors[section.id]?.projectName)}
                        showStartEndError={Boolean(errors[section.id]?.startEnd)}
                        showWorkDoneError={Boolean(errors[section.id]?.workDone)}
                        onChange={(patch) => updateSection(section.id, patch)}
                        onDescriptionRef={(handle) => {
                          descriptionRefs.current[section.id] = handle;
                        }}
                        onWorkDoneRef={(handle) => {
                          workDoneRefs.current[section.id] = handle;
                        }}
                      />
                    ))
                  : null}

                {!planningClosed && !isExtraTask
                  ? sections.map((section, index) => (
                      <TaskSectionRow
                        key={section.id}
                        index={index}
                        section={section}
                        canRemove={sections.length > 1}
                        elevated={elevated}
                        enhancedEligible={enhancedEligible}
                        projectOptions={projectOptions}
                        showTaskNameError={Boolean(errors[section.id]?.taskName)}
                        showHoursRequiredError={Boolean(errors[section.id]?.hoursRequired)}
                        showProjectNameError={Boolean(errors[section.id]?.projectName)}
                        onChange={(patch) => updateSection(section.id, patch)}
                        onRemove={() => removeSection(section.id)}
                        onDescriptionRef={(handle) => {
                          descriptionRefs.current[section.id] = handle;
                        }}
                      />
                    ))
                  : null}
              </div>
            </div>

            <div className="shrink-0 space-y-3 border-t border-gray-200 bg-white px-6 py-4">
              {!planningClosed && !isExtraTask ? (
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
              {hoursAlert ? (
                <p className="text-sm text-red-600 whitespace-pre-wrap">{hoursAlert}</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {!planningClosed && !isExtraTask ? totalHoursIndicator : null}
                {!planningClosed && isExtraTask ? extraHoursIndicator : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || planningClosed}>
                  {saving ? 'Saving…' : !isExtraTask && multipleSections ? 'Save Tasks' : 'Save Task'}
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
        onClose={() => {
          if (saving || submitLockRef.current) return;
          setSummaryDrafts(null);
        }}
        onConfirm={() => {
          if (!summaryDrafts || saving || submitLockRef.current) return;
          void persistDrafts(summaryDrafts);
        }}
      />
    </>
  );
}
