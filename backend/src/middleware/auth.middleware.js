/**
 * Authentication Middleware
 */

import { verifyToken } from '../utils/jwt.js';
import * as UserAccessControlModel from '../models/UserAccessControl.js';
import * as EmployeeModel from '../models/EmployeeMaster.js';
import { getEffectiveRole, hasModuleAccess } from '../utils/accessControl.js';
import {
  assertEmployeeEligibleForAuth,
  EMPLOYEE_EXITED_AUTH_MESSAGE,
  isEmployeeEligibleForAuth,
  revokeAccessControlForEmployee,
} from '../services/employeeOffboarding.service.js';
import log from '../utils/logger.js';

const DEFAULT_ACCESS_CONTROL = {
  globalRole: 'User',
  moduleOverrides: {},
};

export const authenticateToken = async (req, res, next) => {
  try {
    // EventSource cannot set Authorization headers — allow ?token= for SSE only when used.
    const queryToken = String(req.query?.token || req.query?.access_token || '').trim();
    let authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ') && queryToken) {
      authHeader = `Bearer ${queryToken}`;
    }

    if (!authHeader.startsWith('Bearer ')) {
      log.warn('Missing token on protected route:', req.path);
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      log.warn('Empty bearer token on protected route:', req.path);
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const decoded = verifyToken(token);
    const employeeCode = decoded?.employeeCode;

    const [accessControl, employee] = employeeCode
      ? await Promise.all([
          UserAccessControlModel.getByEmployeeCode(employeeCode),
          EmployeeModel.getEmployeeByCode(employeeCode),
        ])
      : [null, null];

    // Soft-deleted or missing master row → reject (do not trust JWT alone).
    if (!employee) {
      log.warn('Token rejected — employee not found or deleted:', employeeCode);
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Date of Exit effective → reject every protected API (even if JWT still valid).
    try {
      assertEmployeeEligibleForAuth(employee);
    } catch (exitErr) {
      // Best-effort: clear stale Access Management while rejecting the session.
      void revokeAccessControlForEmployee(employeeCode, null, {
        reason: 'auth_middleware_exit_effective',
      });
      log.warn('Token rejected — employee exited:', employeeCode);
      return res.status(401).json({
        success: false,
        message: exitErr?.message || EMPLOYEE_EXITED_AUTH_MESSAGE,
        code: 'EMPLOYEE_EXITED',
      });
    }

    req.user = {
      ...decoded,
      firstName: employee?.firstName || '',
      lastName: employee?.lastName || '',
      fullName:
        `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || '',
      dateOfExit: employee?.dateOfExit || employee?.date_of_exit || '',
      accessControl: accessControl || DEFAULT_ACCESS_CONTROL,
      role: accessControl?.globalRole || 'User',
    };
    log.info('Token verified for employee:', employeeCode);
    next();
  } catch (error) {
    log.warn('Invalid token:', error?.message || error);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }
};

// Backward-compatible alias used by existing comments/usages
export const authenticate = authenticateToken;

/**
 * Attach req.user if bearer token exists, but never block the request.
 * Useful for gradual auth rollout while preserving existing open routes.
 */
export const attachUserIfPresent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return next();
    }

    const decoded = verifyToken(token);
    const employeeCode = decoded?.employeeCode;

    const [accessControl, employee] = employeeCode
      ? await Promise.all([
          UserAccessControlModel.getByEmployeeCode(employeeCode),
          EmployeeModel.getEmployeeByCode(employeeCode),
        ])
      : [null, null];

    // Do not attach exited / missing employees on optional auth.
    if (!employee || !isEmployeeEligibleForAuth(employee)) {
      return next();
    }

    req.user = {
      ...decoded,
      firstName: employee?.firstName || '',
      lastName: employee?.lastName || '',
      fullName:
        `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || '',
      dateOfExit: employee?.dateOfExit || employee?.date_of_exit || '',
      accessControl: accessControl || DEFAULT_ACCESS_CONTROL,
      role: accessControl?.globalRole || 'User',
    };
    log.info('Optional token attached for employee:', employeeCode);
  } catch (error) {
    log.warn('Optional token parse failed:', error?.message || error);
    // intentionally swallow to keep behavior backward-compatible
  }

  next();
};

export const authorize = (moduleName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      if (!moduleName) {
        return next();
      }

      const effectiveRole = getEffectiveRole(req.user.accessControl, moduleName);
      req.effectiveRole = effectiveRole;

      if (!hasModuleAccess(req.user.accessControl, moduleName)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
