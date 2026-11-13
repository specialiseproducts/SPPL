import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
} from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import StepProcedureEditor from './StepProcedureEditor';
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
import {
  descriptionFromProcedureSteps,
  draftToPlannedMinutes,
  newProcedureStepDraft,
  partsFromPlannedMinutes,
  resolveProcedureSteps,
  sumDraftDecimalHours,
  sumDraftPlannedMinutes,
  validateProcedureDrafts,
  workDoneFromProcedureSteps,
  type DailyPlannerProcedureStep,
  type ProcedureStepDraft,
} from '../../utils/dailyPlannerProcedureSteps';
import { sumPlannedHoursForDate } from './dailyPlannerUtils';
import { cn } from '../ui/utils';
import {
  fetchDailyPlannerProjects,
  fetchProjectFormOptions,
  uploadDailyPlannerTaskDocument,
  type ProjectFormOption,
} from '../../hooks/dailyPlanner/dailyPlannerApi';
import DailyPlannerPlanSummaryDialog from './DailyPlannerPlanSummaryDialog';
import HoursMinutesFields from './HoursMinutesFields';
import DailyPlannerEnhancedTaskFields, { resolveDocumentUploadPayload } from './DailyPlannerEnhancedTaskFields';
import ProjectObservationsButton, { type ProjectObservationsCache } from './ProjectObservationsButton';
import { normalizeProjectKey } from './ProjectPastDataDialog';
import { isFactoryDailyPlannerEligible } from '../../utils/dailyPlannerFactoryEligibility';

type TaskSectionState = {
  id: string;
  taskName: string;
  /** Step By Step Procedure — source of truth for description + hoursRequired. */
  procedureSteps: ProcedureStepDraft[];
  /**
   * Extra Task only: Work Done rows locked 1:1 to procedureSteps (by stepId).
   * description = work done text; hours/minutes = actual duration (not planned).
   */
  extraWorkDoneSteps: ProcedureStepDraft[];
  priority: DailyPlannerPriority;
  /** Read-only: always the sum of procedure step durations. */
  hoursRequired: number | null;
  isProjectBased: 'Yes' | 'No';
  projectName: string;
  projectTaskId: string;
  managerInstructions: string;
  startTime: string;
  endTime: string;
  needsDocument: 'Yes' | 'No';
  progressDone: number | null;
  documentFile: File | null;
  documentFiles?: File[];
};

/** Keep Extra Work Done rows aligned to procedure stepIds (preserve entered work/actuals). */
function syncExtraWorkDoneSteps(
  procedureSteps: ProcedureStepDraft[],
  prevWork: ProcedureStepDraft[],
): ProcedureStepDraft[] {
  const byId = new Map(prevWork.map((w) => [w.stepId, w]));
  return procedureSteps.map((p) => {
    const existing = byId.get(p.stepId);
    if (existing) return { ...existing, stepId: p.stepId };
    return newProcedureStepDraft({ stepId: p.stepId });
  });
}

type SectionErrors = Record<
  string,
  {
    taskName?: boolean;
    /** Validation message for Step By Step Procedure (incomplete steps). */
    procedureSteps?: string;
    projectName?: boolean;
    startEnd?: boolean;
    /** Extra Task Work Done validation message. */
    workDone?: string | boolean;
  }
>;

function createEmptySection(): TaskSectionState {
  const firstStep = newProcedureStepDraft();
  return {
    id: crypto.randomUUID(),
    taskName: '',
    procedureSteps: [firstStep],
    extraWorkDoneSteps: [newProcedureStepDraft({ stepId: firstStep.stepId })],
    priority: 'Medium',
    hoursRequired: null,
    isProjectBased: 'No',
    projectName: '',
    projectTaskId: '',
    managerInstructions: '',
    startTime: '',
    endTime: '',
    needsDocument: 'No',
    progressDone: null,
    documentFile: null,
    documentFiles: [],
  };
}

function isSectionEmpty(taskName: string, procedureSteps: ProcedureStepDraft[]): boolean {
  const hasSteps = procedureSteps.some((step) => step.description.trim().length > 0);
  return !taskName.trim() && !hasSteps;
}

/** Total of all step durations as decimal hours (null when nothing entered yet). */
/** Collapse whitespace; reuse canonical display name when a case-insensitive match exists. */
function resolveCanonicalProjectName(
  raw: string,
  managedProjects: ProjectFormOption[],
  legacyNames: string[],
): string {
  const collapsed = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!collapsed) return '';
  const key = normalizeProjectKey(collapsed);
  const managed = managedProjects.find((p) => normalizeProjectKey(p.projectName) === key);
  if (managed) return managed.projectName;
  const legacy = legacyNames.find((n) => normalizeProjectKey(n) === key);
  if (legacy) return legacy;
  return collapsed;
}

