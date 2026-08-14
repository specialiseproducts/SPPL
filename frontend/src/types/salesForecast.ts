/** Workflow stored in backend */
export type SalesWorkflowStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'closed';

export interface SalesStatusHistoryEntry {
  previousStatus: string;
  newStatus: string;
  updatedByEmployeeCode: string;
  updatedByName: string;
  updatedOn: string;
  timestamp: string;
  remarks?: string;
}

export interface SalesEditAuditEntry {
  date: string;
  time: string;
  timestamp: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  revision: number;
  user?: string;
  approvedBy?: string;
}

export interface SalesOpportunity {
  forecastId: string;
  workflowStatus: SalesWorkflowStatus;
  quotationRef: string;
  quotationFy: string;
  quotationSerial: number | null;
  quotationMiddle: string;
  principalShortCode: string;
  /** Legacy / derived — mirrors owner for reporting */
  technicalSalesPerson: string;
  quotationDate: string;
  decisionExpectedBy: string;
  opportunityStatus: string;
  /** Timestamp of last Keep/Change status progress update (reminder timer). */
  lastStatusUpdatedAt?: string;
  statusHistory?: SalesStatusHistoryEntry[];
  /** Approved edit count; defaults to Rev 0. */
  revisionNumber?: number;
  editAuditLog?: SalesEditAuditEntry[];
  customerOrganization: string;
  /** @deprecated Legacy single field; prefer structured contact fields */
  contactPersonDetails: string;
  contactTitle: string;
  contactFullName: string;
  contactAddress: string;
  contactNumber: string;
  contactEmail: string;
  customerSegment: string;
  enquiryType: string;
  applicationDetails: string;
  technicalSpecifications: string;
  competition: string;
  principal: string;
  modelNumber: string;
  productDescription: string;
  currency: string;
  unitPrice: number | null;
  quantity: number | null;
  totalValue: number | null;
  inrValueExclGst: number | null;
  deliveryDays: string;
  warranty: string;
  probabilityLabel: string;
  probabilityPercent: number | null;
  technicalChallenges: string;
  keyDecisionCriteria: string;
  followUpActionsRequired: string;
  remarks: string;
  ownerEmployeeCode: string;
  ownerEmployeeName: string;
  createdByEmployeeCode: string;
  createdByName: string;
  approval_status: string;
  approved_by: string;
  approved_at: string;
  rejected_by: string;
  rejected_at: string;
  approval_comments: string;
  createdAt: string;
  updatedAt: string;
}

export type SalesOpportunityPayload = Partial<SalesOpportunity> & {
  mode?: 'draft' | 'submit';
};

export type ExchangeRatesMap = Record<string, number>;

/** @deprecated use ExchangeRatesMap — kept for components that mirrored the old sales tab type */
export type CurrencyRates = ExchangeRatesMap;

export interface SalesMasterAdminItem {
  sk: string;
  value: string;
  isActive: boolean;
}

export interface SalesPrincipalAdminRow {
  principalName: string;
  shortCode: string;
  isActive: boolean;
  sk: string;
}

export interface SalesPrincipalModelRow {
  modelId: string;
  principalId: string;
  principalName: string;
  modelNumber: string;
  productDescription: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalesOrganizationAdminRow {
  organizationName: string;
  address: string;
  isActive: boolean;
  sk: string;
}

export interface SalesOrganizationPartRow {
  partId: string;
  organizationId: string;
  organizationName: string;
  partNumber: string;
  itemDescription: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type QuotationEditRequestType =
  | 'Price'
  | 'Warranty'
  | 'Decision Expected By'
  | 'Part Number'
  | 'Probability';

export type QuotationEditRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface QuotationEditRequest {
  requestId: string;
  quotationId: string;
  quotationRef: string;
  revisionNumber: number;
  employeeCode: string;
  employeeName: string;
  employeeOfficialEmail: string;
  customerOrganization: string;
  principal: string;
  requestType: QuotationEditRequestType | string;
  oldValues: Record<string, unknown>;
  requestedValues: Record<string, unknown>;
  status: QuotationEditRequestStatus | string;
  adminRemark: string;
  requestedAt: string;
  reviewedAt: string;
  reviewedBy: string;
  reviewedByEmployeeCode: string;
  createdAt: string;
  updatedAt: string;
}
