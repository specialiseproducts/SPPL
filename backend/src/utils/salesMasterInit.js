/**
 * One-time sales master seeding — not on per-request hot paths.
 * Safe to call from startup and before first sales master/rates read.
 */

import * as SalesMasterDataModel from '../models/SalesMasterData.js';
import log from './logger.js';

let readyPromise = null;

export function ensureSalesMasterReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const seedResult = await SalesMasterDataModel.seedSalesMasterDataIfEmpty();
        await SalesMasterDataModel.ensureSalesMasterOptionalCategories();
        if (seedResult?.seeded) {
          log.info('Sales master data seeded on first init');
        }
      } catch (err) {
        readyPromise = null;
        throw err;
      }
    })();
  }
  return readyPromise;
}

/** Fire-and-forget startup hook (server boot). */
export function initSalesMasterOnStartup() {
  ensureSalesMasterReady().catch((err) => {
    log.error('Sales master startup init failed:', err?.message || err);
  });
}
