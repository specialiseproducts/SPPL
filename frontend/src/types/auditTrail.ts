export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'VERIFY'
  | 'EXPORT'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PERMISSION_CHANGE'
  | 'ROLE_CHANGE'
  | 'STATUS_CHANGE'
  | 'WORKFLOW_CHANGE'
  | 'CUSTOM'
  | string;

export interface AuditTrailEntry {
  auditId: string;
  employeeCode: string;
  employeeName: string;
  module: string;
  entityType: string;
  entityId: string;
  entityKey: string;
  action: AuditAction;
  description: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  status: string;
  performedBy: string;
  performedByRole: string;
  performedAt: string;
  metadata: Record<string, unknown>;
  reference: string;
  ipAddress: string | null;
  deviceInfo: string | null;
  browser: string | null;
  sessionId: string | null;
}

export interface AuditTrailListParams {
  module?: string;
  employeeCode?: string;
  action?: string;
  status?: string;
  entityType?: string;
  entityId?: string;
  reference?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
  sort?: string;
}
