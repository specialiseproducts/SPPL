/**
 * Authentication Controller
 *
 * Handles HTTP requests/responses for authentication endpoints.
 */

import * as AuthService from '../services/auth.service.js';
import * as PasswordResetService from '../services/passwordReset.service.js';
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
    const { newPassword, confirmPassword } = req.body || {};
    const employeeCode = String(req.user?.employeeCode || '').trim();
    if (!employeeCode) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const result = await AuthService.changePassword({
      employeeCode,
      newPassword,
      confirmPassword,
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

/**
 * Request / resend forgot-password OTP
 * POST /api/auth/forgot-password/request-otp
 * Public — no auth token required.
 */
export const requestPasswordResetOtp = async (req, res, next) => {
  try {
    const result = await PasswordResetService.requestPasswordResetOtp(req.body || {});
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    log.error('requestPasswordResetOtp controller error:', error?.message || error);
    next(error);
  }
};

/**
 * Verify forgot-password OTP and receive short-lived resetToken
 * POST /api/auth/forgot-password/verify-otp
 * Public — no auth token required.
 */
export const verifyPasswordResetOtp = async (req, res, next) => {
  try {
    const result = await PasswordResetService.verifyPasswordResetOtp(req.body || {});
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    log.error('verifyPasswordResetOtp controller error:', error?.message || error);
    next(error);
  }
};

/**
 * Set a new password after successful OTP verification
 * POST /api/auth/forgot-password/reset-password
 * Public — requires resetToken from verify-otp (not the admin reset-password route).
 */
export const forgotPasswordResetPassword = async (req, res, next) => {
  try {
    const result = await PasswordResetService.resetPasswordWithVerifiedToken(req.body || {});
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    log.error('forgotPasswordResetPassword controller error:', error?.message || error);
    next(error);
  }
};


