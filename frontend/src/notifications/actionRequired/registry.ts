import type { PortalNotification } from '../../types/notifications';
import type { ActionRequiredDefinition } from '../../types/actionRequired';
import { quotationEditRequestAction } from './quotationEditRequestAction';

const REGISTRY: ActionRequiredDefinition[] = [quotationEditRequestAction];

/**
 * Resolve an Action Required definition for a notification.
 * Future modules: push into REGISTRY (or call registerActionRequired).
 */
export function registerActionRequired(definition: ActionRequiredDefinition): void {
  const idx = REGISTRY.findIndex((d) => d.kind === definition.kind);
  if (idx >= 0) REGISTRY[idx] = definition;
  else REGISTRY.push(definition);
}

export function resolveActionRequired(
  notification: PortalNotification,
): ActionRequiredDefinition | null {
  if (String(notification.section || '') !== 'action_required') return null;
  const meta = notification.metadata || {};
  if (meta.actionable === false) return null;
  for (const def of REGISTRY) {
    if (def.matches(notification)) return def;
  }
  return null;
}

export function isActionableNotification(notification: PortalNotification): boolean {
  return Boolean(resolveActionRequired(notification));
}
