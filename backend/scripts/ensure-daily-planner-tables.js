#!/usr/bin/env node
/**
 * Provision Daily Planner DynamoDB tables and missing GSIs (idempotent).
 *
 * - Does NOT recreate existing tables.
 * - Creates a table only if it is missing.
 * - Adds any missing GSIs on existing tables via UpdateTable.
 *
 * Backend expects:
 *   DailyPlannerTasks         → GSI_EmployeeDate     (HASH employeeCode, RANGE date)
 *   DailyPlannerTeamMappings  → GSI_ManagerCode      (HASH managerCode)
 *   DailyPlannerPlanning      → GSI_EmployeePlanning (HASH employeeCode, RANGE recordKey)
 *
 * Usage: node scripts/ensure-daily-planner-tables.js
 */

import dotenv from 'dotenv';
import { ensureDailyPlannerStorage } from '../src/utils/ensureDailyPlannerStorage.js';

dotenv.config();

ensureDailyPlannerStorage()
  .then(() => {
    console.log('\nDone. Required indexes:');
    console.log('  DailyPlannerTasks        → GSI_EmployeeDate (HASH employeeCode S, RANGE date S)');
    console.log('  DailyPlannerTeamMappings → GSI_ManagerCode  (HASH managerCode S)');
    console.log(
      '  DailyPlannerPlanning     → GSI_EmployeePlanning (HASH employeeCode S, RANGE recordKey S)',
    );
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
