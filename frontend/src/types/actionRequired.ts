import type { ReactNode } from 'react';
import type { PortalNotification } from '../types/notifications';

/** Stored on notification.metadata.actionKind */
export const ACTION_KINDS = {
  QUOTATION_EDIT_REQUEST: 'quotation_edit_request',
} as const;

export type ActionKind = (typeof ACTION_KINDS)[keyof typeof ACTION_KINDS] | string;

export type ActionOutcome = 'Pending' | 'Completed' | 'Rejected' | string;

export interface ActionRequiredContext {
  notification: PortalNotification;
  actorEmployeeCode: string;
  onModuleSelect: (moduleId: string) => void;
  invalidate: () => void;
}

/**
 * Module-supplied Action Required definition.
 * Future modules register one of these without redesigning the Notification Center.
 */
export interface ActionRequiredDefinition {
  kind: ActionKind;
  /** Card title (can ignore notification.title) */
  getTitle: (notification: PortalNotification) => string;
  /** Whether this definition applies */
  matches: (notification: PortalNotification) => boolean;
  /** Detail rows / body */
  renderDetails: (notification: PortalNotification) => ReactNode;
  /** True when Approve/Reject should be enabled */
  canAct: (notification: PortalNotification, actorEmployeeCode: string) => boolean;
  /** Already processed elsewhere */
  isProcessed: (notification: PortalNotification) => boolean;
  approve: (ctx: ActionRequiredContext) => Promise<void>;
  reject: (ctx: ActionRequiredContext, remark: string) => Promise<void>;
  view: (ctx: ActionRequiredContext) => void;
}
