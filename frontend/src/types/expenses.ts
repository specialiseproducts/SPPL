export type ExpenseAuditDecision = 'Pending' | 'Approved' | 'Rejected';

export type ExpenseExportStatus = 'Pending Export' | 'Exported' | 'Skipped';

export interface ExpenseDocument {
  documentId?: string;
  fileName: string;
  fileUrl: string;
  uploadedAt?: string;
}

export interface ExpenseRecord {
  expenseId: string;
  expenseHead: string;
  /** Present for new canonical heads; omitted on older DynamoDB items */
  subCategory?: string;
  location: string;
  purpose: string;
  serviceProvider: string;
  billNumber: string;
  date: string;
  amount: number;
  employeeName: string;
  employeeId?: string;
  employeeEmail?: string;
  monthYear: string;
  createdAt: string;
  updatedAt: string;
  fromLocation?: string;
  toLocation?: string;
  returnType?: string;
  kilometers?: number;
  stayDateFrom?: string;
  stayDateTo?: string;
  /** Yes = supporting file expected/present; No = none */
  supportingDocument?: 'Yes' | 'No';
  fuelType?: string;
  documents?: ExpenseDocument[];
  selectedFile?: File;
  /** Audit decision from admin review; mirrors approval_status on the server */
  auditStatus?: ExpenseAuditDecision;
  /** Admin rejection reason shown when employee edits a rejected expense */
  auditReason?: string;
  /** Export tracking — set on approve / after Export Data actions */
  exportStatus?: ExpenseExportStatus;
  exportedAt?: string;
  exportBatch?: string;
  exportedMonth?: string;
  exportedYear?: string;
  /** Travel-only outstation allowance flow */
  outStation?: 'Yes' | 'No';
  arrivalDate?: string;
  arrivalTime?: string;
  departureDate?: string;
  departureTime?: string;
  durationHours?: number;
  durationDays?: number;
  travelAllowanceAmount?: number | null;
}

export type ExpenseEditRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export type ExpenseEditRequestType =
  | 'Amount'
  | 'Date'
  | 'Location'
  | 'Purpose'
  | 'Service Provider'
  | 'Bill Number';

export interface ExpenseEditRequest {
  requestId: string;
  expenseId: string;
  expenseRef: string;
  revisionNumber: number;
  employeeCode: string;
  employeeName: string;
  employeeOfficialEmail: string;
  requestType: ExpenseEditRequestType | string;
  oldValues: Record<string, unknown>;
  requestedValues: Record<string, unknown>;
  status: ExpenseEditRequestStatus | string;
  adminRemark: string;
  requestedAt: string;
  reviewedAt: string;
  reviewedBy: string;
  reviewedByEmployeeCode: string;
  createdAt: string;
  updatedAt: string;
}
