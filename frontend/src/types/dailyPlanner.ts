export type DailyPlannerPriority = 'Urgent' | 'High' | 'Medium' | 'Low';
export type DailyPlannerStatus =
  | 'Pending'
  | 'Approved'
  | 'Completed'
  | 'Not Completed'
  | 'Rejected'
  | 'Terminated'
  | 'Rescheduled'
  | 'Needs Revision'
  | 'Awaiting Verification'
  | 'Verified Complete';
export type DailyPlannerTaskType = 'Manual' | 'Sales Visit';
export type DailyPlannerSource = 'MANUAL' | 'SALES_FORECASTING' | 'RESCHEDULED' | 'EXTRA';
export type DailyPlannerNotCompletedAction = 'terminate' | 'next_date';
export type DailyPlannerPlanningCategory = 'Regular' | 'Urgent';
export type DailyPlannerPlanningWindow = 'Morning' | 'Evening' | 'Outside' | null;

export interface DailyPlannerReplacementTask {
  taskName: string;
  description: string;
  priority: DailyPlannerPriority;
  hoursRequired?: number | null;
  /** Optional Super Admin / manager instruction (stored as expectedOutcome for compatibility). */
  expectedOutcome?: string;
  instruction?: string;
}

export interface DailyPlannerTask {
  plannerTaskId: string;
  employeeCode: string;
  employeeName: string;
  date: string;
  taskName: string;
  description: string;
  priority: DailyPlannerPriority;
  originalPriority: DailyPlannerPriority;
  currentPriority: DailyPlannerPriority;
  priorityEdited: boolean;
  priorityEditedBy?: string;
  priorityEditedByName?: string;
  priorityEditedAt?: string | null;
  /** Estimated hours required to complete this task (effective / reviewed value). */
  hoursRequired?: number | null;
  originalHoursRequired?: number | null;
  hoursRequiredEdited?: boolean;
  hoursRequiredEditedBy?: string;
  hoursRequiredEditedByName?: string;
  hoursRequiredEditedAt?: string | null;
  status: DailyPlannerStatus;
  reason: string;
  taskType: DailyPlannerTaskType;
  source: DailyPlannerSource;
  salesPlannerId?: string | null;
  approved: boolean;
  approvalStatus?: string;
  approvedBy: string;
  approvedByName: string;
  approvedDate?: string | null;
  approvedAt?: string | null;
  /** Super Admin reopen — preserves prior approval while unlocking correction. */
  reopenedFromStatus?: string;
  reopenedBy?: string;
  reopenedByName?: string;
  reopenedAt?: string | null;
  reopenReason?: string;
  managerComments: string;
  managerInstructions?: string;
  isProjectBased?: boolean;
  projectName?: string;
  /** Enhanced (Factory / Office SuperAdmin): document required? */
  needsDocument?: boolean | null;
  /** Employee Document (create / mark completed). */
  documentFileName?: string;
  documentFileKey?: string;
  documentUploadedAt?: string | null;
  documentContentType?: string;
  /** Manager Review Document (Team Daily Planner → Task Review). */
  managerReviewDocumentFileName?: string;
  managerReviewDocumentFileKey?: string;
  managerReviewDocumentUploadedAt?: string | null;
  managerReviewDocumentContentType?: string;
  /** Manager Approval Document (Pending Completion Approval). */
  managerApprovalDocumentFileName?: string;
  managerApprovalDocumentFileKey?: string;
  managerApprovalDocumentUploadedAt?: string | null;
  managerApprovalDocumentContentType?: string;
  /** Enhanced: explicit Progress Done 0–100; null = historical / unset. */
  progressDone?: number | null;
  flagStatus?: '' | 'Raised' | 'Accepted' | string;
  flagInstruction?: string;
  flagRaisedBy?: string;
  flagRaisedByName?: string;
  flagRaisedAt?: string | null;
  flagAcceptedAt?: string | null;
  flagHistory?: Array<Record<string, unknown>>;
  planFinalizedAt?: string | null;
  planFinalizedBy?: string;
  createdByRole?: string;
  dayCompletionSubmittedAt?: string | null;
  dayCompletionSubmittedBy?: string;
  completionManagerReviewedAt?: string | null;
  completionManagerReviewedBy?: string;
  dayCompletionReviewSubmittedAt?: string | null;
  dayCompletionReviewSubmittedBy?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string | null;
  verificationStatus?: string;
  revisionReason?: string;
  revisionRequestedBy?: string;
  revisionRequestedByName?: string;
  revisionRequestedAt?: string | null;
  revisionOutcome?: 'accepted_suggestion' | 'custom_revision' | '';
  revisionHandledAt?: string | null;
  revisedTaskId?: string | null;
  replacementTask?: DailyPlannerReplacementTask | null;
  planningCategory?: DailyPlannerPlanningCategory;
  urgentReason?: string;
  planningWindowUsed?: DailyPlannerPlanningWindow;
  planningTimestamp?: string | null;
  originalDate?: string | null;
  rescheduledFrom?: string | null;
  rescheduledToDate?: string | null;
  rescheduledFromDate?: string | null;
  rescheduledBy?: string;
  rescheduledByName?: string;
  rescheduledAt?: string | null;
  terminatedBy?: string;
  terminatedByName?: string;
  terminatedAt?: string | null;
  parentTaskId?: string | null;
  /** Task-level planning contribution (+1 previous day / +0.5 morning). */
  planningScore?: number;
  /** Task-level completion contribution (+2 / -1). */
  completionScore?: number;
  /** planningScore + completionScore. */
  finalScore?: number;
  /** HH:mm start time recorded when marking complete. */
  completionStartTime?: string | null;
  /** HH:mm end time recorded when marking complete. */
  completionEndTime?: string | null;
  /** Decimal hours computed from start/end on complete. */
  completionDurationHours?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyPlannerTeamMapping {
  mappingId: string;
  managerCode: string;
  managerName: string;
  employeeCode: string;
  employeeName: string;
  /** Canonical EmployeeMaster location (Office | Factory) for holiday/working-day rules. */
  location?: string;
  /** Factory OR (Office + Super Admin) — enhanced Daily Planner features. */
  enhancedEligible?: boolean;
  status: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyPlannerTaskDraft {
  date: string;
  taskName: string;
  description: string;
  priority: DailyPlannerPriority;
  hoursRequired: number;
  planningCategory?: DailyPlannerPlanningCategory;
  urgentReason?: string;
  revisesTaskId?: string;
  isProjectBased?: boolean;
  projectName?: string;
  needsDocument?: boolean;
  progressDone?: number | null;
  managerInstructions?: string;
  employeeCode?: string;
  clientBatchId?: string;
  /** Unplanned work logged during Mark Completed — immediately Verified Complete. */
  isExtraTask?: boolean;
  /** Extra Task: completion start (HH:mm), same as Mark Completed. */
  startTime?: string;
  /** Extra Task: completion end (HH:mm), same as Mark Completed. */
  endTime?: string;
  /** Extra Task: work done (bullet text), same as Mark Completed. */
  workDone?: string;
}

/** Manager-facing pending day-completion submission (Team Daily Planner). */
export interface PendingCompletionApproval {
  employeeCode: string;
  employeeName: string;
  date: string;
  taskCount: number;
  submittedAt: string | null;
  status: string;
  tasks: DailyPlannerTask[];
}
