/** Workflow stored in backend */
export type SalesWorkflowStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

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
