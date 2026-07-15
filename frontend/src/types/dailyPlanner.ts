export type DailyPlannerPriority = 'High' | 'Medium' | 'Low';
export type DailyPlannerStatus =
  | 'Pending'
  | 'Approved'
  | 'Completed'
  | 'Not Completed'
  | 'Rejected'
  | 'Terminated'
  | 'Rescheduled';
export type DailyPlannerTaskType = 'Manual' | 'Sales Visit';
export type DailyPlannerSource = 'MANUAL' | 'SALES_FORECASTING' | 'RESCHEDULED';
export type DailyPlannerNotCompletedAction = 'terminate' | 'next_date';
export type DailyPlannerPlanningCategory = 'Regular' | 'Urgent';
export type DailyPlannerPlanningWindow = 'Morning' | 'Evening' | 'Outside' | null;

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
  status: DailyPlannerStatus;
  reason: string;
  taskType: DailyPlannerTaskType;
  source: DailyPlannerSource;
  salesPlannerId?: string | null;
  approved: boolean;
  approvedBy: string;
  approvedByName: string;
  approvedDate?: string | null;
  managerComments: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyPlannerTeamMapping {
  mappingId: string;
  managerCode: string;
  managerName: string;
  employeeCode: string;
  employeeName: string;
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
  planningCategory?: DailyPlannerPlanningCategory;
  urgentReason?: string;
}
