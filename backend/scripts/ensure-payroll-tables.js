#!/usr/bin/env node
/**
 * Provision Payroll DynamoDB tables and missing GSIs (idempotent).
 *
 * - Does NOT recreate existing tables.
 * - Creates a table only if it is missing.
 * - Adds any missing GSIs on existing tables via UpdateTable.
 *
 * Backend expects:
 *   PayrollTeamMappings   → GSI_ManagerCode   (HASH managerCode)
 *   PayrollLeaveRequests  → GSI_EmployeeCode  (HASH employeeCode)
 *
 * Usage: node scripts/ensure-payroll-tables.js
 */

import dotenv from 'dotenv';
import { ensurePayrollStorage } from '../src/utils/ensurePayrollStorage.js';

dotenv.config();

ensurePayrollStorage()
  .then(() => {
    console.log('\nDone. Required indexes:');
    console.log('  PayrollTeamMappings  → GSI_ManagerCode  (HASH managerCode S)');
    console.log('  PayrollLeaveRequests → GSI_EmployeeCode (HASH employeeCode S)');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