function buildProjectNameOptions(
  managedProjects: ProjectFormOption[],
  legacyNames: string[],
): string[] {
  const byKey = new Map<string, string>();
  for (const p of managedProjects) {
    const name = String(p.projectName || '').trim();
    if (!name) continue;
    byKey.set(normalizeProjectKey(name), name);
  }
  for (const n of legacyNames) {
    const name = String(n || '').trim();
    if (!name) continue;
    const key = normalizeProjectKey(name);
    if (!byKey.has(key)) byKey.set(key, name);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

function stepsTotalHours(procedureSteps: ProcedureStepDraft[]): number | null {
  const total = sumDraftDecimalHours(procedureSteps);
  return total > 0 ? total : null;
}

interface TaskSectionRowProps {
  index: number;
  section: TaskSectionState;
  canRemove: boolean;
  elevated: boolean;
  enhancedEligible?: boolean;
  /** Factory v2: mandatory Project Name first; no Yes/No; Progress Done always. */
  factoryMode?: boolean;
  highlighted?: boolean;
  projectOptions: string[];
  managedProjects?: ProjectFormOption[];
  observationCacheRef: MutableRefObject<ProjectObservationsCache>;
  showTaskNameError: boolean;
  procedureError?: string;
  showProjectNameError: boolean;
  onChange: (patch: Partial<TaskSectionState>) => void;
  onRemove: () => void;
}

function TaskSectionRow({
  index,
  section,
  canRemove,
  elevated,
  enhancedEligible = false,
  factoryMode = false,
  highlighted = false,
  projectOptions,
  managedProjects = [],
  observationCacheRef,
  showTaskNameError,
  procedureError,
  showProjectNameError,
  onChange,
  onRemove,
}: TaskSectionRowProps) {
  const showProjectName = factoryMode || section.isProjectBased === 'Yes';
  const selectedManaged = managedProjects.find(
    (p) => normalizeProjectKey(p.projectName) === normalizeProjectKey(section.projectName),
  );
  const managedTaskOptions = selectedManaged?.tasks || [];
  const projectNameChoices = buildProjectNameOptions(managedProjects, projectOptions);

  const applyProjectName = (raw: string, canonicalize: boolean) => {
    const nextName = canonicalize
      ? resolveCanonicalProjectName(raw, managedProjects, projectOptions)
      : raw;
    const matched = managedProjects.find(
      (p) => normalizeProjectKey(p.projectName) === normalizeProjectKey(nextName),
    );
    const sameManaged =
      matched &&
      selectedManaged &&
      normalizeProjectKey(matched.projectName) === normalizeProjectKey(selectedManaged.projectName);
    onChange({
      projectName: nextName,
      projectTaskId: sameManaged ? section.projectTaskId : '',
      ...(sameManaged ? {} : { taskName: matched ? '' : section.taskName }),
      ...(factoryMode ? { isProjectBased: 'Yes' as const } : {}),
    });
  };

  return (
    <div
      id={`create-task-section-${section.id}`}
      data-task-section-id={section.id}
      className={cn(
        'rounded-lg border bg-gray-50/40 p-4 space-y-4 scroll-mt-4',
        highlighted ? 'border-[#007BFF] ring-2 ring-[#007BFF]/30' : 'border-gray-200',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#212529]">{index + 1}</p>
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

      {showProjectName ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor={`project-name-${section.id}`}>Project Name *</Label>
            {factoryMode ? (
              <ProjectObservationsButton
                projectName={section.projectName}
                cacheRef={observationCacheRef}
              />
            ) : null}
          </div>
          <Input
            id={`project-name-${section.id}`}
            list={`project-options-${section.id}`}
            value={section.projectName}
            onChange={(e) => applyProjectName(e.target.value, false)}
            onBlur={() => applyProjectName(section.projectName, true)}
            placeholder="Select or type a project name"
            className={cn(showProjectNameError && 'border-red-500 focus-visible:ring-red-500/30')}
            aria-invalid={showProjectNameError}
            autoComplete="off"
          />
          <datalist id={`project-options-${section.id}`}>
            {projectNameChoices.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {showProjectNameError ? (
            <p className="text-xs text-red-600">Project Name is required.</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`task-name-${section.id}`}>Task Name *</Label>
        {managedTaskOptions.length > 0 ? (
          <select
            id={`task-name-${section.id}`}
            className={cn(
              'border-input bg-background h-9 w-full rounded-md border px-2 text-sm',
              showTaskNameError && 'border-red-500',
            )}
            value={section.projectTaskId || ''}
            onChange={(e) => {
              const id = e.target.value;
              const match = managedTaskOptions.find((t) => t.projectTaskId === id);
              onChange({
                projectTaskId: id,
                taskName: match?.taskName || '',
              });
            }}
            aria-invalid={showTaskNameError}
          >
            <option value="">Select task</option>
            {managedTaskOptions.map((t) => (
              <option key={t.projectTaskId} value={t.projectTaskId}>
                {t.taskName}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id={`task-name-${section.id}`}
            value={section.taskName}
            onChange={(e) => onChange({ taskName: e.target.value, projectTaskId: '' })}
            className={cn(showTaskNameError && 'border-red-500 focus-visible:ring-red-500/30')}
            aria-invalid={showTaskNameError}
          />
        )}
        {showTaskNameError ? (
          <p className="text-xs text-red-600">Task name is required.</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <StepProcedureEditor
          id={`task-procedure-${section.id}`}
          label="Step By Step Procedure"
          required
          steps={section.procedureSteps}
          onChange={(procedureSteps) => onChange({ procedureSteps })}
          error={Boolean(procedureError)}
        />
        {procedureError ? <p className="text-xs text-red-600">{procedureError}</p> : null}
      </div>

      <div className="space-y-2">
        <Label>Hours Required to Complete</Label>
        {/* Read-only: auto-calculated from the Step By Step Procedure durations. */}
        <HoursMinutesFields
          idPrefix={`hours-required-${section.id}`}
          value={section.hoursRequired}
          onChange={() => undefined}
          disabled
        />
        <p className="text-xs text-gray-500">Auto-calculated from the steps above.</p>
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

      {!factoryMode ? (
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
          // Progress Done is not collected at Create New Task — keep Extra Task / completion flows unchanged.
          isProjectBased={false}
          alwaysShowProgressDone={false}
          values={{
            needsDocument: section.needsDocument,
            progressDone: null,
            documentFile: section.documentFile,
            documentFiles: section.documentFiles,
          }}
          onChange={(patch) => onChange(patch)}
        />
      ) : null}
    </div>
  );
}

interface ExtraTaskSectionFieldsProps {
  section: TaskSectionState;
  factoryMode?: boolean;
  enhancedEligible?: boolean;
  projectOptions: string[];
  managedProjects?: ProjectFormOption[];
  observationCacheRef: MutableRefObject<ProjectObservationsCache>;
  showTaskNameError: boolean;
  showProjectNameError: boolean;
  showWorkDoneError: boolean;
  procedureError?: string;
  workDoneError?: string;
  onChange: (patch: Partial<TaskSectionState>) => void;
}

/**
 * Extra Task form: description-only procedure steps + per-step Work Done (text + actual H/M).
 * Planned hours remain 0; actual duration is the sum of Work Done step actuals.
 */
function ExtraTaskSectionFields({
  section,
  factoryMode = false,
  enhancedEligible = false,
  projectOptions,
  managedProjects = [],
  observationCacheRef,
  showTaskNameError,
  showProjectNameError,
  showWorkDoneError,
  procedureError,
  workDoneError,
  onChange,
}: ExtraTaskSectionFieldsProps) {
  const showProjectName = factoryMode || section.isProjectBased === 'Yes';
  const selectedManaged = managedProjects.find(
    (p) => normalizeProjectKey(p.projectName) === normalizeProjectKey(section.projectName),
  );
  const managedTaskOptions = selectedManaged?.tasks || [];
  const projectNameChoices = buildProjectNameOptions(managedProjects, projectOptions);

  const applyProjectName = (raw: string, canonicalize: boolean) => {
    const nextName = canonicalize
      ? resolveCanonicalProjectName(raw, managedProjects, projectOptions)
      : raw;
    const matched = managedProjects.find(
      (p) => normalizeProjectKey(p.projectName) === normalizeProjectKey(nextName),
    );
    const sameManaged =
      matched &&
      selectedManaged &&
      normalizeProjectKey(matched.projectName) === normalizeProjectKey(selectedManaged.projectName);
    onChange({
      projectName: nextName,
      projectTaskId: sameManaged ? section.projectTaskId : '',
      ...(sameManaged ? {} : { taskName: matched ? '' : section.taskName }),
      ...(factoryMode ? { isProjectBased: 'Yes' as const } : {}),
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4 space-y-4">
      {showProjectName ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor={`project-name-${section.id}`}>Project Name *</Label>
            {factoryMode ? (
              <ProjectObservationsButton
                projectName={section.projectName}
                cacheRef={observationCacheRef}
              />
            ) : null}
          </div>
          <Input
            id={`project-name-${section.id}`}
            list={`extra-project-options-${section.id}`}
            value={section.projectName}
            onChange={(e) => applyProjectName(e.target.value, false)}
            onBlur={() => applyProjectName(section.projectName, true)}
            placeholder="Select or type a project name"
            className={cn(showProjectNameError && 'border-red-500 focus-visible:ring-red-500/30')}
            aria-invalid={showProjectNameError}
            autoComplete="off"
          />
          <datalist id={`extra-project-options-${section.id}`}>
            {projectNameChoices.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {showProjectNameError ? (
            <p className="text-xs text-red-600">Project Name is required.</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`task-name-${section.id}`}>Task Name *</Label>
        {managedTaskOptions.length > 0 ? (
          <select
            id={`task-name-${section.id}`}
            className={cn(
              'border-input bg-background h-9 w-full rounded-md border px-2 text-sm',
              showTaskNameError && 'border-red-500',
            )}
            value={section.projectTaskId || ''}
            onChange={(e) => {
              const id = e.target.value;
              const match = managedTaskOptions.find((t) => t.projectTaskId === id);
              onChange({
                projectTaskId: id,
                taskName: match?.taskName || '',
              });
            }}
            aria-invalid={showTaskNameError}
          >
            <option value="">Select task</option>
            {managedTaskOptions.map((t) => (
              <option key={t.projectTaskId} value={t.projectTaskId}>
                {t.taskName}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id={`task-name-${section.id}`}
            value={section.taskName}
            onChange={(e) => onChange({ taskName: e.target.value, projectTaskId: '' })}
            className={cn(showTaskNameError && 'border-red-500 focus-visible:ring-red-500/30')}
            aria-invalid={showTaskNameError}
          />
        )}
        {showTaskNameError ? (
          <p className="text-xs text-red-600">Task name is required.</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <StepProcedureEditor
          id={`extra-procedure-${section.id}`}
          label="Step By Step Procedure"
          required
          descriptionOnly
          descriptionPlaceholder="Enter step…"
          steps={section.procedureSteps}
          onChange={(procedureSteps) =>
            onChange({
              procedureSteps,
              extraWorkDoneSteps: syncExtraWorkDoneSteps(
                procedureSteps,
                section.extraWorkDoneSteps,
              ),
            })
          }
          error={Boolean(procedureError)}
        />
        {procedureError ? <p className="text-xs text-red-600">{procedureError}</p> : null}
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

      {!factoryMode ? (
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
      ) : null}

      {enhancedEligible ? (
        <DailyPlannerEnhancedTaskFields
          idPrefix={`extra-${section.id}`}
          isProjectBased={factoryMode || section.isProjectBased === 'Yes'}
          alwaysShowProgressDone={factoryMode}
          values={{
            needsDocument: section.needsDocument,
            progressDone: section.progressDone,
            documentFile: section.documentFile,
            documentFiles: section.documentFiles,
          }}
          onChange={(patch) => onChange(patch)}
        />
      ) : null}

      <div className="space-y-1">
        <StepProcedureEditor
          id={`extra-work-done-${section.id}`}
          label="Work Done"
          required
          durationMode="actual"
          lockStepCount
          descriptionPlaceholder="Enter work done…"
          steps={section.extraWorkDoneSteps}
          onChange={(extraWorkDoneSteps) => onChange({ extraWorkDoneSteps })}
          error={showWorkDoneError}
        />
        {workDoneError ? <p className="text-xs text-red-600">{workDoneError}</p> : null}
      </div>
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
   * Factory v2 features (mandatory Project Name, navigator, etc.).
   * Prefer server `planningConfig.factoryEligible`; prop overrides when creating for a team employee.
   */
  factoryEligible?: boolean;
  /**
   * Extra Task from Mark Completed / Not Completed — same fields as Add Task,
   * saved as Completed + self-approved (no min-hours / plan-summary).
   */
  isExtraTask?: boolean;
  /** When set, form opens in Edit Mode for this existing task (Create Task UI). */
  editingTask?: DailyPlannerTask | null;
  /** Existing tasks already planned for `date` (same set the calendar uses for that day). */
  existingTasksForDate?: DailyPlannerTask[];
  /** Approved leave kind for `date` (full/half/none) — drives minimum hours. */
  leaveKind?: 'none' | 'full' | 'half';
  onClose: () => void;
  onSave: (drafts: DailyPlannerTaskDraft[]) => Promise<DailyPlannerTask[] | void>;
  /** Edit Mode save — updates the existing task identity. */
  onUpdate?: (
    taskId: string,
    patch: {
      taskName: string;
      description: string;
      priority: DailyPlannerPriority;
      hoursRequired: number;
      procedureSteps: DailyPlannerProcedureStep[];
      isProjectBased?: boolean;
      projectName?: string;
      projectTaskId?: string;
    },
  ) => Promise<DailyPlannerTask | void>;
}

function createEmptySectionForMode(factoryMode: boolean): TaskSectionState {
  const base = createEmptySection();
  if (!factoryMode) return base;
  return { ...base, isProjectBased: 'Yes' };
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
  factoryEligible,
  isExtraTask = false,
  editingTask = null,
  existingTasksForDate = [],
  leaveKind = 'none',
  onClose,
  onSave,
  onUpdate,
}: DailyPlannerCreateTaskModalProps) {
  const isEditMode = Boolean(editingTask?.plannerTaskId);
  const factoryMode = useMemo(() => {
    if (typeof factoryEligible === 'boolean') return factoryEligible;
    if (typeof planningConfig?.factoryEligible === 'boolean') return planningConfig.factoryEligible;
    return isFactoryDailyPlannerEligible(planningConfig?.employeeLocation);
  }, [factoryEligible, planningConfig?.factoryEligible, planningConfig?.employeeLocation]);

  const [sections, setSections] = useState<TaskSectionState[]>(() => [
    createEmptySectionForMode(false),
  ]);
  const [errors, setErrors] = useState<SectionErrors>({});
  const [saving, setSaving] = useState(false);
  const [manualOutsideWindowMode, setManualOutsideWindowMode] = useState(false);
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [managedProjects, setManagedProjects] = useState<ProjectFormOption[]>([]);
  const [hoursAlert, setHoursAlert] = useState<string | null>(null);
  const [summaryDrafts, setSummaryDrafts] = useState<DailyPlannerTaskDraft[] | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const formScrollRef = useRef<HTMLDivElement | null>(null);
  /** Scroll target after + New Task (or nav click) — applied after the section is in the DOM. */
  const pendingScrollSectionIdRef = useRef<string | null>(null);
  const submitLockRef = useRef(false);
  const clientBatchIdRef = useRef('');
  const observationCacheRef = useRef<ProjectObservationsCache>(new Map());

  const advancePartialPlanning =
    Boolean(planningConfig) && getPlanningTargetDateMode(date, planningConfig!) === 'other';
  const requireMinHours =
    !elevated &&
    !forEmployeeCode &&
    !isExtraTask &&
    !advancePartialPlanning &&
    leaveKind !== 'full';
  const minPlannedHours = getMinPlannedHours(planningConfig, undefined, leaveKind);

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
      observationCacheRef.current = new Map();
      setErrors({});
      setManualOutsideWindowMode(false);
      setHoursAlert(null);
      setSummaryDrafts(null);

      if (editingTask?.plannerTaskId) {
        const resolved = resolveProcedureSteps(editingTask);
        const drafts: ProcedureStepDraft[] =
          resolved.length > 0
            ? resolved.map((s) => {
                const parts = partsFromPlannedMinutes(Number(s.plannedMinutes) || 0);
                return newProcedureStepDraft({
                  stepId: s.stepId,
                  description: s.description,
                  hours: parts.hours,
                  minutes: parts.minutes,
                });
              })
            : [newProcedureStepDraft()];
        const projectName = String(editingTask.projectName || '').trim();
        const hydrated: TaskSectionState = {
          ...createEmptySectionForMode(factoryMode),
          taskName: String(editingTask.taskName || '').trim(),
          procedureSteps: drafts,
          extraWorkDoneSteps: syncExtraWorkDoneSteps(drafts, []),
          priority: (editingTask.currentPriority ||
            editingTask.priority ||
            'Medium') as DailyPlannerPriority,
          hoursRequired: stepsTotalHours(drafts),
          isProjectBased: factoryMode || Boolean(projectName) ? 'Yes' : 'No',
          projectName,
          projectTaskId: String(editingTask.projectTaskId || '').trim(),
          managerInstructions: String(editingTask.managerInstructions || '').trim(),
          needsDocument: editingTask.needsDocument ? 'Yes' : 'No',
          progressDone:
            typeof editingTask.progressDone === 'number' ? editingTask.progressDone : null,
        };
        setSections([hydrated]);
        setActiveSectionId(hydrated.id);
      } else {
        const initial = createEmptySectionForMode(factoryMode);
        setSections([initial]);
        setActiveSectionId(initial.id);
      }

      void fetchProjectFormOptions()
        .then((opts) => {
          setManagedProjects(opts.projects || []);
          const names = [
            ...(opts.projects || []).map((p) => p.projectName),
            ...(opts.legacyProjectNames || []),
          ];
          setProjectOptions([...new Set(names.filter(Boolean))]);
        })
        .catch(() => {
          void fetchDailyPlannerProjects()
            .then((projects) =>
              setProjectOptions(projects.map((p) => p.projectName).filter(Boolean)),
            )
            .catch(() => setProjectOptions([]));
          setManagedProjects([]);
        });
    }
  }, [open, date, elevated, isExtraTask, factoryMode, editingTask]);

  const existingPlannedHours = useMemo(
    () => sumPlannedHoursForDate(existingTasksForDate, date),
    [existingTasksForDate, date],
  );

  /**
   * Sum planned duration from step minutes (integer) across all draft tasks, then convert
   * once — avoids per-task decimal rounding drift in Total Planned Hours.
   */
  const liveFormHours = useMemo(() => {
    const totalMinutes = sections.reduce((sum, section) => {
      if (Array.isArray(section.procedureSteps) && section.procedureSteps.length > 0) {
        return sum + sumDraftPlannedMinutes(section.procedureSteps);
      }
      const h = Number(section.hoursRequired);
      if (Number.isFinite(h) && h > 0) return sum + Math.round(h * 60);
      return sum;
    }, 0);
    if (totalMinutes <= 0) return 0;
    return partsToDecimalHours(Math.floor(totalMinutes / 60), totalMinutes % 60);
  }, [sections]);

  const liveTotalHours = Math.round((existingPlannedHours + liveFormHours) * 100) / 100;

  /** Extra Task: Actual Hours from per-step Work Done durations (planned stays 0). */
  const extraActualHours = useMemo(() => {
    if (!isExtraTask) return null;
    const section = sections[0];
    if (!section) return null;
    const totalMinutes = sumDraftPlannedMinutes(section.extraWorkDoneSteps || []);
    if (totalMinutes <= 0) return null;
    return partsToDecimalHours(Math.floor(totalMinutes / 60), totalMinutes % 60);
  }, [isExtraTask, sections]);

  const handleClose = () => {
    onClose();
  };

  const updateSection = (id: string, patch: Partial<TaskSectionState>) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        // Regular Create: Hours Required follows the step sum.
        // Extra Task: planned hours stay 0; actuals live on extraWorkDoneSteps.
        if (patch.procedureSteps && !isExtraTask) {
          next.hoursRequired = stepsTotalHours(patch.procedureSteps);
        }
        if (isExtraTask && patch.procedureSteps && !patch.extraWorkDoneSteps) {
          next.extraWorkDoneSteps = syncExtraWorkDoneSteps(
            patch.procedureSteps,
            s.extraWorkDoneSteps || [],
          );
        }
        return next;
      }),
    );
    setHoursAlert(null);
    if (patch.procedureSteps) {
      setErrors((prev) => {
        if (!prev[id]?.procedureSteps) return prev;
        const { procedureSteps: _cleared, ...rest } = prev[id];
        return { ...prev, [id]: rest };
      });
    }
    if (patch.taskName !== undefined && patch.taskName.trim()) {
      setErrors((prev) => {
        if (!prev[id]?.taskName) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  /**
   * Scroll only the modal's middle content container so the task sits fully below the
   * fixed header. Avoid element.scrollIntoView — it can scroll outer ancestors and
   * align the section under the non-scrolling header.
   */
  const scrollTaskSectionIntoContent = (sectionId: string) => {
    const container = formScrollRef.current;
    if (!container) return false;
    const el =
      (container.querySelector(
        `[data-task-section-id="${sectionId}"]`,
      ) as HTMLElement | null) ||
      document.getElementById(`create-task-section-${sectionId}`);
    if (!el || !container.contains(el)) return false;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = elRect.top - containerRect.top;
    const padding = 8;
    container.scrollTo({
      top: Math.max(0, container.scrollTop + delta - padding),
      behavior: 'smooth',
    });
    return true;
  };

  const addSection = () => {
    const next = createEmptySectionForMode(factoryMode);
    pendingScrollSectionIdRef.current = next.id;
    setSections((prev) => [...prev, next]);
    setActiveSectionId(next.id);
    setHoursAlert(null);
  };

  const removeSection = (id: string) => {
    setSections((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((s) => s.id !== id);
      if (activeSectionId === id) {
        setActiveSectionId(next[0]?.id ?? null);
      }
      return next;
    });
    setHoursAlert(null);
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  useLayoutEffect(() => {
    const sectionId = pendingScrollSectionIdRef.current;
    if (!sectionId) return;
    if (!sections.some((s) => s.id === sectionId)) return;
    pendingScrollSectionIdRef.current = null;
    scrollTaskSectionIntoContent(sectionId);
  }, [sections]);

  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    // Section already mounted — scroll the content container directly.
    scrollTaskSectionIntoContent(sectionId);
  };

  const collectDrafts = (): { drafts: DailyPlannerTaskDraft[]; validationErrors: SectionErrors } => {
    const validationErrors: SectionErrors = {};
    const drafts: DailyPlannerTaskDraft[] = [];

    for (const section of sections) {
      if (isExtraTask) {
        if (!section.taskName.trim()) {
          validationErrors[section.id] = {
            ...(validationErrors[section.id] || {}),
            taskName: true,
          };
        }
        const requireProject = factoryMode || section.isProjectBased === 'Yes';
        const canonicalProjectName = requireProject
          ? resolveCanonicalProjectName(
              section.projectName,
              managedProjects,
              projectOptions,
            )
          : '';
        if (requireProject && !canonicalProjectName) {
          validationErrors[section.id] = {
            ...(validationErrors[section.id] || {}),
            projectName: true,
          };
        }
        const descriptionSteps = section.procedureSteps.filter(
          (d) => String(d.description || '').trim().length > 0,
        );
        if (descriptionSteps.length === 0) {
          validationErrors[section.id] = {
            ...(validationErrors[section.id] || {}),
            procedureSteps: 'Add at least one step with a description',
          };
        }
        const workById = new Map(
          (section.extraWorkDoneSteps || []).map((w) => [w.stepId, w]),
        );
        let workDoneInvalid = false;
        for (const d of descriptionSteps) {
          const work = workById.get(d.stepId);
          const workText = String(work?.description || '').trim();
          const actualMins = work ? draftToPlannedMinutes(work) : 0;
          if (!workText || actualMins <= 0) {
            workDoneInvalid = true;
            break;
          }
        }
        if (workDoneInvalid) {
          validationErrors[section.id] = {
            ...(validationErrors[section.id] || {}),
            workDone: 'Each step needs Work Done text and actual time greater than 0',
          };
        }
        if (validationErrors[section.id]) {
          continue;
        }

        // Extra Task: procedure descriptions + per-step Work Done / actualMinutes.
        // plannedMinutes stay 0; hoursRequired stays 0.
        const procedureSteps: DailyPlannerProcedureStep[] = descriptionSteps.map((d) => {
          const work = workById.get(d.stepId);
          const workText = String(work?.description || '').trim();
          const actualMins = work ? draftToPlannedMinutes(work) : 0;
          return {
            stepId: d.stepId || crypto.randomUUID(),
            description: String(d.description || '').trim(),
            plannedMinutes: 0,
            actualMinutes: actualMins,
            workDone: workText,
            status: 'completed' as const,
            completed: true,
          };
        });
        const workDone = workDoneFromProcedureSteps(procedureSteps);
        const category =
          section.priority === 'Urgent' ? PLANNING_CATEGORY_URGENT : PLANNING_CATEGORY_REGULAR;
        const projectBased = factoryMode || section.isProjectBased === 'Yes';
        drafts.push({
          date,
          taskName: section.taskName.trim(),
          description: descriptionFromProcedureSteps(procedureSteps),
          priority: section.priority,
          hoursRequired: 0,
          planningCategory: category,
          urgentReason: '',
          isProjectBased: projectBased,
          projectName: projectBased ? canonicalProjectName : '',
          projectTaskId: projectBased ? section.projectTaskId.trim() : '',
          needsDocument: enhancedEligible ? section.needsDocument === 'Yes' : undefined,
          progressDone:
            enhancedEligible && (factoryMode || projectBased) ? section.progressDone : undefined,
          managerInstructions: '',
          employeeCode: forEmployeeCode || undefined,
          isExtraTask: true,
          procedureSteps,
          workDone,
        });
        continue;
      }

      if (isSectionEmpty(section.taskName, section.procedureSteps)) {
        continue;
      }

      if (!section.taskName.trim()) {
        validationErrors[section.id] = { ...(validationErrors[section.id] || {}), taskName: true };
        continue;
      }

      // Incomplete steps (missing description / duration) block save.
      const procedureCheck = validateProcedureDrafts(section.procedureSteps);
      if (!procedureCheck.ok) {
        validationErrors[section.id] = {
          ...(validationErrors[section.id] || {}),
          procedureSteps: procedureCheck.error || 'Complete all steps before saving',
        };
        continue;
      }
      const hoursValue = procedureCheck.hoursRequired;

      const requireProject = factoryMode || section.isProjectBased === 'Yes';
      const canonicalProjectName = requireProject
        ? resolveCanonicalProjectName(section.projectName, managedProjects, projectOptions)
        : '';
      if (requireProject && !canonicalProjectName) {
        validationErrors[section.id] = {
          ...(validationErrors[section.id] || {}),
          projectName: true,
        };
        continue;
      }

      const category =
        section.priority === 'Urgent' ? PLANNING_CATEGORY_URGENT : PLANNING_CATEGORY_REGULAR;
      const projectBased = factoryMode || section.isProjectBased === 'Yes';

      drafts.push({
        date,
        taskName: section.taskName.trim(),
        description: descriptionFromProcedureSteps(procedureCheck.steps),
        procedureSteps: procedureCheck.steps,
        priority: section.priority,
        hoursRequired: Math.round(hoursValue * 100) / 100,
        planningCategory: category,
        urgentReason: '',
        isProjectBased: projectBased,
        projectName: projectBased ? canonicalProjectName : '',
        projectTaskId: projectBased ? section.projectTaskId.trim() : '',
        needsDocument: enhancedEligible ? section.needsDocument === 'Yes' : undefined,
        // Create New Task no longer collects Progress Done (%).
        progressDone: undefined,
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
        const filledSections = sections.filter(
          (section) => !isSectionEmpty(section.taskName, section.procedureSteps),
        );
        for (let i = 0; i < Math.min(filledSections.length, createdList.length); i += 1) {
          const file = filledSections[i] ? resolveDocumentUploadPayload(filledSections[i]) : null;
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
        taskName: drafts[index]?.taskName ?? section.taskName,
        priority: (drafts[index]?.priority as DailyPlannerPriority) || section.priority,
        managerInstructions: drafts[index]?.managerInstructions ?? section.managerInstructions,
      })),
    );
  };

  const saveTasks = async () => {
    if (isEditMode && editingTask?.plannerTaskId && onUpdate) {
      const { drafts, validationErrors } = collectDrafts();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        toast.error('Please fix the highlighted fields before saving');
        return;
      }
      const draft = drafts[0];
      if (!draft) {
        toast.error('Task name and steps are required');
        return;
      }
      if (submitLockRef.current) return;
      submitLockRef.current = true;
      setSaving(true);
      try {
        await onUpdate(editingTask.plannerTaskId, {
          taskName: draft.taskName,
          description: draft.description || '',
          priority: draft.priority,
          hoursRequired: Number(draft.hoursRequired) || 0,
          procedureSteps: draft.procedureSteps || [],
          isProjectBased: Boolean(draft.isProjectBased),
          projectName: draft.projectName || '',
          projectTaskId: draft.projectTaskId || '',
        });
        handleClose();
      } catch (err) {
        submitLockRef.current = false;
        toast.error(err instanceof Error ? err.message : 'Update failed');
      } finally {
        setSaving(false);
      }
      return;
    }

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

    // Match liveTotalHours: sum minutes across drafts then convert once.
    const draftMinutes = drafts.reduce((sum, d) => {
      if (Array.isArray(d.procedureSteps) && d.procedureSteps.length > 0) {
        return (
          sum +
          d.procedureSteps.reduce(
            (s, step) => s + (Number(step.plannedMinutes) > 0 ? Number(step.plannedMinutes) : 0),
            0,
          )
        );
      }
      const h = Number(d.hoursRequired);
      return sum + (Number.isFinite(h) && h > 0 ? Math.round(h * 60) : 0);
    }, 0);
    const draftHours =
      draftMinutes > 0
        ? partsToDecimalHours(Math.floor(draftMinutes / 60), draftMinutes % 60)
        : 0;
    const total = Math.round((existingPlannedHours + draftHours) * 100) / 100;

    if (requireMinHours && total < minPlannedHours) {
      const message = buildMinimumHoursRequirementMessage(planningConfig, undefined, leaveKind);
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
  const showTaskNavigator =
    factoryMode && !isExtraTask && !isEditMode && !planningClosed && sections.length > 0;
  const formPlanningClosed = isEditMode ? false : planningClosed;

  const navigatorLabel = (section: TaskSectionState, index: number) => {
    const project = section.projectName.trim();
    const task = section.taskName.trim();
    if (project || task) {
      return { project: project || '—', task: task || 'Untitled task' };
    }
    return { project: `New Task ${index + 1}`, task: '' };
  };

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
      Planned Hours: {formatDurationLabel(0)}
      <span className="mt-0.5 block text-xs font-normal text-gray-500">
        Actual:{' '}
        {extraActualHours != null ? formatDurationLabel(extraActualHours) : '—'}
      </span>
    </div>
  );

  return (
    <>
      <Dialog open={open && !summaryDrafts} onOpenChange={(v) => !v && !summaryDrafts && handleClose()}>
        <DialogContent
          className={cn(
            // Match Task Review dimensions: override DialogContent defaults (incl. sm:max-w-lg)
            // with both utility classes and inline styles so width cannot collapse.
            '!flex !h-[92vh] !max-h-[92vh] !w-[min(96vw,1200px)] !max-w-[1200px] !flex-col !gap-0 overflow-hidden !p-0 sm:!max-w-[1200px]',
          )}
          style={{
            width: 'min(96vw, 1200px)',
            maxWidth: '1200px',
            height: '92vh',
            maxHeight: '92vh',
          }}
        >
          {/*
            Plain header row (not DialogHeader): DialogHeader defaults to flex-col, which
            stacked Date under the title. Keep title left / Date right on one nowrap row.
            pr-12 reserves space for the dialog close (X) control.
          */}
          <div className="flex w-full shrink-0 flex-nowrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-3 pr-12">
            <DialogTitle className="shrink-0 text-left text-lg font-semibold leading-none">
              {isEditMode ? 'Edit Task' : isExtraTask ? 'Extra Task' : 'Create Task'}
            </DialogTitle>
            {!isExtraTask || isEditMode ? (
              <div className="flex shrink-0 items-center gap-2">
                <Label htmlFor="create-task-date" className="shrink-0 text-sm font-medium">
                  Date
                </Label>
                <Input
                  id="create-task-date"
                  value={date}
                  readOnly
                  disabled
                  className="h-9 w-[10.5rem] shrink-0 bg-gray-50"
                />
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {/* Mobile task navigator only (Date lives in the dialog header for Create Task). */}
            {showTaskNavigator ? (
              <div className="shrink-0 space-y-3 border-b border-gray-200 bg-white px-6 py-3 sm:hidden">
                <div className="flex gap-1 overflow-x-auto pb-0.5">
                  {sections.map((section, index) => {
                    const label = navigatorLabel(section, index);
                    const selected = activeSectionId === section.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => scrollToSection(section.id)}
                        className={cn(
                          'shrink-0 rounded-md border px-2 py-1 text-left text-[11px]',
                          selected
                            ? 'border-[#007BFF] bg-[#007BFF]/10 text-[#007BFF]'
                            : 'border-gray-200 bg-white text-gray-700',
                        )}
                      >
                        <span className="block max-w-[7rem] truncate font-semibold">
                          {label.project}
                        </span>
                        {label.task ? (
                          <span className="block max-w-[7rem] truncate text-gray-500">
                            {label.task}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 overflow-hidden">
              {showTaskNavigator ? (
                <aside className="hidden w-44 shrink-0 flex-col border-r border-gray-200 bg-gray-50/80 sm:flex md:w-52">
                  <p className="shrink-0 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Tasks
                  </p>
                  <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                    <ul className="space-y-1">
                      {sections.map((section, index) => {
                        const label = navigatorLabel(section, index);
                        const selected = activeSectionId === section.id;
                        return (
                          <li key={section.id}>
                            <button
                              type="button"
                              onClick={() => scrollToSection(section.id)}
                              className={cn(
                                'w-full rounded-md px-2 py-2 text-left transition-colors',
                                selected
                                  ? 'bg-[#007BFF]/10 text-[#007BFF] ring-1 ring-[#007BFF]/30'
                                  : 'hover:bg-white text-[#212529]',
                              )}
                            >
                              <span className="block truncate text-xs font-semibold">
                                {label.project}
                              </span>
                              {label.task ? (
                                <span className="mt-0.5 block truncate text-[11px] text-gray-600">
                                  {label.task}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                </aside>
              ) : null}

              {/* Only task forms scroll between fixed header and footer. */}
              <div
                ref={formScrollRef}
                className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto scroll-smooth overscroll-contain px-6 py-4"
              >
                <div className="space-y-4">
                  {formPlanningClosed ? (
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

                  {!formPlanningClosed && isExtraTask && !isEditMode
                    ? sections.slice(0, 1).map((section) => (
                        <ExtraTaskSectionFields
                          key={section.id}
                          section={section}
                          factoryMode={factoryMode}
                          enhancedEligible={enhancedEligible}
                          projectOptions={projectOptions}
                          managedProjects={managedProjects}
                          observationCacheRef={observationCacheRef}
                          showTaskNameError={Boolean(errors[section.id]?.taskName)}
                          showProjectNameError={Boolean(errors[section.id]?.projectName)}
                          showWorkDoneError={Boolean(errors[section.id]?.workDone)}
                          procedureError={errors[section.id]?.procedureSteps}
                          workDoneError={
                            typeof errors[section.id]?.workDone === 'string'
                              ? String(errors[section.id]?.workDone)
                              : undefined
                          }
                          onChange={(patch) => updateSection(section.id, patch)}
                        />
                      ))
                    : null}

                  {!formPlanningClosed && (!isExtraTask || isEditMode)
                    ? sections.map((section, index) => (
                        <TaskSectionRow
                          key={section.id}
                          index={index}
                          section={section}
                          canRemove={!isEditMode && sections.length > 1}
                          elevated={elevated}
                          enhancedEligible={enhancedEligible}
                          factoryMode={factoryMode}
                          highlighted={activeSectionId === section.id}
                          projectOptions={projectOptions}
                          managedProjects={managedProjects}
                          observationCacheRef={observationCacheRef}
                          showTaskNameError={Boolean(errors[section.id]?.taskName)}
                          procedureError={errors[section.id]?.procedureSteps}
                          showProjectNameError={Boolean(errors[section.id]?.projectName)}
                          onChange={(patch) => updateSection(section.id, patch)}
                          onRemove={() => removeSection(section.id)}
                        />
                      ))
                    : null}
                </div>
              </div>
            </div>

            <div className="shrink-0 space-y-3 border-t border-gray-200 bg-white px-6 py-4">
              {!formPlanningClosed && !isExtraTask && !isEditMode ? (
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
                {!formPlanningClosed && !isExtraTask && !isEditMode ? totalHoursIndicator : null}
                {!formPlanningClosed && isExtraTask && !isEditMode ? extraHoursIndicator : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || formPlanningClosed}>
                  {saving
                    ? 'Saving…'
                    : isEditMode
                      ? 'Save Changes'
                      : !isExtraTask && multipleSections
                        ? 'Save Tasks'
                        : 'Save Task'}
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
