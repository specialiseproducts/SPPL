import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import {
  createManagedProject,
  deactivateManagedProject,
  fetchAssignableProjectEmployees,
  fetchManagedProjects,
  updateManagedProject,
  type ManagedProject,
  type ManagedProjectTaskDraft,
  type ProjectVisibility,
} from '../../hooks/dailyPlanner/dailyPlannerApi';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

function emptyTask(): ManagedProjectTaskDraft {
  return {
    taskName: '',
    contributionPercent: 0,
    assignedEmployeeCodes: [],
  };
}

function contributionTotal(tasks: ManagedProjectTaskDraft[]): number {
  return Math.round(
    tasks
      .filter((t) => (t.status || 'Active') !== 'Inactive')
      .reduce((sum, t) => sum + (Number(t.contributionPercent) || 0), 0) * 100,
  ) / 100;
}

interface ProjectManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export default function ProjectManagementDialog({
  open,
  onOpenChange,
  onChanged,
}: ProjectManagementDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<ManagedProject[]>([]);
  const [assignees, setAssignees] = useState<
    Array<{ employeeCode: string; employeeName: string }>
  >([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [visibility, setVisibility] = useState<ProjectVisibility>('ProjectTeamOnly');
  /** Independent of Visibility — whether the project appears in Project Progress. Default No. */
  const [showInProjectProgress, setShowInProjectProgress] = useState(false);
  /** When false, project is saved with zero predefined task names. Default No. */
  const [hasPredefinedTasks, setHasPredefinedTasks] = useState(false);
  const [tasks, setTasks] = useState<ManagedProjectTaskDraft[]>([emptyTask()]);

  const total = useMemo(() => contributionTotal(tasks), [tasks]);
  const allocationOk = !hasPredefinedTasks || Math.abs(total - 100) < 0.01;

  /** Projects list only — do not block on assignees (loaded lazily for create/edit). */
  const reloadProjects = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchManagedProjects();
      setProjects(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const ensureAssigneesLoaded = async () => {
    if (assignees.length > 0 || assigneesLoading) return;
    setAssigneesLoading(true);
    try {
      const people = await fetchAssignableProjectEmployees();
      setAssignees(people);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load assignable employees');
    } finally {
      setAssigneesLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setEditingKey(null);
    setProjectName('');
    setVisibility('ProjectTeamOnly');
    setShowInProjectProgress(false);
    setHasPredefinedTasks(false);
    setTasks([emptyTask()]);
    setLoadError(null);
    void reloadProjects();
  }, [open]);

  const startCreate = () => {
    setEditingKey('new');
    setProjectName('');
    setVisibility('ProjectTeamOnly');
    setShowInProjectProgress(false);
    setHasPredefinedTasks(false);
    setTasks([emptyTask()]);
    void ensureAssigneesLoaded();
  };

  const startEdit = (project: ManagedProject) => {
    const activeTasks = (project.projectTasks || []).filter(
      (t) => (t.status || 'Active') !== 'Inactive',
    );
    setEditingKey(project.projectKey);
    setProjectName(project.projectName);
    setVisibility(project.visibility ?? 'ProjectTeamOnly');
    // Legacy records without the field were treated as shown in Progress (DTO defaults true).
    setShowInProjectProgress(project.showInProjectProgress !== false);
    setHasPredefinedTasks(activeTasks.length > 0);
    setTasks(
      activeTasks.length > 0
        ? activeTasks.map((t) => ({
            projectTaskId: t.projectTaskId,
            taskName: t.taskName,
            contributionPercent: Number(t.contributionPercent) || 0,
            assignedEmployeeCodes: [...(t.assignedEmployeeCodes || [])],
            status: 'Active' as const,
          }))
        : [emptyTask()],
    );
    void ensureAssigneesLoaded();
  };

  const updateTask = (index: number, patch: Partial<ManagedProjectTaskDraft>) => {
    setTasks((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const toggleAssignee = (index: number, code: string) => {
    setTasks((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const set = new Set(t.assignedEmployeeCodes || []);
        if (set.has(code)) set.delete(code);
        else set.add(code);
        return { ...t, assignedEmployeeCodes: [...set] };
      }),
    );
  };

  const handleSave = async () => {
    if (!projectName.trim()) {
      toast.error('Project Name is required');
      return;
    }
    if (hasPredefinedTasks) {
      if (tasks.length === 0) {
        toast.error('Add at least one project task');
        return;
      }
      for (const t of tasks) {
        if (!t.taskName.trim()) {
          toast.error('Each task requires a name');
          return;
        }
        if (!t.assignedEmployeeCodes?.length) {
          toast.error(`Assign at least one employee to "${t.taskName || 'task'}"`);
          return;
        }
      }
      if (!allocationOk) {
        toast.error(`Active task contributions must total 100% (currently ${total}%)`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        projectName: projectName.trim(),
        visibility,
        showInProjectProgress,
        hasPredefinedTasks,
        projectTasks: hasPredefinedTasks
          ? tasks.map((t) => ({
              projectTaskId: t.projectTaskId,
              taskName: t.taskName.trim(),
              contributionPercent: Number(t.contributionPercent) || 0,
              assignedEmployeeCodes: t.assignedEmployeeCodes,
              status: 'Active' as const,
            }))
          : [],
      };
      if (editingKey && editingKey !== 'new') {
        await updateManagedProject(editingKey, payload);
        toast.success('Project updated');
      } else {
        await createManagedProject(payload);
        toast.success('Project created');
      }
      setEditingKey(null);
      await reloadProjects();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (projectKey: string) => {
    if (!window.confirm('Deactivate this project? Historical Daily Planner records are kept.')) {
      return;
    }
    try {
      await deactivateManagedProject(projectKey);
      toast.success('Project deactivated');
      if (editingKey === projectKey) setEditingKey(null);
      await reloadProjects();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deactivate failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          editingKey
            ? // Stable outer height: fixed header / scrollable body / fixed footer.
              // Override DialogContent defaults (grid, sm:max-w-lg, p-6, gap-4).
              '!flex !h-[min(90dvh,900px)] !max-h-[90dvh] !w-full !max-w-3xl !flex-col !gap-0 overflow-hidden !p-0 sm:!max-w-3xl'
            : '!flex !max-h-[90dvh] !w-full !max-w-3xl !flex-col !gap-0 overflow-hidden !p-0 sm:!max-w-3xl'
        }
        style={
          editingKey
            ? {
                height: 'min(90dvh, 900px)',
                maxHeight: '90dvh',
              }
            : { maxHeight: '90dvh' }
        }
      >
        {editingKey ? (
          <>
            <div className="shrink-0 space-y-3 border-b border-gray-200 px-6 pb-3 pt-6 pr-12">
              <DialogHeader className="text-left">
                <DialogTitle>
                  {editingKey === 'new' ? 'New Project' : 'Edit Project'}
                </DialogTitle>
              </DialogHeader>
              {hasPredefinedTasks ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[#212529]">
                      Project tasks &amp; contribution to overall project
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => setTasks((prev) => [...prev, emptyTask()])}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add Task
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600">
                    Contribution % is the task&apos;s weight in the project (must total 100%). It is
                    separate from employee Progress Done (%).
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-600">
                  This project has no predefined task names. Employees can enter task names
                  manually when creating Daily Planner tasks.
                </p>
              )}
            </div>

            {/* Sole vertical scroll region — form fields + full employee lists */}
            <div className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-6 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="pm-project-name">Project Name *</Label>
                <Input
                  id="pm-project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <Select
                  value={visibility}
                  onValueChange={(v) => setVisibility(v as ProjectVisibility)}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Everyone">Everyone</SelectItem>
                    <SelectItem value="ProjectTeamOnly">Project Team Only</SelectItem>
                    <SelectItem value="OnlyMe">Only Me</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Show this project in the Project Progress tab?</Label>
                <Select
                  value={showInProjectProgress ? 'yes' : 'no'}
                  onValueChange={(v) => setShowInProjectProgress(v === 'yes')}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Do you want to add predefined task names for this project?</Label>
                <Select
                  value={hasPredefinedTasks ? 'yes' : 'no'}
                  onValueChange={(v) => {
                    const next = v === 'yes';
                    setHasPredefinedTasks(next);
                    if (next && tasks.length === 0) setTasks([emptyTask()]);
                  }}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes — Add Task Names</SelectItem>
                    <SelectItem value="no">No — Create Project Without Task Names</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasPredefinedTasks
                ? tasks.map((task, index) => (
                    <div
                      key={task.projectTaskId || `new-${index}`}
                      className="space-y-2 rounded-md border border-gray-200 p-3"
                    >
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[12rem] flex-1 space-y-1">
                          <Label>Task Name *</Label>
                          <Input
                            value={task.taskName}
                            onChange={(e) => updateTask(index, { taskName: e.target.value })}
                            disabled={saving}
                          />
                        </div>
                        <div className="w-[7.5rem] space-y-1">
                          <Label>Contribution %</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={task.contributionPercent}
                            onChange={(e) =>
                              updateTask(index, {
                                contributionPercent: Number(e.target.value),
                              })
                            }
                            disabled={saving}
                          />
                        </div>
                        {tasks.length > 1 ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-red-600"
                            disabled={saving}
                            onClick={() =>
                              setTasks((prev) => prev.filter((_, i) => i !== index))
                            }
                            title="Remove task"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Label>Assigned employees *</Label>
                        <div className="space-y-1 rounded-md border border-gray-100 p-2">
                          {assigneesLoading ? (
                            <p className="text-xs text-gray-500">Loading employees…</p>
                          ) : assignees.length === 0 ? (
                            <p className="text-xs text-gray-500">No assignable team members.</p>
                          ) : (
                            assignees.map((emp) => {
                              const checked = (task.assignedEmployeeCodes || []).includes(
                                emp.employeeCode,
                              );
                              return (
                                <label
                                  key={emp.employeeCode}
                                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={saving}
                                    onChange={() => toggleAssignee(index, emp.employeeCode)}
                                  />
                                  <span>{emp.employeeName}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                : null}
            </div>

            <div className="shrink-0 space-y-3 border-t border-gray-200 px-6 py-3">
              {hasPredefinedTasks ? (
                <p
                  className={
                    allocationOk
                      ? 'text-sm text-emerald-700'
                      : 'text-sm font-medium text-amber-700'
                  }
                >
                  Contribution total: {total}% {allocationOk ? '(valid)' : '(must equal 100%)'}
                </p>
              ) : (
                <p className="text-sm text-gray-600">No predefined task names for this project.</p>
              )}
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setEditingKey(null)}
                >
                  Back
                </Button>
                <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? 'Saving…' : 'Save Project'}
                </Button>
              </DialogFooter>
            </div>
          </>
        ) : (
          <>
            <div className="shrink-0 space-y-3 border-b border-gray-200 px-6 pb-3 pt-6 pr-12">
              <DialogHeader className="text-left">
                <DialogTitle>Project Management</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-gray-600">
                  Create and maintain projects, task contributions, and employee assignments.
                </p>
                <Button type="button" size="sm" onClick={startCreate} disabled={loading}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  New Project
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-6 py-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading projects…</p>
              ) : loadError ? (
                <div className="space-y-3 rounded-md border border-red-200 bg-red-50 px-3 py-3">
                  <p className="text-sm text-red-700">{loadError}</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => void reloadProjects()}>
                    Retry
                  </Button>
                </div>
              ) : projects.length === 0 ? (
                <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  No managed projects yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {projects.map((project) => {
                    const activeCount = (project.projectTasks || []).filter(
                      (t) => t.status !== 'Inactive',
                    ).length;
                    return (
                      <li
                        key={project.projectKey}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 p-3"
                      >
                        <div>
                          <p className="font-medium text-[#212529]">{project.projectName}</p>
                          <p className="text-xs text-gray-500">
                            {activeCount === 0
                              ? 'No predefined task names'
                              : `${activeCount} task${activeCount === 1 ? '' : 's'}`}
                            {activeCount > 0
                              ? project.allocationValid
                                ? ' · allocation valid'
                                : ' · check contributions'
                              : ''}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(project)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => void handleDeactivate(project.projectKey)}
                          >
                            Deactivate
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
