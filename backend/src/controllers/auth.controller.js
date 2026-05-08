/**
 * Authentication Controller
 *
 * Handles HTTP requests/responses for authentication endpoints.
 */

import * as AuthService from '../services/auth.service.js';
import log from '../utils/logger.js';

/**
 * Login endpoint handler
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { employeeCode, password } = req.body;

    if (!employeeCode || !password) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID and password are required',
      });
    }

    const result = await AuthService.login({ employeeCode, password });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error?.statusCode === 401) {
      return res.status(401).json({
        success: false,
        message: 'Invalid employee ID or password',
      });
    }
    log.error('Login controller error:', error);
    next(error);
  }
};

/**
 * Current logged-in profile
 * GET /api/auth/me
 */
export const me = async (req, res, next) => {
  try {
    const result = await AuthService.getMe(req.user?.employeeCode);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('/me controller error:', error);
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (!newPassword || newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password confirmation mismatch' });
    }
    const result = await AuthService.changePassword({
      employeeCode: req.user?.employeeCode,
      currentPassword,
      newPassword,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { employeeCode } = req.body || {};
    const result = await AuthService.resetPasswordByPrivilegedUser({
      actor: req.user,
      targetEmployeeCode: employeeCode,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};


