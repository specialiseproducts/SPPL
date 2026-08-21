/**
 * Authentication Routes
 *
 * Defines all authentication-related API endpoints.
 */

import express from 'express';
import * as AuthController from '../controllers/auth.controller.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/login', AuthController.login);
router.get('/me', authenticateToken, AuthController.me);
router.post('/change-password', authenticateToken, AuthController.changePassword);
router.post('/reset-password', authenticateToken, authorize('userManagement'), AuthController.resetPassword);

// Forgot-password OTP flow (public). Does not replace admin /reset-password above.
router.post('/forgot-password/request-otp', AuthController.requestPasswordResetOtp);
router.post('/forgot-password/verify-otp', AuthController.verifyPasswordResetOtp);
router.post('/forgot-password/reset-password', AuthController.forgotPasswordResetPassword);

export default router;