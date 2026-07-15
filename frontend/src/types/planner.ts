export type PlannerEventStatus =
  | 'Planned'
  | 'Visited'
  | 'Not Visited'
  | 'Quotation Created'
  | 'Rescheduled';

export type PlannerModeOfMeeting = 'Physical Visit' | 'Phone Call' | 'Video Call' | 'Email';

export interface PlannerEvent {
  eventId: string;
  ownerEmployeeCode: string;
  ownerEmployeeName: string;
  visitDate: string;
  organizationId: string;
  organizationName: string;
  organizationAddress: string;
  modeOfMeeting: PlannerModeOfMeeting | string;
  contactTitle: string;
  contactFullName: string;
  contactAddress: string;
  contactNumber: string;
  contactEmail: string;
  purpose: string;
  status: PlannerEventStatus;
  notVisitedReason?: string;
  visitReport?: string;
  parentEventId?: string | null;
  linkedForecastId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlannerOrganizationOption {
  organizationName: string;
  address: string;
  isActive: boolean;
  sk: string;
}

export interface PlannerEventDraft {
  organizationId: string;
  organizationName: string;
  organizationAddress: string;
  modeOfMeeting: PlannerModeOfMeeting | '';
  contactTitle: string;
  contactFullName: string;
  contactAddress: string;
  contactNumber: string;
  contactEmail: string;
  purpose: string;
}

export const PLANNER_MEETING_MODES: PlannerModeOfMeeting[] = [
  'Physical Visit',
  'Phone Call',
  'Video Call',
  'Email',
];

export const EMPTY_PLANNER_EVENT_DRAFT = (): PlannerEventDraft => ({
  organizationId: '',
  organizationName: '',
  organizationAddress: '',
  modeOfMeeting: '',
  contactTitle: '',
  contactFullName: '',
  contactAddress: '',
  contactNumber: '',
  contactEmail: '',
  purpose: '',
});
