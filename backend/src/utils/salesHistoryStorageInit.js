import { ensureSalesHistoryStorage } from './ensureSalesHistoryStorage.js';
import log from './logger.js';

export function initSalesHistoryStorageOnStartup() {
  ensureSalesHistoryStorage({
    log: (msg) => log.info(msg),
  }).catch((err) => {
    log.error('SalesHistory storage init failed (non-fatal)', err?.message || err);
  });
}
