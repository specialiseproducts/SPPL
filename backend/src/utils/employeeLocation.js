/**
 * Resolve employee Location (Office | Factory) for holiday / working-day rules.
 */

import { getEmployeeByCode } from '../models/EmployeeMaster.js';
import { normalizeEmployeeLocation } from '../utils/companyWorkingDays.js';

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getEmployeeLocation(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) return normalizeEmployeeLocation('');

  const cached = cache.get(code);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.location;
  }

  try {
    const employee = await getEmployeeByCode(code);
    const location = normalizeEmployeeLocation(employee?.location);
    cache.set(code, { location, at: Date.now() });
    return location;
  } catch {
    const location = normalizeEmployeeLocation('');
    cache.set(code, { location, at: Date.now() });
    return location;
  }
}

export function clearEmployeeLocationCache() {
  cache.clear();
}
