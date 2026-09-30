#!/usr/bin/env node
/**
 * Populate ExpenseMasterValues TYPE#LOCATION with:
 * 1) Comprehensive Indian city/location seeds
 * 2) Unique existing Expenses location / fromLocation / toLocation values
 *
 * Idempotent — safe to re-run; never deletes existing master rows.
 *
 * Usage: node scripts/seed-expense-location-masters.js
 */

import dotenv from 'dotenv';
import { populateLocationMasterValues } from '../src/models/ExpenseMasterValues.js';
import log from '../src/utils/logger.js';

dotenv.config();

async function main() {
  console.log('Seeding ExpenseMasterValues Location masters…');
  const result = await populateLocationMasterValues();
  console.log('Location master populate complete:');
  console.log(`  Candidates considered : ${result.candidates}`);
  console.log(`  Unique after normalize: ${result.unique}`);
  console.log(`  Newly inserted        : ${result.inserted}`);
  console.log(`  Already present       : ${result.alreadyPresent}`);
  console.log(`  Total Location masters: ${result.totalLocations}`);
}

main().catch((err) => {
  log.error('seed-expense-location-masters failed', { message: err?.message, stack: err?.stack });
  console.error(err);
  process.exit(1);
});
