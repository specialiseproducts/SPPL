import log from './logger.js';

export function isGsiMissingError(err) {
  const code = err?.code || '';
  const msg = String(err?.message || '');
  return (
    code === 'ValidationException' ||
    code === 'ResourceNotFoundException' ||
    /specified index|Index not found|does not have the specified index/i.test(msg)
  );
}

/** Log once and allow fallback scan during GSI rollout. */
export function warnGsiFallback(context, err) {
  log.warn(`[DynamoDB] GSI query unavailable for ${context}, falling back to scan:`, err?.message || err);
}
